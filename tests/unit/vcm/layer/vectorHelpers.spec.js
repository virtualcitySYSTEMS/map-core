import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import Polygon from 'ol/geom/Polygon.js';
import Vector from '../../../../src/vcs/vcm/layer/vector.js';
import { setOpenlayersMap } from '../../helpers/openlayers.js';
import { getFramework } from '../../helpers/framework.js';
import resetFramework from '../../helpers/resetFramework.js';
import VectorStyleItem from '../../../../src/vcs/vcm/util/style/vectorStyleItem.js';
import {
  updateGlobalHider,
  updateFeatureVisibility,
  synchronizeFeatureVisibility,
  fvLastUpdated,
  globalHiderLastUpdated,
  getGenericFeatureFromClickedObject,
} from '../../../../src/vcs/vcm/layer/vectorHelpers.js';

function setupVectorLayer() {
  const vectorLayer = new Vector({});
  const ids = vectorLayer.addFeatures([
    new Feature(),
    new Feature(),
    new Feature(),
  ]);
  const highlightStyle = new VectorStyleItem({});
  vectorLayer.featureVisibility.hideObjects([ids[1], ids[2]]);
  vectorLayer.featureVisibility.highlight({
    [ids[0]]: highlightStyle,
    [ids[2]]: highlightStyle,
  });


  return {
    vectorLayer,
    highlightStyle,
    highlightFeatureId: ids[0],
    hiddenFeatureId: ids[1],
    hiddenHighlightedFeatureId: ids[2],
  };
}

