import LineString from 'ol/geom/LineString.js';
import Point from 'ol/geom/Point.js';
import Style from 'ol/style/Style.js';
import CircleStyle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import OLText from 'ol/style/Text.js';
import Feature from 'ol/Feature.js';

import VcsApp from '../../../../../src/vcs/vcm/vcsApp.js';
import Vector from '../../../../../src/vcs/vcm/layer/vector.js';
import { setCesiumMap } from '../../../helpers/cesiumHelpers.js';
import { setOpenlayersMap } from '../../../helpers/openlayersHelpers.js';

describe('vcs.vcm.layer.cesium.VectorCesium', () => {
  let sandbox;
  let app;
  let cesiumMap;
  let openlayers;
  /** @type {import("@vcmap/core").Vector} */
  let commonLayer;
  /** @type {import("@vcmap/core").VectorCesium} */
  let vectorLayer;

  let feature;
  let pointFeature;

  before(() => {
    sandbox = sinon.createSandbox();
    feature = new Feature({ geometry: new LineString([[1, 1], [2, 2]]) });
    pointFeature = new Feature({
      geometry: new Point([1, 1, 1]),
    });

    pointFeature.setStyle(new Style({
      image: new CircleStyle({
        fill: new Fill({ color: '#000000' }),
        radius: 1,
      }),
      text: new OLText({
        text: 'test',
      }),
    }));
  });

  beforeEach(async () => {
    app = new VcsApp();
    openlayers = await setOpenlayersMap(app);
    cesiumMap = await setCesiumMap(app);
    cesiumMap.setTarget('mapContainer');
    commonLayer = new Vector({});
    app.layers.add(commonLayer);
    [vectorLayer] = commonLayer.getImplementationsForMap(cesiumMap);
  });

  afterEach(() => {
    app.destroy();
    sandbox.restore();
  });

  describe('initialize', () => {
    it('should set the initialized property to true', async () => {
      await vectorLayer.initialize();
      expect(vectorLayer.initialized).to.be.true;
    });

    it('should add the _rootCollection to the scenes primitives', async () => {
      await vectorLayer.initialize();
      expect(cesiumMap.getScene().primitives.contains(vectorLayer._rootCollection)).to.be.true;
    });

    it('should add a listener to features added to the source, calling _addFeature', async () => {
      const addFeature = sandbox.spy(vectorLayer, '_addFeature');
      await vectorLayer.initialize();
      commonLayer.addFeatures([new Feature({})]);
      expect(addFeature).to.have.been.called;
    });

    it('should add a listener to removing features on the source, calling _removeFeature', async () => {
      const removeFeature = sandbox.spy(vectorLayer, '_removeFeature');
      commonLayer.addFeatures([feature]);
      await vectorLayer.initialize();
      commonLayer.removeFeaturesById([feature.getId()]);
      expect(removeFeature).to.have.been.called;
    });

    it('should add a listener for changefeautre on the source, calling _featureChanged', async () => {
      const featureChanged = sandbox.spy(vectorLayer, '_featureChanged');
      commonLayer.addFeatures([feature]);
      await vectorLayer.initialize();
      feature.set('test', true);
      expect(featureChanged).to.have.been.called;
    });

    it('should add a listener to vector properties, calling refresh', async () => {
      const refresh = sandbox.spy(vectorLayer, 'refresh');
      await vectorLayer.initialize();
      commonLayer.vectorProperties.allowPicking = !commonLayer.vectorProperties.allowPicking;
      expect(refresh).to.have.been.called;
    });

    it('should add all features in the source', async () => {
      const addFeature = sandbox.spy(vectorLayer, '_addFeature');
      commonLayer.addFeatures([feature, pointFeature]);
      await vectorLayer.initialize();
      expect(addFeature).to.have.been.calledWith(feature);
      expect(addFeature).to.have.been.calledWith(pointFeature);
    });
  });

  describe('_addFeature', () => {
    beforeEach(async () => {
      await vectorLayer.initialize();
    });

    describe('active layer', () => {
      beforeEach(async () => {
        await vectorLayer.activate();
      });

      it('should convert a feature, adding it to its primitives', () => {
        vectorLayer._addFeature(feature);
        expect(vectorLayer._context.primitives.length).to.equal(1);
      });

      it('should add a feature to the primitive map', () => {
        vectorLayer._addFeature(feature);
        const primitiveArray = vectorLayer._context.featureToPrimitiveMap.get(feature);
        expect(primitiveArray).to.be.an('array').and.have.lengthOf(1);
      });

      it('should convert a point feature, adding it to the billboards', () => {
        vectorLayer._addFeature(pointFeature);
        expect(vectorLayer._context.billboards.length).to.equal(1);
      });

      it('should add a point feature to the billboards map', () => {
        vectorLayer._addFeature(pointFeature);
        const billboardArray = vectorLayer._context.featureToBillboardMap.get(pointFeature);
        expect(billboardArray).to.be.an('array').and.have.lengthOf(1);
      });

      it('should convert a labeled point feature, adding it to the billboards', () => {
        vectorLayer._addFeature(pointFeature);
        expect(vectorLayer._context.labels.length).to.equal(1);
      });

      it('should add a labeled point feature to the labels map', () => {
        vectorLayer._addFeature(pointFeature);
        const labelArray = vectorLayer._context.featureToLabelMap.get(pointFeature);
        expect(labelArray).to.be.an('array').and.have.lengthOf(1);
      });
    });

    it('should, if not active, cache a feature, until the layer is active', async () => {
      vectorLayer._addFeature(feature);
      expect(vectorLayer._context.primitives.length).to.equal(0);

      await vectorLayer.activate();
      expect(vectorLayer._context.primitives.length).to.equal(1);
    });

    it('should, if current map is not a cesium map, cache a feature, until the map is a cesium map', async () => {
      await app.maps.setActiveMap(openlayers.name);
      await commonLayer.activate();
      vectorLayer._addFeature(feature);
      expect(vectorLayer._context.primitives.length).to.equal(0);
      await app.maps.setActiveMap(cesiumMap.name);
      expect(vectorLayer._context.primitives.length).to.equal(1);
    });
  });

  describe('refresh', () => {
    beforeEach(async () => {
      await vectorLayer.activate();
      vectorLayer._addFeature(feature);
      vectorLayer._addFeature(pointFeature);
    });

    it('chould clear all primitives, billboards, labels & feature maps', () => {
      vectorLayer.refresh();
      expect(vectorLayer._context.primitives.length).to.equal(0);
      expect(vectorLayer._context.billboards.length).to.equal(0);
      expect(vectorLayer._context.labels.length).to.equal(0);
      expect(vectorLayer._context.featureToPrimitiveMap).to.be.empty;
      expect(vectorLayer._context.featureToBillboardMap).to.be.empty;
      expect(vectorLayer._context.featureToLabelMap).to.be.empty;
    });

    it('should add features which are part of the vectorLayer', () => {
      const newFeature = new Feature({ geometry: feature.getGeometry().clone() });
      commonLayer.addFeatures([newFeature]);
      vectorLayer.refresh();
      expect(vectorLayer._context.primitives.length).to.equal(1);
      expect(vectorLayer._context.featureToPrimitiveMap.has(newFeature)).to.be.true;
    });
  });

  describe('_removeFeature', () => {
    beforeEach(async () => {
      await vectorLayer.initialize();
      await vectorLayer.activate();
      vectorLayer._addFeature(feature);
      vectorLayer._addFeature(pointFeature);
    });

    it('should remove a feature from the primitives', () => {
      vectorLayer._removeFeature(feature);
      expect(vectorLayer._context.primitives.length).to.equal(0);
      expect(vectorLayer._context.featureToPrimitiveMap.has(feature)).to.be.false;
    });

    it('should remove a point feature from the billboards', () => {
      vectorLayer._removeFeature(pointFeature);
      expect(vectorLayer._context.billboards.length).to.equal(0);
      expect(vectorLayer._context.featureToBillboardMap.has(pointFeature)).to.be.false;
    });

    it('should remove a labeled feature from the labels', () => {
      vectorLayer._removeFeature(pointFeature);
      expect(vectorLayer._context.labels.length).to.equal(0);
      expect(vectorLayer._context.featureToLabelMap.has(pointFeature)).to.be.false;
    });

    it('should remove a feature from the cache', async () => {
      vectorLayer.refresh();
      vectorLayer.deactivate();
      vectorLayer._addFeature(feature);
      vectorLayer._removeFeature(feature);
      await vectorLayer.activate();
      expect(vectorLayer._context.primitives.length).to.equal(0);
    });
  });

  describe('_featureChanged', () => {
    beforeEach(async () => {
      await vectorLayer.initialize();
      await vectorLayer.activate();
      vectorLayer._addFeature(feature);
    });

    it('should cache the features cesium resources, add the feature and clear the cache', () => {
      const createFeatureCache = sandbox.spy(vectorLayer._context, 'createFeatureCache');
      const clearFeatureCache = sandbox.spy(vectorLayer._context, 'clearFeatureCache');
      vectorLayer._featureChanged(feature);
      expect(createFeatureCache).to.have.been.calledWith(feature);
      expect(clearFeatureCache).to.have.been.called;
    });
  });

  describe('show', () => {
    beforeEach(async () => {
      await vectorLayer.initialize();
    });

    it('should set the active property to true', async () => {
      await vectorLayer.activate();
      expect(vectorLayer.active).to.be.true;
    });

    it('should set the _rootCollection visible', async () => {
      await vectorLayer.activate();
      expect(vectorLayer._rootCollection.show).to.be.true;
    });

    it('should add any cached features', async () => {
      vectorLayer._addFeature(feature);
      await vectorLayer.activate();
      expect(vectorLayer._context.primitives.length).to.equal(1);
      expect(vectorLayer._context.featureToPrimitiveMap.has(feature)).to.be.true;
    });
  });

  describe('hide', () => {
    beforeEach(async () => {
      await vectorLayer.initialize();
      await vectorLayer.activate();
    });

    it('should set active to false', () => {
      vectorLayer.deactivate();
      expect(vectorLayer.active).to.be.false;
    });

    it('should hide the _rootCollection', () => {
      vectorLayer.deactivate();
      expect(vectorLayer._rootCollection.show).to.be.false;
    });
  });

  describe('updateStyle', () => {
    it('should remove and re-add each feature which does not have its own style', async () => {
      await vectorLayer.initialize();
      await vectorLayer.activate();
      commonLayer.addFeatures([feature, pointFeature]);
      const featureChanged = sandbox.spy(vectorLayer, '_featureChanged');
      vectorLayer.updateStyle(commonLayer.style);
      expect(featureChanged).to.have.been.calledOnce;
      expect(featureChanged).to.have.been.calledWith(feature);
    });
  });

  describe('destroy', () => {
    beforeEach(async () => {
      await vectorLayer.initialize();
    });

    it('should remove the _rootCollection from the scene', () => {
      vectorLayer.destroy();
      expect(cesiumMap.getScene().primitives.contains(vectorLayer._rootCollection)).to.be.false;
    });

    it('should destroy the _rootCollection', () => {
      const rootCollection = vectorLayer._rootCollection;
      vectorLayer.destroy();
      expect(rootCollection.isDestroyed()).to.be.true;
    });

    it('should clear all the context', () => {
      const clear = sandbox.spy(vectorLayer._context, 'clear');
      vectorLayer.destroy();

      expect(clear).to.have.been.called;
    });

    it('should set context to null', () => {
      vectorLayer.destroy();
      expect(vectorLayer._context).to.be.null;
    });

    it('should remove feature added listeners', () => {
      vectorLayer.destroy();
      const addFeature = sandbox.spy(vectorLayer, '_addFeature');
      commonLayer.addFeatures([feature]);
      expect(addFeature).to.not.have.been.called;
    });

    it('should remove feature remove listener', () => {
      const removeFeature = sandbox.spy(vectorLayer, '_removeFeature');
      commonLayer.addFeatures([feature]);
      vectorLayer.destroy();
      commonLayer.removeFeaturesById([feature.getId()]);
      expect(removeFeature).to.not.have.been.called;
    });

    it('should remove feature changed listeners', () => {
      const featureChanged = sandbox.spy(vectorLayer, '_featureChanged');
      commonLayer.addFeatures([feature]);
      vectorLayer.destroy();
      feature.set('test', true);
      expect(featureChanged).to.not.have.been.called;
    });

    it('should remove vectorPropertiesChanged listeners', () => {
      const refresh = sandbox.spy(vectorLayer, 'refresh');
      vectorLayer.destroy();
      commonLayer.vectorProperties.allowPicking = !commonLayer.vectorProperties.allowPicking;
      expect(refresh).to.not.have.been.called;
    });
  });
});
