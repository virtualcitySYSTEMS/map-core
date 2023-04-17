const exportedNames = new Set();

const defaultExportModules = new Map();

function setupDefaultExport(doclet) {
  const {
    longname,
    meta: { filename, path },
  } = doclet;
  let modulePath = path.split(/[/\\]/);
  modulePath = modulePath.slice(modulePath.indexOf('src') + 1).join('/');
  modulePath = `${modulePath}/${filename.replace(/\.js$/, '')}`;
  defaultExportModules.set(modulePath, longname);
}

function rewriteModule(name) {
  return name
    .replace(/module:([^~<|]*)~([\w\d]+)/g, (all, importee, newName) => {
      if (
        importee.startsWith('ol') ||
        (importee.startsWith('@') && !importee.startsWith('@vcmap/core'))
      ) {
        // XXX think of a better solution for this. maybe always use import... for this
        return all;
      }
      return newName;
    })
    .replace(/module:([^@~<|]+)/, (all, defaultImport) => {
      if (defaultExportModules.has(defaultImport)) {
        return defaultExportModules.get(defaultImport);
      }
      return all;
    });
}

function checkName(name) {
  let rewrittenName = name;
  if (/module:.*<.*>/.test(rewrittenName)) {
    rewrittenName = rewrittenName.replace(/\.<(.*)>/g, (all, generic) => {
      return `<${checkName(generic)}>`;
    });
  }
  if (/module:/.test(rewrittenName)) {
    rewrittenName = rewriteModule(rewrittenName);
  }
  return rewrittenName;
}

function checkParam(param) {
  if (param?.type?.names) {
    param.type.names = param.type.names.map(checkName);
  }
}

exports.handlers = {
  newDoclet(event) {
    const { doclet } = event;
    if (doclet.longname === 'module.exports') {
      doclet.longname = doclet.meta.code.node.id
        ? doclet.meta.code.node.id.name
        : doclet.meta.code.node.name;
      exportedNames.add(doclet.longname);
    }

    if (typeof doclet?.meta?.code?.name === 'string') {
      if (doclet.meta.code.name === 'module.exports') {
        doclet.exports = 'default';
        setupDefaultExport(doclet);
      } else if (doclet.meta.code.name.startsWith('exports.')) {
        doclet.exports = doclet.meta.code.name.replace(/exports./, '');
        exportedNames.add(doclet.longname);
      }
    }

    if (doclet.access === 'private' || !doclet.exports) {
      doclet.implicitPrivate = true;
    }
  },
  parseComplete({ doclets }) {
    doclets
      .filter((d) => d.implicitPrivate)
      .forEach((d) => {
        if (
          exportedNames.has(d.longname.split(/[#~]/)[0]) ||
          d.kind === 'typedef'
        ) {
          delete d.implicitPrivate;
        } else {
          d.access = 'private';
        }
      });

    const nonPrivate = doclets.filter((d) => d.access !== 'private');

    nonPrivate.forEach((d) => {
      if (d.augments) {
        // class
        d.augments = d.augments.map(checkName);
      }
      if (d.params) {
        // function
        d.params.forEach(checkParam);
      }
      if (d.returns) {
        // function
        d.returns.forEach(checkParam);
      }
      if (d.properties) {
        // typedef
        d.properties.forEach(checkParam);
      }

      checkParam(d); // constant & typedef & member
    });
  },
};