describe('vcs.vcm.layer.VectorHelpers', () => {
  let openlayers;
  let sandbox;

  before(async () => {
    sandbox = sinon.createSandbox();
    openlayers = await setOpenlayersMap(getFramework());
  });

  after(() => {
    resetFramework();
  });

  describe('updating feature visibility', () => {
    let setup;
    let impl;
    let now;

    before(() => {
      setup = setupVectorLayer();
      [impl] = setup.vectorLayer.createImplementationsForMap(openlayers);
      updateFeatureVisibility(impl.featureVisibility, impl.source);
      now = Date.now();
      sandbox.useFakeTimers(now);
    });

    after(() => {
      sandbox.restore();
      setup.vectorLayer.destroy();
    });

    it('should add highlighted features', () => {
      const feature = impl.source.getFeatureById(setup.highlightFeatureId);
      expect(impl.featureVisibility.hasHighlightFeature(setup.highlightFeatureId, feature)).to.be.true;
    });

    it('should add highlighted features, even if they are hidden', () => {
      const feature = impl.source.getFeatureById(setup.hiddenHighlightedFeatureId);
      expect(impl.featureVisibility.hasHighlightFeature(setup.hiddenHighlightedFeatureId, feature)).to.be.true;
    });

    it('should add hidden features', () => {
      const feature = impl.source.getFeatureById(setup.hiddenFeatureId);
      expect(impl.featureVisibility.hasHiddenFeature(setup.hiddenFeatureId, feature)).to.be.true;
    });

    it('should add hidden features, even if they are highlighted', () => {
      const feature = impl.source.getFeatureById(setup.hiddenHighlightedFeatureId);
      expect(impl.featureVisibility.hasHiddenFeature(setup.hiddenHighlightedFeatureId, feature)).to.be.true;
    });

    it('should set FV last updated to now', () => {
      expect(impl.source[fvLastUpdated]).to.equal(now);
    });
  });

  describe('updating global hider', () => {
    let setup;
    let impl;
    let now;

    before(() => {
      setup = setupVectorLayer();
      [impl] = setup.vectorLayer.createImplementationsForMap(openlayers);
      impl.hasFeatureUUID = true;
      impl.globalHider.hideObjects([setup.hiddenFeatureId, setup.hiddenHighlightedFeatureId]);
      updateGlobalHider(impl.globalHider, impl.source);
      now = Date.now();
      sandbox.useFakeTimers(now);
    });

    after(() => {
      sandbox.restore();
      setup.vectorLayer.destroy();
    });

    it('should add hidden features', () => {
      const feature = impl.source.getFeatureById(setup.hiddenFeatureId);
      expect(impl.globalHider.hasFeature(setup.hiddenFeatureId, feature)).to.be.true;
    });

    it('should add hidden features, even if they are highlighted', () => {
      const feature = impl.source.getFeatureById(setup.hiddenHighlightedFeatureId);
      expect(impl.globalHider.hasFeature(setup.hiddenHighlightedFeatureId, feature)).to.be.true;
    });

    it('should set FV last updated to now', () => {
      expect(impl.source[globalHiderLastUpdated]).to.equal(now);
    });
  });

  describe('synchronize implementations', () => {
    describe('setting up vcs listeners', () => {
      let setup;
      let impl;
      let listeners;
      let now;
      let clock;

      before(() => {
        setup = setupVectorLayer();
        [impl] = setup.vectorLayer.createImplementationsForMap(openlayers);
        listeners = synchronizeFeatureVisibility(impl.featureVisibility, impl.source, impl.globalHider);
        now = Date.now();
        clock = sandbox.useFakeTimers(now);
      });

      after(() => {
        sandbox.restore();
        listeners.forEach((cb) => { cb(); });
        setup.vectorLayer.destroy();
      });

      it('should add a globalHider listener', () => {
        clock.tick(1);
        const feature = impl.source.getFeatureById(setup.hiddenFeatureId);
        impl.globalHider.hideObjects([setup.hiddenFeatureId]);
        expect(impl.globalHider.hasFeature(setup.hiddenFeatureId, feature)).to.be.true;
        expect(impl.source[globalHiderLastUpdated]).to.equal(Date.now());
      });

      it('should add a featureVisibility highlight listener', () => {
        clock.tick(1);
        const feature = impl.source.getFeatureById(setup.hiddenFeatureId);
        impl.featureVisibility.highlight({ [setup.hiddenFeatureId]: setup.highlightStyle });
        expect(impl.featureVisibility.hasHighlightFeature(setup.hiddenFeatureId, feature)).to.be.true;
        expect(impl.source[fvLastUpdated]).to.equal(Date.now());
      });

      it('should add a featureVisibility hide listener', () => {
        clock.tick(1);
        const feature = impl.source.getFeatureById(setup.highlightFeatureId);
        impl.featureVisibility.hideObjects([setup.highlightFeatureId]);
        expect(impl.featureVisibility.hasHiddenFeature(setup.highlightFeatureId, feature)).to.be.true;
        expect(impl.source[fvLastUpdated]).to.equal(Date.now());
      });
    });

    describe('checking for last updated', () => {
      let setup;
      let impl;

      beforeEach(() => {
        setup = setupVectorLayer();
        [impl] = setup.vectorLayer.createImplementationsForMap(openlayers);
      });

      afterEach(() => {
        setup.vectorLayer.destroy();
      });

      it('should update hidden and highlighted features', () => {
        const listeners = synchronizeFeatureVisibility(impl.featureVisibility, impl.source, impl.globalHider);
        const hiddenFeature = impl.source.getFeatureById(setup.hiddenFeatureId);
        expect(impl.featureVisibility.hasHiddenFeature(setup.hiddenFeatureId, hiddenFeature)).to.be.true;
        listeners.forEach((cb) => { cb(); });
      });

      it('should update globalHider', () => {
        impl.globalHider.hideObjects([setup.hiddenFeatureId]);
        const listeners = synchronizeFeatureVisibility(impl.featureVisibility, impl.source, impl.globalHider);
        const hiddenFeature = impl.source.getFeatureById(setup.hiddenFeatureId);
        expect(impl.globalHider.hasFeature(setup.hiddenFeatureId, hiddenFeature)).to.be.true;
        listeners.forEach((cb) => { cb(); });
      });
    });

    describe('setting up of ol source listeners', () => {
      let setup;
      let impl;
      let listeners;
      let now;
      let clock;

      before(() => {
        setup = setupVectorLayer();
        [impl] = setup.vectorLayer.createImplementationsForMap(openlayers);
        listeners = synchronizeFeatureVisibility(impl.featureVisibility, impl.source, impl.globalHider);
        now = Date.now();
        clock = sandbox.useFakeTimers(now);
      });

      after(() => {
        sandbox.restore();
        listeners.forEach((cb) => { cb(); });
        setup.vectorLayer.destroy();
      });

      it('should add a listener, which adds hidden features', () => {
        clock.tick(1);
        const feature = new Feature({});
        const id = 'hidden';
        feature.setId(id);
        impl.featureVisibility.hideObjects([id]);
        setup.vectorLayer.addFeatures([feature]);
        expect(impl.featureVisibility.hasHiddenFeature(id, feature)).to.be.true;
        expect(impl.source[fvLastUpdated]).to.equal(Date.now());
      });

      it('should add a listener, which adds a highlighted features', () => {
        clock.tick(1);
        const feature = new Feature({});
        const id = 'highlighted';
        feature.setId(id);
        impl.featureVisibility.highlight({ [id]: setup.highlightStyle });
        setup.vectorLayer.addFeatures([feature]);
        expect(impl.featureVisibility.hasHighlightFeature(id, feature)).to.be.true;
        expect(impl.source[fvLastUpdated]).to.equal(Date.now());
      });

      it('should add a listener, which adds globally hidden features', () => {
        clock.tick(1);
        const feature = new Feature({});
        const id = 'globalHidden';
        feature.setId(id);
        impl.globalHider.hideObjects([id]);
        setup.vectorLayer.addFeatures([feature]);
        expect(impl.globalHider.hasFeature(id, feature)).to.be.true;
        expect(impl.source[globalHiderLastUpdated]).to.equal(Date.now());
      });
    });

    describe('setting up of ol source listeners', () => {
      let setup;
      let impl;
      let listeners;
      let now;
      let clock;

      before(() => {
        setup = setupVectorLayer();
        [impl] = setup.vectorLayer.createImplementationsForMap(openlayers);
        listeners = synchronizeFeatureVisibility(impl.featureVisibility, impl.source, impl.globalHider);
        now = Date.now();
        clock = sandbox.useFakeTimers(now);
      });

      after(() => {
        sandbox.restore();
        listeners.forEach((cb) => {
          cb();
        });
        setup.vectorLayer.destroy();
      });

      it('should add a listener, which adds hidden features', () => {
        clock.tick(1);
        const feature = new Feature({});
        const id = 'hidden';
        feature.setId(id);
        impl.featureVisibility.hideObjects([id]);
        setup.vectorLayer.addFeatures([feature]);
        expect(impl.featureVisibility.hasHiddenFeature(id, feature)).to.be.true;
        expect(impl.source[fvLastUpdated]).to.equal(Date.now());
      });
    });

    describe('getGenericFeatureFromClickedObject', () => {
      describe('handle Properties', () => {
        let layer;
        let feature;
        let genericFeature;

        before(() => {
          layer = new Vector({
            name: 'layerName',
            genericFeatureProperties: {
              test: 'test',
            },
          });
          feature = new Feature({ geometry: new Point([1, 1, 1]), test2: 'test2' });
          feature.clickedPosition = { latitude: 52.0, longitude: 13.0 };
          genericFeature = getGenericFeatureFromClickedObject(feature, layer);
        });

        after(() => {
          layer.destroy();
        });

        it('should set the layerClass', () => {
          expect(genericFeature.layerClass).to.equal(Vector.className);
        });

        it('should set the layerName', () => {
          expect(genericFeature.layerName).to.equal('layerName');
        });

        it('should add feature properties to the GenericFeature', () => {
          expect(genericFeature.attributes).to.have.property('test2', 'test2');
        });

        it('should not add geometry property to the GenericFeature', () => {
          expect(genericFeature.attributes).to.not.have.property('geometry');
        });

        it('should add layerGenericProperties to the GenericFeature', () => {
          expect(genericFeature.attributes).to.have.property('test', 'test');
        });
      });

      describe('handle normal features, clickedPosition intersects Geometry', () => {
        let layer;
        let feature;
        let genericFeature;

        before(() => {
          layer = new Vector({
            name: 'layerName',
            genericFeatureProperties: {
              test: 'test',
            },
          });
          feature = new Feature({
            geometry: new Polygon([[
              [1447153, 6800125],
              [1447153, 6800126],
              [1447154, 6800126],
              [1447154, 6800125],
            ]]),
            test2: 'test2',
          });
          feature.clickedPosition = { latitude: 52.0, longitude: 13.0 };
          genericFeature = getGenericFeatureFromClickedObject(feature, layer);
        });

        after(() => {
          layer.destroy();
        });

        it('should use given position, if they intersect the geometry', () => {
          expect(genericFeature.longitude).to.equal(feature.clickedPosition.longitude);
          expect(genericFeature.latitude).to.equal(feature.clickedPosition.latitude);
        });

        it('should add the balloonHeightOffset to the height', () => {
          expect(genericFeature.height).to.equal(layer.balloonHeightOffset);
        });

        it('should set relativeToGround if no height is provided', () => {
          expect(genericFeature.relativeToGround).to.be.true;
        });
      });

      describe('handle features, clickedPosition does not intersects Geometry', () => {
        let layer;
        let feature;
        let genericFeature;

        before(() => {
          layer = new Vector({
            name: 'layerName',
            genericFeatureProperties: {
              test: 'test',
            },
          });
          feature = new Feature({
            geometry: new Polygon([[
              [1447153, 6800125],
              [1447153, 6800126],
              [1447154, 6800126],
              [1447154, 6800125],
            ]]),
            test2: 'test2',
          });
          feature.clickedPosition = { latitude: 52.0, longitude: 12.0 };
          genericFeature = getGenericFeatureFromClickedObject(feature, layer);
        });

        after(() => {
          layer.destroy();
        });

        it('should calculate the closest position on the geometry', () => {
          expect(genericFeature.longitude).to.be.closeTo(13, 0.00001);
          expect(genericFeature.latitude).to.be.closeTo(52, 0.00001);
        });

        it('should set relativeToGround if no height is provided', () => {
          expect(genericFeature.relativeToGround).to.be.true;
        });
      });

      describe('should calculate height from coordinates', () => {
        let layer;
        let feature;
        let genericFeature;

        before(() => {
          layer = new Vector({
            name: 'layerName',
            balloonHeightOffset: 0,
            genericFeatureProperties: {
              test: 'test',
            },
          });
          feature = new Feature({
            geometry: new Polygon([[
              [1447153, 6800125, 12],
              [1447153, 6800126, 9],
              [1447154, 6800126, 11],
              [1447154, 6800125, 11],
            ]]),
            test2: 'test2',
          });
          feature.clickedPosition = { latitude: 52.0, longitude: 12.0 };
          genericFeature = getGenericFeatureFromClickedObject(feature, layer);
        });

        after(() => {
          layer.destroy();
        });

        it('should set height to max Height', () => {
          expect(genericFeature.height).to.be.equal(12);
        });

        it('should set relativeToGround to true if clickedPosition does not provide a height (2D)', () => {
          expect(genericFeature.relativeToGround).to.be.true;
        });

        it('should set relativeToGround to false if clickedPosition does provide a height (3D)', () => {
          const feature2 = new Feature({
            geometry: new Polygon([[
              [1447153, 6800125, 12],
              [1447153, 6800126, 9],
              [1447154, 6800126, 11],
              [1447154, 6800125, 11],
            ]]),
            test2: 'test2',
          });
          feature2.clickedPosition = { latitude: 52.0, longitude: 12.0, height: 12 };
          genericFeature = getGenericFeatureFromClickedObject(feature2, layer);
          expect(genericFeature.relativeToGround).to.be.false;
        });
      });

      describe('should handle VectorProperties', () => {
        let layer;
        let feature;
        let genericFeature;
        let geometry;
        before(() => {
          layer = new Vector({
            name: 'layerName',
            balloonHeightOffset: 0,
          });
          geometry = new Polygon([[
            [1447153, 6800125, 12],
            [1447153, 6800126, 9],
            [1447154, 6800126, 11],
            [1447154, 6800125, 11],
          ]]);
        });

        after(() => {
          layer.destroy();
        });

        it('should take extrudedHeight into account for maxHeight', () => {
          feature = new Feature({ geometry, olcs_extrudedHeight: 20 });
          feature.clickedPosition = { latitude: 52.0, longitude: 12.0 };
          genericFeature = getGenericFeatureFromClickedObject(feature, layer);
          expect(genericFeature.height).to.be.equal(29); // minLevel, extruded
        });

        it('should use set height to 0 if point and heightReference === clamped', () => {
          feature = new Feature({ geometry: new Point([1, 1, 1]), olcs_altitudeMode: 'clampToGround' });
          feature.clickedPosition = { latitude: 52.0, longitude: 12.0 };
          genericFeature = getGenericFeatureFromClickedObject(feature, layer);
          expect(genericFeature.height).to.be.equal(0);
        });

        it('should use set height to heightAboveGround if point and heightReference === relativeToGround', () => {
          feature = new Feature({
            geometry: new Point([1, 1, 1]),
            olcs_altitudeMode: 'relativeToGround',
            olcs_heightAboveGround: 15,
          });
          feature.clickedPosition = { latitude: 52.0, longitude: 12.0 };
          genericFeature = getGenericFeatureFromClickedObject(feature, layer);
          expect(genericFeature.height).to.be.equal(15);
        });

        it('should take heightAboveGround into account', () => {
          feature = new Feature({ geometry, olcs_altitudeMode: 'relativeToGround', olcs_heightAboveGround: 15 });
          feature.clickedPosition = { latitude: 52.0, longitude: 12.0 };
          genericFeature = getGenericFeatureFromClickedObject(feature, layer);
          expect(genericFeature.height).to.be.equal(12 + 15); // maxHeight + heightAboveGroundAdjustment
        });
      });
    });
  });
});
