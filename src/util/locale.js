/* eslint-disable import/prefer-default-export */
/**
 * returns the default browserLocale, if not possible 'en'
 * @returns {string}
 */
export function detectBrowserLocale() {
  if (navigator.language) {
    const lang = navigator.language;
    return lang.substring(0, 2);
  }
  return 'en';
}
