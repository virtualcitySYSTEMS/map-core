import { expect } from 'chai';
import sinon, { SinonSandbox } from 'sinon';
import LineString from 'ol/geom/LineString.js';
import Point from 'ol/geom/Point.js';
import Style from 'ol/style/Style.js';
import CircleStyle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import OLText from 'ol/style/Text.js';
import Feature from 'ol/Feature.js';

import { PrimitiveCollection, SplitDirection } from '@vcmap-cesium/engine';
import VcsApp from '../../../../src/vcsApp.js';
import VectorLayer from '../../../../src/layer/vectorLayer.js';
import { setCesiumMap } from '../../helpers/cesiumHelpers.js';
import { setOpenlayersMap } from '../../helpers/openlayersHelpers.js';
import { timeout } from '../../helpers/helpers.js';
import {
  CesiumMap,
  OpenlayersMap,
  VectorCesiumImpl,
  VectorContext,
} from '../../../../index.js';

describe('VectorCesiumImpl', () => {
  let sandbox: SinonSandbox;
  let app: VcsApp;
  let cesiumMap: CesiumMap;
  let openlayers: OpenlayersMap;
  /** @type {import("@vcmap/core").VectorLayer} */
  let commonLayer: VectorLayer;
  /** @type {import("@vcmap/core").VectorCesiumImpl} */
  let vectorCesiumImpl: VectorCesiumImpl;

  let feature: Feature;
  let pointFeature: Feature<Point>;

  before(() => {
    sandbox = sinon.createSandbox();
    feature = new Feature({
      geometry: new LineString([
        [1, 1],
        [2, 2],
      ]),
    });
    pointFeature = new Feature({
      geometry: new Point([1, 1, 1]),
    });

    pointFeature.setStyle(
      new Style({
        image: new CircleStyle({
          fill: new Fill({ color: '#000000' }),
          radius: 1,
        }),
        text: new OLText({
          text: 'test',
        }),
      }),
    );
  });

  beforeEach(async () => {
    app = new VcsApp();
    openlayers = await setOpenlayersMap(app);
    cesiumMap = await setCesiumMap(app);
    cesiumMap.setTarget('mapContainer');
    commonLayer = new VectorLayer({});
    app.layers.add(commonLayer);
    [vectorCesiumImpl] = commonLayer.getImplementationsForMap(
      cesiumMap,
    ) as VectorCesiumImpl[];
  });

  afterEach(() => {
    app.destroy();
    sandbox.restore();
  });

  describe('initialize', () => {
    it('should set the initialized property to true', async () => {
      await vectorCesiumImpl.initialize();
      expect(vectorCesiumImpl.initialized).to.be.true;
    });

    it('should add the _rootCollection to the scenes primitives', async () => {
      await vectorCesiumImpl.initialize();
      expect(
        cesiumMap
          .getScene()
          // @ts-expect-error: access private
          ?.primitives.contains(vectorCesiumImpl._rootCollection),
      ).to.be.true;
    });

    it('should add a listener to features added to the source, calling _addFeature', async () => {
      // @ts-expect-error: access private
      const addFeature = sandbox.spy(vectorCesiumImpl, '_addFeature');
      await vectorCesiumImpl.initialize();
      commonLayer.addFeatures([new Feature({})]);
      expect(addFeature).to.have.been.called;
    });

    it('should add a listener to removing features on the source, calling _removeFeature', async () => {
      // @ts-expect-error: access private
      const removeFeature = sandbox.spy(vectorCesiumImpl, '_removeFeature');
      commonLayer.addFeatures([feature]);
      await vectorCesiumImpl.initialize();
      commonLayer.removeFeaturesById([feature.getId()!]);
      expect(removeFeature).to.have.been.called;
    });

    it('should add a listener for changefeature on the source, calling _featureChanged', async () => {
      // @ts-expect-error: access private
      const featureChanged = sandbox.spy(vectorCesiumImpl, '_featureChanged');
      commonLayer.addFeatures([feature]);
      await vectorCesiumImpl.initialize();
      feature.set('test', true);
      expect(featureChanged).to.have.been.called;
    });

    it('should add a listener to vector properties, calling refresh', async () => {
      const refresh = sandbox.spy(vectorCesiumImpl, 'refresh');
      await vectorCesiumImpl.initialize();
      commonLayer.vectorProperties.allowPicking =
        !commonLayer.vectorProperties.allowPicking;
      expect(refresh).to.have.been.called;
    });

    it('should add all features in the source', async () => {
      // @ts-expect-error: access private
      const addFeature = sandbox.spy(vectorCesiumImpl, '_addFeature');
      commonLayer.addFeatures([feature, pointFeature]);
      await vectorCesiumImpl.initialize();
      expect(addFeature).to.have.been.calledWith(feature);
      expect(addFeature).to.have.been.calledWith(pointFeature);
    });

    it('should update the split direction on initialize', async () => {
      const updateSplitDirection = sandbox.spy(
        vectorCesiumImpl,
        'updateSplitDirection',
      );
      vectorCesiumImpl.splitDirection = SplitDirection.LEFT;
      await vectorCesiumImpl.initialize();
      expect(updateSplitDirection).to.have.been.calledWith(SplitDirection.LEFT);
    });
  });

  describe('_addFeature', () => {
    beforeEach(async () => {
      await vectorCesiumImpl.initialize();
    });

    it('should, if not active, cache a feature, until the layer is active', async () => {
      commonLayer.addFeatures([feature]);
      await timeout(100);
      // @ts-expect-error: access private
      expect(vectorCesiumImpl._context.primitives.length).to.equal(0);

      await vectorCesiumImpl.activate();
      await timeout(100);
      // @ts-expect-error: access private
      expect(vectorCesiumImpl._context.primitives.length).to.equal(1);
    });

    it('should, if current map is not a cesium map, cache a feature, until the map is a cesium map', async () => {
      await app.maps.setActiveMap(openlayers.name);
      await commonLayer.activate();
      commonLayer.addFeatures([feature]);
      await timeout(100);
      // @ts-expect-error: access private
      expect(vectorCesiumImpl._context.primitives.length).to.equal(0);
      await app.maps.setActiveMap(cesiumMap.name);
      // @ts-expect-error: access private
      expect(vectorCesiumImpl._context.primitives.length).to.equal(1);
    });
  });

  describe('show', () => {
    beforeEach(async () => {
      await vectorCesiumImpl.initialize();
    });

    it('should set the active property to true', async () => {
      await vectorCesiumImpl.activate();
      expect(vectorCesiumImpl.active).to.be.true;
    });

    it('should set the _rootCollection visible', async () => {
      await vectorCesiumImpl.activate();
      // @ts-expect-error: access private
      expect(vectorCesiumImpl._rootCollection.show).to.be.true;
    });

    it('should add any cached features', async () => {
      commonLayer.addFeatures([feature]);
      await timeout(100);
      await vectorCesiumImpl.activate();
      await timeout(100);
      // @ts-expect-error: access private
      const context = vectorCesiumImpl._context;
      expect(context!.primitives.length).to.equal(1);
    });
  });

  describe('hide', () => {
    beforeEach(async () => {
      await vectorCesiumImpl.initialize();
      await vectorCesiumImpl.activate();
    });

    it('should set active to false', () => {
      vectorCesiumImpl.deactivate();
      expect(vectorCesiumImpl.active).to.be.false;
    });

    it('should hide the _rootCollection', () => {
      vectorCesiumImpl.deactivate();
      // @ts-expect-error: access private
      expect(vectorCesiumImpl._rootCollection.show).to.be.false;
    });
  });

  describe('updateStyle', () => {
    it('should remove and re-add each feature which does not have its own style', async () => {
      await vectorCesiumImpl.initialize();
      await vectorCesiumImpl.activate();
      commonLayer.addFeatures([feature, pointFeature]);
      // @ts-expect-error: access private
      const featureChanged = sandbox.spy(vectorCesiumImpl, '_featureChanged');
      vectorCesiumImpl.updateStyle(commonLayer.style);
      expect(featureChanged).to.have.been.calledOnce;
      expect(featureChanged).to.have.been.calledWith(feature);
    });
  });

  describe('destroy', () => {
    beforeEach(async () => {
      await vectorCesiumImpl.initialize();
    });

    it('should remove the _rootCollection from the scene', () => {
      vectorCesiumImpl.destroy();
      expect(
        cesiumMap
          .getScene()
          // @ts-expect-error: access private
          ?.primitives.contains(vectorCesiumImpl._rootCollection),
      ).to.be.false;
    });

    it('should destroy the _rootCollection', () => {
      // @ts-expect-error: access private
      const rootCollection = vectorCesiumImpl._rootCollection;
      vectorCesiumImpl.destroy();
      expect(rootCollection.isDestroyed()).to.be.true;
    });

    it('should destroy the context', () => {
      // @ts-expect-error: access private
      const clear = sandbox.spy(vectorCesiumImpl._context, 'destroy');
      vectorCesiumImpl.destroy();

      expect(clear).to.have.been.called;
    });

    it('should set context to null', () => {
      vectorCesiumImpl.destroy();
      // @ts-expect-error: access private
      expect(vectorCesiumImpl._context).to.be.null;
    });

    it('should remove feature added listeners', () => {
      vectorCesiumImpl.destroy();
      // @ts-expect-error: access private
      const addFeature = sandbox.spy(vectorCesiumImpl, '_addFeature');
      commonLayer.addFeatures([feature]);
      expect(addFeature).to.not.have.been.called;
    });

    it('should remove feature remove listener', () => {
      // @ts-expect-error: access private
      const removeFeature = sandbox.spy(vectorCesiumImpl, '_removeFeature');
      commonLayer.addFeatures([feature]);
      vectorCesiumImpl.destroy();
      commonLayer.removeFeaturesById([feature.getId()!]);
      expect(removeFeature).to.not.have.been.called;
    });

    it('should remove feature changed listeners', () => {
      // @ts-expect-error: access private
      const featureChanged = sandbox.spy(vectorCesiumImpl, '_featureChanged');
      commonLayer.addFeatures([feature]);
      vectorCesiumImpl.destroy();
      feature.set('test', true);
      expect(featureChanged).to.not.have.been.called;
    });

    it('should remove vectorPropertiesChanged listeners', () => {
      const refresh = sandbox.spy(vectorCesiumImpl, 'refresh');
      vectorCesiumImpl.destroy();
      commonLayer.vectorProperties.allowPicking =
        !commonLayer.vectorProperties.allowPicking;
      expect(refresh).to.not.have.been.called;
    });
  });
});
