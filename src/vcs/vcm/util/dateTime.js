/**
 * @param {Date} date
 * @param {string=} locale
 * @returns {string}
 */
export function getShortLocaleDate(date, locale) {
  // dateStyle is not within the standard yet
  // @ts-ignore
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short' }).format(date);
}

/**
 * @param {Date} date
 * @param {string=} locale
 * @returns {string}
 */
export function getShortLocaleTime(date, locale) {
  // timeStyle is not within the standard yet
  // @ts-ignore
  return new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(date);
}

/**
 * @param {Date} date
 * @returns {string}
 */
export function getISODateString(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${date.getFullYear()}-${month > 9 ? '' : 0}${month}-${day > 9 ? '' : 0}${day}`;
}

/**
 * @param {Date} date
 * @returns {number}
 */
export function getDayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  // TS cant handle date manipulation
  // @ts-ignore
  const diff = (date - start) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * @param {Date} date
 * @returns {boolean}
 */
export function isLeapYear(date) {
  const currentYear = date.getFullYear();
  if (currentYear % 4 !== 0) {
    return false;
  } else if (currentYear % 100 !== 0) {
    return true;
  } else if (currentYear % 400 !== 0) {
    return false;
  }
  return true;
}
