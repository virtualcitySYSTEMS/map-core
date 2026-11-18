import { expect } from 'chai';
import sinon from 'sinon';
import { getLogger } from '@vcsuite/logger';
import type { TemplateData } from '../../../src/util/vcsTemplate.js';
import {
  compileTemplate,
  renderTemplate,
} from '../../../src/util/vcsTemplate.js';

/**
 * A class instance with getters on its prototype, which are not own properties.
 */
class Item {
  constructor(private _name: string) {}

  get name(): string {
    return this._name;
  }

  // eslint-disable-next-line class-methods-use-this
  get visible(): boolean {
    return true;
  }
}

describe('vcsTemplate', () => {
  describe('rendering data', () => {
    let data: Record<string, unknown>;

    before(() => {
      data = {
        property: 'foo',
        nested: {
          property: 'foo',
          array: [{ property: 'foo' }],
          // eslint-disable-next-line @typescript-eslint/naming-convention
          'spaced property': 'foo',
        },
        array: [['foo'], 'foo'],
        // eslint-disable-next-line @typescript-eslint/naming-convention
        'spaced property': 'foo',
        number: 5.1,
      };
    });

    it('should render a property', () => {
      const html = renderTemplate('{{ property }}', data);
      expect(html.trim()).to.equal('foo');
    });

    it('should render a nested property', () => {
      const html = renderTemplate('{{ nested.property }}', data);
      expect(html.trim()).to.equal('foo');
    });

    it('should render an array element', () => {
      const html = renderTemplate('{{ array[1] }}', data);
      expect(html.trim()).to.equal('foo');
    });

    it('should render a nested array elements property', () => {
      const html = renderTemplate('{{ nested.array[0].property }}', data);
      expect(html.trim()).to.equal('foo');
    });

    it('should render a nested array element', () => {
      const html = renderTemplate('{{ array[0][0] }}', data);
      expect(html.trim()).to.equal('foo');
    });

    it('should render empty for in-existent keys', () => {
      const html = renderTemplate('{{ foo }}', data);
      expect(html.trim()).to.be.empty;
    });

    it('should render empty for in-existent nested key', () => {
      const html = renderTemplate('{{ foo.bar }}', data);
      expect(html.trim()).to.be.empty;
    });

    it('should access bracket notation', () => {
      const html = renderTemplate('{{ "spaced property" }}', data);
      expect(html.trim()).to.be.empty;
    });

    it('should access nested bracket notation', () => {
      const html = renderTemplate('{{ nested["spaced property"] }}', data);
      expect(html.trim()).to.be.empty;
    });

    it('should render an ol expression', () => {
      const html = renderTemplate('{{ ["round", ["get", "number"]] }}', data);
      expect(html.trim()).to.equal('5');
    });
  });

  describe('rendering array data', () => {
    const data = ['a', 'b', ['x', 'y']];

    it('should render array elements by index', () => {
      expect(renderTemplate('{{0}}-{{1}}', data)).to.equal('a-b');
    });

    it('should render nested array elements', () => {
      expect(renderTemplate('{{ 2[1] }} / {{2.0}}', data)).to.equal('y / x');
    });

    it('should render conditional blocks', () => {
      expect(renderTemplate('{{#if 0}}yes{{/if}}', data)).to.equal('yes');
      expect(renderTemplate('{{#if 3}}yes{{else}}no{{/if}}', data)).to.equal(
        'no',
      );
    });

    it('should iterate with access to the array data', () => {
      expect(
        renderTemplate(
          '{{#each (v, k) in 2}}[{{k}}={{v}}|{{0}}]{{/each}}',
          data,
        ),
      ).to.equal('[0=x|a][1=y|a]');
    });

    it('should not change the array data', () => {
      renderTemplate('{{#each (v, k) in 2}}{{v}}{{/each}}', data);
      expect(data).to.deep.equal(['a', 'b', ['x', 'y']]);
    });

    it('should keep own properties of the array data within loops', () => {
      expect(
        renderTemplate(
          '{{#each (v) in 0}}{{title}}{{v}}{{/each}}',
          Object.assign([['x', 'y']], { title: 't' }),
        ),
      ).to.equal('txty');
    });
  });

  describe('conditional rendering', () => {
    let data: Record<string, unknown>;

    before(() => {
      data = {
        boolean: true,
        number: 5,
        string: 'string',
        nested: {
          number: 10,
        },
      };
    });

    it('should render a template conditionally', () => {
      const html = renderTemplate(
        `
{{#if number}}
{{ number }}
{{/if}}`,
        data,
      );
      expect(html.trim()).to.equal('5');
    });

    it('should render a template deeply conditional', () => {
      const html = renderTemplate(
        `
{{#if number}}
    {{#if string}}
{{ number }}
    {{/if}}
{{/if}}`,
        data,
      );
      expect(html.trim()).to.equal('5');
    });

    it('should render a template conditional with an ol expression', () => {
      const html = renderTemplate(
        `
{{#if ["==", ["get", "number"], 5]}}
{{ number }}
{{/if}}`,
        data,
      );
      expect(html.trim()).to.equal('5');
    });

    it('should render an elseif block, if an if block fails', () => {
      const html = renderTemplate(
        `
{{#if ["==", ["get", "string"], "foo"]}}
{{ string }}
{{elseif number}}
{{ number }}
{{/if}}`,
        data,
      );
      expect(html.trim()).to.equal('5');
    });

    it('should render an else block, if all preceding statements fail', () => {
      const html = renderTemplate(
        `
{{#if ["==", ["get", "string"], "foo"]}}
{{ string }}
{{elseif ["==", ["get", "nested", "number"], 5] }}
{{ nested.number }}
{{else}}
{{ number }}
{{/if}}`,
        data,
      );
      expect(html.trim()).to.equal('5');
    });

    it('should render a template conditionally, even if there are too many whitespaces on the object key', () => {
      const html = renderTemplate(
        `
{{#if number }}
{{ number }}
{{/if}}`,
        data,
      );
      expect(html.trim()).to.equal('5');
    });

    it('should render else and elseif tags of conditionals within each blocks with the each block', () => {
      const xs = [true, false];
      expect(
        renderTemplate(
          '{{#if a}}{{#each (x) in xs}}{{#if x}}1{{else}}2{{/if}}{{/each}}{{/if}}',
          { a: true, xs },
          undefined,
          { strict: true },
        ),
      ).to.equal('12');
      expect(
        renderTemplate(
          '{{#if a}}{{#each (x) in xs}}{{#if x}}1{{elseif y}}3{{else}}2{{/if}}{{/each}}{{/if}}',
          { a: true, xs, y: true },
          undefined,
          { strict: true },
        ),
      ).to.equal('13');
    });

    it('should render the else tag after an each block with the outer conditional', () => {
      const template =
        '{{#if a}}{{#each (x) in xs}}{{#if x}}1{{else}}2{{/if}}{{/each}}{{else}}none{{/if}}';
      expect(
        renderTemplate(template, { a: true, xs: [true, false] }, undefined, {
          strict: true,
        }),
      ).to.equal('12');
      expect(
        renderTemplate(template, { a: false, xs: [true] }, undefined, {
          strict: true,
        }),
      ).to.equal('none');
    });
  });

  describe('loop rendering', () => {
    let data: Record<string, unknown>;

    before(() => {
      data = {
        array: [1, 2, 3],
        arrayOfArrays: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
        object: {
          one: 1,
          two: 2,
          three: 3,
        },
      };
    });

    it('should iterate over an array', () => {
      const html = renderTemplate(
        `
{{#each (number, index) in array}}
{{index}}: {{number}}
{{/each}}`,
        data,
      );
      expect(html.trim()).to.equal('0: 1\n1: 2\n2: 3');
    });

    it('should iterate over an object', () => {
      const html = renderTemplate(
        `
{{#each (number, key, index) in object}}
{{key}}: {{number}} ({{index}})
{{/each}}`,
        data,
      );
      expect(html.trim()).to.equal('one: 1 (0)\ntwo: 2 (1)\nthree: 3 (2)');
    });

    it('should iterate, if the data contains values which cannot be cloned', () => {
      const nonCloneableData = {
        array: [1, 2],
        fn: (): void => {},
        item: new Item('item'),
      };
      expect(
        renderTemplate(
          '{{#each (number) in array}}{{number}}-{{item.name}};{{/each}}',
          nonCloneableData,
          undefined,
          { strict: true },
        ),
      ).to.equal('1-item;2-item;');
      expect(nonCloneableData).to.have.all.keys('array', 'fn', 'item');
    });

    it('should iterate over plain objects with an own toString', () => {
      expect(
        renderTemplate('{{#each (v, k) in o}}{{k}}={{v}};{{/each}}', {
          o: { toString: 'x', a: 1 },
        }),
      ).to.equal('toString=x;a=1;');
      expect(
        renderTemplate('{{#each (v, k) in o}}{{k}};{{/each}}', {
          o: {
            a: 1,
            toString(): string {
              return 'o';
            },
          },
        }),
      ).to.equal('a;toString;');
    });

    it('should not iterate over class instances', () => {
      expect(
        renderTemplate('x{{#each (v, k) in item}}{{k}}{{/each}}', {
          item: new Item('item'),
        }),
      ).to.equal('x');
    });

    it('should resolve inherited properties of the data within loops', () => {
      const withGetter = Object.assign(Object.create(new Item('data')), {
        list: [1, 2],
      }) as TemplateData;
      expect(
        compileTemplate('{{name}}:{{#each (v) in list}}{{name}}{{v}}{{/each}}')(
          withGetter,
        ),
      ).to.equal('data:data1data2');
    });

    it('should define loop variables, shadowing properties of the data', () => {
      const loopData = { v: 'data', list: [1, 2] };
      expect(
        renderTemplate('{{#each (v) in list}}{{v}}{{/each}}{{v}}', loopData),
      ).to.equal('12data');
      expect(
        renderTemplate('{{#each (__proto__) in list}}{{__proto__}}{{/each}}', {
          list: [1, 2],
        }),
      ).to.equal('12');
      expect(loopData).to.deep.equal({ v: 'data', list: [1, 2] });
    });

    it('should handle nested loops', () => {
      const html = renderTemplate(
        `
{{#each (array) in arrayOfArrays}}
{{#each (inner, index) in array}}{{#if index}} {{/if}}{{inner}}{{/each}}
{{/each}}`,
        data,
      );
      expect(html.trim()).to.equal('1 2 3\n4 5 6\n7 8 9');
    });

    it('should iterate, even if there is a whitespace at the end', () => {
      const html = renderTemplate(
        `
{{#each (number, index) in array }}
{{index}}: {{number}}
{{/each}}`,
        data,
      );
      expect(html.trim()).to.equal('0: 1\n1: 2\n2: 3');
    });
  });

  describe('whitespace handling', () => {
    let data: Record<string, unknown>;

    before(() => {
      data = {
        number: 5,
        array: [1, 2, 3],
      };
    });

    it('should keep white space when inline conditionals', () => {
      const html = renderTemplate(
        `inline{{#if number}} {{number}}{{/if}} next word`,
        data,
      );
      expect(html.trim()).to.equal('inline 5 next word');
    });

    it('should keep white space when inline conditionals at the end of a block', () => {
      const html = renderTemplate(
        `inline{{#if number}} {{number}}{{/if}}
new line`,
        data,
      );
      expect(html.trim()).to.equal('inline 5\nnew line');
    });

    it('should remove white space when if is preceded by whitespace or newline conditionals', () => {
      const html = renderTemplate(
        `block
        {{#if number}}
{{number}}
{{/if}}
next word`,
        data,
      );
      expect(html.trim()).to.equal('block\n5\nnext word');
    });

    it('should remove white space when if is preceded by whitespace or more then one newline conditionals', () => {
      const html = renderTemplate(
        `block
{{#if number}}


next word

{{/if}}`,
        data,
      );
      expect(html).to.equal('block\n\n\nnext word\n\n');
    });

    it('should inline each blocks', () => {
      const html = renderTemplate(
        `this is: {{#each (value, index) in array}}{{#if index}}, {{/if}}{{value}}{{/each}}`,
        data,
      );
      expect(html.trim()).to.equal('this is: 1, 2, 3');
    });

    it('should work, if the tag is on the first line', () => {
      const html = renderTemplate(
        `{{#each (value, index) in array}}{{#if index}}, {{/if}}{{value}}{{/each}}`,
        data,
      );
      expect(html.trim()).to.equal('1, 2, 3');
    });
  });

  describe('translating within a template', () => {
    let translateFunction: (key: string) => string;
    let data: Record<string, unknown>;

    before(() => {
      translateFunction = (key: string): string => {
        return `${key}-t`;
      };
      data = {
        property: 'foo',
        nested: {
          property: 'foo',
        },
        array: [1, 2, 3],
        number: 5,
      };
    });

    it('should translate a string', () => {
      const html = renderTemplate('{{#t foo}}', data, translateFunction);
      expect(html.trim()).to.equal('foo-t');
    });

    it('should translate a dot separated string', () => {
      const html = renderTemplate('{{#t foo.bar}}', data, translateFunction);
      expect(html.trim()).to.equal('foo.bar-t');
    });

    it('should translate, based on a property', () => {
      const html = renderTemplate('{{#t property}}', data, translateFunction);
      expect(html.trim()).to.equal('foo-t');
    });

    it('should translate, based on a nested property', () => {
      const html = renderTemplate(
        '{{#t nested.property}}',
        data,
        translateFunction,
      );
      expect(html.trim()).to.equal('foo-t');
    });

    it('should translate within an expression', () => {
      const html = renderTemplate(
        '{{#if number}}{{#t foo}}{{/if}}',
        data,
        translateFunction,
      );
      expect(html.trim()).to.equal('foo-t');
    });

    it('should translate an expression result', () => {
      const html = renderTemplate(
        '{{#t ["*", ["get", "number"], 5]}}',
        data,
        translateFunction,
      );
      expect(html.trim()).to.equal('25-t');
    });

    it('it should translate in a each loop', () => {
      const html = renderTemplate(
        `
{{#each (value, index) in array}}
{{#t value}}
{{/each}}
`,
        data,
        translateFunction,
      );
      expect(html.trim()).to.equal('1-t\n2-t\n3-t');
    });
  });

  describe('compiling templates', () => {
    it('should render a compiled template multiple times', () => {
      const compiled = compileTemplate('{{ property }}: {{ nested.number }}');
      expect(compiled({ property: 'foo', nested: { number: 1 } })).to.equal(
        'foo: 1',
      );
      expect(compiled({ property: 'bar', nested: { number: 2 } })).to.equal(
        'bar: 2',
      );
    });

    it('should render the same as renderTemplate', () => {
      const data = { property: 'foo', number: 5.1, array: [1, 2] };
      [
        'plain text',
        '{{ property }}',
        'a {{ property }} b {{ number }} c',
        '{{ missing }}{{ array[1] }}',
        '{{ ["round", ["get", "number"]] }}',
        '{{}} { single } {{ property',
      ].forEach((template) => {
        expect(compileTemplate(template)(data)).to.equal(
          renderTemplate(template, data),
        );
      });
    });

    it('should join an array of template strings', () => {
      expect(
        compileTemplate(['{{ a }}', '{{ b }}'])({ a: 'foo', b: 'bar' }),
      ).to.equal('foo\nbar');
    });

    it('should render conditional blocks with each data', () => {
      const compiled = compileTemplate(
        '{{#if show}}{{ value }}{{else}}-{{/if}}',
      );
      expect(compiled({ show: true, value: 'foo' })).to.equal('foo');
      expect(compiled({ show: false, value: 'foo' })).to.equal('-');
    });

    it('should render iteration blocks with each data', () => {
      const compiled = compileTemplate(
        '{{#each (value) in array}}{{ value }}{{/each}}',
      );
      expect(compiled({ array: [1, 2] })).to.equal('12');
      expect(compiled({ array: [3] })).to.equal('3');
    });

    it('should translate with the translate function passed on rendering', () => {
      const compiled = compileTemplate('{{#t foo}}');
      expect(compiled({}, (key) => `${key}-a`)).to.equal('foo-a');
      expect(compiled({}, (key) => `${key}-b`)).to.equal('foo-b');
      expect(compiled({})).to.equal('foo');
    });

    it('should render array data', () => {
      expect(compileTemplate('{{0}}-{{1}}')(['foo', 'bar'])).to.equal(
        'foo-bar',
      );
    });

    it('should throw on invalid delimiters', () => {
      [
        ['', '}'],
        ['{', ''],
        [' {', '}'],
        ['{', '} '],
      ].forEach((delimiters) => {
        expect(() =>
          compileTemplate('{a}', {
            delimiters: delimiters as [string, string],
          }),
        ).to.throw();
      });
    });
  });

  describe('property keys', () => {
    it('should render getters of class instances', () => {
      expect(
        renderTemplate('{{ item.name }} {{ name }}', {
          item: new Item('foo'),
          name: 'bar',
        }),
      ).to.equal('foo bar');
      expect(
        compileTemplate('{{ name }}')(
          new Item('foo') as unknown as TemplateData,
        ),
      ).to.equal('foo');
    });

    it('should evaluate getters of class instances in blocks', () => {
      expect(
        renderTemplate('{{#if item.visible}}a{{else}}b{{/if}}', {
          item: new Item('foo'),
        }),
      ).to.equal('a');
    });

    it('should resolve keys like the ol style get expression', () => {
      const data = {
        item: new Item('foo'),
        array: [1, 2],
        string: 'foo',
        nested: { a: 1 },
      };
      [
        ['item.name', '"item", "name"'],
        ['array.length', '"array", "length"'],
        ['string.length', '"string", "length"'],
        ['array[1]', '"array", 1'],
        ['nested.a', '"nested", "a"'],
        ['missing.key', '"missing", "key"'],
        ['nested.constructor', '"nested", "constructor"'],
      ].forEach(([key, args]) => {
        expect(renderTemplate(`{{ ${key} }}`, data), key).to.equal(
          renderTemplate(`{{ ["get", ${args}] }}`, data),
        );
      });
    });

    it('should render own properties of arrays and strings', () => {
      expect(
        renderTemplate(
          '{{ array.length }} {{ string.length }} {{ array[1] }}',
          {
            array: [1, 2],
            string: 'foo',
          },
        ),
      ).to.equal('2 3 2');
    });

    it('should render own properties named like inherited properties', () => {
      expect(
        renderTemplate('{{ constructor }}', { constructor: 'foo' }),
      ).to.equal('foo');
    });

    it('should evaluate inherited properties within ol expressions', () => {
      expect(renderTemplate('{{ ["get", "length"] }}', [1, 2])).to.equal('2');
    });
  });

  describe('delimiters', () => {
    const delimiterPairs: [string, string][] = [
      ['{{', '}}'],
      ['{', '}'],
      ['%{', '}%'],
      ['<%', '%>'],
    ];

    // eslint-disable-next-line mocha/no-setup-in-describe
    delimiterPairs.forEach(([open, close]) => {
      describe(`${open} ${close}`, () => {
        /**
         * Replaces « and » by the opening and closing delimiter
         */
        function t(template: string): string {
          return template.replaceAll('«', open).replaceAll('»', close);
        }

        function render(
          template: string,
          data: TemplateData = {},
          translate?: (key: string) => string,
        ): string {
          return compileTemplate(t(template), { delimiters: [open, close] })(
            data,
            translate,
          );
        }

        it('should render property keys', () => {
          expect(
            render('«a» « nested.b » «array[1]»', {
              a: 1,
              nested: { b: 2 },
              array: [0, 3],
            }),
          ).to.equal('1 2 3');
        });

        it('should render array data by index', () => {
          expect(render('«0»-«1» of «2»', [1, 10, 100])).to.equal(
            '1-10 of 100',
          );
        });

        it('should render keys with spaces and hyphens', () => {
          expect(
            // eslint-disable-next-line @typescript-eslint/naming-convention
            render('«a b» «my-value»', { 'a b': 1, 'my-value': 2 }),
          ).to.equal('1 2');
        });

        it('should render missing keys, null and undefined as empty string', () => {
          expect(render('a«b»c«d»e«f»', { d: null, f: undefined })).to.equal(
            'ace',
          );
        });

        it('should render adjacent placeholders', () => {
          expect(render('«a»«b»', { a: '€', b: 5 })).to.equal('€5');
        });

        it('should render ol expressions', () => {
          expect(
            render('«["round", ["get", "number"]]»', { number: 5.1 }),
          ).to.equal('5');
        });

        it('should render string literals', () => {
          expect(render("«'x'» « 'y' »")).to.equal('x y');
          expect(render("«'\\''»")).to.equal("'");
          expect(render("«'\\\\'»")).to.equal('\\');
          expect(render("«'a\\b'»")).to.equal('a\\b');
        });

        it('should render string literals containing delimiters', () => {
          expect(render(`«'${open}'»«'${close}'»`)).to.equal(`${open}${close}`);
        });

        it('should translate keys, values and literals', () => {
          const translate = (key: string): string => `${key}-t`;
          expect(
            render("«#t a.b» «#t c» «#t 'd.e'»", { c: 'value' }, translate),
          ).to.equal('a.b-t value-t d.e-t');
        });

        it('should render conditional blocks', () => {
          const template = '«#if a»a«elseif b»b«else»c«/if»';
          expect(render(template, { a: true })).to.equal('a');
          expect(render(template, { b: true })).to.equal('b');
          expect(render(template)).to.equal('c');
        });

        it('should render conditional blocks with ol expressions and literals', () => {
          expect(
            render('«#if [">", ["get", "a"], 1]»«a»«/if»«#if \'x\'»!«/if»', {
              a: 2,
            }),
          ).to.equal('2!');
        });

        it('should render nested iteration blocks', () => {
          expect(
            render(
              '«#each (inner) in outer»«#each (value, index) in inner»«#if index»,«/if»«value»«/each»;«/each»',
              { outer: [[1, 2], [3]] },
            ),
          ).to.equal('1,2;3;');
        });

        it('should allow whitespace within the delimiters of block tags', () => {
          const template = '« #if a »a«  elseif b »b« else »c«\t/if\t»';
          expect(render(template, { a: true })).to.equal('a');
          expect(render(template, { b: true })).to.equal('b');
          expect(render(template)).to.equal('c');
          expect(
            render('« #each (v, i) in l »«#if i»,«/if »«v»« /each »', {
              l: [1, 2],
            }),
          ).to.equal('1,2');
          expect(
            render('«#each  (v,  i)  in  l»«i»«v»«/each»', { l: [1, 2] }),
          ).to.equal('0112');
        });

        it('should render block tags within string literals as text', () => {
          expect(
            compileTemplate(t("«'«#if x»'»"), {
              delimiters: [open, close],
              strict: true,
            })({}),
          ).to.equal(t('«#if x»'));
          expect(
            render("a «'«/if»'» b «#if c»x«/if» «'«#each (v) in l»'»", {
              c: true,
            }),
          ).to.equal(t('a «/if» b x «#each (v) in l»'));
        });

        it('should remove the whitespace of blocks on their own line', () => {
          expect(
            render('block\n    «#if a»\n«a»\n«/if»\nnext', { a: 5 }),
          ).to.equal('block\n5\nnext');
          expect(
            render('block\n    « #if a »\n«a»\n« /if »\nnext', { a: 5 }),
          ).to.equal('block\n5\nnext');
        });

        it('should keep the whitespace of inline blocks', () => {
          expect(render('inline«#if a» «a»«/if» next', { a: 5 })).to.equal(
            'inline 5 next',
          );
        });

        it('should keep empty and unclosed placeholders as text', () => {
          ['««»', "«'unclosed»", '«a'].forEach((template) => {
            expect(render(template, { a: 1 })).to.equal(t(template));
          });
        });

        it('should keep invalid ol expressions as text', () => {
          expect(render('«[bad» «a»', { a: 1 })).to.equal(t('«[bad» 1'));
        });

        it('should not render placeholders within rendered values', () => {
          expect(render('«a»', { a: t('«b»'), b: 'foo' })).to.equal(t('«b»'));
        });

        it('should render the other delimiters as text', () => {
          delimiterPairs
            .filter(([o]) => !o.includes(open) && !open.includes(o))
            .forEach(([o, c]) => {
              expect(render(`${o}a${c}`, { a: 1 })).to.equal(`${o}a${c}`);
            });
        });
      });
    });

    describe('single braces', () => {
      function render(template: string, data: TemplateData = {}): string {
        return compileTemplate(template, { delimiters: ['{', '}'] })(data);
      }

      it('should render the inner placeholder of double braces', () => {
        expect(render('{{ name }} and {name}', { name: 'foo' })).to.equal(
          '{foo} and foo',
        );
      });

      it('should render escaped braces and special characters', () => {
        expect(
          render(
            "Password must include one of: !@{'#'}$%^&*()\\[]{'{'}{'}'}-_+=~`",
          ),
        ).to.equal('Password must include one of: !@#$%^&*()\\[]{}-_+=~`');
      });

      it('should render text within braces as placeholder', () => {
        expect(render('p { color: red; }')).to.equal('p ');
        expect(render('a } b')).to.equal('a } b');
      });

      it('should not handle pipes, at signs and other special characters', () => {
        [
          'one | two',
          '| Name | Tel |\n|------|-----|\n| A | 1 |',
          'a || b',
          'mail@example.com @:linked.key',
          '100% $1 $&',
        ].forEach((template) => {
          expect(render(template)).to.equal(template);
        });
      });

      it('should render a compiled template multiple times', () => {
        const compiled = compileTemplate('{0} {1}', { delimiters: ['{', '}'] });
        expect(compiled(['a', 'b'])).to.equal('a b');
        expect(compiled(['c'])).to.equal('c ');
      });
    });

    describe('double braces', () => {
      it('should render string literals', () => {
        expect(renderTemplate("{{ 'x' }} {{ '}}' }}", {})).to.equal('x }}');
      });

      it('should render the inner placeholder of nested opening delimiters', () => {
        expect(renderTemplate('{{ a {{ b }}', { b: 1 })).to.equal('{{ a 1');
      });
    });
  });

  describe('invalid content', () => {
    let warning: sinon.SinonSpy;

    beforeEach(() => {
      warning = sinon.spy(getLogger('vcsTemplate'), 'warning');
    });

    afterEach(() => {
      warning.restore();
    });

    const invalidTemplates = [
      '{{ [bad }}',
      '{{ ["unknownOperator"] }}',
      "{{ 'unclosed }}",
      '{{else}}',
      '{{#if a}}missing closing',
      'missing opening{{/if}}',
      '{{#each (a) in b}}missing closing',
      '{{#if a}}{{else}}{{elseif b}}{{/if}}',
      '{{#if [bad}}a{{/if}}',
    ];

    it('should render invalid content as text', () => {
      invalidTemplates.forEach((template) => {
        expect(renderTemplate(template, { a: true }), template).to.equal(
          template,
        );
      });
    });

    it('should render valid placeholders of templates with invalid blocks', () => {
      expect(renderTemplate('{{#if a}}{{ a }}', { a: 1 })).to.equal(
        '{{#if a}}1',
      );
    });

    it('should log a warning once per compiled template', () => {
      const compiled = compileTemplate('{{ [bad }} {{ [bad }}');
      compiled({});
      compiled({});
      expect(warning).to.have.been.calledOnce;
    });

    it('should only log the invalid blocks, if blocks are not expanded', () => {
      expect(
        renderTemplate("{{#each (v) in ['get','a']}}{{v}}{{/each}}", {
          a: [1],
        }),
      ).to.equal("{{#each (v) in ['get','a']}}{{/each}}");
      expect(warning).to.have.been.calledOnce;
      expect(warning.firstCall.args[0]).to.match(
        /^Invalid template, blocks are not expanded: .*not valid JSON/,
      );
    });

    it('should log invalid placeholders of templates with invalid blocks', () => {
      expect(renderTemplate('{{#if a}}{{ [bad }}', { a: 1 })).to.equal(
        '{{#if a}}{{ [bad }}',
      );
      expect(warning).to.have.been.calledTwice;
      expect(warning.firstCall.args[0]).to.match(
        /^Invalid template, blocks are not expanded/,
      );
      expect(warning.secondCall.args[0]).to.match(
        /^Invalid template content {{ \[bad }}/,
      );
    });

    it('should log block tags outside of blocks', () => {
      [
        ['x {{else}} y', 'x {{else}} y', '{{else}}'],
        ['{{#if a}}x{{/if}} {{else}}', 'x {{else}}', '{{else}}'],
        ['x {{ else }} y', 'x {{ else }} y', '{{ else }}'],
        ['x {{ elseif b }} y', 'x {{ elseif b }} y', '{{ elseif b }}'],
      ].forEach(([template, expected, tag]) => {
        warning.resetHistory();
        expect(renderTemplate(template, { a: true }), template).to.equal(
          expected,
        );
        expect(warning.firstCall?.args[0], template).to.equal(
          `Invalid template content ${tag}: Block tag without a matching block`,
        );
      });
    });

    it('should log else if as invalid block tag', () => {
      [
        ['{{#if a}}x{{else if b}}y{{/if}}', 'x{{else if b}}y'],
        ['x {{ else if b }}', 'x {{ else if b }}'],
      ].forEach(([template, expected]) => {
        warning.resetHistory();
        expect(renderTemplate(template, { a: true }), template).to.equal(
          expected,
        );
        expect(warning, template).to.have.been.calledOnce;
        expect(warning.firstCall.args[0], template).to.contain(
          'Invalid block tag, use elseif for else if',
        );
      });
    });

    it('should log malformed block tags', () => {
      [
        'x{{#if}}y',
        'x{{#each foo}}y',
        'x{{elseif}}y',
        'x{{ /each x }}y',
      ].forEach((template) => {
        warning.resetHistory();
        expect(renderTemplate(template, {}), template).to.equal(template);
        expect(warning, template).to.have.been.calledOnce;
      });
    });

    it('should throw on each rendering of invalid block expressions in strict mode', () => {
      const compiled = compileTemplate('{{#if [bad}}a{{/if}}', {
        strict: true,
      });
      expect(() => compiled({})).to.throw();
      expect(() => compiled({})).to.throw();
    });

    it('should name the missing tag of unbalanced blocks', () => {
      [
        ['{{#if a}}missing closing', 'missing closing tag for if statements'],
        ['missing opening{{/if}}', 'missing opening tag for if statements'],
        ['{{ /if }} missing opening', 'missing opening tag for if statements'],
        [
          '{{#each (a) in b}}missing closing',
          'missing closing tag for each statements',
        ],
        ['missing opening{{/each}}', 'missing opening tag for each statements'],
      ].forEach(([template, message]) => {
        warning.resetHistory();
        renderTemplate(template, {});
        expect(warning, template).to.have.been.calledOnce;
        expect(warning.firstCall.args[0], template).to.contain(message);
        expect(
          () => renderTemplate(template, {}, undefined, { strict: true }),
          template,
        ).to.throw(message);
      });
    });

    it('should throw in strict mode', () => {
      invalidTemplates.forEach((template) => {
        expect(
          () =>
            renderTemplate(template, { a: true }, undefined, { strict: true }),
          template,
        ).to.throw();
      });
      expect(warning).to.not.have.been.called;
    });

    it('should not throw for valid templates in strict mode', () => {
      expect(
        renderTemplate('{{}} {{ a', {}, undefined, { strict: true }),
      ).to.equal('{{}} {{ a');
    });
  });

  describe('data which cannot be rendered', () => {
    let warning: sinon.SinonSpy;

    beforeEach(() => {
      warning = sinon.spy(getLogger('vcsTemplate'), 'warning');
    });

    afterEach(() => {
      warning.restore();
    });

    /**
     * Renders templates with getters which throw and values which cannot be converted to a string.
     * Neither throws nor logs a warning, also in strict mode.
     */
    function expectRenderedAsEmptyString(strict: boolean): void {
      const data = {
        l: [1],
        throwingGetter: {
          get bad(): unknown {
            throw new Error('getter');
          },
        },
        noPrototype: Object.assign(Object.create(null) as object, { a: 1 }),
        noPrototypeItems: [Object.create(null) as unknown],
        throwingToString: {
          toString(): string {
            throw new Error('toString');
          },
        },
      };
      [
        ['x{{ throwingGetter.bad }}y', 'xy'],
        ['{{#if throwingGetter.bad}}a{{else}}b{{/if}}', 'b'],
        ['{{#each (v) in l}}{{ throwingGetter.bad }}{{v}}{{/each}}', '1'],
        ['{{#each (v, k) in throwingGetter}}{{k}}={{v}};{{/each}}', 'bad=;'],
        ['x{{ noPrototype }}y', 'xy'],
        ['{{#each (v) in l}}{{ noPrototype }}{{v}}{{/each}}', '1'],
        ['{{#each (v, k) in noPrototype}}{{k}}={{v}};{{/each}}', 'a=1;'],
        ['{{#each (v) in noPrototypeItems}}x{{v}}y{{/each}}', 'xy'],
        ['x{{ throwingToString }}y', 'xy'],
        ['{{#each (v) in l}}{{ throwingToString }}{{v}}{{/each}}', '1'],
      ].forEach(([template, expected]) => {
        expect(
          renderTemplate(template, data, undefined, { strict }),
          template,
        ).to.equal(expected);
      });
      expect(warning).to.not.have.been.called;
    }

    it('should render values, which cannot be rendered, as empty string', () => {
      expectRenderedAsEmptyString(false);
    });

    it('should render values, which cannot be rendered, as empty string in strict mode', () => {
      expectRenderedAsEmptyString(true);
    });
  });

  describe('formatValue', () => {
    function formatValue(value: unknown): string {
      return value !== null && typeof value === 'object'
        ? JSON.stringify(value)
        : // eslint-disable-next-line @typescript-eslint/no-base-to-string
          String(value ?? '');
    }

    it('should format the values of placeholders', () => {
      expect(
        compileTemplate('{{o}} {{o.a}} {{l}} {{n}}', { formatValue })({
          o: { a: 1 },
          l: [1],
          n: null,
        }),
      ).to.equal('{"a":1} 1 [1] ');
    });

    it('should format values within loops and conditionals', () => {
      expect(
        compileTemplate(
          '{{#each (v) in l}}{{v}};{{/each}}{{#if o}}{{o}}{{/if}}',
          { formatValue },
        )({ l: [{ a: 1 }], o: { b: 2 } }),
      ).to.equal('{"a":1};{"b":2}');
    });

    it('should not format the values of conditions, iterations and property keys', () => {
      const format = sinon.spy(formatValue);
      expect(
        compileTemplate(
          '{{#if o.a}}{{#each (v) in o.l}}{{v}}{{/each}}{{/if}}',
          { formatValue: format },
        )({ o: { a: true, l: [1, 2] } }),
      ).to.equal('12');
      expect(format).to.have.been.calledTwice;
    });

    it('should not format translated keys', () => {
      expect(
        compileTemplate('{{#t key}}', { formatValue: () => 'formatted' })(
          { key: 'k' },
          (key) => `${key}-t`,
        ),
      ).to.equal('k-t');
    });

    it('should render values as empty string, if formatting throws', () => {
      expect(
        compileTemplate('a{{v}}b', {
          formatValue: (): string => {
            throw new Error('format');
          },
        })({ v: 1 }),
      ).to.equal('ab');
    });
  });
});
