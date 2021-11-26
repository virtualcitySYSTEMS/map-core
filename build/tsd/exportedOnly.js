const exportedLongNames = new Set();

exports.handlers = {
  newDoclet({ doclet }) {
    if (doclet.longname === 'module.exports') {
      doclet.longname = doclet.meta.code.node.id ? doclet.meta.code.node.id.name : doclet.meta.code.node.name;
    }
    if (typeof doclet?.meta?.code?.name === 'string') {
      if (doclet.meta.code.name === 'module.exports') {
        doclet.exports = 'default';
      } else if (doclet.meta.code.name.startsWith('exports.')) {
        doclet.exports = doclet.meta.code.name.replace(/exports./, '');
      }
    }

    if (doclet.exports) {
      exportedLongNames.add(doclet.longname);
    }
  },
  parseComplete({ doclets }) {
    doclets.forEach((doclet) => {
      if (
        !doclet.undocumented &&
        doclet.scope === 'global' &&
        doclet.kind !== 'typedef' &&
        !exportedLongNames.has(doclet.longname)
      ) {
        doclet.undocumented = true;
      }
    });
  },
};
