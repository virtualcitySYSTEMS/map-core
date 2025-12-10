import Feature from 'ol/Feature.js';
import nock from 'nock';
import { expect } from 'chai';
import UrlIdAttributeProvider from '../../../src/featureProvider/urlIdAttributeProvider.js';

describe('UrlAttributeProvider', () => {
  let provider: UrlIdAttributeProvider;
  let feature: Feature;

  beforeEach(() => {
    nock('https://example.com')
      .get('/data/feature1.json')
      .reply(200, { attr1: 'value1', attr2: 42 });

    provider = new UrlIdAttributeProvider({
      name: 'UrlProvider',
      urlTemplate: 'https://example.com/data/{id}.json',
    });
    feature = new Feature();
    feature.setId('feature1');
  });

  afterEach(() => {
    provider.destroy();
    nock.cleanAll();
  });

  it('should augment a feature', async () => {
    await provider.augmentFeature(feature);
    expect(feature.get('attr1')).to.equal('value1');
    expect(feature.get('attr2')).to.equal(42);
  });
});
