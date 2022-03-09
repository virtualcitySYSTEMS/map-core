// generates vcs.d.ts
const path = require('path');
const fs = require('fs');

/**
 * @typedef {Object} VcsTypedefDoclet
 * @property {string} name - the longname of the typedef
 * @property {string} inheritsFrom,
 * @property {Array<Object>} properties
 */

/**
 * @type {Object<string, VcsTypedefDoclet>}
 */
const typedefs = {};

function rewriteModule(property) {
  return property
    .replace(/module:vcs\/([^~]*)~([\w\d]+)/g, (all, importee, name) => {
      if (typedefs[name]) {
        return name;
      }
      return `import("@vcmap/core").${name}`;
    })
    .replace(/module:([^~<|]*)~([\w\d]+)/g, 'import("$1").$2')
    .replace(/module:([\w\d./]+)/g, 'import("$1").default');
}

/**
 * @param {string} input
 * @returns {string|*}
 */
function checkPropertyName(input) {
  let property = input;
  if (/module:.*<.*>/.test(property)) {
    property = property.replace(/\.<(.*)>/g, (all, generic) => {
      return `<${checkPropertyName(generic)}>`;
    });
  }
  if (/module:/.test(property)) {
    property = rewriteModule(property);
  }

  if (/\b(Array|Object|Promise|Set|Map)/.test(property)) {
    property = property
      .replace(/(Array|Object|Promise|Set|Map)\.</g, '$1<')
      .replace(/Object<(.*?),\s?([\w.]+|\{.*\}|\([\s\S]*?\)|\*|\w+<[\s\S]*?>)>/, (all, key, val) => {
        return `{ [s: ${checkPropertyName(key)}]: ${checkPropertyName(val)}; }`;
      })
      .replace(/(vcs[.\w]+)(>|\||\)|,)/g, (all, match, ending) => {
        return `${checkPropertyName(match)}${ending}`;
      });
    if (property === 'Promise') {
      property = 'Promise<any>';
    }
  } else if (/^(Number|String|Boolean)$/.test(property)) {
    return property.toLowerCase();
  }

  return property
    .replace(/\*/, 'any')
    .replace(/(\b)function(\(.*\))?/, '$1Function');
}

/**
 * @param {Object} def
 * @returns {string}
 */
function getParamType(def) {
  switch (def.type) {
    case 'NameExpression':
      return checkPropertyName(def.name);
    case 'TypeApplication':
      return `${def.expression.name}<${def.applications.map(getParamType).join('|')}>`;
    case 'TypeUnion':
      return `(${def.elements.map(getParamType).join('|')})`;
    default:
      return 'any';
  }
}

/**
 * @param {string} name
 * @param {Object} parsedType
 * @returns {string}
 */
function getFunctionFromProperty(name, parsedType) {
  const params = parsedType.params
    .map((def, index) => {
      const paramType = getParamType(def);
      return `p${index}${def.optional ? '?' : ''}: ${checkPropertyName(paramType)}`;
    })
    .filter(p => p);

  let resultValue = 'void';
  if (parsedType.result) {
    resultValue = getParamType(parsedType.result);
  }

  return `\t${name}(${params.join(', ')}):${resultValue}\n`;
}

/**
 * writes out typedefs as interfaces, so they can be used with import("vcs").interfaceName
 * @returns {string[]}
 */
function writeTypeDefs() {
  return Object.keys(typedefs).map((key) => {
    const def = typedefs[key];
    let decleration = `interface ${key.replace(/\./g, '$')}`;
    if (def.inheritsFrom !== 'Object') {
      decleration += ` extends ${checkPropertyName(def.inheritsFrom)} {\n`;
    } else {
      decleration += '{ \n';
    }

    if (def.properties) {
      def.properties.forEach((prop) => {
        let { name } = prop;
        if (/-/.test(name)) {
          name = `'${name}'`;
        }
        if (
          (
            prop.nullable !== false &&
            (
              (prop.type.names && prop.type.names.includes('undefined')) ||
              prop.nullable
            )
          ) ||
          prop.optional
        ) {
          name = `${name}?`;
        }

        if (prop.type.names.length === 1 && prop.type.names[0] === 'function') {
          decleration += getFunctionFromProperty(name, prop.type.parsedType);
        } else {
          decleration += `\t${name}: ${prop.type.names.map(checkPropertyName).join('|')}\n`;
        }
      });
    }

    decleration += '}\n';
    return decleration;
  });
}

exports.defineTags = function defineTags(dictionary) {
  dictionary.defineTag('api', {
    mustHaveValue: false,
    canHaveType: false,
    canHaveName: false,
    onTagged(doclet) {
      doclet.api = true;
    },
  });

  dictionary.defineTag('interface', {});

  dictionary.defineTag('inheritDoc', {
    mustHaveValue: false,
    canHaveType: false,
    canHaveName: false,
    onTagged(doclet) {
      doclet.inheritdoc = true;
    },
  });
};

exports.handlers = {
  newDoclet({ doclet }) {
    const filePath = path.join(doclet.meta.path, doclet.meta.filename);

    if (doclet.skip) {
      return;
    }
    if (doclet.kind === 'typedef') {
      typedefs[doclet.longname] = {
        filePath,
        name: doclet.longname,
        inheritsFrom: doclet.type.names[0],
        properties: doclet.properties,
      };
    }
  },
  parseComplete() {
    const typedefDeclerations = writeTypeDefs();
    const joinedTypeDefs = typedefDeclerations
      .join('')
      .replace(/import\("@vcmap\/core"\)/g, 'core')
      .replace(/import\("ol"\)\.Feature/g, 'olFeature')
      .replace(/import\("ol\/Feature"\)\.default/g, 'olFeature');

    const overrideCollectionContent = fs.readFileSync('./build/types/overrideCollection.d.ts');
    const overrideCollectionTypes = overrideCollectionContent.toString()
      .replace(/import.*;/, '')
      .replace(/\b(Collection|VcsEvent|LayerCollection|Layer|MapCollection|VcsMap)\b/g, 'core.$1')
      .replace(/export/g, '');

    fs.writeFileSync('./build/types/vcs.d.ts', `/**
 * This file is auto generated and to be used for typechecking only.
 * It allows for the use of global _typedefs_ from jsdocs.
 * Example: 
 * @typedef {VcsObjectOptions} FooOptions
 * @property {boolean} isFoo
 * can be used as @param {FooOptions} options in a doclet
 */
import * as core from '@vcmap/core';
import olFeature from 'ol/Feature';

declare global {
namespace vcs {
  let apps: Map<string, core.VcsApp>;
}
${joinedTypeDefs}
${overrideCollectionTypes}
}
`);
  },
};
