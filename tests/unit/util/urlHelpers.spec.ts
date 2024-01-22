import { expect } from 'chai';
import { isSameOrigin } from '../../../src/util/urlHelpers.js';

describe('urlHelper isSameOrigin', () => {
  it('should return true on relative urls', () => {
    expect(isSameOrigin('my/relative/path')).to.be.true;
  });

  it('should return true on a data url', () => {
    expect(isSameOrigin('data:text/one')).to.be.true;
  });

  it('should return true, if a url has the same base', () => {
    const url = new URL('foo', window.location.href);
    expect(isSameOrigin(url.toString())).to.be.true;
  });

  it('should return false, if the url has another host', () => {
    expect(isSameOrigin('http://test.com/test')).to.be.false;
  });

  it('should return false, if the url has another protocol', () => {
    const url = new URL('foo', window.location.href);
    url.protocol = 'ftp:';
    expect(isSameOrigin(url.toString())).to.be.false;
  });

  it('should return false, if the url has another port', () => {
    const url = new URL('foo', window.location.href);
    url.port = '5123';
    expect(isSameOrigin(url.toString())).to.be.false;
  });
});
