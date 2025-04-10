import { expect } from 'chai';
import sinon from 'sinon';
import { Cartesian2 } from '@vcmap-cesium/engine';
import { LineString, Point } from 'ol/geom.js';
import { Feature } from 'ol';
import type {
  CesiumMap,
  ObliqueMap,
  OpenlayersMap,
} from '../../../../../index.js';
import {
  EventType,
  LayerSnapping,
  ModificationKeyType,
  PointerEventType,
  PointerKeyType,
  VectorLayer,
} from '../../../../../index.js';
import { getOpenlayersMap } from '../../../helpers/openlayersHelpers.js';
import { getCesiumMap } from '../../../helpers/cesiumHelpers.js';
import VcsApp from '../../../../../src/vcsApp.js';
import { setObliqueMap } from '../../../helpers/obliqueHelpers.js';
import { arrayCloseTo, timeout } from '../../../helpers/helpers.js';
import { snapTypes } from '../../../../../src/util/editor/snappingHelpers.js';

describe('Layer Snapping', () => {
  let scratchLayer: VectorLayer;
  let layer1: VectorLayer;
  let layer2: VectorLayer;
  let app: VcsApp;

  before(() => {
    app = new VcsApp();
    scratchLayer = new VectorLayer({});
    layer1 = new VectorLayer({});
    layer2 = new VectorLayer({});
    app.layers.add(scratchLayer);
    app.layers.add(layer1);
    app.layers.add(layer2);
  });

  afterEach(() => {
    layer1.removeAllFeatures();
    layer2.removeAllFeatures();
  });

  after(() => {
    app.destroy();
  });

  describe('snapping to a layer', () => {
    let map: OpenlayersMap;
    let eventBase: {
      key: ModificationKeyType;
      pointer: PointerKeyType;
      pointerEvent: PointerEventType;
      windowPosition: Cartesian2;
      map: OpenlayersMap;
    };
    let layerSnapping: LayerSnapping;

    before(async () => {
      map = await getOpenlayersMap({});
      sinon.stub(map, 'getCurrentResolution').returns(0.05);
      eventBase = {
        key: ModificationKeyType.NONE,
        pointer: PointerKeyType.ALL,
        pointerEvent: PointerEventType.UP,
        windowPosition: new Cartesian2(0, 0),
        map,
      };
      layerSnapping = new LayerSnapping([layer1], scratchLayer, () => true);
    });

    beforeEach(() => {
      const geometry = new LineString([
        [0, 0, 0],
        [2, 0, 0],
        [2, 2, 0],
        [0, 2, 0],
      ]);
      layer1.addFeatures([new Feature({ geometry })]);
    });

    it('should snap to vertices', async () => {
      const modifiedEvent = await layerSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [2.05, 0.05],
        positionOrPixel: [2.05, 0.05],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([2, 0]);
    });

    it('should snap to edges', async () => {
      const modifiedEvent = await layerSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [0.6, 0.05],
        positionOrPixel: [0.6, 0.05],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([0.6, 0]);
    });

    it('should prioritize snapping to a vertex instead of an edge', async () => {
      layer1.addFeatures([new Feature({ geometry: new Point([0.65, 0.1]) })]);
      const modifiedEvent = await layerSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [0.6, 0.05],
        positionOrPixel: [0.6, 0.05],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([
        0.65, 0.1,
      ]);
    });

    it('should snap to more then one layer', async () => {
      layerSnapping.layers = [layer1, layer2];
      layer2.addFeatures([new Feature({ geometry: new Point([0.65, 0.1]) })]);

      const modifiedEvent = await layerSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [2.05, 0.05],
        positionOrPixel: [2.05, 0.05],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([2, 0]);

      const modifiedEventLayer2 = await layerSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [0.6, 0.05],
        positionOrPixel: [0.6, 0.05],
      });
      expect(modifiedEventLayer2.positionOrPixel!).to.have.ordered.members([
        0.65, 0.1,
      ]);
    });

    describe('setting of snapping features', () => {
      it('should set the vertex feature to the snapped vertex', async () => {
        await layerSnapping.pipe({
          ...eventBase,
          type: EventType.MOVE,
          position: [2.05, 0.05],
          positionOrPixel: [2.05, 0.05],
        });

        const features = scratchLayer.getFeatures();
        expect(features).to.have.lengthOf(1);
        expect(
          features[0].getGeometry()!.getCoordinates(),
        ).to.have.deep.ordered.members([2, 0]);
      });

      it('should set the edge feature to the snapped edge', async () => {
        await layerSnapping.pipe({
          ...eventBase,
          type: EventType.MOVE,
          position: [0.6, 0.05],
          positionOrPixel: [0.6, 0.05],
        });

        const features = scratchLayer.getFeatures();
        expect(features).to.have.lengthOf(1);
        expect(
          features[0].getGeometry()!.getCoordinates(),
        ).to.have.deep.ordered.members([0.6, 0]);
      });

      it('should clear the snapped features, if there is no snapping', async () => {
        await layerSnapping.pipe({
          ...eventBase,
          type: EventType.MOVE,
          position: [2.05, 0.05],
          positionOrPixel: [2.05, 0.05],
        });
        expect(scratchLayer.getFeatures()).to.have.lengthOf(1);
        await layerSnapping.pipe({
          ...eventBase,
          type: EventType.MOVE,
          position: [5.05, 0.05],
          positionOrPixel: [5.05, 0.05],
        });
        expect(scratchLayer.getFeatures()).to.be.empty;
      });
    });

    describe('setting of snapTo', () => {
      afterEach(() => {
        layerSnapping.snapTo = [...snapTypes];
      });

      it('should not snap to a vertex, if snapTo does not include vertex', async () => {
        layerSnapping.snapTo = [...snapTypes].filter((s) => s !== 'vertex');

        const modifiedEvent = await layerSnapping.pipe({
          ...eventBase,
          type: EventType.MOVE,
          position: [0.05, 2.05],
          positionOrPixel: [0.05, 2.05],
        });
        arrayCloseTo(modifiedEvent.positionOrPixel!, [0.05, 2]);
      });

      it('should not snap to an edge, if snapTo does not include edge', async () => {
        layerSnapping.snapTo = [...snapTypes].filter((s) => s !== 'edge');
        const modifiedEvent = await layerSnapping.pipe({
          ...eventBase,
          type: EventType.MOVE,
          position: [0.6, 0.05],
          positionOrPixel: [0.6, 0.05],
        });
        expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([
          0.6, 0.05,
        ]);
      });
    });
  });

  describe('snapping in 3D', () => {
    let map: CesiumMap;
    let eventBase: {
      key: ModificationKeyType;
      pointer: PointerKeyType;
      pointerEvent: PointerEventType;
      windowPosition: Cartesian2;
      map: CesiumMap;
    };
    let layerSnapping: LayerSnapping;

    before(() => {
      map = getCesiumMap({});
      sinon.stub(map, 'getCurrentResolution').returns(0.05);
      eventBase = {
        key: ModificationKeyType.NONE,
        pointer: PointerKeyType.ALL,
        pointerEvent: PointerEventType.UP,
        windowPosition: new Cartesian2(0, 0),
        map,
      };
      layerSnapping = new LayerSnapping([layer1], scratchLayer, () => true);
    });

    beforeEach(() => {
      const geometry = new LineString([
        [0, 0, 0],
        [2, 0, 0],
        [2, 2, 0],
        [0, 2, 0],
      ]);
      layer1.addFeatures([new Feature({ geometry })]);
    });

    it('should snap to vertices', async () => {
      const modifiedEvent = await layerSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [2.05, 0.05, 2],
        positionOrPixel: [2.05, 0.05, 2],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([2, 0, 0]);
    });

    it('should snap to edges', async () => {
      const modifiedEvent = await layerSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [0.6, 0.05, 2],
        positionOrPixel: [0.6, 0.05, 2],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([
        0.6, 0, 0,
      ]);
    });

    it('should augment 2D values with the picked position', async () => {
      layer1.addFeatures([new Feature({ geometry: new Point([0.65, 0.1]) })]);
      const modifiedEvent = await layerSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [0.6, 0.05, 12],
        positionOrPixel: [0.6, 0.05, 12],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([
        0.65, 0.1, 12,
      ]);
    });
  });

  describe('snapping in oblique', () => {
    let map: ObliqueMap;
    let eventBase: {
      key: ModificationKeyType;
      pointer: PointerKeyType;
      pointerEvent: PointerEventType;
      windowPosition: Cartesian2;
      map: ObliqueMap;
    };
    let layerSnapping: LayerSnapping;

    before(async () => {
      map = await setObliqueMap(app);
      sinon.stub(map, 'getCurrentResolution').returns(0.5);
      eventBase = {
        key: ModificationKeyType.NONE,
        pointer: PointerKeyType.ALL,
        pointerEvent: PointerEventType.UP,
        windowPosition: new Cartesian2(0, 0),
        map,
      };
      layerSnapping = new LayerSnapping([layer1], scratchLayer, () => true);
      await layer1.activate();
    });

    beforeEach(async () => {
      const geometry = new LineString([
        [0, 0, 0],
        [20, 0, 0],
        [20, 20, 0],
        [0, 20, 0],
      ]);
      geometry.translate(1489084, 6892790);
      const feature = new Feature({
        geometry,
      });
      layer1.addFeatures([feature]);
      await timeout(1);
    });

    it('should snap to vertices', async () => {
      const modifiedEvent = await layerSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [2676, 6483],
        positionOrPixel: [2676, 6483],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([
        2670.8819994153737, 6480.2822387372225,
      ]);
    });

    it('should snap to edges', async () => {
      const modifiedEvent = await layerSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [2679, 6480],
        positionOrPixel: [2679, 6480],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([
        2679.002452334995, 6480.140341340255,
      ]);
    });
  });
});
