const path = require('path');
const fs = require('fs');

/**
 * @typedef {Object} ExportDef
 * @property {string} default
 * @property {Set<string>} named
 */

/**
 * @param {string} nsPath
 * @returns {string}
 */
function resolvePath(nsPath) {
  return `./${path.relative(path.join(__dirname, '..', '..'), nsPath).replace(/\\/g, '/')}`;
}

/**
 * @param {Object<string, ExportDef>} fileNames
 */
function createIndex(fileNames) {
  const imports = [];

  const exports = Object.entries(fileNames)
    .map(([fileName, e]) => {
      const filePath = resolvePath(fileName);
      const es = [...e.named];
      if (e.default) {
        es.push(`default as ${e.default}`);
      }
      if (es.length === 0) {
        console.error(`Found nothing to export in file ${fileName}`);
        return null;
      }
      return `export { ${es.join(', ')} } from '${filePath}';`;
    })
    .filter(f => f);

  imports.push(
    'import \'./src/ol/geom/circle.js\';',
    'import \'./src/ol/geom/geometryCollection.js\';',
    'import \'./src/ol/feature.js\';',
    'import \'./src/cesium/wallpaperMaterial.js\';',
    'import \'./src/cesium/cesium3DTilePointFeature.js\';',
    'import \'./src/cesium/cesium3DTileFeature.js\';',
    'import \'./src/cesium/cesiumVcsCameraPrimitive.js\';',
    'import \'./src/cesium/entity.js\';',
  );
  imports.push('');
  exports.push('');
  fs.writeFileSync('./index.js', `${imports.join('\n')}\n${exports.join('\n')}`, 'utf8');
}

exports.publish = function publish(data) {
  const docs = data([
    { define: { isObject: true } },
    function dataCb() {
      if (this.longname === 'module.exports') {
        this.longname = this.meta.code.node.id ? this.meta.code.node.id.name : this.meta.code.node.name;
      }

      if (typeof this?.meta?.code?.name === 'string') {
        if (this.meta.code.name === 'module.exports') {
          this.exports = 'default';
        } else if (this.meta.code.name.startsWith('exports.')) {
          this.exports = this.meta.code.name.replace(/exports./, '');
        }
      }

      return this.access !== 'private' && this.exports;
    },
  ]).get();

  /**
   * @type {Object<string, ExportDef>}
   */
  const fileNames = {};

  docs.forEach((doc) => {
    const fileName = path.join(doc.meta.path, doc.meta.filename);
    if (!fileNames[fileName]) {
      fileNames[fileName] = {
        named: new Set(),
      };
    }
    const exports = fileNames[fileName];
    const name = doc.longname.split('.').pop();
    if (doc.exports === 'default') {
      exports.default = name;
    } else {
      exports.named.add(name);
    }
  });

  createIndex(fileNames);
};
