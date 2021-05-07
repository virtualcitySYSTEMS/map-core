/**
 * Handle the api annotation.
 * @param {Object} dictionary The tag dictionary.
 */
exports.defineTags = function defineTags(dictionary) {
  dictionary.defineTag('export', {
    onTagged(doclet) {
      doclet.export = true;
    },
  });
};
