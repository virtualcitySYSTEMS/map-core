import {
  PrimitiveCollection,
  ImageryLayer,
  SingleTileImageryProvider,
  Math as CesiumMath,
  Cartographic,
  CustomDataSource,
  DataSourceClock,
  Clock,
  JulianDate,
} from '@vcmap-cesium/engine';

import Layer from '../../../src/layer/layer.js';
import { vcsLayerName } from '../../../src/layer/layerSymbols.js';
import LayerCollection from '../../../src/util/layerCollection.js';
import { blackPixelURI } from '../helpers/imageHelpers.js';
import Viewpoint from '../../../src/util/viewpoint.js';
import CesiumMap, { synchronizeClock } from '../../../src/map/cesiumMap.js';
import { getCesiumMap } from '../helpers/cesiumHelpers.js';
import CameraLimiter from '../../../src/map/cameraLimiter.js';

describe('CesiumMap', () => {
  let sandbox;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  after(() => {
    sandbox.restore();
  });

  describe('handling primitive collection / tileset visualizations', () => {
    let layer1;
    let layer2;
    let primitiveCollection1;
    let primitiveCollection2;

    before(() => {
      layer1 = new Layer({});
      layer2 = new Layer({});
    });

    beforeEach(() => {
      // destroyed on map destroy or removal
      primitiveCollection1 = new PrimitiveCollection();
      primitiveCollection1[vcsLayerName] = layer1.name;
      primitiveCollection2 = new PrimitiveCollection();
      primitiveCollection2[vcsLayerName] = layer2.name;
    });

    after(() => {
      layer1.destroy();
      layer2.destroy();
    });

    describe('adding primitive collection', () => {
      /** @type {import("@vcmap/core").CesiumMap} */
      let map;
      let layerCollection;

      before(() => {
        layerCollection = LayerCollection.from([layer1, layer2]);
      });

      beforeEach(() => {
        map = getCesiumMap({ layerCollection });
      });

      afterEach(() => {
        map.destroy();
      });

      after(() => {
        layerCollection.destroy();
      });

      it('should add a primitive collection to the scene', () => {
        map.addPrimitiveCollection(primitiveCollection1);
        expect(map.getScene().primitives.contains(primitiveCollection1)).to.be
          .true;
      });

      it('should not add a visualization twice', () => {
        map.addPrimitiveCollection(primitiveCollection1);
        map.addPrimitiveCollection(primitiveCollection1);
        expect(map.getScene().primitives.length).to.equal(1);
      });

      it('should add a visualization at the correct index based on the index in the layer collection', () => {
        map.addPrimitiveCollection(primitiveCollection2);
        map.addPrimitiveCollection(primitiveCollection1);
        const { primitives } = map.getScene();
        expect(primitives.length).to.equal(2);
        expect(primitives.get(0)).to.equal(primitiveCollection1);
        expect(primitives.get(1)).to.equal(primitiveCollection2);
      });

      it('should not add a primitive collection without a vcsLayerName symbol', () => {
        const collection = new PrimitiveCollection();
        map.addPrimitiveCollection(collection);
        expect(map.getScene().primitives.length).to.equal(0);
        collection.destroy();
      });

      it('should not add an primitive collection with a vcsLayerName not corresponding to a layer in the layerCollection', () => {
        const collection = new PrimitiveCollection();
        collection[vcsLayerName] = 'test';
        map.addPrimitiveCollection(collection);
        expect(map.getScene().primitives.length).to.equal(0);
        collection.destroy();
      });
    });

    describe('moving of layers within the layer collection', () => {
      it('should rearrange the primitive collections to place them at the right index', async () => {
        const layerCollection = LayerCollection.from([layer1, layer2]);
        const map = getCesiumMap({ layerCollection });
        map.addPrimitiveCollection(primitiveCollection1);
        map.addPrimitiveCollection(primitiveCollection2);
        layerCollection.raise(layer1);
        const { primitives } = map.getScene();
        expect(primitives.get(0)).to.equal(primitiveCollection2);
        expect(primitives.get(1)).to.equal(primitiveCollection1);
        map.destroy();
        layerCollection.destroy();
      });
    });

    describe('removing of layers', () => {
      /** @type {import("@vcmap/core").CesiumMap} */
      let map;
      let layerCollection;

      before(() => {
        layerCollection = LayerCollection.from([layer1, layer2]);
      });

      beforeEach(() => {
        map = getCesiumMap({ layerCollection });
        map.addPrimitiveCollection(primitiveCollection1);
        map.addPrimitiveCollection(primitiveCollection2);
      });

      afterEach(() => {
        map.destroy();
      });

      after(() => {
        layerCollection.destroy();
      });

      it('should remove the primitive collection from the map', () => {
        map.removePrimitiveCollection(primitiveCollection1);
        expect(map.getScene().primitives.contains(primitiveCollection1)).to.be
          .false;
      });

      it('should no longer place the primitive collection at an index, if it has been removed after the removal of its visualization', () => {
        map.removePrimitiveCollection(primitiveCollection1);
        layerCollection.raise(layer1);
        expect(map.getScene().primitives.contains(primitiveCollection1)).to.be
          .false;
      });
    });
  });

  describe('handling imagery visualizations', () => {
    let layer1;
    let layer2;
    let imageryProvider;
    let imageryLayer1;
    let imageryLayer2;

    before(() => {
      layer1 = new Layer({});
      layer2 = new Layer({});
    });

    beforeEach(() => {
      // destroyed on map destroy
      imageryProvider = new SingleTileImageryProvider({
        url: blackPixelURI,
        tileWidth: 1,
        tileHeight: 1,
      });
      imageryLayer1 = new ImageryLayer(imageryProvider);
      imageryLayer1[vcsLayerName] = layer1.name;
      imageryLayer2 = new ImageryLayer(imageryProvider);
      imageryLayer2[vcsLayerName] = layer2.name;
    });

    after(() => {
      layer1.destroy();
      layer2.destroy();
    });

    describe('adding imagery layers', () => {
      /** @type {import("@vcmap/core").CesiumMap} */
      let map;
      let layerCollection;

      before(() => {
        layerCollection = LayerCollection.from([layer1, layer2]);
      });

      beforeEach(() => {
        map = getCesiumMap({ layerCollection });
      });

      afterEach(() => {
        map.destroy();
      });

      after(() => {
        layerCollection.destroy();
      });

      it('should add an imagery layer to the scene', () => {
        map.addImageryLayer(imageryLayer1);
        expect(map.getScene().imageryLayers.contains(imageryLayer1)).to.be.true;
      });

      it('should not add a visualization twice', () => {
        map.addImageryLayer(imageryLayer1);
        map.addImageryLayer(imageryLayer1);
        expect(map.getScene().imageryLayers.length).to.equal(1);
      });

      it('should add a visualization at the correct index based on the index in the layer collection', () => {
        map.addImageryLayer(imageryLayer2);
        map.addImageryLayer(imageryLayer1);
        const { imageryLayers } = map.getScene();
        expect(imageryLayers.length).to.equal(2);
        expect(imageryLayers.get(0)).to.equal(imageryLayer1);
        expect(imageryLayers.get(1)).to.equal(imageryLayer2);
      });

      it('should not add an imagery layer without a vcsLayerName symbol', () => {
        const layer = new ImageryLayer(imageryProvider);
        map.addImageryLayer(layer);
        expect(map.getScene().imageryLayers.length).to.equal(0);
        layer.destroy();
      });

      it('should not add an imagery layer with a vcsLayerName not corresponding to a layer in the layerCollection', () => {
        const layer = new ImageryLayer(imageryProvider);
        layer[vcsLayerName] = 'test';
        map.addImageryLayer(layer);
        expect(map.getScene().imageryLayers.length).to.equal(0);
        layer.destroy();
      });
    });

    describe('moving of layers within the layer collection', () => {
      it('should rearrange the layers to place them at the right index', async () => {
        const layerCollection = LayerCollection.from([layer1, layer2]);
        const map = getCesiumMap({ layerCollection });
        map.addImageryLayer(imageryLayer1);
        map.addImageryLayer(imageryLayer2);
        layerCollection.raise(layer1);
        const { imageryLayers } = map.getScene();
        expect(imageryLayers.get(0)).to.equal(imageryLayer2);
        expect(imageryLayers.get(1)).to.equal(imageryLayer1);
        map.destroy();
        layerCollection.destroy();
      });
    });

    describe('removing of layers', () => {
      /** @type {import("@vcmap/core").CesiumMap} */
      let map;
      let layerCollection;

      before(() => {
        layerCollection = LayerCollection.from([layer1, layer2]);
      });

      beforeEach(() => {
        map = getCesiumMap({ layerCollection });
        map.addImageryLayer(imageryLayer1);
        map.addImageryLayer(imageryLayer2);
      });

      afterEach(() => {
        map.destroy();
      });

      after(() => {
        layerCollection.destroy();
      });

      it('should remove the layer from the map', () => {
        map.removeImageryLayer(imageryLayer1);
        expect(map.getScene().imageryLayers.contains(imageryLayer1)).to.be
          .false;
      });

      it('should no longer place the layer at an index, if it has been removed after the removal of its visualization', () => {
        map.removeImageryLayer(imageryLayer1);
        layerCollection.raise(layer1);
        expect(map.getScene().imageryLayers.contains(imageryLayer1)).to.be
          .false;
      });
    });
  });

  describe('handling datasource visualizations', () => {
    let layer1;
    let layer2;
    let dataSource1;
    let dataSource2;

    before(() => {
      layer1 = new Layer({});
      layer2 = new Layer({});
    });

    beforeEach(() => {
      // destroyed on map destroy
      dataSource1 = new CustomDataSource();
      dataSource1[vcsLayerName] = layer1.name;
      dataSource2 = new CustomDataSource();
      dataSource2[vcsLayerName] = layer2.name;
    });

    after(() => {
      layer1.destroy();
      layer2.destroy();
    });

    describe('adding data sources', () => {
      /** @type {import("@vcmap/core").CesiumMap} */
      let map;
      let layerCollection;

      before(() => {
        layerCollection = LayerCollection.from([layer1, layer2]);
      });

      beforeEach(() => {
        map = getCesiumMap({ layerCollection });
      });

      afterEach(() => {
        map.destroy();
      });

      after(() => {
        layerCollection.destroy();
      });

      it('should add a datasource to the datasources', async () => {
        await map.addDataSource(dataSource1);
        expect(map.getDatasources().contains(dataSource1)).to.be.true;
      });

      it('should not add a visualization twice', async () => {
        await map.addDataSource(dataSource1);
        await map.addDataSource(dataSource1);
        expect(map.getDatasources().length).to.equal(1);
      });

      it('should add a visualization at the correct index based on the index in the layer collection', async () => {
        await map.addDataSource(dataSource2);
        await map.addDataSource(dataSource1);
        const dataSources = map.getDatasources();
        expect(dataSources.length).to.equal(2);
        expect(dataSources.get(0)).to.equal(dataSource1);
        expect(dataSources.get(1)).to.equal(dataSource2);
      });

      it('should not add a data source without a vcsLayerName symbol', async () => {
        const dataSource = new CustomDataSource();
        await map.addDataSource(dataSource);
        expect(map.getDatasources().length).to.equal(0);
      });

      it('should not add a data source with a vcsLayerName not corresponding to a layer in the layerCollection', async () => {
        const dataSource = new CustomDataSource();
        dataSource[vcsLayerName] = 'test';
        await map.addDataSource(dataSource);
        expect(map.getDatasources().length).to.equal(0);
      });
    });

    describe('moving of layers within the layer collection', () => {
      it('should rearrange the layers to place them at the right index', async () => {
        const layerCollection = LayerCollection.from([layer1, layer2]);
        const map = getCesiumMap({ layerCollection });
        await map.addDataSource(dataSource1);
        await map.addDataSource(dataSource2);
        layerCollection.lower(layer2);
        const dataSources = map.getDatasources();
        expect(dataSources.get(0)).to.equal(dataSource2);
        expect(dataSources.get(1)).to.equal(dataSource1);
        map.destroy();
        layerCollection.destroy();
      });
    });

    describe('removing of layers', () => {
      /** @type {import("@vcmap/core").CesiumMap} */
      let map;
      let layerCollection;

      before(() => {
        layerCollection = LayerCollection.from([layer1, layer2]);
      });

      beforeEach(async () => {
        map = getCesiumMap({ layerCollection });
        await map.addDataSource(dataSource1);
        await map.addDataSource(dataSource2);
      });

      afterEach(() => {
        map.destroy();
      });

      after(() => {
        layerCollection.destroy();
      });

      it('should remove the layer from the map', () => {
        map.removeDataSource(dataSource1);
        expect(map.getDatasources().contains(dataSource1)).to.be.false;
      });

      it('should no longer place the layer at an index, if it has been removed after the removal of its visualization', () => {
        map.removeDataSource(dataSource1);
        layerCollection.raise(layer1);
        expect(map.getDatasources().contains(dataSource1)).to.be.false;
      });
    });
  });

  describe('setting a viewpoint', () => {
    let map;

    before(() => {
      map = getCesiumMap();
    });

    after(() => {
      map.destroy();
    });

    describe('with a regular viewpoint', () => {
      before(async () => {
        await map.gotoViewpoint(
          new Viewpoint({
            groundPosition: [0, 0, 10],
            cameraPosition: [1, 1, 100],
            distance: 100,
            animate: false,
            heading: 45,
            pitch: -45,
            roll: 45,
          }),
        );
      });

      it('should set the camera position', () => {
        const cartographic = map.getScene().camera.positionCartographic;
        expect(cartographic.longitude).to.be.closeTo(
          CesiumMath.toRadians(1),
          0.00001,
        );
        expect(cartographic.latitude).to.be.closeTo(
          CesiumMath.toRadians(1),
          0.00001,
        );
        expect(cartographic.height).to.be.closeTo(100, 0.00001);
      });

      it('should set the cameras heading, pitch and roll', () => {
        const { heading, pitch, roll } = map.getScene().camera;
        expect(heading).to.equal(Math.PI / 4);
        expect(pitch).to.equal(-Math.PI / 4);
        expect(roll).to.equal(Math.PI / 4);
      });
    });

    describe('without a camera position', () => {
      it('should determine the camera position based on the ground coordinate and the distance', async () => {
        await map.gotoViewpoint(
          new Viewpoint({
            groundPosition: [0, 0, 10],
            distance: 100,
            animate: false,
            pitch: -90,
          }),
        );
        const cartographic = map.getScene().camera.positionCartographic;
        expect(cartographic.longitude).to.be.closeTo(0, 0.001);
        expect(cartographic.latitude).to.be.closeTo(0, 0.001);
        expect(cartographic.height).to.be.closeTo(110, 0.00001);
      });
    });

    describe('which is animated', () => {
      it('should create a flight path if animated', async () => {
        await map.gotoViewpoint(
          new Viewpoint({
            groundPosition: [0, 0, 0],
            cameraPosition: [1, 1, 100],
            distance: 100,
            animate: true,
            duration: 0.01,
            heading: 45,
          }),
        );
        const cartographic = map.getScene().camera.positionCartographic;
        expect(cartographic.longitude).to.be.closeTo(
          CesiumMath.toRadians(1),
          0.00001,
        );
        expect(cartographic.latitude).to.be.closeTo(
          CesiumMath.toRadians(1),
          0.00001,
        );
        expect(cartographic.height).to.be.closeTo(100, 0.00001);
      });

      it('should cancel a running animated viewpoint on the next function call', async () => {
        map.gotoViewpoint(
          new Viewpoint({
            groundPosition: [0, 0, 0],
            cameraPosition: [1, 1, 100],
            distance: 100,
            animate: true,
            duration: 0.01,
            heading: 45,
          }),
        );
        await map.gotoViewpoint(
          new Viewpoint({
            groundPosition: [0, 0, 0],
            cameraPosition: [2, 2, 100],
            distance: 100,
            animate: false,
            duration: 0.01,
            heading: 45,
          }),
        );
        const cartographic = map.getScene().camera.positionCartographic;
        expect(cartographic.longitude).to.be.closeTo(
          CesiumMath.toRadians(2),
          0.00001,
        );
        expect(cartographic.latitude).to.be.closeTo(
          CesiumMath.toRadians(2),
          0.00001,
        );
        expect(cartographic.height).to.be.closeTo(100, 0.00001);
      });
    });
  });

  describe('determining the visibility of a WGS84 coordinate', () => {
    let map;

    before(async () => {
      map = getCesiumMap();
      await map.gotoViewpoint(
        new Viewpoint({
          groundPosition: [0, 0, 0],
          cameraPosition: [0, 0, 100],
          distance: 100,
          animate: false,
        }),
      );
    });

    after(() => {
      map.destroy();
    });

    it('should return true for a coordinate within the current views bounds', () => {
      expect(map.pointIsVisible([0, 0])).to.be.true;
    });

    it('should return false for a coordinate outside the current views bounds', () => {
      expect(map.pointIsVisible([10, 10])).to.be.false;
    });
  });

  describe('activating a cesium map', () => {
    let map;

    beforeEach(() => {
      map = getCesiumMap();
    });

    afterEach(() => {
      map.destroy();
    });

    it('should set the cesium widgets use of the default rendering loop to true', async () => {
      await map.activate();
      expect(map.getCesiumWidget()).to.have.property(
        'useDefaultRenderLoop',
        true,
      );
    });

    it('should force a resize of the cesium widget', async () => {
      const resize = sandbox.spy(map.getCesiumWidget(), 'resize');
      await map.activate();
      expect(resize).to.have.been.called;
    });
  });

  describe('deactivating a cesium map', () => {
    let map;

    beforeEach(async () => {
      map = getCesiumMap();
      await map.activate();
    });

    afterEach(() => {
      map.destroy();
    });

    it('should set the cesium widgets use of the default rendering loop to false', () => {
      map.deactivate();
      expect(map.getCesiumWidget()).to.have.property(
        'useDefaultRenderLoop',
        false,
      );
    });
  });

  describe('synchronizing clocks', () => {
    let clock;
    let dataSourceDisplayClock;

    before(() => {
      clock = new DataSourceClock();
      dataSourceDisplayClock = new Clock({ shouldAnimate: true });
      synchronizeClock(clock, dataSourceDisplayClock);
    });

    describe('change clock properties', () => {
      it('should update the clock', () => {
        clock.startTime = JulianDate.fromIso8601('2020-12-31T11:59:59Z');
        clock.currentTime = JulianDate.fromIso8601('2021-01-01T00:00:00Z');
        expect(dataSourceDisplayClock).to.have.property(
          'startTime',
          clock.startTime,
        );
        expect(dataSourceDisplayClock).to.have.property(
          'currentTime',
          clock.currentTime,
        );
      });
    });
  });

  describe('handling data source clocks', () => {
    let map;
    let dataSourceClock1;
    let dataSourceClock2;

    before(() => {
      dataSourceClock1 = new DataSourceClock();
      dataSourceClock1.currentTime = JulianDate.fromIso8601(
        '2021-01-01T01:01:01Z',
      );
      dataSourceClock1.startTime = JulianDate.fromIso8601(
        '2021-01-01T01:01:01Z',
      );
      dataSourceClock1.stopTime = JulianDate.fromIso8601(
        '2021-01-01T11:11:11Z',
      );
      dataSourceClock2 = new DataSourceClock();
      dataSourceClock2.currentTime = JulianDate.fromIso8601(
        '2020-02-02T02:02:02Z',
      );
      dataSourceClock2.startTime = JulianDate.fromIso8601(
        '2020-02-02T02:02:02Z',
      );
      dataSourceClock2.stopTime = JulianDate.fromIso8601(
        '2020-02-02T22:22:22Z',
      );
    });

    describe('set dataSourceClock to cesium map', () => {
      before(() => {
        map = getCesiumMap();
        map.setDataSourceDisplayClock(dataSourceClock1);
        map.setDataSourceDisplayClock(dataSourceClock2);
        map.setDataSourceDisplayClock(dataSourceClock1);
        map.setDataSourceDisplayClock(dataSourceClock1);
        map.setDataSourceDisplayClock(dataSourceClock2);
      });

      after(() => {
        map.destroy();
      });

      it('should add dataSourceClock to clocks', () => {
        expect(map._dataSourceClocks).to.have.ordered.members([
          dataSourceClock1,
          dataSourceClock2,
          dataSourceClock1,
          dataSourceClock1,
          dataSourceClock2,
        ]);
      });

      it('should synchronize active dataSourceClock and dataSourceDisplayClock', () => {
        const {
          clockRange,
          clockStep,
          multiplier,
          startTime,
          stopTime,
          currentTime,
        } = dataSourceClock2;
        expect(map.dataSourceDisplayClock).to.include({
          clockRange,
          clockStep,
          multiplier,
          startTime,
          stopTime,
          currentTime,
        });
      });

      it('should NOT synchronize currentTime, startTime & endTime, if start and end time are equal', () => {
        const dataSourceClock3 = dataSourceClock2.clone();
        JulianDate.addHours(
          dataSourceClock3.currentTime,
          1,
          dataSourceClock3.currentTime,
        );
        dataSourceClock3.multiplier = 2;
        map.setDataSourceDisplayClock(dataSourceClock3);
        expect(map.dataSourceDisplayClock.currentTime).to.equal(
          dataSourceClock2.currentTime,
        );
        expect(map.dataSourceDisplayClock.multiplier).to.equal(
          dataSourceClock3.multiplier,
        );
      });
    });

    describe('unset active dataSourceClock from cesium map', () => {
      before(() => {
        map = getCesiumMap();
        map.setDataSourceDisplayClock(dataSourceClock1);
        map.setDataSourceDisplayClock(dataSourceClock2);
        map.setDataSourceDisplayClock(dataSourceClock1);
        map.setDataSourceDisplayClock(dataSourceClock1);
        map.setDataSourceDisplayClock(dataSourceClock2);
        map.unsetDataSourceDisplayClock(dataSourceClock2);
      });

      after(() => {
        map.destroy();
      });

      it('should remove dataSourceClock from clocks', () => {
        expect(map._dataSourceClocks).to.have.ordered.members([
          dataSourceClock1,
          dataSourceClock2,
          dataSourceClock1,
          dataSourceClock1,
        ]);
      });

      it('should synchronize the last active clock', () => {
        expect(map.dataSourceDisplayClock).to.have.property(
          'currentTime',
          dataSourceClock1.currentTime,
        );
      });
    });

    describe('unset inactive dataSourceClock from cesium map', () => {
      before(() => {
        map = getCesiumMap();
        map.setDataSourceDisplayClock(dataSourceClock1);
        map.setDataSourceDisplayClock(dataSourceClock2);
        map.setDataSourceDisplayClock(dataSourceClock1);
        map.setDataSourceDisplayClock(dataSourceClock1);
        map.setDataSourceDisplayClock(dataSourceClock2);
        map.unsetDataSourceDisplayClock(dataSourceClock1);
      });

      after(() => {
        map.destroy();
      });

      it('should remove dataSourceClock from clocks', () => {
        expect(map._dataSourceClocks).to.have.ordered.members([
          dataSourceClock1,
          dataSourceClock2,
          dataSourceClock1,
          dataSourceClock2,
        ]);
      });

      it('should NOT resynchronize clocks', () => {
        expect(map.dataSourceDisplayClock).to.have.property(
          'currentTime',
          dataSourceClock2.currentTime,
        );
      });
    });

    describe('unset all dataSourceClock from cesium map', () => {
      before(() => {
        map = getCesiumMap();
        map.setDataSourceDisplayClock(dataSourceClock1);
        map.unsetDataSourceDisplayClock(dataSourceClock1);
      });

      after(() => {
        map.destroy();
      });

      it('should restore default clock', () => {
        expect(map._dataSourceClocks).to.have.length(0);
        expect(map.dataSourceDisplayClock).to.have.property(
          'currentTime',
          map._defaultClock.currentTime,
        );
      });
    });
  });

  describe('camera limiters', () => {
    let map;

    beforeEach(() => {
      map = getCesiumMap();
    });

    afterEach(() => {
      map.destroy();
    });

    it('should set a camera limiter', () => {
      const cameraLimiter = new CameraLimiter({});
      map.cameraLimiter = cameraLimiter;
      expect(map.cameraLimiter).to.equal(cameraLimiter);
    });

    it('should allow the setting of a camera limiter on an uninitialized map', () => {
      const newMap = new CesiumMap({});
      const cameraLimiter = new CameraLimiter({});
      newMap.cameraLimiter = cameraLimiter;
      expect(newMap.cameraLimiter).to.equal(cameraLimiter);
      newMap.destroy();
    });

    it('should add the camera limiter to the preUpdate event', (done) => {
      Cartographic.toCartesian(
        new Cartographic(0, 0, 100),
        null,
        map.getScene().camera.position,
      );
      map.cameraLimiter = new CameraLimiter({ limit: 200 });
      map.getScene().preUpdate.raiseEvent();
      setTimeout(() => {
        expect(map.getScene().camera.positionCartographic.height).to.equal(200);
        done();
      }, 100);
    });

    it('should remove a previously set camera limiter', (done) => {
      Cartographic.toCartesian(
        new Cartographic(0, 0, 100),
        null,
        map.getScene().camera.position,
      );
      map.cameraLimiter = new CameraLimiter({ limit: 200 });
      map.cameraLimiter = null;
      map.getScene().preUpdate.raiseEvent();
      setTimeout(() => {
        expect(map.getScene().camera.positionCartographic.height).to.be.closeTo(
          100,
          0.00001,
        );
        done();
      }, 100);
    });

    it('should replace a previously set camera limiter', (done) => {
      Cartographic.toCartesian(
        new Cartographic(0, 0, 100),
        null,
        map.getScene().camera.position,
      );
      map.cameraLimiter = new CameraLimiter({ limit: 500 });
      map.cameraLimiter = new CameraLimiter({ limit: 200 });
      map.getScene().preUpdate.raiseEvent();
      setTimeout(() => {
        expect(map.getScene().camera.positionCartographic.height).to.be.closeTo(
          200,
          0.00001,
        );
        done();
      }, 100);
    });
  });

  describe('getting of a config object', () => {
    it('should only return name and type of a default cesium map', () => {
      const map = new CesiumMap({});
      const config = map.toJSON();
      expect(config).to.have.all.keys('name', 'type');
      map.destroy();
    });

    it('should return the config of a set camera limiter', () => {
      const map = new CesiumMap({});
      map.cameraLimiter = new CameraLimiter({ level: null });
      const config = map.toJSON();
      expect(config)
        .to.have.property('cameraLimiter')
        .and.to.have.property('level', null);
      map.destroy();
    });

    describe('of a configured cesium map', () => {
      let map;
      let inputConfig;
      let outputConfig;

      before(() => {
        inputConfig = {
          enableLightning: false,
          tileCacheSize: 2,
          webGLaa: true,
          globeColor: '#00ff00',
          contextOptions: {
            webgl: {
              failIfMajorPerformanceCaveat: true,
            },
          },
          useOriginalCesiumShader: true,
          lightIntensity: 4,
          cameraLimiter: {
            terrainUrl: 'test',
            limit: 200,
            level: 10,
            mode: 'distance',
          },
        };
        map = new CesiumMap(inputConfig);
        outputConfig = map.toJSON();
      });

      after(() => {
        map.destroy();
      });

      it('should configure enableLighting', () => {
        expect(outputConfig).to.have.property(
          'enableLightning',
          inputConfig.enableLightning,
        );
      });

      it('should configure tileCacheSize', () => {
        expect(outputConfig).to.have.property(
          'tileCacheSize',
          inputConfig.tileCacheSize,
        );
      });

      it('should configure webGLaa', () => {
        expect(outputConfig).to.have.property('webGLaa', inputConfig.webGLaa);
      });

      it('should configure globeColor', () => {
        expect(outputConfig).to.have.property(
          'globeColor',
          inputConfig.globeColor,
        );
      });

      it('should configure cameraLimiter', () => {
        expect(outputConfig)
          .to.have.property('cameraLimiter')
          .and.to.eql(inputConfig.cameraLimiter);
      });

      it('should configure lightIntensity', () => {
        expect(outputConfig)
          .to.have.property('lightIntensity')
          .and.to.eql(inputConfig.lightIntensity);
      });

      it('should configure useOriginalCesiumShader', () => {
        expect(outputConfig)
          .to.have.property('useOriginalCesiumShader')
          .and.to.eql(inputConfig.useOriginalCesiumShader);
      });

      it('should configure contextOptions', () => {
        expect(outputConfig)
          .to.have.property('contextOptions')
          .and.to.deep.equal(inputConfig.contextOptions);
      });
    });
  });

  describe('setting a shadowMap', () => {
    let map;
    let newShadowMap;

    before(async () => {
      newShadowMap = { enabled: true };
    });

    beforeEach(() => {
      map = getCesiumMap();
    });

    afterEach(() => {
      map.destroy();
    });

    it('should set a shadowMap', () => {
      map.setShadowMap(newShadowMap);
      expect(map.getScene().shadowMap).to.equal(newShadowMap);
    });

    it('should raise the shadowMapChanged event', () => {
      const changed = sandbox.spy();
      map.shadowMapChanged.addEventListener(changed);
      map.setShadowMap(newShadowMap);
      expect(changed).to.have.been.calledWithExactly(newShadowMap);
    });

    it('should only raise the shadowMapChanged event, if the shadow map actually changes', () => {
      const changed = sandbox.spy();
      map.shadowMapChanged.addEventListener(changed);
      map.setShadowMap(map._defaultShadowMap);
      expect(changed).to.not.have.been.called;
    });

    it('should set default shadow map', () => {
      map.setShadowMap(newShadowMap);
      map.setDefaultShadowMap();
      expect(map.getScene().shadowMap).to.equal(map._defaultShadowMap);
    });

    it('should set initialShadowMap', () => {
      const newMap = new CesiumMap({});
      newMap.setShadowMap(newShadowMap);
      expect(newMap._initialShadowMap).to.equal(newShadowMap);
    });
  });
});
