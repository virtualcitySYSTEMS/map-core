/**
 * returns the default browserLocale, if not possible 'en'
 */
export function detectBrowserLocale(): string {
  if (navigator.language) {
    const lang = navigator.language;
    return lang.substring(0, 2);
  }
  return 'en';
}
