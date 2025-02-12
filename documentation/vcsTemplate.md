# Vcs Template Engine

The Vcs Template Engine is a simple templating engine that allows you to render string templates. The main
application is to render markdown or SVG templates with dynamic data. The engine syntax is loosely based on
mustache and handlebars, e.g. `{{foo}}` would render the value of the property `foo` in the data context.

This property key shorthand also works for array accessors and nested properties, simply use
java script dot notation: `foo.bar` to access an object `{ foo: { bar: 'bar' } }` or brackets: `foo[0]` to access
an array `{ foo: ['bar'] }` where `foo["bar"]` is equivalent to `foo.bar`. Currently
only string and number properties are rendered correctly. Missing keys are rendered as an empty string `''`.

Alternatively, you can use [openlayers style expressions](https://openlayers.org/en/latest/apidoc/module-ol_style_expressions.html)
which evaluate to a string within
the expansion brackets. Per example `{{ ["round", ["get", "value"]] }}` would render the `value`
attribute rounded. Using the above described property key shorthand (`{{ foo }}` or `{{ foo.bar }}`) is equivalent to writing a `["get", ...keys]`
style expression. If writing expressions, you must use `"` for strings and not `'` since the expression within the brackets
must be JSON parsable (`{{ ['round', ['get', 'value]] }}` will not work).

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
o the expression: `["get", "name"]`), or an openlayers expression same as with conditions.

You must provide an `item` parameter, `index` and `key` are optional.
Make sure to provide an item parameter name that does not potentially collide with a key
in your current contexts data, otherwise you cannot access it within the block.

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
If the `expr` is not an ol style expression and is not found in the data context, it will be passed as a
string literal to the translation function.
The translation function should return a string.
The translation function is passed as a parameter to the render function.
