import {
  getDayOfYear,
  getISODateString,
  getShortLocaleDate,
  getShortLocaleTime,
  isLeapYear,
} from '../../../src/util/dateTime.js';

describe('Date Time Helpers', () => {
  describe('getShortLocaleDate', () => {
    it('should get a short date', () => {
      expect(getShortLocaleDate(new Date(2000, 1, 1), 'en-US')).to.equal('2/1/00'); // node only provides en-US
    });
  });

  describe('getShortLocaleTime', () => {
    it('should get a short time', () => {
      expect(getShortLocaleTime(new Date(2000, 1, 1, 3, 30), 'en-US')).to.equal('3:30 AM'); // node only provides en-US
    });
  });

  describe('getISODateString', () => {
    it('should return a date in yyyy-mm-dd format', () => {
      expect(getISODateString(new Date())).to.match(/\d{4}-\d{2}-\d{2}/);
    });

    it('should pad months', () => {
      expect(getISODateString(new Date(2000, 1, 10))).to.equal('2000-02-10');
    });

    it('should pad days', () => {
      expect(getISODateString(new Date(2000, 9, 2))).to.equal('2000-10-02');
    });
  });

  describe('getDayOfYear', () => {
    it('should return the day of the year', () => {
      expect(getDayOfYear(new Date(2000, 0, 30))).to.equal(30);
    });

    it('should factor in leap years', () => {
      expect(getDayOfYear(new Date(2000, 11, 31))).to.equal(366);
      expect(getDayOfYear(new Date(2000, 2, 1))).to.equal(31 + 29 + 1);
    });
  });

  describe('isLeapYear', () => {
    it('should be true for leap years', () => {
      expect(isLeapYear(new Date(2004, 1, 1))).to.be.true;
      expect(isLeapYear(new Date(2000, 1, 1))).to.be.true;
    });

    it('should be false for non-leap years', () => {
      expect(isLeapYear(new Date(2001, 1, 1))).to.be.false;
      expect(isLeapYear(new Date(1700, 1, 1))).to.be.false;
    });
  });
});
