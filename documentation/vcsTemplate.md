# Vcs Template Engine

The Vcs Template Engine is a simple templating engine that allows you to render string templates. The main
application is to render markdown or SVG templates with dynamic data. The engine syntax is loosely based on
mustache and handlebars, e.g. `{{foo}}` would render the value of the property `foo` in the data context.

This property key shorthand also works for array accessors and nested properties, simply use
java script dot notation: `foo.bar` to access an object `{ foo: { bar: 'bar' } }` or brackets: `foo[0]` to access
an array `{ foo: ['bar'] }`. Currently
only string and number properties are rendered correctly. Missing keys are rendered as an empty string `''`,
as well as getters which throw and values which cannot be converted to a string (e.g. `Object.create(null)`).

Alternatively, you can use [openlayers style expressions](https://openlayers.org/en/latest/apidoc/module-ol_style_expressions.html)
which evaluate to a string within
the expansion brackets. Per example `{{ ["round", ["get", "value"]] }}` would render the `value`
attribute rounded. Using the above described property key shorthand (`{{ foo }}` or `{{ foo.bar }}`) is equivalent to writing a `["get", ...keys]`
style expression. Any placeholder starting with `[` is an ol style expression. If writing expressions, you must use `"` for strings and not `'` since the expression within the brackets
must be JSON parsable (`{{ ['round', ['get', 'value]] }}` will not work). Expressions cannot contain the closing delimiter (`}}`).

String literals render text as is: `{{ 'foo' }}` renders `foo`. Within a literal, quotes and backslashes are escaped
by a backslash (`{{ '\'' }}` renders `'`). Literals may contain the delimiters, so they can be used to escape them:
`{{ '{{' }}` renders `{{` and `{{ '{{#if foo}}' }}` renders `{{#if foo}}`, not a block.

The following markdown example template can illustrate this:

```markdown
# Title

- this is a listing
- with the {{ property }} "property"
- and the {{ missing }} missing property
- with image ![](https://vc.systems/images/{{logo}}.png)
- with video <video src=\"path/to/video.mp4\" width=\"{{ ["round", ["get", "videoWidth"]] }}\" height=\"240\" controls></video>
- with link [Link text Here](https://vc.systems/?id={{id}})
```

#### Conditional rendering

You can use conditional rendering to only render certain blocks if
an ol style expression evaluates to a truthy value.
You can replace `$expression` with a property key or an ol style expression which
evaluates to a boolean. Using a property key is shorthand for the `["get", ...keys]`
same as with the `{{}}` property expansion. Statements can be nested. You
can use the following building blocks to manage conditional rendering:

- `{{#if $expression }}` is the beginning of a conditional block
- `{{elseif $expresson}}` alternate expression, can be placed within an if block
- `{{else}}` catch all if any of the previous conditions fail
- `{{/if}}` end clause of a conditional statement. Failing to place this, will break the template.

Whitespace within the delimiters of block tags is allowed, e.g. `{{ #if foo }}`, `{{ else }}` or `{{ /if }}`, but
not within the keyword: `{{# if foo}}` is not a block tag. `{{else if foo}}` is invalid, use `{{elseif foo}}` instead.

```markdown
# Title

{{#if property}}
{{#if headerProperty}}

### {{ headerProperty }}

{{/if}}
**property** is {{ property }}
{{elseif ["!", ["get", "otherProperty"]]}}
cannot find otherProperty in this obect
{{else}}
there are no properties i expected here.
{{/if}}
```

#### Iteration

You can iterate over `Array`s and `Object`s using the following syntax for arrays
`{{#each (value, index) in array}}{{value}}: {{index}}{{/each}}` and for objects
`{{#each (value, key, index) in object}}{{key}}: {{value}} ({{index}}){{/each}}`.
Where the `(value, key?, index?)` is the parameter list and will determine the
name of these values within the data context of the block. The object you are
accessing from the data can be shorthanded to its name (which in turn is equal
to the expression: `["get", "name"]`), or an openlayers expression same as with conditions.

You must provide an `item` parameter, `index` and `key` are optional.
Make sure to provide an item parameter name that does not potentially collide with a key
in your current contexts data, otherwise you cannot access it within the block.
Within the block, the data is available as outside of it, including inherited properties such as getters of class instances.
Plain objects (and objects without prototype) are iterated, other objects such as class instances are not.

```markdown
# List of stuff

- **key**: value
  {{#each (item) in arrayOfItems}}
  {{#each (subItemValue, key) in item}}
- **{{key}}**: {{subItemValue}}
  {{/each}}
  {{/each}}
```

Given an input of `[{ foo: 1 }, { foo: 2, bar: 3 }, { bar: 1}]` the above template would render:

```markdown
- **key**: value
- **foo**: 1
- **foo**: 2
- **bar**: 3
- **bar**: 1
```

### Translation

There is a build in translate directive for which you can provide a translation function.
Use the `{{#t expr}}` block. The given `expr` (ol style expression, context property or string literal)
will be evaluated and the result passed to the translation function.
If the `expr` is a property key, which is not found in the data context, the key itself is passed to the
translation function. Use a string literal (`{{#t 'my.key'}}`) to always translate the given key.
The translation function should return a string.
The translation function is passed as a parameter to the render function.

### Compiling templates

`renderTemplate` parses the template on each call. If a template is rendered multiple times,
use `compileTemplate` instead. It returns a function, which renders the template with the given data
and an optional translation function:

```js
import { compileTemplate } from '@vcmap/core';

const render = compileTemplate('# {{ title }}');
render({ title: 'foo' }); // '# foo'
render({ title: 'bar' }); // '# bar'
```

The placeholders of templates without conditional or iteration blocks are only parsed once.
Templates with blocks are expanded on each rendering, since the blocks depend on the data. Their expressions are
compiled once.

### Formatting values

By default, the values of placeholders are rendered with `String`, `null` and `undefined` as an empty string.
Pass the `formatValue` option to render values differently, e.g. objects as JSON:

```js
const render = compileTemplate('{{ user }} ({{ user.name }})', {
  formatValue: (value) =>
    value !== null && typeof value === 'object'
      ? JSON.stringify(value)
      : String(value ?? ''),
});
render({ user: { name: 'foo' } }); // '{"name":"foo"} (foo)'
```

Only the rendered values are formatted: property keys, conditions and iterations use the values as is.
If `formatValue` throws, the value is rendered as an empty string.

### Delimiters

By default, placeholders and blocks are delimited by `{{` and `}}`. Other delimiters can be passed as
`delimiters` option, e.g. single braces for short texts such as i18n messages:

```js
const render = compileTemplate('{0}-{1} of {total}', {
  delimiters: ['{', '}'],
});
render([1, 10]); // '1-10 of '
render({ 0: 1, 1: 10, total: 100 }); // '1-10 of 100'
```

The delimiters only change how placeholders and blocks are marked, the syntax within them is the same:
`{foo.bar}`, `{["get", "foo"]}`, `{'{'}`, `{#t foo}` and `{#if foo}…{/if}` are all supported.
Delimiters must not be empty and must not start or end with whitespace.

- Any text within the delimiters is a placeholder: `{foo bar}` renders the property `foo bar`, usually an empty string.
  Use string literals to render the delimiters as text: `{'{'}` renders `{`.
- Other delimiters are text: with single braces, `%{foo}%` renders `%`, the property `foo` and `%`, `<%foo%>` is kept as is.
- If a placeholder contains an opening delimiter, the outer delimiter is text: with single braces, `{{ foo }}` renders `{`, the property `foo` and `}`.
- Empty placeholders (`{}`) and unclosed placeholders (`{ foo`) are kept as is.

### Invalid templates

Invalid template content is rendered as text and a warning is logged, so a template never throws while rendering:

- invalid ol style expressions (`{{ [bad }}`) and string literals (`{{ 'unclosed }}`) are kept as is.
- if the blocks of a template are invalid (e.g. a missing `{{/if}}` or an `{{else}}` before an `{{elseif}}`),
  no blocks are expanded and all block tags are kept as is. Placeholders are still rendered. A single warning is
  logged for the invalid blocks, not for each block tag.
- block tags outside of a block (e.g. `{{else}}` without an `{{#if}}`) and malformed block tags
  (e.g. `{{#if}}`, `{{#each foo}}` or `{{else if foo}}`) are kept as is.

Empty placeholders (`{{ }}`) and unclosed placeholders (`{{ foo`) are not invalid content, but text: they are
kept as is, without a warning, also in strict mode.

Pass the `strict` option to throw instead. Templates without blocks are checked when compiled.
Templates with blocks are checked when rendered, and only the content the data renders: invalid content
within a branch that isn't rendered neither throws nor logs a warning.

```js
compileTemplate('{{ [bad }}', { strict: true }); // throws
renderTemplate('{{#if foo}}', {}, undefined, { strict: true }); // throws
compileTemplate('{{#if foo}}{{ [bad }}{{/if}}', { strict: true })({
  foo: false,
}); // does not throw, the branch is not rendered
```
