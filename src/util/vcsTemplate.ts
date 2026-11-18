import type { EncodedExpression } from 'ol/expr/expression.js';
import {
  BooleanType,
  newParsingContext,
  StringType,
  NoneType,
} from 'ol/expr/expression.js';
import { buildExpression, newEvaluationContext } from 'ol/expr/cpu.js';
import { getLogger } from '@vcsuite/logger';
import { getCaughtError } from './error.js';

type Block = {
  opening: RegExpExecArray;
  closing: RegExpExecArray;
};

type ConditionalBlock = Block & {
  elseStatement?: RegExpExecArray;
  elseIfs: RegExpExecArray[];
};

type Translate = (key: string) => string;

/**
 * The data of a template: an object or an array, e.g. ['a', 'b'] for {{0}}-{{1}}.
 */
export type TemplateData = Record<string, unknown> | unknown[];

type Evaluate = (data: TemplateData) => unknown;

/**
 * A part of a parsed template: either text or a placeholder to render.
 */
type TemplatePart =
  string | ((data: TemplateData, translate: Translate) => string);

export type TemplateOptions = {
  /**
   * The opening and closing delimiter of placeholders and blocks, e.g. `['{', '}']` for `{foo}`.
   * Defaults to `['{{', '}}']`. Delimiters must not be empty and must not start or end with whitespace.
   */
  delimiters?: [open: string, close: string];
  /**
   * Throw on invalid template content, such as invalid ol style expressions or unbalanced blocks.
   * By default, invalid content is rendered as text and a warning is logged.
   * Templates without blocks are checked when compiled. Templates with blocks are checked when rendered,
   * and only the content the data renders: invalid content within a branch that isn't rendered does not throw.
   */
  strict?: boolean;
  /**
   * Converts the value of a placeholder to the rendered text, e.g. to render objects as JSON.
   * Only applies to rendered values: property keys, conditions and iterations use the values as is.
   * Defaults to String, rendering null and undefined as an empty string. Errors are caught and rendered as an empty string.
   */
  formatValue?: (value: unknown) => string;
};

/**
 * A compiled template. Renders the template with the given data.
 */
