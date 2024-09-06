import { expect } from 'chai';
import sinon from 'sinon';
import { LineString, Polygon } from 'ol/geom.js';
import { Cartesian2 } from '@vcmap-cesium/engine';
import {
  CesiumMap,
  createVertex,
  EventType,
  ModificationKeyType,
  OpenlayersMap,
  PointerEventType,
  PointerKeyType,
  VectorLayer,
} from '../../../../../index.js';
import { getOpenlayersMap } from '../../../helpers/openlayersHelpers.js';
import { arrayCloseTo } from '../../../helpers/helpers.js';
import { getCesiumMap } from '../../../helpers/cesiumHelpers.js';
import TranslationSnapping from '../../../../../src/util/editor/interactions/translationSnapping.js';
import { snapTypes } from '../../../../../src/util/editor/snappingHelpers.js';

describe('translation snapping', () => {
  let map: OpenlayersMap;
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

  after(() => {
    map.destroy();
    scratchLayer.destroy();
  });

  describe('line string', () => {
    let geometry: LineString;
    let translationSnapping: TranslationSnapping;

    beforeEach(() => {
      geometry = new LineString([]);
      translationSnapping = new TranslationSnapping(scratchLayer, geometry);
    });

    afterEach(() => {
      translationSnapping.destroy();
    });

    it('should snap to bearings', async () => {
      geometry.setCoordinates([
        [0, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
        [1, 1.5, 0],
      ]);
      const feature = createVertex([1, 1.5], {}, 3);
      await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAGSTART,
        position: [1, 2.1],
        positionOrPixel: [1, 2.1],
      });
      const modifiedEvent = await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAG,
        position: [1, 2.1],
        positionOrPixel: [1, 2.1],
      });
      arrayCloseTo(modifiedEvent.positionOrPixel!, [1.05, 2.05]);
    });

    it('should snap to an orthogonal', async () => {
      geometry.setCoordinates([
        [1, 1, 0],
        [2, 2, 0],
        [3, 1.05, 0],
      ]);
      const feature = createVertex([3, 1.05], {}, 2);
      await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAGSTART,
        position: [3, 1.05],
        positionOrPixel: [3, 1.05],
      });
      const modifiedEvent = await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAG,
        position: [3, 1.05],
        positionOrPixel: [3, 1.05],
      });
      arrayCloseTo(modifiedEvent.positionOrPixel!, [2.975, 1.025]);
    });

    it('should snap to a co-linear point', async () => {
      geometry.setCoordinates([
        [1, 1, 0],
        [2, 2, 0],
        [3, 3.05, 0],
      ]);
      const feature = createVertex([3, 3.05], {}, 2);
      await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAGSTART,
        position: [3, 3.05],
        positionOrPixel: [3, 3.05],
      });
      const modifiedEvent = await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAG,
        position: [3, 3.05],
        positionOrPixel: [3, 3.05],
      });
      arrayCloseTo(modifiedEvent.positionOrPixel!, [3.025, 3.025]);
    });

    it('should not snap, if deviation of angle is too high', async () => {
      geometry.setCoordinates([
        [1, 1, 0],
        [2, 2, 0],
        [3, 1.05, 0],
      ]);
      const feature = createVertex([3, 1.05], {}, 2);
      await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAGSTART,
        position: [3, 1.25],
        positionOrPixel: [3, 1.25],
      });
      const modifiedEvent = await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAG,
        position: [3, 1.25],
        positionOrPixel: [3, 1.25],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([3, 1.25]);
    });

    it('should not snap, if pixel deviation is too high', async () => {
      geometry.setCoordinates([
        [1, 1, 0],
        [2, 2, 0],
        [2500000, 2500050, 0],
      ]);
      const feature = createVertex([2500000, 2500050], {}, 2);
      await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAGSTART,
        position: [2500000, 2500350],
        positionOrPixel: [2500000, 2500350],
      });
      const modifiedEvent = await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAG,
        position: [2500000, 2500350],
        positionOrPixel: [2500000, 2500350],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([
        2500000, 2500350,
      ]);
    });

    it('should not snap to its own bearings', async () => {
      geometry.setCoordinates([
        [0, 0, 0],
        [1, 0, 0],
        [1, 1, 0],
        [2, 2, 0],
      ]);
      const feature = createVertex([2, 2], {}, 3);
      await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAGSTART,
        position: [3.1, 3],
        positionOrPixel: [3.1, 3],
      });
      const modifiedEvent = await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAG,
        position: [3.1, 3],
        positionOrPixel: [3.1, 3],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([3.1, 3]);
    });

    it('should snap to the next segment, if there is one', async () => {
      geometry.setCoordinates([
        [1, 1.1, 0],
        [2, 2, 0],
        [3, 1, 0],
      ]);
      const feature = createVertex([1, 1.1, 0], {}, 0);
      await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAGSTART,
        position: [1, 1.05],
        positionOrPixel: [1, 1.05],
      });
      const modifiedEvent = await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAG,
        position: [1, 1.05],
        positionOrPixel: [1, 1.05],
      });
      arrayCloseTo(modifiedEvent.positionOrPixel!, [1.025, 1.025]);
    });

    it('should maintain snapping on drag end to bearings', async () => {
      geometry.setCoordinates([
        [0, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
        [1, 1.5, 0],
      ]);
      const feature = createVertex([1, 1.5], {}, 3);
      await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAGSTART,
        position: [1, 2.1],
        positionOrPixel: [1, 2.1],
      });
      await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAG,
        position: [1, 2.1],
        positionOrPixel: [1, 2.1],
      });
      const modifiedEvent = await translationSnapping.pipe({
        ...eventBase,
        type: EventType.DRAGEND,
        position: [1, 2.1],
        positionOrPixel: [1, 2.1],
      });
      arrayCloseTo(modifiedEvent.positionOrPixel!, [1.05, 2.05]);
    });

    it('should not set the previous last coordinate after a drag', async () => {
      geometry.setCoordinates([
        [0, 0, 0],
        [1, 1, 0],
        [0, 1, 0],
        [1, 1.5, 0],
      ]);
      const feature = createVertex([1, 1.5], {}, 3);
      await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAGSTART,
        position: [1, 2.1],
        positionOrPixel: [1, 2.1],
      });
      await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAG,
        position: [1, 2.1],
        positionOrPixel: [1, 2.1],
      });
      const modifiedEvent = await translationSnapping.pipe({
        ...eventBase,
        type: EventType.DRAGEND,
        position: [1, 2.1],
        positionOrPixel: [1, 2.1],
      });
      arrayCloseTo(modifiedEvent.positionOrPixel!, [1.05, 2.05]);
      await translationSnapping.pipe({
        ...eventBase,
        type: EventType.DRAGSTART,
        position: [1, 2.1],
        positionOrPixel: [1, 2.1],
      });
      await translationSnapping.pipe({
        ...eventBase,
        type: EventType.DRAG,
        position: [1, 2.1],
        positionOrPixel: [1, 2.1],
      });
      const nonFeatureEvent = await translationSnapping.pipe({
        ...eventBase,
        type: EventType.DRAGEND,
        position: [1, 2.1],
        positionOrPixel: [1, 2.1],
      });
      expect(nonFeatureEvent.positionOrPixel).to.have.ordered.members([1, 2.1]);
    });

    it('should snap to its own vertices', async () => {
      geometry.setCoordinates([
        [0, 0, 0],
        [1, 0, 0],
        [2, 1, 0],
        [2, 2, 0],
      ]);
      const feature = createVertex([1.05, 0.05], {}, 3);
      await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAGSTART,
        position: [1.05, 0.05],
        positionOrPixel: [1.05, 0.05],
      });
      const modifiedEvent = await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAG,
        position: [1.05, 0.05],
        positionOrPixel: [1.05, 0.05],
      });
      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([1, 0]);
    });

    it('should snap to its own edges', async () => {
      geometry.setCoordinates([
        [0, 0, 0],
        [2, 0, 0],
        [2, 2, 0],
        [0, 2, 0],
      ]);
      const feature = createVertex([0.6, 0.05], {}, 3);
      await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAGSTART,
        position: [0.6, 0.05],
        positionOrPixel: [0.6, 0.05],
      });
      const modifiedEvent = await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAG,
        position: [0.6, 0.05],
        positionOrPixel: [0.6, 0.05],
      });

      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([0.6, 0]);
    });

    it('should not snap to the editing vertex', async () => {
      geometry.setCoordinates([
        [0, 0, 0],
        [1, 2, 0],
        [2, 0, 0],
        [4, 2, 0],
      ]);
      const feature = createVertex([2.1, 0.05], {}, 2);
      await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAGSTART,
        position: [2.1, 0.05],
        positionOrPixel: [2.1, 0.05],
      });
      const modifiedEvent = await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAG,
        position: [2.1, 0.05],
        positionOrPixel: [2.1, 0.05],
      });

      expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([
        2.1, 0.05,
      ]);
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
        geometry.setCoordinates([
          [0, 0, 0],
          [1, 1, 0],
          [0, 1, 0],
          [1, 1.5, 0],
        ]);
        const feature = createVertex([1, 1.5, 0], {}, 3);
        await translationSnapping.pipe({
          ...eventBase,
          feature,
          map: cesiumMap,
          type: EventType.DRAGSTART,
          position: [1, 2.1, 12],
          positionOrPixel: [1, 2.1, 12],
        });
        const modifiedEvent = await translationSnapping.pipe({
          ...eventBase,
          feature,
          map: cesiumMap,
          type: EventType.DRAG,
          position: [1, 2.1, 12],
          positionOrPixel: [1, 2.1, 12],
        });
        arrayCloseTo(modifiedEvent.positionOrPixel!, [1.05, 2.05, 12]);
      });

      it('should snap to a 2D geometry', async () => {
        geometry.setCoordinates([
          [0, 0],
          [1, 1],
          [0, 1],
          [1, 1.5],
        ]);
        const feature = createVertex([1, 1.5], {}, 3);
        await translationSnapping.pipe({
          ...eventBase,
          feature,
          map: cesiumMap,
          type: EventType.DRAGSTART,
          position: [1, 2.1, 12],
          positionOrPixel: [1, 2.1, 12],
        });
        const modifiedEvent = await translationSnapping.pipe({
          ...eventBase,
          feature,
          map: cesiumMap,
          type: EventType.DRAG,
          position: [1, 2.1, 12],
          positionOrPixel: [1, 2.1, 12],
        });
        arrayCloseTo(modifiedEvent.positionOrPixel!, [1.05, 2.05, 12]);
      });
    });

    describe('setting of snapping features', () => {
      it('should set the orthogonal feature to the snapped vertex', async () => {
        geometry.setCoordinates([
          [1, 1, 0],
          [2, 2, 0],
          [3, 1.05, 0],
        ]);

        const feature = createVertex([3, 1.05, 0], {}, 2);
        await translationSnapping.pipe({
          ...eventBase,
          feature,
          type: EventType.DRAGSTART,
          position: [3, 1.05],
          positionOrPixel: [3, 1.05],
        });
        await translationSnapping.pipe({
          ...eventBase,
          feature,
          type: EventType.DRAG,
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
        geometry.setCoordinates([
          [0, 0, 0],
          [1, 1, 0],
          [0, 1, 0],
          [1, 1.5, 0],
        ]);
        const feature = createVertex([1, 1.5, 0], {}, 3);
        await translationSnapping.pipe({
          ...eventBase,
          feature,
          type: EventType.DRAGSTART,
          position: [1, 2.1],
          positionOrPixel: [1, 2.1],
        });
        await translationSnapping.pipe({
          ...eventBase,
          feature,
          type: EventType.DRAG,
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
        geometry.setCoordinates([
          [0, 0, 0],
          [1, 0, 0],
          [2, 1, 0],
          [2, 2, 0],
        ]);
        const feature = createVertex([1.05, 0.05], {}, 3);
        await translationSnapping.pipe({
          ...eventBase,
          feature,
          type: EventType.DRAGSTART,
          position: [1.05, 0.05],
          positionOrPixel: [1.05, 0.05],
        });
        await translationSnapping.pipe({
          ...eventBase,
          feature,
          type: EventType.DRAG,
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
        geometry.setCoordinates([
          [0, 0, 0],
          [2, 0, 0],
          [2, 2, 0],
          [0, 2, 0],
        ]);
        const feature = createVertex([0.6, 0.05], {}, 3);
        await translationSnapping.pipe({
          ...eventBase,
          feature,
          type: EventType.DRAGSTART,
          position: [0.6, 0.05],
          positionOrPixel: [0.6, 0.05],
        });
        await translationSnapping.pipe({
          ...eventBase,
          feature,
          type: EventType.DRAG,
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
        geometry.setCoordinates([
          [1, 1, 0],
          [2, 2, 0],
          [3, 1.05, 0],
        ]);
        const feature = createVertex([3, 1.05, 0], {}, 2);
        await translationSnapping.pipe({
          ...eventBase,
          feature,
          type: EventType.DRAGSTART,
          position: [3, 1.05],
          positionOrPixel: [3, 1.05],
        });
        await translationSnapping.pipe({
          ...eventBase,
          feature,
          type: EventType.DRAG,
          position: [3, 1.05],
          positionOrPixel: [3, 1.05],
        });
        expect(scratchLayer.getFeatures()).to.have.lengthOf(1);
        await translationSnapping.pipe({
          ...eventBase,
          feature,
          type: EventType.DRAG,
          position: [3, 2.05],
          positionOrPixel: [3, 2.05],
        });
        expect(scratchLayer.getFeatures()).to.be.empty;
      });
    });

    describe('setting of snapTo', () => {
      afterEach(() => {
        translationSnapping.snapTo = [...snapTypes];
      });

      it('should not snap to a vertex, if snapTo does not include vertex', async () => {
        translationSnapping.snapTo = [...snapTypes].filter(
          (s) => s !== 'vertex',
        );
        geometry.setCoordinates([
          [0, 0, 0],
          [1, 0, 0],
          [2, 1, 0],
          [2, 2, 0],
        ]);
        await translationSnapping.pipe({
          ...eventBase,
          type: EventType.DRAGSTART,
          position: [1.05, 0.05],
          positionOrPixel: [1.05, 0.05],
        });
        const modifiedEvent = await translationSnapping.pipe({
          ...eventBase,
          type: EventType.DRAG,
          position: [1.05, 0.05],
          positionOrPixel: [1.05, 0.05],
        });
        arrayCloseTo(modifiedEvent.positionOrPixel!, [1.05, 0.05]);
      });

      it('should not snap to an edge, if snapTo does not include edge', async () => {
        translationSnapping.snapTo = [...snapTypes].filter((s) => s !== 'edge');
        geometry.setCoordinates([
          [0, 0, 0],
          [2, 0, 0],
          [2, 2, 0],
          [0, 2, 0],
        ]);
        await translationSnapping.pipe({
          ...eventBase,
          type: EventType.DRAGSTART,
          position: [0.6, 0.05],
          positionOrPixel: [0.6, 0.05],
        });
        const modifiedEvent = await translationSnapping.pipe({
          ...eventBase,
          type: EventType.DRAG,
          position: [0.6, 0.05],
          positionOrPixel: [0.6, 0.05],
        });
        expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([
          0.6, 0.05,
        ]);
      });

      it('should not snap to bearings, if snapTo does not include parallel', async () => {
        translationSnapping.snapTo = [...snapTypes].filter(
          (s) => s !== 'parallel',
        );
        geometry.setCoordinates([
          [0, 0, 0],
          [1, 1, 0],
          [0, 1, 0],
          [1, 1.5, 0],
        ]);
        await translationSnapping.pipe({
          ...eventBase,
          type: EventType.DRAGSTART,
          position: [1, 2.1],
          positionOrPixel: [1, 2.1],
        });
        const modifiedEvent = await translationSnapping.pipe({
          ...eventBase,
          type: EventType.DRAG,
          position: [1, 2.1],
          positionOrPixel: [1, 2.1],
        });
        expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([
          1, 2.1,
        ]);
      });

      it('should not snap to an orthogonal, if snapTo does not include orthogonal', async () => {
        translationSnapping.snapTo = [...snapTypes].filter(
          (s) => s !== 'orthogonal',
        );
        geometry.setCoordinates([
          [1, 1, 0],
          [2, 2, 0],
          [3, 1.05, 0],
        ]);
        await translationSnapping.pipe({
          ...eventBase,
          type: EventType.DRAGSTART,
          position: [3, 1.05],
          positionOrPixel: [3, 1.05],
        });
        const modifiedEvent = await translationSnapping.pipe({
          ...eventBase,
          type: EventType.DRAG,
          position: [3, 1.05],
          positionOrPixel: [3, 1.05],
        });
        expect(modifiedEvent.positionOrPixel!).to.have.ordered.members([
          3, 1.05,
        ]);
      });
    });
  });

  describe('polygon', () => {
    let geometry: Polygon;
    let translationSnapping: TranslationSnapping;

    beforeEach(() => {
      geometry = new Polygon([]);
      translationSnapping = new TranslationSnapping(scratchLayer, geometry);
    });

    afterEach(() => {
      translationSnapping.destroy();
    });

    it('should snap to the closing segment, if a polygon', async () => {
      geometry.setCoordinates([
        [
          [2, 2, 0],
          [3, 1, 0],
          [1, 1.1, 0],
        ],
      ]);
      const feature = createVertex([1, 1.1, 0], {}, 2);
      await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAGSTART,
        position: [1, 1.05],
        positionOrPixel: [1, 1.05],
      });
      const modifiedEvent = await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAG,
        position: [1, 1.05],
        positionOrPixel: [1, 1.05],
      });
      arrayCloseTo(modifiedEvent.positionOrPixel!, [1.025, 1.025]);
    });

    it('should snap to the last segment, if a linear ring and moving the first vertex', async () => {
      geometry.setCoordinates([
        [
          [2, 2, 0],
          [3, 1, 0],
          [1, 1, 0],
          [1, 1.1, 0],
        ],
      ]);
      const feature = createVertex([2, 2, 0], {}, 0);
      await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAGSTART,
        position: [1.05, 2.05],
        positionOrPixel: [1.05, 2.05],
      });
      const modifiedEvent = await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAG,
        position: [1.05, 2.05],
        positionOrPixel: [1.05, 2.05],
      });
      expect(modifiedEvent.positionOrPixel).to.have.ordered.members([1, 2.05]);
    });

    it('should set both snapping features, if closing a perpendicular linear ring', async () => {
      geometry.setCoordinates([
        [
          [2, 2, 0],
          [3, 1, 0],
          [2, 0, 0],
          [1, 1.1, 0],
        ],
      ]);
      const feature = createVertex([1, 1.1, 0], {}, 3);
      await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAGSTART,
        position: [1, 1.05],
        positionOrPixel: [1, 1.05],
      });
      await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAG,
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

    it('should snap exactly to the intersection, when snapping to two things', async () => {
      geometry.setCoordinates([
        [
          [1, 1, 0],
          [2, 1, 0],
          [2, 2, 0],
          [2, 2.4, 0],
        ],
      ]);
      const feature = createVertex([2, 2.4, 0], {}, 3);
      await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAGSTART,
        position: [1.05, 2.05],
        positionOrPixel: [1.05, 2.05],
      });
      const modifiedEvent = await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAG,
        position: [1.05, 2.05],
        positionOrPixel: [1.05, 2.05],
      });
      arrayCloseTo(modifiedEvent.positionOrPixel!, [1, 2]);
    });

    it('should snap to the closing edge, if not editing first or last index', async () => {
      geometry.setCoordinates([
        [
          [0, 0, 0],
          [1, 0, 0],
          [2, 2, 0],
          [1, 4, 0],
          [0, 5, 0],
        ],
      ]);
      const feature = createVertex([2, 2, 0], {}, 2);
      await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAGSTART,
        position: [0.1, 2.1],
        positionOrPixel: [0.1, 2.1],
      });
      const modifiedEvent = await translationSnapping.pipe({
        ...eventBase,
        feature,
        type: EventType.DRAG,
        position: [0.1, 2.1],
        positionOrPixel: [0.1, 2.1],
      });
      arrayCloseTo(modifiedEvent.positionOrPixel!, [0, 2.1]);
    });
  });
});
