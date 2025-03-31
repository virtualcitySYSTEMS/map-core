import type { LiteralValue } from 'ol/expr/expression.js';
import {
  BooleanType,
  newParsingContext,
  StringType,
  NoneType,
} from 'ol/expr/expression.js';
import { buildExpression, newEvaluationContext } from 'ol/expr/cpu.js';
import { is } from '@vcsuite/check';

type Block = {
  opening: RegExpExecArray;
  closing: RegExpExecArray;
};

type ConditionalBlock = Block & {
  elseStatement?: RegExpExecArray;
  elseIfs: RegExpExecArray[];
};

/**
 * @param {string} expressionString
 * @param {Record<string, unknown>} data
 * @param {number} evaluationType
 * @returns {*}
 */
function evaluateExpression(
  expressionString: string,
  data: Record<string, unknown>,
  evaluationType: number,
): LiteralValue {
  const parsed = expressionString.startsWith('[')
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (JSON.parse(expressionString) as any[])
    : [
        'get',
        ...expressionString
          .replace(/\[([^\]]+)]/g, '.$1')
          .split('.')
          .filter((f) => f),
      ];

  const compiledExpression = buildExpression(
    parsed,
    evaluationType,
    newParsingContext(),
  );
  const evaluationContext = newEvaluationContext();
  evaluationContext.properties = data;
  try {
    return compiledExpression(evaluationContext);
  } catch (_e) {
    if (evaluationType === BooleanType) {
      return false;
    }
    return '';
  }
}

/**
 * Replaces template strings by provided attributes, e.g. {{myAttribute}}
 */
function replaceAttributes(
  template: string,
  data: Record<string, unknown>,
  translate: (key: string) => string,
): string {
  const pattern = /\{\{([^}]+)}}/g;
  return template.replace(pattern, (_p, value) => {
    const trimmedValue = (value as string).trim();
    if (trimmedValue.startsWith('#t ')) {
      const valueWithoutT = trimmedValue.slice(3).trim();
      return translate(
        (evaluateExpression(valueWithoutT, data, StringType) as string) ||
          valueWithoutT,
      );
    }
    return (evaluateExpression(trimmedValue, data, StringType) as string) ?? '';
  });
}

function regexHits(regexp: RegExp, string: string): RegExpExecArray[] {
  const hits = [];
  let hit;

  while ((hit = regexp.exec(string))) {
    hits.push(hit);
  }

  return hits;
}

function findTopLevelBlock(
  openings: RegExpExecArray[],
  closings: RegExpExecArray[],
  accepted: (b: Block) => void,
  rejected: (b: Block) => void,
): void {
  const localOpenings = openings.slice();
  const localClosings = closings.slice();
  while (localOpenings.length > 0) {
    let matchingClosing;
    let matchingOpening;
    while (!matchingClosing && localClosings.length > 0) {
      const currentClosing = localClosings.shift()!;
      const openingDistances = localOpenings.map(
        (o) => currentClosing.index - o.index,
      );
      const minDistance = openingDistances.reduce((min, currentDistance) => {
        if (currentDistance > 0 && currentDistance < min) {
          return currentDistance;
        }
        return min;
      }, Infinity);
      const matchingOpeningIndex = openingDistances.indexOf(minDistance);
      matchingOpening = localOpenings[matchingOpeningIndex];

      if (matchingOpeningIndex === 0) {
        matchingClosing = currentClosing;
      } else {
        rejected({ opening: matchingOpening, closing: currentClosing });
      }
      localOpenings.splice(matchingOpeningIndex, 1);
    }

    if (matchingOpening && matchingClosing) {
      accepted({ opening: matchingOpening, closing: matchingClosing });
    }
  }
}

function tagWithinBlock(tag: RegExpExecArray, block: Block): boolean {
  return tag.index > block.opening.index && tag.index < block.closing.index;
}

