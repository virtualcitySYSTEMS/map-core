import { expect } from 'chai';
import LayerGroup from 'ol/layer/Group.js';
import RenderFeature from 'ol/render/Feature.js';
import Layer from '../../../src/layer/layer.js';
import MapboxFeatureProvider from '../../../src/featureProvider/mapboxFeatureProvider.js';

describe('MapboxFeatureProvider', () => {
  describe('excludeLayerFromPicking', () => {
    let layer: Layer;

    beforeEach(() => {
      layer = new Layer({ name: 'testLayer' });
    });

    afterEach(() => {
      layer.destroy();
    });

    it('should exclude configured mvt layers from picking', async () => {
      const provider = new MapboxFeatureProvider({
        styledMapboxLayerGroup: new LayerGroup(),
        excludeLayerFromPicking: ['buildings'],
      });
      const includedFeature = new RenderFeature(
        'Point',
        [0, 0],
        [2],
        2,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        { 'mvt:layer': 'roads' },
        'roads-id',
      );
      const excludedFeature = new RenderFeature(
        'Point',
        [1, 1],
        [2],
        2,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        { 'mvt:layer': 'buildings' },
        'buildings-id',
      );

      // @ts-expect-error access protected member for testing
      provider._renderMap.getFeaturesAtPixel = (): RenderFeature[] => [
        includedFeature,
        excludedFeature,
      ];

      const features = await provider.getFeaturesByCoordinate(
        [0, 0, 0],
        1,
        layer,
      );

      expect(features).to.have.length(1);
      expect(features[0].getId()).to.equal('roads-id');

      provider.destroy();
    });

    it('should keep all layers when no exclude list is configured', async () => {
      const provider = new MapboxFeatureProvider({
        styledMapboxLayerGroup: new LayerGroup(),
      });
      const featureA = new RenderFeature(
        'Point',
        [0, 0],
        [2],
        2,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        { 'mvt:layer': 'roads' },
        'roads-id',
      );
      const featureB = new RenderFeature(
        'Point',
        [1, 1],
        [2],
        2, // eslint-disable-next-line @typescript-eslint/naming-convention
        { 'mvt:layer': 'buildings' },
        'buildings-id',
      );

      // @ts-expect-error access protected member for testing
      provider._renderMap.getFeaturesAtPixel = (): RenderFeature[] => [
        featureA,
        featureB,
      ];

      const features = await provider.getFeaturesByCoordinate(
        [0, 0, 0],
        1,
        layer,
      );

      expect(features).to.have.length(2);
      expect(features.map((f) => f.getId())).to.have.members([
        'roads-id',
        'buildings-id',
      ]);

      provider.destroy();
    });
  });
});
