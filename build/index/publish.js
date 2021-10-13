const path = require('path');
const fs = require('fs');

const namespaces = {};

function resolvePath(nsPath) {
  return `./${path.relative(path.join(__dirname, '..', '..'), nsPath).replace(/\\/g, '/')}`;
}

function createIndex() {
  const importedNamedFiles = {};

  const exports = [];
  const imports = [];

  Object.keys(namespaces).sort().forEach((ns) => {
    const def = namespaces[ns];
    const filePath = resolvePath(def.path);
    if (def.isNamed) {
      if (!importedNamedFiles[filePath]) {
        exports.push(`export * from '${filePath}';`);
        importedNamedFiles[filePath] = true;
      }
    } else {
      exports.push(`export { default as ${def.name} } from '${filePath}';`);
    }
  });

  imports.push(
    'import \'./src/ol/geom/circle.js\';',
    'import \'./src/ol/geom/geometryCollection.js\';',
    'import \'./src/ol/feature.js\';',
    'import \'./src/cesium/wallpaperMaterial.js\';',
    'import \'./src/cesium/cesium3DTilePointFeature.js\';',
    'import \'./src/cesium/cesium3DTileFeature.js\';',
    'import \'./src/cesium/cesiumVcsCameraPrimitive.js\';',
  );
  imports.push('');
  exports.push('');
  fs.writeFileSync('./index.js', `${imports.join('\n')}\n${exports.join('\n')}`, 'utf8');
}

exports.publish = function publish(data) {
  const docs = data(function dataCb() {
    return typeof this.export === 'boolean';
  }).get();

  docs.forEach((doc) => {
    if (doc.kind === 'class') {
      const className = doc.longname.replace(/\.exports/, '');
      namespaces[className] = {
        path: path.join(doc.meta.path, doc.meta.filename),
        isNamed: /\.exports/.test(doc.longname),
        name: doc.name,
      };
    } else if (
      (doc.kind === 'function' || doc.isEnum || doc.kind === 'member' || doc.kind === 'constant') &&
      !/#/.test(doc.longname)
    ) {
      const name = doc.longname.replace(/\.exports/, '');
      namespaces[name] = {
        path: path.join(doc.meta.path, doc.meta.filename),
        isNamed: /\.exports/.test(doc.longname),
        name: doc.name,
      };
    }
  });

  createIndex();
};
