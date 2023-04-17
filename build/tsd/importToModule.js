const importRegex = /import\("([@\w\d/-]+)"\)(\.[\w\d-]+)/g;

exports.handlers = {
  jsdocCommentFound(event) {
    event.comment = event.comment.replace(
      importRegex,
      (all, module, qualifier) => {
        const name = `module:${module}`;
        if (qualifier) {
          return `${name}~${qualifier.substring(1)}`;
        }
        return name;
      },
    );
  },
};
