import sinon, { SinonSandbox } from 'sinon';
import { expect } from 'chai';
import type { Cesium3DTileset, Globe } from '@vcmap-cesium/engine';
import {
  getCesiumMap,
  setCesiumMap,
  createInitializedTilesetLayer,
} from '../../helpers/cesiumHelpers.js';
import VcsApp from '../../../../src/vcsApp.js';
import CesiumMap from '../../../../src/map/cesiumMap.js';
import ClippingPolygonObject from '../../../../src/util/clipping/clippingPolygonObject.js';
import { CesiumTilesetLayer } from '../../../../index.js';
import { timeout } from '../../helpers/helpers.js';

function getTilesetVisualization(
  map: CesiumMap,
  layer: CesiumTilesetLayer,
): Cesium3DTileset | undefined {
  const vis = map.getVisualizationsForLayer(layer);
  if (vis) {
    return [...vis][0] as Cesium3DTileset;
  }
  return vis;
}

const coordinates = [
  [1, 1, 1],
  [2, 2, 2],
  [3, 3, 3],
];

describe('clippingPolygonObjectCollection', () => {
  describe('adding an item', () => {
    let sandbox: SinonSandbox;
    let app: VcsApp;
    let cesiumMap: CesiumMap;

    before(async () => {
      sandbox = sinon.createSandbox();
      app = new VcsApp();
      cesiumMap = await setCesiumMap(app);
    });

    after(() => {
      cesiumMap.destroy();
      app.destroy();
    });

    it('should add ClippingPolygons, if item is set active on startup', async () => {
      const layer = await createInitializedTilesetLayer(
        sandbox,
        cesiumMap,
        'layer1',
      );
      await layer.activate();
      app.layers.add(layer);
      const vis = getTilesetVisualization(cesiumMap, layer);
      const globe = cesiumMap.getScene()?.globe;
      const clippingPolygonObject = new ClippingPolygonObject({
        coordinates,
        activeOnStartup: true,
        terrain: true,
      });
      app.clippingPolygons.add(clippingPolygonObject);
      await timeout(20);
      expect(
        globe?.clippingPolygons?.contains(
          clippingPolygonObject.clippingPolygon!,
        ),
      ).to.be.true;
      expect(
        vis?.clippingPolygons?.contains(clippingPolygonObject.clippingPolygon!),
      ).to.be.true;
      app.layers.remove(layer);
      cesiumMap.layerCollection.remove(layer);
      layer.destroy();
      app.clippingPolygons.remove(clippingPolygonObject);
      clippingPolygonObject.destroy();
    });

    describe('should set item listener', () => {
      let clippingPolygonObject: ClippingPolygonObject;
      let layer: CesiumTilesetLayer;
      let vis: Cesium3DTileset;
      let globe: Globe;

      before(async () => {
        layer = await createInitializedTilesetLayer(
          sandbox,
          cesiumMap,
          'layer2',
        );
        await layer.activate();
        app.layers.add(layer);
        vis = getTilesetVisualization(cesiumMap, layer)!;
        globe = cesiumMap.getScene()!.globe!;
        clippingPolygonObject = new ClippingPolygonObject({
          terrain: true,
          coordinates,
        });
        app.clippingPolygons.add(clippingPolygonObject);
      });

      after(() => {
        app.clippingPolygons.remove(clippingPolygonObject);
        clippingPolygonObject.destroy();
        app.layers.remove(layer);
        cesiumMap.layerCollection.remove(layer);
        layer.destroy();
      });

      it('should listen to state changes', () => {
        clippingPolygonObject.activate();
        expect(
          globe?.clippingPolygons?.contains(
            clippingPolygonObject.clippingPolygon!,
          ),
        ).to.be.true;
        expect(
          vis?.clippingPolygons?.contains(
            clippingPolygonObject.clippingPolygon!,
          ),
        ).to.be.true;
        clippingPolygonObject.deactivate();
        expect(globe?.clippingPolygons?.length).to.be.equal(0);
        expect(vis?.clippingPolygons?.length).to.be.equal(0);
      });

      it('should listen to clipping polygon changes', async () => {
        clippingPolygonObject.activate();
        clippingPolygonObject.setCoordinates([
          [13, 52],
          [14, 53],
          [13, 54],
        ]);
        await timeout(20);
        expect(vis.clippingPolygons.get(0)?.positions).to.deep.equal(
          clippingPolygonObject.clippingPolygon?.positions,
        );
        expect(globe.clippingPolygons.get(0)?.positions).to.deep.equal(
          clippingPolygonObject.clippingPolygon?.positions,
        );
      });

      it('should listen to terrain change', async () => {
        clippingPolygonObject.activate();
        clippingPolygonObject.terrain = false;
        await timeout(20);
        expect(
          globe?.clippingPolygons?.contains(
            clippingPolygonObject.clippingPolygon!,
          ),
        ).to.be.false;
        clippingPolygonObject.terrain = true;
        expect(
          globe?.clippingPolygons?.contains(
            clippingPolygonObject.clippingPolygon!,
          ),
        ).to.be.true;
      });

      it('should listen to layerNames changes', () => {
        clippingPolygonObject.activate();
        expect(
          vis?.clippingPolygons?.contains(
            clippingPolygonObject.clippingPolygon!,
          ),
        ).to.be.true;
        clippingPolygonObject.setLayerNames([]);
        expect(
          vis?.clippingPolygons?.contains(
            clippingPolygonObject.clippingPolygon!,
          ),
        ).to.be.false;
      });
    });
  });

  describe('removing an item', () => {
    let sandbox: SinonSandbox;
    let app: VcsApp;
    let cesiumMap: CesiumMap;

    before(async () => {
      sandbox = sinon.createSandbox();
      app = new VcsApp();
      cesiumMap = await setCesiumMap(app);
    });

    after(() => {
      cesiumMap.destroy();
      app.destroy();
    });

    it('should remove ClippingPolygons from active CesiumMaps', async () => {
      const layer = await createInitializedTilesetLayer(
        sandbox,
        cesiumMap,
        'layer3',
      );
      await layer.activate();
      app.layers.add(layer);
      const vis = getTilesetVisualization(cesiumMap, layer);
      const globe = cesiumMap.getScene()?.globe;
      const clippingPolygonObject = new ClippingPolygonObject({
        coordinates,
        activeOnStartup: true,
        terrain: true,
      });
      app.clippingPolygons.add(clippingPolygonObject);
      app.clippingPolygons.remove(clippingPolygonObject);
      await timeout(20);
      expect(
        globe?.clippingPolygons?.contains(
          clippingPolygonObject.clippingPolygon!,
        ),
      ).to.be.false;
      expect(
        vis?.clippingPolygons?.contains(clippingPolygonObject.clippingPolygon!),
      ).to.be.false;
      app.layers.remove(layer);
      cesiumMap.layerCollection.remove(layer);
      layer.destroy();
      clippingPolygonObject.destroy();
    });

    describe('should unset item listener', () => {
      let clippingPolygonObject: ClippingPolygonObject;
      let layer: CesiumTilesetLayer;
      let vis: Cesium3DTileset;
      let globe: Globe;

      before(async () => {
        layer = await createInitializedTilesetLayer(
          sandbox,
          cesiumMap,
          'layer4',
        );
        await layer.activate();
        app.layers.add(layer);
        vis = getTilesetVisualization(cesiumMap, layer)!;
        globe = cesiumMap.getScene()!.globe!;
        clippingPolygonObject = new ClippingPolygonObject({
          activeOnStartup: true,
          terrain: true,
          coordinates,
        });
        app.clippingPolygons.add(clippingPolygonObject);
        app.clippingPolygons.remove(clippingPolygonObject);
      });

      after(() => {
        app.clippingPolygons.remove(clippingPolygonObject);
        clippingPolygonObject.destroy();
        app.layers.remove(layer);
        cesiumMap.layerCollection.remove(layer);
        layer.destroy();
      });

      it('should not listen to state changes', () => {
        clippingPolygonObject.activate();
        expect(globe?.clippingPolygons?.length).to.be.equal(0);
        expect(vis?.clippingPolygons?.length).to.be.equal(0);
        clippingPolygonObject.deactivate();
        expect(globe?.clippingPolygons?.length).to.be.equal(0);
        expect(vis?.clippingPolygons?.length).to.be.equal(0);
      });

      it('should listen to clipping polygon changes', async () => {
        clippingPolygonObject.activate();
        clippingPolygonObject.setCoordinates([
          [13, 52],
          [14, 53],
          [13, 54],
        ]);
        await timeout(20);
        expect(globe?.clippingPolygons?.length).to.be.equal(0);
        expect(vis?.clippingPolygons?.length).to.be.equal(0);
      });

      it('should listen to terrain change', async () => {
        clippingPolygonObject.activate();
        clippingPolygonObject.terrain = false;
        await timeout(20);
        expect(globe?.clippingPolygons?.length).to.be.equal(0);
        expect(vis?.clippingPolygons?.length).to.be.equal(0);
      });

      it('should listen to layerNames changes', () => {
        clippingPolygonObject.activate();
        expect(vis?.clippingPolygons?.length).to.be.equal(0);
        clippingPolygonObject.setLayerNames([]);
        expect(vis?.clippingPolygons?.length).to.be.equal(0);
      });
    });
  });

  describe('map listener', () => {
    let sandbox: SinonSandbox;
    let app: VcsApp;
    let cesiumMap: CesiumMap;
    let layer: CesiumTilesetLayer;
    let clippingPolygonObject: ClippingPolygonObject;

    before(async () => {
      sandbox = sinon.createSandbox();
      app = new VcsApp();
      layer = await createInitializedTilesetLayer(sandbox, cesiumMap, 'layer4');
      app.layers.add(layer);
    });

    after(() => {
      cesiumMap.destroy();
      layer.destroy();
      app.destroy();
    });

    beforeEach(() => {
      clippingPolygonObject = new ClippingPolygonObject({
        coordinates,
        activeOnStartup: true,
        terrain: true,
      });
      app.clippingPolygons.add(clippingPolygonObject);
    });

    afterEach(() => {
      app.clippingPolygons.remove(clippingPolygonObject);
      clippingPolygonObject.destroy();
    });

    it('should track map state changes', async () => {
      cesiumMap = getCesiumMap(app);
      app.maps.add(cesiumMap);
      const globe = cesiumMap.getScene()?.globe;
      expect(globe?.clippingPolygons).to.be.undefined;
      await app.maps.setActiveMap(cesiumMap.name);
      await timeout(20);
      expect(
        globe?.clippingPolygons?.contains(
          clippingPolygonObject.clippingPolygon!,
        ),
      ).to.be.true;
    });

    it('should track visualizations being added', async () => {
      app.clippingPolygons.add(clippingPolygonObject);
      expect(getTilesetVisualization(cesiumMap, layer)).to.be.undefined;
      await layer.activate();
      await timeout(20);
      const vis = getTilesetVisualization(cesiumMap, layer);
      expect(
        vis?.clippingPolygons?.contains(clippingPolygonObject.clippingPolygon!),
      ).to.be.true;
    });

    it('should track visualizations being removed', async () => {
      app.layers.remove(layer);
      await timeout(20);
      expect(getTilesetVisualization(cesiumMap, layer)).to.be.undefined;
    });

    it('should handle removed CesiumMaps', async () => {
      const globe = cesiumMap.getScene()?.globe;
      app.maps.remove(cesiumMap);
      cesiumMap.deactivate();
      await timeout(20);
      expect(
        globe?.clippingPolygons?.contains(
          clippingPolygonObject.clippingPolygon!,
        ),
      ).to.be.false;
    });

    it('should handle replaced CesiumMaps', async () => {
      cesiumMap = await setCesiumMap(app);
      const globe = cesiumMap.getScene()?.globe;
      expect(
        globe?.clippingPolygons?.contains(
          clippingPolygonObject.clippingPolygon!,
        ),
      ).to.be.true;
      const newCesiumMap = getCesiumMap({ name: cesiumMap.name });
      app.maps.replace(newCesiumMap);
      await timeout(20);
      expect(
        globe?.clippingPolygons?.contains(
          clippingPolygonObject.clippingPolygon!,
        ),
      ).to.be.false;
      newCesiumMap.destroy();
    });
  });
});
