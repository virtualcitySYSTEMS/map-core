import { expect } from 'chai';
import { Cartesian2, HeightReference } from '@vcmap-cesium/engine';
import { Circle, LineString, Polygon } from 'ol/geom.js';
import Style from 'ol/style/Style.js';
import SegmentLengthInteraction from '../../../../../src/util/editor/interactions/segmentLengthInteraction.js';
import {
  createVertex,
  EventType,
  mercatorProjection,
  ModificationKeyType,
  OpenlayersMap,
  PointerEventType,
  PointerKeyType,
  validityPlaceholder,
  VectorLayer,
} from '../../../../../index.js';
import { getOpenlayersMap } from '../../../helpers/openlayersHelpers.js';

describe('segmentLengthInteraction', () => {
  let map: OpenlayersMap;
  let eventBase: {
    key: ModificationKeyType;
    pointer: PointerKeyType;
    pointerEvent: PointerEventType;
    windowPosition: Cartesian2;
    map: OpenlayersMap;
  };

  before(async () => {
    map = await getOpenlayersMap({});
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
  });

  describe('while creating', () => {
    let segmentLengthInteraction: SegmentLengthInteraction;
    let scratchLayer: VectorLayer;

    before(() => {
      scratchLayer = new VectorLayer({
        projection: mercatorProjection.toJSON(),
      });
      segmentLengthInteraction = new SegmentLengthInteraction(
        scratchLayer,
        true,
      );
    });

    afterEach(() => {
      scratchLayer.removeAllFeatures();
    });

    after(() => {
      segmentLengthInteraction.destroy();
    });

    describe('of a line string', () => {
      it('should not set a label, if the linestring has too few vertices', async () => {
        segmentLengthInteraction.setGeometry(new LineString([]));
        await segmentLengthInteraction.pipe({
          ...eventBase,
          type: EventType.MOVE,
        });
        expect(scratchLayer.getFeatures()).to.be.empty;
      });

      it('should set a label with the 2D distance', async () => {
        segmentLengthInteraction.setGeometry(
          new LineString([
            [1, 1],
            [1, 2],
          ]),
        );
        await segmentLengthInteraction.pipe({
          ...eventBase,
          type: EventType.MOVE,
        });
        const features = scratchLayer.getFeatures();
        expect(features).to.have.lengthOf(1);
        expect((features[0].getStyle() as Style).getText()?.getText()).to.equal(
          '1.00 m',
        );
        expect(features[0].getGeometry()?.getCoordinates()).to.have.members([
          1, 1.5,
        ]);
      });

      it('should set a label with the 3D distance', async () => {
        segmentLengthInteraction.setGeometry(
          new LineString([
            [1, 1, 0],
            [1, 2, 3],
          ]),
        );
        scratchLayer.vectorProperties.altitudeMode = HeightReference.NONE;
        await segmentLengthInteraction.pipe({
          ...eventBase,
          type: EventType.MOVE,
        });
        scratchLayer.vectorProperties.altitudeMode =
          HeightReference.CLAMP_TO_GROUND;
        const features = scratchLayer.getFeatures();
        expect(features).to.have.lengthOf(1);
        expect((features[0].getStyle() as Style).getText()?.getText()).to.equal(
          '3.16 m',
        );
      });
    });

    describe('of a polygon', () => {
      it('should only set one label, if the polygon is still in creation', async () => {
        const geometry = new Polygon([
          [
            [0, 0],
            [1, 0],
            [0, 0],
          ],
        ]);
        geometry[validityPlaceholder] = true;
        segmentLengthInteraction.setGeometry(geometry);
        await segmentLengthInteraction.pipe({
          ...eventBase,
          type: EventType.MOVE,
        });
        const features = scratchLayer.getFeatures();
        expect(features).to.have.lengthOf(1);
        expect((features[0].getStyle() as Style).getText()?.getText()).to.equal(
          '1.00 m',
        );
        expect(features[0].getGeometry()?.getCoordinates()).to.have.members([
          0.5, 0,
        ]);
      });

      it('should set a label with the 2D distances for both segments', async () => {
        segmentLengthInteraction.setGeometry(
          new Polygon([
            [
              [0, 0],
              [1, 1],
              [0, 1],
            ],
          ]),
        );
        await segmentLengthInteraction.pipe({
          ...eventBase,
          type: EventType.MOVE,
        });
        const features = scratchLayer.getFeatures();
        expect(features).to.have.lengthOf(2);
        expect((features[0].getStyle() as Style).getText()?.getText()).to.equal(
          '1.00 m',
        );
        expect((features[1].getStyle() as Style).getText()?.getText()).to.equal(
          '1.00 m',
        );
      });

      it('should set a label with the 3D distance', async () => {
        segmentLengthInteraction.setGeometry(
          new Polygon([
            [
              [0, 0, 0],
              [1, 1, 1],
              [0, 1, 0.5],
            ],
          ]),
        );
        scratchLayer.vectorProperties.altitudeMode = HeightReference.NONE;
        await segmentLengthInteraction.pipe({
          ...eventBase,
          type: EventType.MOVE,
        });
        scratchLayer.vectorProperties.altitudeMode =
          HeightReference.CLAMP_TO_GROUND;
        const features = scratchLayer.getFeatures();
        expect(features).to.have.lengthOf(2);
        expect((features[0].getStyle() as Style).getText()?.getText()).to.equal(
          '1.12 m',
        );
        expect((features[1].getStyle() as Style).getText()?.getText()).to.equal(
          '1.11 m',
        );
      });
    });

    describe('of a circle', () => {
      it('should draw the label and the segment', async () => {
        segmentLengthInteraction.setGeometry(new Circle([0, 0], 1));
        await segmentLengthInteraction.pipe({
          ...eventBase,
          type: EventType.MOVE,
        });
        const features = scratchLayer.getFeatures();
        expect(features).to.have.lengthOf(2);
        expect((features[0].getStyle() as Style).getText()?.getText()).to.equal(
          '1.00 m',
        );
        expect(features[0].getGeometry()?.getCoordinates()).to.have.members([
          0.5, 0,
        ]);
        expect(features[1].getGeometry()).to.be.an.instanceof(LineString);
      });
    });
  });

  describe('while editing', () => {
    let segmentLengthInteraction: SegmentLengthInteraction;
    let scratchLayer: VectorLayer;

    before(() => {
      scratchLayer = new VectorLayer({
        projection: mercatorProjection.toJSON(),
      });
      segmentLengthInteraction = new SegmentLengthInteraction(
        scratchLayer,
        false,
      );
    });

    afterEach(() => {
      scratchLayer.removeAllFeatures();
    });

    after(() => {
      segmentLengthInteraction.destroy();
    });

    describe('of a line string', () => {
      it('should set a label with the 2D distance', async () => {
        segmentLengthInteraction.setGeometry(
          new LineString([
            [1, 1],
            [1, 2],
          ]),
        );
        const feature = createVertex([1, 2], {}, 1);
        await segmentLengthInteraction.pipe({
          ...eventBase,
          type: EventType.DRAGSTART,
          feature,
        });
        const features = scratchLayer.getFeatures();
        expect(features).to.have.lengthOf(1);
        expect((features[0].getStyle() as Style).getText()?.getText()).to.equal(
          '1.00 m',
        );
        expect(features[0].getGeometry()?.getCoordinates()).to.have.members([
          1, 1.5,
        ]);
      });

      it('should set a label with the 3D distance', async () => {
        segmentLengthInteraction.setGeometry(
          new LineString([
            [1, 1, 0],
            [1, 2, 3],
          ]),
        );
        const feature = createVertex([1, 2, 3], {}, 1);
        scratchLayer.vectorProperties.altitudeMode = HeightReference.NONE;
        await segmentLengthInteraction.pipe({
          ...eventBase,
          type: EventType.DRAGSTART,
          feature,
        });
        scratchLayer.vectorProperties.altitudeMode =
          HeightReference.CLAMP_TO_GROUND;
        const features = scratchLayer.getFeatures();
        expect(features).to.have.lengthOf(1);
        expect((features[0].getStyle() as Style).getText()?.getText()).to.equal(
          '3.16 m',
        );
      });

      it('should create two labels, when moving a vertex in between', async () => {
        segmentLengthInteraction.setGeometry(
          new LineString([
            [1, 1, 0],
            [1, 2, 3],
            [1, 1, 3],
          ]),
        );
        const feature = createVertex([1, 2, 3], {}, 1);
        await segmentLengthInteraction.pipe({
          ...eventBase,
          type: EventType.DRAGSTART,
          feature,
        });
        const features = scratchLayer.getFeatures();
        expect(features).to.have.lengthOf(2);
        expect((features[0].getStyle() as Style).getText()?.getText()).to.equal(
          '1.00 m',
        );
        expect((features[0].getStyle() as Style).getText()?.getText()).to.equal(
          '1.00 m',
        );
      });

      it('should set a label, when moving the first vertex', async () => {
        segmentLengthInteraction.setGeometry(
          new LineString([
            [1, 1],
            [1, 2],
          ]),
        );
        const feature = createVertex([1, 1], {}, 0);
        await segmentLengthInteraction.pipe({
          ...eventBase,
          type: EventType.DRAGSTART,
          feature,
        });
        const features = scratchLayer.getFeatures();
        expect(features).to.have.lengthOf(1);
        expect((features[0].getStyle() as Style).getText()?.getText()).to.equal(
          '1.00 m',
        );
        expect(features[0].getGeometry()?.getCoordinates()).to.have.members([
          1, 1.5,
        ]);
      });

      it('should clear the labels, when drag end without a feature is called', async () => {
        segmentLengthInteraction.setGeometry(
          new LineString([
            [1, 1],
            [1, 2],
          ]),
        );
        const feature = createVertex([1, 2], {}, 1);
        await segmentLengthInteraction.pipe({
          ...eventBase,
          type: EventType.DRAGSTART,
          feature,
        });
        expect(scratchLayer.getFeatures()).to.have.lengthOf(1);
        await segmentLengthInteraction.pipe({
          ...eventBase,
          type: EventType.DRAGEND,
        });
        expect(scratchLayer.getFeatures()).to.have.lengthOf(0);
      });
    });

    describe('of a polygon', () => {
      it('should set a label with the 2D distances for both segments', async () => {
        segmentLengthInteraction.setGeometry(
          new Polygon([
            [
              [0, 0],
              [1, 1],
              [0, 1],
            ],
          ]),
        );
        const feature = createVertex([0, 1], {}, 2);
        await segmentLengthInteraction.pipe({
          ...eventBase,
          type: EventType.DRAGSTART,
          feature,
        });
        const features = scratchLayer.getFeatures();
        expect(features).to.have.lengthOf(2);
        expect((features[0].getStyle() as Style).getText()?.getText()).to.equal(
          '1.00 m',
        );
        expect((features[1].getStyle() as Style).getText()?.getText()).to.equal(
          '1.00 m',
        );
      });

      it('should set a label with the 3D distance', async () => {
        segmentLengthInteraction.setGeometry(
          new Polygon([
            [
              [0, 0, 0],
              [1, 1, 3],
              [0, 1, 1],
            ],
          ]),
        );
        const feature = createVertex([0, 0, 0], {}, 0);
        scratchLayer.vectorProperties.altitudeMode = HeightReference.NONE;
        await segmentLengthInteraction.pipe({
          ...eventBase,
          type: EventType.DRAGSTART,
          feature,
        });
        scratchLayer.vectorProperties.altitudeMode =
          HeightReference.CLAMP_TO_GROUND;
        const features = scratchLayer.getFeatures();
        expect(features).to.have.lengthOf(2);
        expect((features[0].getStyle() as Style).getText()?.getText()).to.equal(
          '3.31 m',
        );
        expect((features[1].getStyle() as Style).getText()?.getText()).to.equal(
          '1.41 m',
        );
      });

      it('should set a label, when moving the first vertex', async () => {
        segmentLengthInteraction.setGeometry(
          new Polygon([
            [
              [0, 0],
              [1, 1],
              [0, 1],
            ],
          ]),
        );
        const feature = createVertex([0, 0], {}, 0);
        await segmentLengthInteraction.pipe({
          ...eventBase,
          type: EventType.DRAGSTART,
          feature,
        });
        const features = scratchLayer.getFeatures();
        expect(features).to.have.lengthOf(2);
        expect((features[0].getStyle() as Style).getText()?.getText()).to.equal(
          '1.41 m',
        );
        expect((features[1].getStyle() as Style).getText()?.getText()).to.equal(
          '1.00 m',
        );
      });
    });

    describe('of a circle', () => {
      it('should draw the label and the segment', async () => {
        segmentLengthInteraction.setGeometry(new Circle([0, 0], 1));
        const feature = createVertex([1, 1], {}, 1);
        await segmentLengthInteraction.pipe({
          ...eventBase,
          type: EventType.DRAGSTART,
          feature,
        });
        const features = scratchLayer.getFeatures();
        expect(features).to.have.lengthOf(2);
        expect((features[0].getStyle() as Style).getText()?.getText()).to.equal(
          '1.00 m',
        );
        expect(features[0].getGeometry()?.getCoordinates()).to.have.members([
          0.5, 0,
        ]);
        expect(features[1].getGeometry()).to.be.an.instanceof(LineString);
      });

      it('should clear the labels, when drag end without a feature is called', async () => {
        segmentLengthInteraction.setGeometry(new Circle([0, 0], 1));
        const feature = createVertex([1, 1], {}, 1);
        await segmentLengthInteraction.pipe({
          ...eventBase,
          type: EventType.DRAGSTART,
          feature,
        });
        expect(scratchLayer.getFeatures()).to.have.lengthOf(2);
        await segmentLengthInteraction.pipe({
          ...eventBase,
          type: EventType.DRAGEND,
        });
        expect(scratchLayer.getFeatures()).to.have.lengthOf(0);
      });
    });
  });
});
