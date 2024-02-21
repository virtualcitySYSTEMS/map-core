import { Feature } from 'ol';
import { Point } from 'ol/geom.js';
import { expect } from 'chai';
import { Color } from '@vcmap-cesium/engine';
import {
  FeatureStoreLayer,
  featureStoreStateSymbol,
  OpenlayersMap,
  VcsApp,
  vcsMetaVersion,
} from '../../../index.js';
import { timeout } from '../helpers/helpers.js';

describe('FeatureStoreFeatureVisibility', () => {
  describe('tracking', () => {
    let app: VcsApp;
    let layer: FeatureStoreLayer;
    let id: string;
    let feature: Feature;

    before(async () => {
      app = new VcsApp();
      const map = new OpenlayersMap({});
      app.maps.add(map);
      await app.maps.setActiveMap(map.name);
      layer = new FeatureStoreLayer({
        featureType: '',
        features: [],
        hiddenStaticFeatureIds: [],
        type: '',
        vcsMeta: {
          version: vcsMetaVersion,
        },
        id: 'foo',
      });
      id = 'foo';
      feature = new Feature(new Point([0, 0, 1]));
      feature[featureStoreStateSymbol] = 'dynamic';
      feature.setId(id);
      layer.addFeatures([feature]);
      app.layers.add(layer);
      await layer.activate();
    });

    after(() => {
      app.destroy();
    });

    describe('without tracking', () => {
      it('should not active change tracking when highlighting / hiding', () => {
        layer.featureVisibility.highlight({
          [id]: Color.fromCssColorString('#ff00ff'),
        });
        expect(layer.changeTracker.active).to.be.false;
        layer.featureVisibility.clearHighlighting();
        expect(layer.changeTracker.active).to.be.false;
        layer.featureVisibility.hideObjects([id]);
        expect(layer.changeTracker.active).to.be.false;
        layer.featureVisibility.clearHiddenObjects();
        expect(layer.changeTracker.active).to.be.false;
      });
    });

    describe('with tracking on', () => {
      before(() => {
        layer.changeTracker.track();
      });

      after(() => {
        layer.changeTracker.unTrack();
      });

      it('should keep tracking on, without changes', () => {
        layer.featureVisibility.highlight({
          [id]: Color.fromCssColorString('#ff00ff'),
        });
        expect(layer.changeTracker.active).to.be.true;
        expect(layer.changeTracker.hasChanges()).to.be.false;

        layer.featureVisibility.clearHighlighting();
        expect(layer.changeTracker.active).to.be.true;
        expect(layer.changeTracker.hasChanges()).to.be.false;

        layer.featureVisibility.hideObjects([id]);
        expect(layer.changeTracker.active).to.be.true;
        expect(layer.changeTracker.hasChanges()).to.be.false;

        layer.featureVisibility.clearHiddenObjects();
        expect(layer.changeTracker.active).to.be.true;
        expect(layer.changeTracker.hasChanges()).to.be.false;
      });
    });
  });
});
