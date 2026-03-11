import { expect } from 'chai';
import nock from 'nock';
import type Feature from 'ol/Feature.js';
import AbstractFeatureProvider from '../../../src/featureProvider/abstractFeatureProvider.js';
import type { CompositeFeatureProviderOptions } from '../../../src/featureProvider/compositeFeatureProvider.js';
import CompositeFeatureProvider from '../../../src/featureProvider/compositeFeatureProvider.js';
import MapboxFeatureProvider from '../../../src/featureProvider/mapboxFeatureProvider.js';
import MapboxStyleLayer from '../../../src/layer/mapboxStyleLayer.js';
import { allowPicking, vcsLayerName } from '../../../src/layer/layerSymbols.js';
import TestAttributeProvider from '../featureProvider/testAttributeProvider.js';

class TestFeatureProvider extends AbstractFeatureProvider {
  static get className(): string {
    return 'TestFeatureProvider';
  }

  // eslint-disable-next-line class-methods-use-this
  getFeaturesByCoordinate(): Promise<Feature[]> {
    return Promise.resolve([]);
  }
}

const mockStyle = {
  version: 8,
  sources: {
    roads: {
      type: 'vector',
      tiles: ['http://localhost/tiles/{z}/{x}/{y}.pbf'],
    },
    buildings: {
      type: 'vector',
      tiles: ['http://localhost/tiles/{z}/{x}/{y}.pbf'],
    },
  },
  layers: [
    // eslint-disable-next-line @typescript-eslint/naming-convention
    { id: 'roads-line', type: 'line', source: 'roads', 'source-layer': 'road' },
    {
      id: 'buildings-fill',
      type: 'fill',
      source: 'buildings',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      'source-layer': 'building',
    },
  ],
};

describe('MapboxStyleLayer', () => {
  before(() => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const header = { 'Content-Type': 'application/json' };
    nock('http://localhost')
      .get('/style-filter.json')
      .reply(200, mockStyle, header)
      .get('/style-composite.json')
      .reply(200, mockStyle, header)
      .get('/style-tojson.json')
      .reply(200, mockStyle, header)
      .get('/style-augmentation-tojson.json')
      .reply(200, mockStyle, header)
      .get('/style-feature-provider-tojson.json')
      .reply(200, mockStyle, header)
      .persist();
  });

  after(() => {
    nock.cleanAll();
  });

  it('should filter mapbox layers by configured sources on initialize', async () => {
    const styleUrl = 'http://localhost/style-filter.json';

    const layer = new MapboxStyleLayer({
      url: styleUrl,
      sources: ['roads'],
      allowPicking: false,
    });

    await layer.initialize();

    const group = layer.getImplementationOptions().styledMapboxLayerGroup;
    const layers = group.getLayersArray();

    expect(layers).to.have.length(1);
    expect(layers[0].get('mapbox-source')).to.equal('roads');
    expect(layers[0][allowPicking]).to.equal(false);
    expect(layers[0][vcsLayerName]).to.equal(layer.name);

    layer.destroy();
  });

  it('should create a composite feature provider when an attribute provider is configured', async () => {
    const styleUrl = 'http://localhost/style-composite.json';

    const layer = new MapboxStyleLayer({
      url: styleUrl,
      featureProvider: new TestAttributeProvider(42),
      excludeLayerFromPicking: ['buildings'],
    });

    await layer.initialize();

    expect(layer.featureProvider).to.be.instanceOf(CompositeFeatureProvider);
    const mapboxFeatureProvider =
      // @ts-expect-error assert private internals for provider composition behavior
      (layer.featureProvider._featureProviders as MapboxFeatureProvider[])[0];
    expect(mapboxFeatureProvider).to.be.instanceOf(MapboxFeatureProvider);
    // @ts-expect-error assert private field for option forwarding behavior
    expect(mapboxFeatureProvider._excludeLayerFromPicking).to.have.members([
      'buildings',
    ]);

    layer.destroy();
  });

  it('should serialize sources and excluded picking layers', () => {
    const layer = new MapboxStyleLayer({
      url: 'http://localhost/style-tojson.json',
      sources: ['roads'],
      excludeLayerFromPicking: ['buildings'],
    });

    const config = layer.toJSON();

    expect(config.sources).to.have.members(['roads']);
    expect(config.excludeLayerFromPicking).to.have.members(['buildings']);

    layer.destroy();
  });

  it('should serialize the original augmentation provider after initialization', async () => {
    const augmentationProvider = new TestAttributeProvider(42, {
      name: 'augmentation-provider',
    });
    const layer = new MapboxStyleLayer({
      url: 'http://localhost/style-augmentation-tojson.json',
      featureProvider: augmentationProvider,
      excludeLayerFromPicking: ['buildings'],
    });

    await layer.initialize();

    const config = layer.toJSON();

    expect(layer.featureProvider).to.be.instanceOf(CompositeFeatureProvider);
    const compositeProvider =
      config.featureProvider as CompositeFeatureProviderOptions;

    expect(compositeProvider.featureProviders).to.have.length(1);
    expect(compositeProvider.attributeProviders[0]).to.deep.equal(
      augmentationProvider.toJSON(),
    );
    expect(compositeProvider.featureProviders).to.have.length(1);
    expect(compositeProvider.featureProviders[0]).to.have.property(
      'type',
      'MapboxFeatureProvider',
    );
    expect(config.excludeLayerFromPicking).to.have.members(['buildings']);

    layer.destroy();
  });

  it('should serialize a differing feature provider after initialization', async () => {
    const featureProvider = new TestFeatureProvider({
      name: 'custom-feature-provider',
    });
    const layer = new MapboxStyleLayer({
      url: 'http://localhost/style-feature-provider-tojson.json',
      featureProvider,
      sources: ['roads'],
    });

    await layer.initialize();

    const config = layer.toJSON();

    expect(layer.featureProvider).to.equal(featureProvider);
    expect(config.featureProvider).to.deep.equal(featureProvider.toJSON());
    expect(config.sources).to.have.members(['roads']);

    layer.destroy();
  });
});
