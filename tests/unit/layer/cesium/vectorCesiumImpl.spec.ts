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
    it('should call changed on each feature', async () => {
      await vectorCesiumImpl.initialize();
      await vectorCesiumImpl.activate();
      const changedF = sandbox.spy(feature, 'changed');
      const changedP = sandbox.spy(pointFeature, 'changed');
      commonLayer.addFeatures([feature, pointFeature]);
      vectorCesiumImpl.updateStyle(commonLayer.style);
      expect(changedF).to.have.been.calledOnce;
      expect(changedP).to.have.been.calledOnce;
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
  });
});