export type CompiledTemplate = (
  data: TemplateData,
  translate?: (key: string) => string,
) => string;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The block tags, the single definition of their grammar. The content of a tag (e.g. #if foo of {{#if foo}}) starts
 * with the keyword, followed by the rest. Expressions are captured lazily and trimmed when evaluated.
 * The block patterns, the detection of templates with blocks and blockTagKeyword are created from these definitions.
 */
const blockTagDefinitions = {
  eachOpening: {
    keyword: '#each',
    rest: '\\s+\\(([^.)]+)\\)\\s+in\\s+([\\s\\S]+?)',
  },
  eachClosing: { keyword: '/each', rest: '' },
  ifOpening: { keyword: '#if', rest: '\\s([\\s\\S]*?)' },
  ifClosing: { keyword: '/if', rest: '' },
  elseIf: { keyword: 'elseif', rest: '\\s([\\s\\S]*?)' },
  else: { keyword: 'else', rest: '' },
} as const;

type BlockTag = keyof typeof blockTagDefinitions;

/**
 * The block tags found in a template, see findBlockTags
 */
type BlockTags = Record<BlockTag, RegExpExecArray[]>;

/**
 * The tags making a template a template with blocks. Templates with only elseif or else tags have no blocks.
 */
const blockDelimitingTags: BlockTag[] = [
  'eachOpening',
  'eachClosing',
  'ifOpening',
  'ifClosing',
];

/**
 * Tests, if the trimmed content of a placeholder is a block tag, e.g. #if foo of {{ #if foo }}. Block tags are only
 * valid within blocks. Only the keyword is tested, unlike the block patterns: malformed block tags
 * (e.g. {{#if}} or {{#each foo}}) and else followed by whitespace (e.g. {{else if foo}}, a misspelled elseif)
 * are reported as invalid block tags, instead of being rendered as properties.
 */
const blockTagKeyword = new RegExp(
  `^(?:${Object.values(blockTagDefinitions)
    .map(({ keyword }) => escapeRegExp(keyword))
    .join('|')})(?:\\s|$)`,
);

/**
 * Maximum number of compiled values cached per template, see TemplateContext.compile
 */
const maxCompiledValues = 256;

/**
 * The delimiters, error handling and caches of a compiled template.
 */
type TemplateContext = {
  open: string;
  close: string;
  strict: boolean;
  /**
   * The global regular expressions of the block tags for the delimiters of the template, including the whitespace
   * before and after a tag (see getTagBounds). Use with regexHits, which resets them.
   */
  blockRegExps: Record<BlockTag, RegExp>;
  /**
   * Compiles a value (see compileValue). Compiled values are cached, so the expressions of blocks are not compiled on
   * each rendering. Throws, if the value is invalid: invalid values are not cached.
   */
  compile(value: string, evaluationType: number): Evaluate;
  /**
   * Converts the value of a placeholder to the rendered text, see TemplateOptions.formatValue. Never throws.
   */
  formatValue(value: unknown): string;
  /**
   * Handles invalid template content: throws in strict mode, otherwise logs a warning (once per template)
   * and returns the content to be rendered as text. An empty raw content refers to the blocks of the template.
   */
  invalid(raw: string, error: unknown): string;
};

/**
 * Returns the index of the quote closing the string literal opened at the given index or -1.
 * Within a literal, quotes and backslashes are escaped by a backslash.
 */
function findLiteralEnd(value: string, quoteIndex: number): number {
  let i = quoteIndex + 1;
  while (i < value.length) {
    if (value[i] === '\\' && (value[i + 1] === "'" || value[i + 1] === '\\')) {
      i += 2;
    } else if (value[i] === "'") {
      return i;
    } else {
      i += 1;
    }
  }
  return -1;
}

/**
 * Parses a string literal, e.g. 'foo'. Returns null, if the value is not a valid literal.
 */
function parseLiteral(value: string): string | null {
  if (value[0] !== "'" || findLiteralEnd(value, 0) !== value.length - 1) {
    return null;
  }
  return value.slice(1, -1).replace(/\\(['\\])/g, '$1');
}

/**
 * Returns the property of a value. Errors thrown by getters are caught, undefined is returned then.
 */
function getProperty(value: unknown, key: string): unknown {
  try {
    return (value as Record<string, unknown>)[key];
  } catch (_e) {
    return undefined;
  }
}

/**
 * The source of the Object constructor, to detect plain objects of other realms (e.g. iframes)
 */
const objectConstructorSource = Function.prototype.toString.call(Object);

/**
 * Tests, if a value is a plain object, which can be iterated with an each block: an object with Object.prototype
 * (of any realm) or without prototype. Values are not converted to strings, so own toString properties do not matter.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  try {
    const prototype = Object.getPrototypeOf(value) as object | null;
    if (prototype === null || prototype === Object.prototype) {
      return true;
    }
    // the Object.prototype of another realm has no prototype and the Object constructor of that realm
    const constructor = Object.hasOwn(prototype, 'constructor')
      ? (prototype as { constructor: unknown }).constructor
      : undefined;
    return (
      Object.getPrototypeOf(prototype) === null &&
      typeof constructor === 'function' &&
      Function.prototype.toString.call(constructor) === objectConstructorSource
    );
  } catch (_e) {
    return false;
  }
}

/**
 * Creates the data of an iteration of an each block. The data is inherited, not copied: its properties are not
 * evaluated and inherited properties (e.g. getters of class instances) are resolved as outside of the block.
 * The loop variables are own properties, shadowing properties of the data with the same name.
 */
function createLoopData(
  data: TemplateData,
  loopVariables: Record<string, unknown>,
): TemplateData {
  const prototype = Object(data) === data ? data : null;
  // defined, not assigned, so a loop variable named like a setter (e.g. __proto__) is a property as well
  const descriptors = Object.fromEntries(
    Object.entries(loopVariables).map(([key, value]) => [
      key,
      { value, enumerable: true, writable: true, configurable: true },
    ]),
  );
  return Object.create(prototype, descriptors) as TemplateData;
}

/**
 * Compiles a property key shorthand, e.g. foo.bar[0]. The key is resolved like the ol style expression
 * ["get", "foo", "bar", "0"]: properties are accessed as is, including inherited properties such as getters
 * of class instances. Errors thrown by getters are caught, the key is missing then.
 */
function compileKey(key: string): Evaluate {
  const segments = key
    .replace(/\[([^\]]+)]/g, '.$1')
    .split('.')
    .filter((f) => f);

  return (data) => {
    if (segments.length === 0) {
      return undefined;
    }
    let current: unknown = data;
    for (const segment of segments) {
      if (current == null) {
        return undefined;
      }
      current = getProperty(current, segment);
    }
    return current;
  };
}

/**
 * Compiles an ol style expression, e.g. ["get", "foo"]. Throws, if the expression is invalid.
 * Errors on evaluation are caught.
 */
function compileOlExpression(
  expression: string,
  evaluationType: number,
): Evaluate {
  const compiledExpression = buildExpression(
    JSON.parse(expression) as EncodedExpression,
    evaluationType,
    newParsingContext(),
  );

  return (data) => {
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
  };
}

/**
 * Compiles a value of a placeholder or a block: a string literal ('foo'), an ol style expression (["get", "foo"])
 * or a property key shorthand (foo.bar[0]). Throws, if a literal or an ol style expression is invalid.
 */
function compileValue(value: string, evaluationType: number): Evaluate {
  if (value.startsWith("'")) {
    const literal = parseLiteral(value);
    if (literal == null) {
      throw new Error('Invalid string literal');
    }
    return () => literal;
  }
  if (value.startsWith('[')) {
    return compileOlExpression(value, evaluationType);
  }
  return compileKey(value);
}

/**
 * Evaluates the expression of a block. Throws, if the expression is invalid.
 */
function evaluateExpression(
  expressionString: string,
  data: TemplateData,
  evaluationType: number,
  context: TemplateContext,
): unknown {
  return context.compile(expressionString, evaluationType)(data);
}

/**
 * Converts a value to the rendered text. null and undefined are rendered as an empty string, as well as values
 * which cannot be converted to a string, e.g. objects without prototype (Object.create(null)).
 */
function toText(value: unknown): string {
  try {
    // objects are rendered with their toString, e.g. [object Object] for plain objects
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    return String(value ?? '');
  } catch (_e) {
    return '';
  }
}

/**
 * Compiles the content of a placeholder, e.g. myAttribute of {{myAttribute}}.
 * Empty placeholders are rendered as text. Block tags are invalid content, since they are only valid within blocks.
 * With keepBlockTags, block tags are rendered as text without being reported, e.g. if the blocks of a template are
 * not expanded, which is already reported.
 */
function compilePlaceholder(
  content: string,
  raw: string,
  context: TemplateContext,
  keepBlockTags: boolean,
): TemplatePart {
  const value = content.trim();
  if (!value) {
    return raw;
  }
  try {
    if (blockTagKeyword.test(value)) {
      if (keepBlockTags) {
        return raw;
      }
      throw new Error(
        /^else\s/.test(value)
          ? 'Invalid block tag, use elseif for else if'
          : 'Block tag without a matching block',
      );
    }
    const translateDirective = /^#t\s+/.exec(value);
    if (translateDirective) {
      const key = value.slice(translateDirective[0].length);
      const evaluate = context.compile(key, StringType);
      return (data, translate) => translate(toText(evaluate(data)) || key);
    }
    const evaluate = context.compile(value, StringType);
    return (data) => context.formatValue(evaluate(data));
  } catch (e) {
    return context.invalid(raw, e);
  }
}

function skipWhitespace(value: string, index: number): number {
  let i = index;
  while (i < value.length && /\s/.test(value[i])) {
    i += 1;
  }
  return i;
}

/**
 * Finds the closing delimiter of a placeholder, whose content starts at the given index. Returns its index
 * (end, -1 if the placeholder is not closed) and whether the content is a string literal. A string literal is
 * skipped, so it may contain the delimiters, e.g. {'}'}.
 */
function findPlaceholderEnd(
  template: string,
  contentStart: number,
  close: string,
): { end: number; literal: boolean } {
  let i = skipWhitespace(template, contentStart);
  const translateDirective = /#t\s+/y;
  translateDirective.lastIndex = i;
  if (translateDirective.test(template)) {
    i = translateDirective.lastIndex;
  }
  if (template[i] === "'") {
    const literalEnd = findLiteralEnd(template, i);
    if (literalEnd > -1) {
      const end = skipWhitespace(template, literalEnd + 1);
      if (template.startsWith(close, end)) {
        return { end, literal: true };
      }
    }
  }
  return { end: template.indexOf(close, contentStart), literal: false };
}

/**
 * The position of a placeholder within a template.
 */
type PlaceholderSpan = {
  /**
   * Index of the opening delimiter
   */
  start: number;
  contentStart: number;
  /**
   * Index of the closing delimiter
   */
  contentEnd: number;
  /**
   * Index after the closing delimiter
   */
  end: number;
  /**
   * The content is a string literal (with or without #t), which may contain the delimiters
   */
  literal: boolean;
};

/**
 * Finds the placeholders of a template, e.g. {{myAttribute}}. If a placeholder contains an opening delimiter,
 * the inner placeholder is found and the outer opening delimiter is text. Unclosed placeholders are text.
 */
function scanPlaceholders(
  template: string,
  context: TemplateContext,
): PlaceholderSpan[] {
  const { open, close } = context;
  const spans: PlaceholderSpan[] = [];
  let start = template.indexOf(open);
  while (start > -1) {
    const contentStart = start + open.length;
    const { end: contentEnd, literal } = findPlaceholderEnd(
      template,
      contentStart,
      close,
    );
    if (contentEnd === -1) {
      break;
    }
    const innerStart = literal ? -1 : template.indexOf(open, contentStart);
    if (innerStart > -1 && innerStart < contentEnd) {
      start = innerStart;
    } else {
      const end = contentEnd + close.length;
      spans.push({ start, contentStart, contentEnd, end, literal });
      start = template.indexOf(open, end);
    }
  }
  return spans;
}

/**
 * Parses the placeholders of a template (see scanPlaceholders).
 * With keepBlockTags, block tags are kept as text without being reported (see compilePlaceholder).
 */
function parsePlaceholders(
  template: string,
  context: TemplateContext,
  keepBlockTags = false,
): TemplatePart[] {
  const parts: TemplatePart[] = [];
  let text = '';
  let index = 0;
  for (const span of scanPlaceholders(template, context)) {
    text += template.slice(index, span.start);
    const part = compilePlaceholder(
      template.slice(span.contentStart, span.contentEnd),
      template.slice(span.start, span.end),
      context,
      keepBlockTags,
    );
    if (typeof part === 'string') {
      text += part;
    } else {
      if (text) {
        parts.push(text);
        text = '';
      }
      parts.push(part);
    }
    index = span.end;
  }
  text += template.slice(index);
  if (text) {
    parts.push(text);
  }
  return parts;
}

function renderParts(
  parts: TemplatePart[],
  data: TemplateData,
  translate: Translate,
): string {
  return parts
    .map((part) => (typeof part === 'string' ? part : part(data, translate)))
    .join('');
}

/**
 * Replaces template strings by provided attributes, e.g. {{myAttribute}}
 */
function replaceAttributes(
  template: string,
  data: TemplateData,
  translate: Translate,
  context: TemplateContext,
): string {
  return renderParts(parsePlaceholders(template, context), data, translate);
}

/**
 * Returns all matches of a global regular expression. Resets the regular expression, so it can be reused.
 */
function regexHits(regexp: RegExp, string: string): RegExpExecArray[] {
  const hits = [];
  let hit;

  regexp.lastIndex = 0;
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

function getForEachBlocks(tags: BlockTags): Block[] {
  const forEachBlocks = [] as Block[];
  const forEachOpenings = tags.eachOpening;
  const forEachClosings = tags.eachClosing;

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
  tags: BlockTags,
  forEachBlocks: Block[],
  context: TemplateContext,
): ConditionalBlock[] {
  const conditionalBlocks = [] as ConditionalBlock[];

  const outsideForEachBlocks = (tag: RegExpExecArray): boolean =>
    !forEachBlocks.some((block) => tagWithinBlock(tag, block));

  // conditionals within for each blocks, including their elseif and else tags, are rendered with the for each block
  const conditionalOpenings = tags.ifOpening.filter(outsideForEachBlocks);
  const conditionalClosings = tags.ifClosing.filter(outsideForEachBlocks);
  let elseIfs = tags.elseIf.filter(outsideForEachBlocks);
  let elses = tags.else.filter(outsideForEachBlocks);

  if (conditionalClosings.length > conditionalOpenings.length) {
    throw new Error(
      'Template failed to render, missing opening tag for if statements',
    );
  } else if (conditionalClosings.length < conditionalOpenings.length) {
    throw new Error(
      'Template failed to render, missing closing tag for if statements',
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
        throw new Error(
          `${context.open}else${context.close} must be the last entry in a block`,
        );
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

/**
 * The position of a block tag within the template and the whitespace matched before and after it.
 */
type TagBounds = {
  start: number;
  end: number;
  leading: string;
  trailing: string;
};

function getTagBounds(tag: RegExpExecArray): TagBounds {
  const value = tag[0];
  const leadingLength = value.length - value.trimStart().length;
  const tagLength = value.trim().length;
  return {
    start: tag.index + leadingLength,
    end: tag.index + leadingLength + tagLength,
    leading: value.slice(0, leadingLength),
    trailing: value.slice(leadingLength + tagLength),
  };
}

/**
 * Finds the block tags of a template. Block tags within string literals (e.g. {{ '{{#if foo}}' }}) are text.
 */
function findBlockTags(template: string, context: TemplateContext): BlockTags {
  const literals = scanPlaceholders(template, context).filter(
    (span) => span.literal,
  );
  const outsideLiterals = (tag: RegExpExecArray): boolean => {
    const { start } = getTagBounds(tag);
    return !literals.some((span) => start >= span.start && start < span.end);
  };
  return Object.fromEntries(
    Object.entries(context.blockRegExps).map(([tag, regexp]) => [
      tag,
      regexHits(regexp, template).filter(outsideLiterals),
    ]),
  ) as BlockTags;
}

/**
 * Tests, if a template has blocks, see blockDelimitingTags.
 */
function hasBlocks(template: string, context: TemplateContext): boolean {
  const tags = findBlockTags(template, context);
  return blockDelimitingTags.some((tag) => tags[tag].length > 0);
}

/**
 * Whitespace up to the line feed, which precedes a tag
 */
const whitespaceBeforeTag = /\n([\t ]*)$/;
/**
 * Whitespace including the line feed, which follows a tag
 */
const whitespaceAfterTag = /^[\t ]*\n/;

function shouldRemoveWhiteSpace(opening: TagBounds): boolean {
  return (
    whitespaceBeforeTag.test(opening.leading) &&
    whitespaceAfterTag.test(opening.trailing)
  );
}

/**
 * This will extract the block to render separately. This will depend on the white space handling. If the
 * opening is placed on its own line, whitespace after the opening and before the closing blocks will be removed
 * from the sub template, up to the first new line feed.
 */
function getSubTemplateForBlock(template: string, block: Block): string {
  const opening = getTagBounds(block.opening);
  const closing = getTagBounds(block.closing);
  let startIndex = opening.end;
  let endIndex = closing.start;
  if (shouldRemoveWhiteSpace(opening)) {
    startIndex += whitespaceAfterTag.exec(opening.trailing)?.[0].length ?? 0;
    endIndex -= whitespaceBeforeTag.exec(closing.leading)?.[1].length ?? 0;
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
  const opening = getTagBounds(block.opening);
  const closing = getTagBounds(block.closing);
  let startIndex = opening.start;
  let endIndex = closing.end;
  if (shouldRemoveWhiteSpace(opening)) {
    startIndex -= whitespaceBeforeTag.exec(opening.leading)?.[1].length ?? 0;
    endIndex += whitespaceAfterTag.exec(closing.trailing)?.[0].length ?? 0;
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
  data: TemplateData,
  translate: Translate,
  context: TemplateContext,
): string {
  let renderedTemplate = template;
  const tags = findBlockTags(template, context);
  const forEachBlocks = getForEachBlocks(tags);

  getConditionalBlocks(tags, forEachBlocks, context)
    .reverse()
    .forEach(
      /** @param {ConditionalBlock} block */ (block) => {
        const partialBlocks = [block.opening];
        if (block.elseIfs) {
          partialBlocks.push(...block.elseIfs);
        }
        let trueStatementIndex = partialBlocks.findIndex((s) =>
          evaluateExpression(s[1].trim(), data, BooleanType, context),
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
            context,
          );
        }

        renderedTemplate = replaceBlock(renderedTemplate, block, renderedBlock);
      },
    );

  // only iterate over blocks not removed by conditionals
  getForEachBlocks(findBlockTags(renderedTemplate, context))
    .reverse()
    .forEach((block) => {
      const obj = evaluateExpression(
        block.opening[2].trim(),
        data,
        NoneType,
        context,
      );
      let keyValuePairs: Iterable<[string | number, unknown]> | undefined;
      if (Array.isArray(obj)) {
        keyValuePairs = obj.entries();
      } else if (isPlainObject(obj)) {
        try {
          keyValuePairs = Object.keys(obj).map((key) => [
            key,
            getProperty(obj, key),
          ]);
        } catch (_e) {
          // e.g. a proxy, which cannot list its keys
          keyValuePairs = undefined;
        }
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
          const forEachData = createLoopData(data, {
            [valueName]: args[1],
            ...(keyName && { [keyName]: args[0] }),
            ...(indexName && { [indexName]: index }),
          });
          const currentBlock = expandConditionalsAndLoops(
            blockTemplate,
            forEachData,
            translate,
            context,
          );
          renderedBlocks.push(
            replaceAttributes(currentBlock, forEachData, translate, context),
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

function createContext(options: TemplateOptions): TemplateContext {
  const [open, close] = options.delimiters ?? ['{{', '}}'];
  if (
    typeof open !== 'string' ||
    typeof close !== 'string' ||
    !open ||
    !close ||
    open.trim() !== open ||
    close.trim() !== close
  ) {
    throw new Error(
      'Template delimiters must not be empty and must not start or end with whitespace',
    );
  }
  const o = escapeRegExp(open);
  const c = escapeRegExp(close);
  const strict = !!options.strict;
  const warned = new Set<string>();
  const compiledValues = new Map<string, Evaluate>();
  const { formatValue } = options;

  return {
    open,
    close,
    strict,
    // whitespace is allowed within the delimiters of block tags, e.g. {{ else }}
    blockRegExps: Object.fromEntries(
      Object.entries(blockTagDefinitions).map(([tag, { keyword, rest }]) => [
        tag,
        new RegExp(
          `\\s*${o}\\s*${escapeRegExp(keyword)}${rest}\\s*${c}\\s*`,
          'g',
        ),
      ]),
    ) as Record<BlockTag, RegExp>,
    compile(value, evaluationType): Evaluate {
      const cacheKey = `${evaluationType}:${value}`;
      let evaluate = compiledValues.get(cacheKey);
      if (!evaluate) {
        evaluate = compileValue(value, evaluationType);
        if (compiledValues.size >= maxCompiledValues) {
          compiledValues.clear();
        }
        compiledValues.set(cacheKey, evaluate);
      }
      return evaluate;
    },
    formatValue: formatValue
      ? (value): string => {
          try {
            return toText(formatValue(value));
          } catch (_e) {
            return '';
          }
        }
      : toText,
    invalid(raw, error): string {
      const reason = getCaughtError(error).message;
      const message = raw
        ? `Invalid template content ${raw}: ${reason}`
        : `Invalid template, blocks are not expanded: ${reason}`;
      if (strict) {
        throw new Error(message);
      }
      if (!warned.has(message)) {
        warned.add(message);
        getLogger('vcsTemplate').warning(message);
      }
      return raw;
    },
  };
}

function defaultTranslate(key: string): string {
  return key;
}

/**
 * Compiles a template, to render it multiple times. See {@link documentation/vcsTemplate.md} for more information.
 * The placeholders of templates without conditional or iteration blocks are only parsed once. Templates with blocks
 * are expanded on each rendering.
 * Invalid content is rendered as text and a warning is logged, unless the strict option is set.
 * Templates with blocks are checked when rendered, only the rendered content (see TemplateOptions.strict).
 * Throws, if the delimiters are invalid.
 */
export function compileTemplate(
  template: string | string[],
  options: TemplateOptions = {},
): CompiledTemplate {
  const templateString = Array.isArray(template)
    ? template.join('\n')
    : template;
  const context = createContext(options);

  if (hasBlocks(templateString, context)) {
    let fallbackParts: TemplatePart[] | undefined;
    return (data, translate = defaultTranslate) => {
      let expandedTemplate: string;
      try {
        expandedTemplate = expandConditionalsAndLoops(
          templateString,
          data,
          translate,
          context,
        );
      } catch (e) {
        if (context.strict) {
          throw e;
        }
        context.invalid('', e);
        // render without expanding blocks, keeping the block tags as text. They are not reported separately,
        // since the invalid blocks have been reported
        fallbackParts ??= parsePlaceholders(templateString, context, true);
        return renderParts(fallbackParts, data, translate);
      }
      return replaceAttributes(expandedTemplate, data, translate, context);
    };
  }

  const parts = parsePlaceholders(templateString, context);
  return (data, translate = defaultTranslate) =>
    renderParts(parts, data, translate);
}

/**
 * Renders a template in these steps. See {@link documentation/vcsTemplate.md} for more information.
 * 1. expand conditional blocks. this will remove any blocks that do not match their expressions and choose from if / elseif / else block which of them to render
 * 2. expand iterations. this will create new templates for each iteration and re-run the rendering for those blocks
 * 3. render attributes. this will add the attributes to all the blocks not within each blocks
 */
export function renderTemplate(
  template: string | string[],
  data: TemplateData,
  translate: (key: string) => string = defaultTranslate,
  options?: TemplateOptions,
): string {
  return compileTemplate(template, options)(data, translate);
}
