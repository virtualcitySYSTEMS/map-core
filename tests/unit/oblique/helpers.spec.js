import { hasSameOrigin } from '../../../index.js';

describe('hasSameOrigin', () => {
  it('should return true on relative urls', () => {
    expect(hasSameOrigin('my/relative/path')).to.be.true;
  });

  it('should return true on a data url', () => {
    expect(hasSameOrigin('data:text/one')).to.be.true;
  });

  it('should return true, if a url has the same base', () => {
    const url = new URL('foo', window.location.href);
    expect(hasSameOrigin(url.toString())).to.be.true;
  });

  it('should return false, if the url has another host', () => {
    expect(hasSameOrigin('http://test.com/test')).to.be.false;
  });

  it('should return false, if the url has another protocol', () => {
    const url = new URL('foo', window.location.href);
    url.protocol = 'ftp:';
    expect(hasSameOrigin(url.toString())).to.be.false;
  });

  it('should return false, if the url has another port', () => {
    const url = new URL('foo', window.location.href);
    url.port = '5123';
    expect(hasSameOrigin(url.toString())).to.be.false;
  });
});