function getForEachBlocks(template: string): Block[] {
  const forEachBlocks = [] as Block[];
  const forEachOpenings = regexHits(
    /\s*{{#each\s\(([^.)]+)\)\sin\s([^}]+)}}\s*/g,
    template,
  );
  const forEachClosings = regexHits(/\s*{{\/each}}\s*/g, template);

  if (forEachClosings.length > forEachOpenings.length) {
    throw new Error(
      'Template failed to render, missing opening tag for each statements',
    );
  } else if (forEachClosings.length < forEachOpenings.length) {
    throw new Error(
      'Template failed to render, missing closing tag for each statements',
    );
  }

  findTopLevelBlock(
    forEachOpenings,
    forEachClosings,
    (block) => {
      forEachBlocks.push(block);
    },
    () => {},
  );

  return forEachBlocks;
}

function getConditionalBlocks(
  template: string,
  forEachBlocks: Block[],
): ConditionalBlock[] {
  const conditionalBlocks = [] as ConditionalBlock[];
  let conditionalOpenings = regexHits(/\s*{{#if\s([^}]*)}}\s*/g, template);
  let conditionalClosings = regexHits(/\s*{{\/if}}\s*/g, template);
  let elseIfs = regexHits(/\s*{{elseif\s([^}]*)}}\s*/g, template);
  let elses = regexHits(/\s*{{else}}\s*/g, template);

  const withinForEachBlock = (tag: RegExpExecArray): Block | undefined =>
    forEachBlocks.find((block) => tagWithinBlock(tag, block));

  // conditionals within a for each blocks are rendered with the for each block, ignore
  conditionalOpenings = conditionalOpenings.filter(
    (t) => !withinForEachBlock(t),
  );
  conditionalClosings = conditionalClosings.filter(
    (t) => !withinForEachBlock(t),
  );

  if (conditionalClosings.length > conditionalOpenings.length) {
    throw new Error(
      'Template failed to render, missing closing tag for if statements',
    );
  } else if (conditionalClosings.length < conditionalOpenings.length) {
    throw new Error(
      'Template failed to render, missing opening tag for if statements',
    );
  }

  const filterElseIfElse = (block: Block): void => {
    elseIfs = elseIfs.filter((tag) => !tagWithinBlock(tag, block));
    elses = elses.filter((tag) => !tagWithinBlock(tag, block));
  };

  findTopLevelBlock(
    conditionalOpenings,
    conditionalClosings,
    (block) => {
      const blockElseIfs = elseIfs.filter((tag) => tagWithinBlock(tag, block));
      const elseStatement = elses.find((tag) => tagWithinBlock(tag, block));
      if (
        elseStatement &&
        blockElseIfs.length > 0 &&
        elseStatement.index < blockElseIfs.at(-1)!.index
      ) {
        throw new Error('{{else}} must be the last entry in a block');
      }
      conditionalBlocks.push({
        ...block,
        elseStatement,
        elseIfs: blockElseIfs,
      });
    },
    (block) => {
      filterElseIfElse(block);
    },
  );

  return conditionalBlocks;
}

function shouldRemoveWhiteSpace(openingTag: string): boolean {
  return /\n[\t ]*\{/.test(openingTag) && /}[\t ]*\n/.test(openingTag);
}

/**
 * This will extract the block to render separately. This will depend on the white space handling. If the
 * opening is placed on its own line, whitespace after the opening and before the closing blocks will be removed
 * from the sub template, up to the first new line feed.
 */
function getSubTemplateForBlock(template: string, block: Block): string {
  const removeWhiteSpace = shouldRemoveWhiteSpace(block.opening[0]);
  let startIndex = block.opening.index + block.opening[0].indexOf('}') + 2;
  let endIndex = block.closing.index + block.closing[0].indexOf('{');
  if (removeWhiteSpace) {
    startIndex += (/}[\t ]*\n/.exec(block.opening[0])?.[0].length ?? 1) - 1;
    endIndex -= (/\n[\t ]*\{/.exec(block.closing[0])?.[0].length ?? 2) - 2;
  }

  return template.substring(startIndex, endIndex);
}

/**
 * This will replace a block with a previously extracted blocks rendered template.
 * This will depend on the white space handling. If the opening is placed on its own line,
 * whitespace before the opening and after the closing blocks will be removed up to the first new line feed,
 * from the new template string all together.
 */
function replaceBlock(
  template: string,
  block: Block,
  replacement: string,
): string {
  const removeWhiteSpace = shouldRemoveWhiteSpace(block.opening[0]);
  let startIndex = block.opening.index + block.opening[0].indexOf('{');
  let endIndex = block.closing.index + block.closing[0].indexOf('}') + 2;
  if (removeWhiteSpace) {
    startIndex -= (/\n[\t ]*\{/.exec(block.opening[0])?.[0].length ?? 2) - 2;
    endIndex += (/}[\t ]*\n/.exec(block.closing[0])?.[0].length ?? 1) - 1;
  }

  return `${template.substring(
    0,
    startIndex,
  )}${replacement}${template.substring(endIndex)}`;
}

/**
 * Replaces {{#if }} blocks
 */
function expandConditionalsAndLoops(
  template: string,
  data: Record<string, unknown>,
  translate: (key: string) => string,
): string {
  let renderedTemplate = template;
  const forEachBlocks = getForEachBlocks(template);

  getConditionalBlocks(template, forEachBlocks)
    .reverse()
    .forEach(
      /** @param {ConditionalBlock} block */ (block) => {
        const partialBlocks = [block.opening];
        if (block.elseIfs) {
          partialBlocks.push(...block.elseIfs);
        }
        let trueStatementIndex = partialBlocks.findIndex((s) =>
          evaluateExpression(s[1].trim(), data, BooleanType),
        );
        if (trueStatementIndex === -1 && block.elseStatement) {
          trueStatementIndex = partialBlocks.length;
        }

        let renderedBlock = '';
        if (trueStatementIndex > -1) {
          if (block.elseStatement) {
            partialBlocks.push(block.elseStatement);
          }
          partialBlocks.push(block.closing);

          const blockTemplate = getSubTemplateForBlock(template, {
            opening: partialBlocks[trueStatementIndex],
            closing: partialBlocks[trueStatementIndex + 1],
          });

          renderedBlock = expandConditionalsAndLoops(
            blockTemplate,
            data,
            translate,
          );
        }

        renderedTemplate = replaceBlock(renderedTemplate, block, renderedBlock);
      },
    );

  // only iterate over blocks not removed by conditionals
  getForEachBlocks(renderedTemplate)
    .reverse()
    .forEach((block) => {
      const obj = evaluateExpression(block.opening[2].trim(), data, NoneType);
      let keyValuePairs;
      if (is(obj, Object)) {
        keyValuePairs = Object.entries(obj);
      } else if (Array.isArray(obj)) {
        keyValuePairs = obj.entries();
      }
      const renderedBlocks = [];
      if (keyValuePairs) {
        let index = 0;
        const [valueName, keyName, indexName] = block.opening[1]
          .split(',')
          .map((e) => e.trim())
          .slice(0, 3);

        const blockTemplate = getSubTemplateForBlock(renderedTemplate, block);

        for (const args of keyValuePairs) {
          const forEachData = structuredClone(data);
          forEachData[valueName] = args[1];
          if (keyName) {
            forEachData[keyName] = args[0];
          }
          if (indexName) {
            forEachData[indexName] = index;
          }
          const currentBlock = expandConditionalsAndLoops(
            blockTemplate,
            forEachData,
            translate,
          );
          renderedBlocks.push(
            replaceAttributes(currentBlock, forEachData, translate),
          );
          index += 1;
        }
      }

      renderedTemplate = replaceBlock(
        renderedTemplate,
        block,
        renderedBlocks.join(''),
      );
    });

  return renderedTemplate;
}

function defaultTranslate(key: string): string {
  return key;
}

/**
 * Renders a template in these steps. See {@link documentation/vcsTemplate.md} for more information.
 * 1. expand conditional blocks. this will remove any blocks that do not match their expressions and choose from if / elseif / else block which of them to render
 * 2. expand iterations. this will create new templates for each iteration and re-run the rendering for those blocks
 * 3. render attributes. this will add the attributes to all the blocks not within each blocks
 */

export function renderTemplate(
  template: string | string[],
  data: Record<string, unknown>,
  translate: (key: string) => string = defaultTranslate,
): string {
  const templateString = Array.isArray(template)
    ? template.join('\n')
    : template;
  const conditionalTemplate = expandConditionalsAndLoops(
    templateString,
    data,
    translate,
  );
  return replaceAttributes(conditionalTemplate, data, translate);
}
