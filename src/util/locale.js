import VcsEvent from '../vcsEvent.js';

/**
 * @type {VcsEvent<string>}
 */
let localeChangedEvent;

/**
 * @returns {VcsEvent<string>}
 */
export function getLocaleChangedEvent() {
  if (!localeChangedEvent) {
    localeChangedEvent = new VcsEvent();
  }
  return localeChangedEvent;
}

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

/**
 * @type {string}
 */
let currentLocale;

/**
 * @returns {string}
 */
export function getCurrentLocale() {
  if (!currentLocale) {
    currentLocale = detectBrowserLocale();
  }
  return currentLocale;
}

/**
 * @param {string} value
 */
export function setCurrentLocale(value) {
  if (typeof value === 'string') {
    currentLocale = value;
    getLocaleChangedEvent().raiseEvent(value);
  }
}
