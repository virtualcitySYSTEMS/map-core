import { LineString } from 'ol/geom.js';
import { Feature } from 'ol';
import { ArcStyle, Extent3D, featureArcStruct } from '../../../index.js';
import { arrayCloseTo } from '../helpers/helpers.js';

describe('ArcStyle', () => {
  describe('getting an arc geometry', () => {
    let feature;
    /** @type {ArcStyle} */
    let style;
    /** @type {import("ol/geom").LineString} */
    let geometry;
    /** @type {import("ol/geom").LineString} */
    let arcGeometry;

    before(() => {
      style = new ArcStyle();
      geometry = new LineString([
        [0, 0, 0],
        [1, 0, 0],
      ]);
      feature = new Feature({ geometry });
      arcGeometry = style.getGeometry()(feature);
    });

    it('should return a linestring', () => {
      expect(arcGeometry).to.be.an.instanceof(LineString);
    });

    it('should calculate segments', () => {
      expect(arcGeometry.getCoordinates()).to.have.lengthOf(
        style.numberOfSegments + 1,
      );
    });

    it('should maintain start and end coordinates', () => {
      arrayCloseTo(
        arcGeometry.getFirstCoordinate(),
        geometry.getFirstCoordinate(),
      );
      arrayCloseTo(
        arcGeometry.getLastCoordinate(),
        geometry.getLastCoordinate(),
      );
    });

    it('should create an arc of height distance * arcFactor', () => {
      arrayCloseTo(arcGeometry.getExtent(), [0, -style.arcFactor, 1, 0]);
    });

    it('should create an arc struct on the feature', () => {
      expect(feature).to.have.property(featureArcStruct);
    });

    it('should cache the geometry on the arc struct', () => {
      expect(feature[featureArcStruct]).to.have.property(
        'geometry',
        arcGeometry,
      );
    });

    it('should cache the 3D coordinates on the arc struct', () => {
      expect(feature[featureArcStruct]).to.have.property('coordinates');
    });

    it('should create numberSegments + 1 coordinates', () => {
      expect(feature[featureArcStruct])
        .to.have.property('coordinates')
        .and.to.have.lengthOf(style.numberOfSegments + 1);
    });

    it('should create a height based on the distance and arc factor', () => {
      expect(feature[featureArcStruct]).to.have.property('coordinates');
      const { coordinates } = feature[featureArcStruct];
      const extent = Extent3D.fromCoordinates(coordinates);
      expect(extent.maxZ).to.be.equal(style.arcFactor / 2);
    });
  });

  describe('changing arc style parameters', () => {
    /** @type {ArcStyle} */
    let style;
    let feature;
    let originalArcStruct;

    beforeEach(() => {
      style = new ArcStyle({ arcFactor: 0.2, numberOfSegments: 12 });
      feature = new Feature({
        geometry: new LineString([
          [0, 1, 0],
          [0, 0, 0],
        ]),
      });
      style.getGeometry()(feature);
      originalArcStruct = feature[featureArcStruct];
    });

    it('should recreate the arc struct, if changing the arc factor', () => {
      style.arcFactor = 0.5;
      style.getGeometry()(feature);
      expect(feature[featureArcStruct]).to.not.equal(originalArcStruct);
    });

    it('should recreate the arc struct, if changing the number of segments', () => {
      style.numberOfSegments = 24;
      style.getGeometry()(feature);
      expect(feature[featureArcStruct]).to.not.equal(originalArcStruct);
    });

    it('should recreate the arc struct, if getting the struct from another style', () => {
      new ArcStyle().getGeometry()(feature);
      expect(feature[featureArcStruct]).to.not.equal(originalArcStruct);
    });
  });

  describe('changing feature or geometry', () => {
    /** @type {ArcStyle} */
    let style;
    let feature;
    let originalArcStruct;

    beforeEach(() => {
      style = new ArcStyle({ arcFactor: 0.2, numberOfSegments: 12 });
      feature = new Feature({
        geometry: new LineString([
          [0, 1, 0],
          [0, 0, 0],
        ]),
      });
      style.getGeometry()(feature);
      originalArcStruct = feature[featureArcStruct];
    });

    it('should recreate the arc struct, when setting a new feature geometry', () => {
      feature.setGeometry(
        new LineString([
          [1, 1, 0],
          [0, 1, 0],
        ]),
      );
      expect(feature[featureArcStruct]).to.not.equal(originalArcStruct);
    });

    it('should recreate the arc struct, when changing the features geometry', () => {
      feature.getGeometry().setCoordinates([
        [1, 1, 0],
        [0, 1, 0],
      ]);
      expect(feature[featureArcStruct]).to.not.equal(originalArcStruct);
    });
  });
});
