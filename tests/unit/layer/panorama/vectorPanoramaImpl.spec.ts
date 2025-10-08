import { expect } from 'chai';
import type { SinonSandbox } from 'sinon';
import sinon from 'sinon';
import LineString from 'ol/geom/LineString.js';
import Point from 'ol/geom/Point.js';
import Style from 'ol/style/Style.js';
import CircleStyle from 'ol/style/Circle.js';
import Fill from 'ol/style/Fill.js';
import OLText from 'ol/style/Text.js';
import Feature from 'ol/Feature.js';
import type { Coordinate } from 'ol/coordinate.js';

import { Cartesian3, SplitDirection } from '@vcmap-cesium/engine';
import VcsApp from '../../../../src/vcsApp.js';
import VectorLayer from '../../../../src/layer/vectorLayer.js';
import { timeout } from '../../helpers/helpers.js';
import {
  cartesianToMercator,
  type PanoramaImage,
  type PanoramaMap,
  primitives,
} from '../../../../index.js';
import type VectorPanoramaImpl from '../../../../src/layer/panorama/vectorPanoramaImpl.js';
import {
  getPanoramaImage,
  getPanoramaMap,
} from '../../helpers/panoramaHelpers.js';

describe('VectorCesiumImpl', () => {
  let panoramaImage: PanoramaImage;
  let destroyPanoramaImage: () => void;
  let sandbox: SinonSandbox;
  let app: VcsApp;
  let panoramaMap: PanoramaMap;
  let commonLayer: VectorLayer;
  let vectorPanoramaImpl: VectorPanoramaImpl;

  let feature: Feature;
  let pointFeature: Feature<Point>;
  let mercatorPosition: Coordinate;

  before(async () => {
    sandbox = sinon.createSandbox();
    ({ panoramaImage, destroy: destroyPanoramaImage } =
      await getPanoramaImage());
    mercatorPosition = cartesianToMercator(panoramaImage.position);
    feature = new Feature({
      geometry: new LineString([
        [mercatorPosition[0] - 1, mercatorPosition[1] - 1],
        [mercatorPosition[0] + 1, mercatorPosition[1] + 1],
      ]),
    });
    pointFeature = new Feature({
      geometry: new Point(mercatorPosition.map((c) => c + 1)),
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
    panoramaMap = getPanoramaMap();
    panoramaMap.setCurrentImage(panoramaImage);
    app.maps.add(panoramaMap);
    await app.maps.setActiveMap(panoramaMap.name);
    panoramaMap.setTarget('mapContainer');
    commonLayer = new VectorLayer({});
    app.layers.add(commonLayer);
    [vectorPanoramaImpl] = commonLayer.getImplementationsForMap(
      panoramaMap,
    ) as VectorPanoramaImpl[];
  });

  afterEach(() => {
    app.destroy();
    sandbox.restore();
    destroyPanoramaImage();
  });

  describe('initialize', () => {
    it('should set the initialized property to true', async () => {
      await vectorPanoramaImpl.initialize();
      expect(vectorPanoramaImpl.initialized).to.be.true;
    });

    it('should add the _rootCollection to the scenes primitives', async () => {
      await vectorPanoramaImpl.initialize();
      expect(
        panoramaMap
          .getScene()
          // @ts-expect-error: access private
          ?.primitives.contains(vectorPanoramaImpl._rootCollection),
      ).to.be.true;
    });

    it('should update the split direction on initialize', async () => {
      const updateSplitDirection = sandbox.spy(
        vectorPanoramaImpl,
        'updateSplitDirection',
      );
      vectorPanoramaImpl.splitDirection = SplitDirection.LEFT;
      await vectorPanoramaImpl.initialize();
      expect(updateSplitDirection).to.have.been.calledWith(SplitDirection.LEFT);
    });
  });

  describe('show', () => {
    beforeEach(async () => {
      await vectorPanoramaImpl.initialize();
    });

    it('should set the active property to true', async () => {
      await vectorPanoramaImpl.activate();
      expect(vectorPanoramaImpl.active).to.be.true;
    });

    it('should set the _rootCollection visible', async () => {
      await vectorPanoramaImpl.activate();
      // @ts-expect-error: access private
      expect(vectorPanoramaImpl._rootCollection.show).to.be.true;
    });

    it('should add any cached features', async () => {
      commonLayer.addFeatures([feature]);
      await timeout(100);
      await vectorPanoramaImpl.activate();
      await timeout(100);
      // @ts-expect-error: access private
      const context = vectorPanoramaImpl._context;
      expect(context!.primitives.length).to.equal(1);
    });
  });

  describe('hide', () => {
    beforeEach(async () => {
      await vectorPanoramaImpl.initialize();
      await vectorPanoramaImpl.activate();
    });

    it('should set active to false', () => {
      vectorPanoramaImpl.deactivate();
      expect(vectorPanoramaImpl.active).to.be.false;
    });

    it('should hide the _rootCollection', () => {
      vectorPanoramaImpl.deactivate();
      // @ts-expect-error: access private
      expect(vectorPanoramaImpl._rootCollection.show).to.be.false;
    });
  });

  describe('updateStyle', () => {
    it('should replace features via the vector context sync', async () => {
      await vectorPanoramaImpl.initialize();
      await vectorPanoramaImpl.activate();
      commonLayer.addFeatures([feature, pointFeature]);
      await timeout(100);
      expect(vectorPanoramaImpl.source.getFeatures()).to.have.lengthOf(2);
      expect(feature).to.have.property(primitives).and.to.not.be.empty;
      expect(pointFeature).to.have.property(primitives).and.to.not.be.empty;

      const featurePrimitive = feature[primitives]?.[0];
      const pointPrimitive = pointFeature[primitives]?.[0];
      vectorPanoramaImpl.updateStyle(commonLayer.style.clone());

      await timeout(100);
      expect(feature)
        .to.have.property(primitives)
        .and.to.not.include(featurePrimitive);
      expect(pointFeature)
        .to.have.property(primitives)
        .and.to.not.include(pointPrimitive);
    });
  });

  describe('features within image handling', () => {
    let otherPanoramaImage: PanoramaImage;
    let destroyOtherPanoramaImage: () => void;
    let otherImageFeature: Feature;

    before(async () => {
      ({
        panoramaImage: otherPanoramaImage,
        destroy: destroyOtherPanoramaImage,
      } = await getPanoramaImage());

      Cartesian3.add(
        otherPanoramaImage.position,
        new Cartesian3(120, 120, 120),
        otherPanoramaImage.position,
      );
      const otherMercatorPosition = cartesianToMercator(
        otherPanoramaImage.position,
      );
      otherImageFeature = new Feature({
        geometry: new Point(otherMercatorPosition.map((c) => c + 1)),
      });
    });

    beforeEach(async () => {
      await vectorPanoramaImpl.initialize();
      await vectorPanoramaImpl.activate();
      commonLayer.addFeatures([feature, pointFeature, otherImageFeature]);
    });

    after(() => {
      destroyOtherPanoramaImage();
    });

    it('should load features which are close enough to the image position', () => {
      expect(vectorPanoramaImpl.source.getFeatures()).to.have.lengthOf(2);
    });

    it('should unload all features, if there is no image', async () => {
      panoramaMap.setCurrentImage(undefined);
      await timeout(100);
      expect(vectorPanoramaImpl.source.getFeatures()).to.be.empty;
    });

    it('should update features when the panorama image changes', async () => {
      panoramaMap.setCurrentImage(otherPanoramaImage);
      await timeout(100);
      expect(vectorPanoramaImpl.source.getFeatures()).to.have.lengthOf(1);
      expect(vectorPanoramaImpl.source.getFeatures()[0]).to.equal(
        otherImageFeature,
      );
    });
  });

  describe('destroy', () => {
    beforeEach(async () => {
      await vectorPanoramaImpl.initialize();
    });

    it('should remove the _rootCollection from the scene', () => {
      vectorPanoramaImpl.destroy();
      expect(
        panoramaMap
          .getScene()
          // @ts-expect-error: access private
          ?.primitives.contains(vectorPanoramaImpl._rootCollection),
      ).to.be.false;
    });

    it('should destroy the _rootCollection', () => {
      // @ts-expect-error: access private
      const rootCollection = vectorPanoramaImpl._rootCollection;
      vectorPanoramaImpl.destroy();
      expect(rootCollection.isDestroyed()).to.be.true;
    });

    it('should destroy the context', () => {
      // @ts-expect-error: access private
      const clear = sandbox.spy(vectorPanoramaImpl._context, 'destroy');
      vectorPanoramaImpl.destroy();

      expect(clear).to.have.been.called;
    });

    it('should set context to null', () => {
      vectorPanoramaImpl.destroy();
      // @ts-expect-error: access private
      expect(vectorPanoramaImpl._context).to.be.null;
    });
  });
});
