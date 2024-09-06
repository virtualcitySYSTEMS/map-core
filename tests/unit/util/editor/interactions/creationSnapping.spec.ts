import { expect } from 'chai';
import sinon from 'sinon';
import { LineString, Polygon } from 'ol/geom.js';
import { Math as CesiumMath, Cartesian2 } from '@vcmap-cesium/engine';
import {
  CesiumMap,
  EventType,
  ModificationKeyType,
  OpenlayersMap,
  PointerEventType,
  PointerKeyType,
  validityPlaceholder,
  VectorLayer,
} from '../../../../../index.js';
import { getOpenlayersMap } from '../../../helpers/openlayersHelpers.js';
import CreationSnapping from '../../../../../src/util/editor/interactions/creationSnapping.js';
import { arrayCloseTo } from '../../../helpers/helpers.js';
import { getCesiumMap } from '../../../helpers/cesiumHelpers.js';
import { snapTypes } from '../../../../../src/util/editor/snappingHelpers.js';

describe('creation snapping', () => {
  let map: OpenlayersMap;
  let creationSnapping: CreationSnapping;
  let scratchLayer: VectorLayer;
  let eventBase: {
    key: ModificationKeyType;
    pointer: PointerKeyType;
    pointerEvent: PointerEventType;
    windowPosition: Cartesian2;
    map: OpenlayersMap;
  };

  before(async () => {
    map = await getOpenlayersMap({});
    scratchLayer = new VectorLayer({});
    sinon.stub(map, 'getCurrentResolution').returns(0.05);
    eventBase = {
      key: ModificationKeyType.NONE,
      pointer: PointerKeyType.ALL,
      pointerEvent: PointerEventType.UP,
      windowPosition: new Cartesian2(0, 0),
      map,
    };
  });

  beforeEach(() => {
    creationSnapping = new CreationSnapping(scratchLayer);
  });

  afterEach(() => {
    creationSnapping.destroy();
  });

  after(() => {
    map.destroy();
    scratchLayer.destroy();
  });

  describe('line string', () => {
    it('should snap to bearings', async () => {
      const geometry = new LineString([
        [0, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
        [1, 1.5, 0],
      ]);
      creationSnapping.setGeometry(geometry);
      const modifiedEvent = await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [1, 2.1],
        positionOrPixel: [1, 2.1],
      });
      arrayCloseTo(modifiedEvent.positionOrPixel!, [1.05, 2.05]);
    });

    it('should snap to an orthogonal', async () => {
      const geometry = new LineString([
        [1, 1, 0],
        [2, 2, 0],
        [3, 1.05, 0],
      ]);
      creationSnapping.setGeometry(geometry);
      const modifiedEvent = await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [3, 1.05],
        positionOrPixel: [3, 1.05],
      });
      arrayCloseTo(modifiedEvent.positionOrPixel!, [2.975, 1.025]);
    });

    it('should snap to a co-linear point', async () => {
      const geometry = new LineString([
        [1, 1, 0],
        [2, 2, 0],
        [3, 3.05, 0],
      ]);
      creationSnapping.setGeometry(geometry);
      const modifiedEvent = await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [3, 3.05],
        positionOrPixel: [3, 3.05],
      });
      arrayCloseTo(modifiedEvent.positionOrPixel!, [3.025, 3.025]);
    });

    it('should not snap, if deviation of angle is too high', async () => {
      const geometry = new LineString([
        [1, 1, 0],
        [2, 2, 0],
        [3, 1.05, 0],
      ]);
      creationSnapping.setGeometry(geometry);
      const modifiedEvent = await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [3, 1.25],
        positionOrPixel: [3, 1.25],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([3, 1.25]);
    });

    it('should not snap, if pixel deviation is too high', async () => {
      const geometry = new LineString([
        [1, 1, 0],
        [2, 2, 0],
        [2500000, 2500050, 0],
      ]);
      creationSnapping.setGeometry(geometry);
      const modifiedEvent = await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [2500000, 2500350],
        positionOrPixel: [2500000, 2500350],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([
        2500000, 2500350,
      ]);
    });

    it('should not snap to its own bearings', async () => {
      const geometry = new LineString([
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
        [2, 2, 0],
      ]);
      creationSnapping.setGeometry(geometry);
      const modifiedEvent = await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [3.1, 3],
        positionOrPixel: [3.1, 3],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([3.1, 3]);
    });

    it('should snap to its own vertices', async () => {
      const geometry = new LineString([
        [0, 0, 0],
        [1, 0, 0],
        [2, 1, 0],
        [2, 2, 0],
      ]);
      creationSnapping.setGeometry(geometry);
      const modifiedEvent = await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [1.05, 0.05],
        positionOrPixel: [1.05, 0.05],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([1, 0]);
    });

    it('should snap to its own edge', async () => {
      const geometry = new LineString([
        [0, 0, 0],
        [2, 0, 0],
        [2, 2, 0],
        [0, 2, 0],
      ]);
      creationSnapping.setGeometry(geometry);
      const modifiedEvent = await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [0.6, 0.05],
        positionOrPixel: [0.6, 0.05],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([0.6, 0]);
    });
  });

  describe('polygon', () => {
    it('should snap to the closing segment, if a polygon', async () => {
      const geometry = new Polygon([
        [
          [2, 2, 0],
          [3, 1, 0],
          [1, 1.1, 0],
        ],
      ]);
      creationSnapping.setGeometry(geometry);
      const modifiedEvent = await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [1, 1.05],
        positionOrPixel: [1, 1.05],
      });
      arrayCloseTo(modifiedEvent.positionOrPixel!, [1.025, 1.025]);
    });

    it('should snap exactly to the intersection, when snapping to two things', async () => {
      const geometry = new Polygon([
        [
          [1, 1, 0],
          [2, 1, 0],
          [2, 2, 0],
          [2, 2.4, 0],
        ],
      ]);
      creationSnapping.setGeometry(geometry);
      const modifiedEvent = await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [1.05, 2.05],
        positionOrPixel: [1.05, 2.05],
      });
      arrayCloseTo(modifiedEvent.positionOrPixel!, [1, 2]);
    });

    it('should not snap to any validity place holders', async () => {
      const geometry = new Polygon([
        [
          [2, 2, 0],
          [3, 1, 0],
          [1, 1.1, 0],
        ],
      ]);
      geometry[validityPlaceholder] = true;
      creationSnapping.setGeometry(geometry);
      const modifiedEvent = await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [1, 1.05],
        positionOrPixel: [1, 1.05],
      });
      expect(modifiedEvent.positionOrPixel).to.have.ordered.members([1, 1.05]);
    });
  });

  describe('snapping in 3D', () => {
    let cesiumMap: CesiumMap;

    before(() => {
      cesiumMap = getCesiumMap({});
      sinon.stub(cesiumMap, 'getCurrentResolution').returns(0.05);
    });

    after(() => {
      cesiumMap.destroy();
    });

    it('should maintain height in the snapped position', async () => {
      const geometry = new LineString([
        [0, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
        [1, 1.5, 0],
      ]);
      creationSnapping.setGeometry(geometry);
      const modifiedEvent = await creationSnapping.pipe({
        ...eventBase,
        map: cesiumMap,
        type: EventType.MOVE,
        position: [1, 2.1, 12],
        positionOrPixel: [1, 2.1, 12],
      });
      arrayCloseTo(modifiedEvent.positionOrPixel!, [1.05, 2.05, 12]);
    });

    it('should snap to a 2D geometry', async () => {
      const geometry = new LineString([
        [0, 0],
        [1, 1],
        [0, 1],
        [1, 1.5],
      ]);
      creationSnapping.setGeometry(geometry);
      const modifiedEvent = await creationSnapping.pipe({
        ...eventBase,
        map: cesiumMap,
        type: EventType.MOVE,
        position: [1, 2.1, 12],
        positionOrPixel: [1, 2.1, 12],
      });
      arrayCloseTo(modifiedEvent.positionOrPixel!, [1.05, 2.05, 12]);
    });
  });

  describe('setting of snapping features', () => {
    it('should set the orthogonal feature to the snapped vertex', async () => {
      const geometry = new LineString([
        [1, 1, 0],
        [2, 2, 0],
        [3, 1.05, 0],
      ]);
      creationSnapping.setGeometry(geometry);
      await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [3, 1.05],
        positionOrPixel: [3, 1.05],
      });
      const features = scratchLayer.getFeatures();
      expect(features).to.have.lengthOf(1);
      expect(
        features[0].getGeometry()!.getCoordinates(),
      ).to.have.deep.ordered.members([2, 2, 0]);
    });

    it('should set the parallel feature to the snapped mid-point', async () => {
      const geometry = new LineString([
        [0, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
        [1, 1.5, 0],
      ]);
      creationSnapping.setGeometry(geometry);
      await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [1, 2.1],
        positionOrPixel: [1, 2.1],
      });

      const features = scratchLayer.getFeatures();
      expect(features).to.have.lengthOf(1);
      expect(
        features[0].getGeometry()!.getCoordinates(),
      ).to.have.deep.ordered.members([0.5, 0.5, 0]);
    });

    it('should set the vertex feature to the snapped vertex', async () => {
      const geometry = new LineString([
        [0, 0, 0],
        [1, 0, 0],
        [2, 1, 0],
        [2, 2, 0],
      ]);
      creationSnapping.setGeometry(geometry);
      await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [1.05, 0.05],
        positionOrPixel: [1.05, 0.05],
      });

      const features = scratchLayer.getFeatures();
      expect(features).to.have.lengthOf(1);
      expect(
        features[0].getGeometry()!.getCoordinates(),
      ).to.have.deep.ordered.members([1, 0]);
    });

    it('should set the edge feature to the snapped edge', async () => {
      const geometry = new LineString([
        [0, 0, 0],
        [2, 0, 0],
        [2, 2, 0],
        [0, 2, 0],
      ]);
      creationSnapping.setGeometry(geometry);
      await creationSnapping.pipe({
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
      const geometry = new LineString([
        [1, 1, 0],
        [2, 2, 0],
        [3, 1.05, 0],
      ]);
      creationSnapping.setGeometry(geometry);
      await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [3, 1.05],
        positionOrPixel: [3, 1.05],
      });
      expect(scratchLayer.getFeatures()).to.have.lengthOf(1);
      await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [3, 2.05],
        positionOrPixel: [3, 2.05],
      });
      expect(scratchLayer.getFeatures()).to.be.empty;
    });

    it('should set both snapping features, if closing a perpendicular linear ring', async () => {
      const geometry = new Polygon([
        [
          [2, 2, 0],
          [3, 1, 0],
          [2, 0, 0],
          [1, 1.1, 0],
        ],
      ]);
      creationSnapping.setGeometry(geometry);
      await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [1, 1.05],
        positionOrPixel: [1, 1.05],
      });
      const features = scratchLayer.getFeatures();
      expect(features).to.have.lengthOf(2);
      expect(
        features[0].getGeometry()!.getCoordinates(),
      ).to.have.deep.ordered.members([2, 0, 0]);
      expect(
        features[1].getGeometry()!.getCoordinates(),
      ).to.have.deep.ordered.members([2, 2, 0]);
    });
  });

  describe('setting of snapTo', () => {
    afterEach(() => {
      creationSnapping.snapTo = [...snapTypes];
    });

    it('should not snap to a vertex, if snapTo does not include vertex', async () => {
      creationSnapping.snapTo = [...snapTypes].filter((s) => s !== 'vertex');
      const geometry = new LineString([
        [0, 0, 0],
        [1, 0, 0],
        [2, 1, 0],
        [2, 2, 0],
      ]);
      creationSnapping.setGeometry(geometry);
      const modifiedEvent = await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [1.05, 0.05],
        positionOrPixel: [1.05, 0.05],
      });
      arrayCloseTo(modifiedEvent.positionOrPixel!, [1.05, 0.05]);
    });

    it('should not snap to an edge, if snapTo does not include edge', async () => {
      creationSnapping.snapTo = [...snapTypes].filter((s) => s !== 'edge');
      const geometry = new LineString([
        [0, 0, 0],
        [2, 0, 0],
        [2, 2, 0],
        [0, 2, 0],
      ]);
      creationSnapping.setGeometry(geometry);
      const modifiedEvent = await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [0.6, 0.05],
        positionOrPixel: [0.6, 0.05],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([
        0.6, 0.05,
      ]);
    });

    it('should not snap to bearings, if snapTo does not include parallel', async () => {
      creationSnapping.snapTo = [...snapTypes].filter((s) => s !== 'parallel');
      const geometry = new LineString([
        [0, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
        [1, 1.5, 0],
      ]);
      creationSnapping.setGeometry(geometry);
      const modifiedEvent = await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [1, 2.1],
        positionOrPixel: [1, 2.1],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([1, 2.1]);
    });

    it('should not snap to an orthogonal, if snapTo does not include orthogonal', async () => {
      creationSnapping.snapTo = [...snapTypes].filter(
        (s) => s !== 'orthogonal',
      );
      const geometry = new LineString([
        [1, 1, 0],
        [2, 2, 0],
        [3, 1.05, 0],
      ]);
      creationSnapping.setGeometry(geometry);
      const modifiedEvent = await creationSnapping.pipe({
        ...eventBase,
        type: EventType.MOVE,
        position: [3, 1.05],
        positionOrPixel: [3, 1.05],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([3, 1.05]);
    });
  });
});
