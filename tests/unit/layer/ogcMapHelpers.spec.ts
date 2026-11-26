import { expect } from 'chai';
import { getOgcMapUrl } from '../../../src/layer/ogcMapHelpers.js';

describe('getOgcMapUrl', () => {
  const options = {
    parameters: {},
  };

  it('does not send transparent by default', () => {
    const url = getOgcMapUrl('http://localhost/collections/maps', options);

    expect(url.searchParams.has('transparent')).to.equal(false);
  });

  it('sends explicit transparent and bgcolor parameters', () => {
    const url = getOgcMapUrl('http://localhost/collections/maps', {
      ...options,
      parameters: { bgcolor: 'white', transparent: 'false' },
    });

    expect(url.searchParams.get('bgcolor')).to.equal('white');
    expect(url.searchParams.get('transparent')).to.equal('false');
  });

  it('sends datetime and collections from the parameters', () => {
    const url = getOgcMapUrl('http://localhost/ogc', {
      ...options,
      parameters: {
        datetime: '2026-10-23T00:00:00Z',
        collections: 'roads,buildings',
      },
    });

    expect(url.pathname).to.equal('/ogc/map');
    expect(url.searchParams.get('datetime')).to.equal('2026-10-23T00:00:00Z');
    expect(url.searchParams.get('collections')).to.equal('roads,buildings');
  });

  it('lets parameters replace query parameters of the url', () => {
    const url = getOgcMapUrl('http://localhost/ogc?datetime=2020&foo=bar', {
      ...options,
      parameters: { datetime: '2026' },
    });

    expect(url.searchParams.getAll('datetime')).to.deep.equal(['2026']);
    expect(url.searchParams.get('foo')).to.equal('bar');
  });
});
