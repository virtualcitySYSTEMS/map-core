import { expect } from 'chai';
import Circle from 'ol/geom/Circle.js';
import Polygon from 'ol/geom/Polygon.js';
import Point from 'ol/geom/Point.js';
import MultiPoint from 'ol/geom/MultiPoint.js';
import MultiPolygon from 'ol/geom/MultiPolygon.js';
import LineString from 'ol/geom/LineString.js';
import MultiLineString from 'ol/geom/MultiLineString.js';
import GeometryCollection from 'ol/geom/GeometryCollection.js';
import type { Coordinate } from 'ol/coordinate.js';
import type { Cartographic, Scene } from '@vcmap-cesium/engine';
import { HeightReference, Math as CesiumMath } from '@vcmap-cesium/engine';
import type { Geometry } from 'ol/geom.js';
import { Feature } from 'ol';
import {
  circleFromCenterRadius,
  convertGeometryToPolygon,
  createAbsoluteFeature,
  from2Dto3DLayout,
  from3Dto2DLayout,
  getFlatCoordinateReferences,
  getFlatCoordinatesFromSimpleGeometry,
  placeGeometryOnSurface,
  drapeGeometryOnSurface,
} from '../../../src/util/geometryHelpers.js';
import { getMockScene } from '../helpers/cesiumHelpers.js';
import {
  mercatorProjection,
  Projection,
  VectorProperties,
  wgs84Projection,
} from '../../../index.js';
import { arrayCloseTo } from '../helpers/helpers.js';

describe('util.geometryHelpers', () => {
  describe('convertGeometryToPolygon', () => {
    it('should convert a Circle to a Polygon', () => {
      const circle = new Circle([1, 1, 1], 1, 'XYZ');
      const polygon = convertGeometryToPolygon(circle);
      expect(polygon).to.be.an.instanceof(Polygon);
    });

    it('should remove the _vcmGeomType property from polygons', () => {
      const polygon = new Polygon([]);
      polygon.set('_vcsGeomType', 'test');
      const point = new Point([1, 1, 1]);
      point.set('_vcsGeomType', 'test');

      const convertedPolygon = convertGeometryToPolygon(polygon);
      expect(convertedPolygon.get('_vcsGeomType')).to.not.exist;

      const convertedPoint = convertGeometryToPolygon(point);
      expect(convertedPoint.get('_vcsGeomType')).to.equal('test');
    });
  });

  describe('getFlatCoordinatesFromSimpleGeometry', () => {
    let geometry;
    let flatCoordinates;

    it('should return an empty array if no coordinates are there', () => {
      geometry = new Point([]);
      flatCoordinates = getFlatCoordinatesFromSimpleGeometry(geometry);
      expect(flatCoordinates).to.be.empty;
    });

    it('should return the coordinates of a 3D point', () => {
      geometry = new Point([1, 2, 3]);
      flatCoordinates = getFlatCoordinatesFromSimpleGeometry(geometry);
      expect(flatCoordinates).to.have.deep.members([[1, 2, 3]]);
    });

    it('should return the coordinates of a 2D point', () => {
      geometry = new Point([1, 2]);
      flatCoordinates = getFlatCoordinatesFromSimpleGeometry(geometry);
      expect(flatCoordinates).to.have.deep.members([[1, 2]]);
    });

    it('should return the coordinates of a MultiPoint', () => {
      geometry = new MultiPoint([
        [1, 2],
        [2, 2],
      ]);
      flatCoordinates = getFlatCoordinatesFromSimpleGeometry(geometry);
      expect(flatCoordinates).to.have.deep.members([
        [1, 2],
        [2, 2],
      ]);
    });

    it('should return the coordinates of a 3D polygon', () => {
      geometry = new Polygon([
        [
          [50, 50, 3],
          [50, 55, 3],
          [55, 50, 3],
        ],
      ]);
      flatCoordinates = getFlatCoordinatesFromSimpleGeometry(geometry);
      expect(flatCoordinates).to.have.deep.members([
        [50, 50, 3],
        [50, 55, 3],
        [55, 50, 3],
      ]);
    });

    it('should return the coordinates of a 2D polygon', () => {
      geometry = new Polygon([
        [
          [50, 50],
          [50, 55],
          [55, 50],
        ],
      ]);
      flatCoordinates = getFlatCoordinatesFromSimpleGeometry(geometry);
      expect(flatCoordinates).to.have.deep.members([
        [50, 50],
        [50, 55],
        [55, 50],
      ]);
    });

    it('should return the coordinates of a MultiPolygon', () => {
      geometry = new MultiPolygon([
        [
          [
            [50, 50],
            [50, 55],
            [55, 50],
          ],
        ],
        [
          [
            [50, 50],
            [50, 55],
            [55, 50],
          ],
        ],
      ]);
      flatCoordinates = getFlatCoordinatesFromSimpleGeometry(geometry);
      expect(flatCoordinates).to.have.deep.members([
        [50, 50],
        [50, 55],
        [55, 50],
        [50, 50],
        [50, 55],
        [55, 50],
      ]);
    });

    it('should return the coordinates of a 3D linestring', () => {
      geometry = new LineString([
        [1, 2, 3],
        [1, 2, 3],
      ]);
      flatCoordinates = getFlatCoordinatesFromSimpleGeometry(geometry);
      expect(flatCoordinates).to.have.deep.members([
        [1, 2, 3],
        [1, 2, 3],
      ]);
    });

    it('should return the coordinates of a 2D linestring', () => {
      geometry = new LineString([
        [1, 2],
        [1, 3],
      ]);
      flatCoordinates = getFlatCoordinatesFromSimpleGeometry(geometry);
      expect(flatCoordinates).to.have.deep.members([
        [1, 2],
        [1, 3],
      ]);
    });

    it('should return the coordinates of a MultilineString', () => {
      geometry = new MultiLineString([
        [
          [1, 2],
          [1, 3],
        ],
        [
          [1, 4],
          [1, 5],
        ],
      ]);
      flatCoordinates = getFlatCoordinatesFromSimpleGeometry(geometry);
      expect(flatCoordinates).to.have.deep.members([
        [1, 2],
        [1, 3],
        [1, 4],
        [1, 5],
      ]);
    });
  });

  describe('getFlatCoordinatesFromGeometry', () => {
    let geometries: {
      point: Point;
      lineString: LineString;
      multiPoint: MultiPoint;
      polygon: Polygon;
      multiLineString: MultiLineString;
      circle: Circle;
      multiPolygon: MultiPolygon;
      geometryCollection: GeometryCollection;
    };
    let keys: (keyof typeof geometries)[];
    let flatCoordinates: Record<keyof typeof geometries, Coordinate[]>;

    before(() => {
      geometries = {
        point: new Point([1, 1, 1]),
        lineString: new LineString([
          [1, 1, 1],
          [2, 2, 2],
        ]),
        multiPoint: new MultiPoint([
          [1, 1, 1],
          [2, 2, 2],
        ]),
        polygon: new Polygon([
          [
            [0, 0, 0],
            [10, 0, 0],
            [10, 10, 0],
            [0, 10, 0],
          ],
          [
            [2, 2, 0],
            [0, 8, 0],
            [8, 8, 0],
            [8, 0, 0],
          ],
        ]),
        multiLineString: new MultiLineString([
          [
            [1, 1, 1],
            [2, 2, 2],
          ],
          [
            [1, 1, 1],
            [3, 3, 3],
          ],
        ]),
        circle: new Circle([0, 0, 0], 1, 'XYZ'),
        multiPolygon: new MultiPolygon([
          [
            [
              [0, 0, 0],
              [1, 0, 0],
              [0, 1, 0],
            ],
          ],
          [
            [
              [2, 2, 0],
              [2, 5, 0],
              [-2, 5, 0],
            ],
            [
              [1, 3, 0],
              [0, 4, 0],
              [1, 4, 0],
            ],
          ],
        ]),
        geometryCollection: new GeometryCollection([]),
      };
      geometries.geometryCollection = new GeometryCollection([
        geometries.point.clone(),
        geometries.lineString.clone(),
        geometries.polygon.clone(),
        geometries.multiLineString.clone(),
        geometries.circle.clone(),
      ]);
      keys = Object.keys(geometries) as (keyof typeof geometries)[];
      flatCoordinates = {
        point: [[1, 1, 1]],
        lineString: [
          [1, 1, 1],
          [2, 2, 2],
        ],
        multiPoint: [
          [1, 1, 1],
          [2, 2, 2],
        ],
        polygon: [
          [0, 0, 0],
          [10, 0, 0],
          [10, 10, 0],
          [0, 10, 0],
          [2, 2, 0],
          [0, 8, 0],
          [8, 8, 0],
          [8, 0, 0],
        ],
        multiLineString: [
          [1, 1, 1],
          [2, 2, 2],
          [1, 1, 1],
          [3, 3, 3],
        ],
        circle: [
          [0, 0, 0],
          [1, 0, 0],
        ],
        multiPolygon: [
          [0, 0, 0],
          [1, 0, 0],
          [0, 1, 0],
          [2, 2, 0],
          [2, 5, 0],
          [-2, 5, 0],
          [1, 3, 0],
          [0, 4, 0],
          [1, 4, 0],
        ],
        geometryCollection: [],
      };
      flatCoordinates.geometryCollection = [
        flatCoordinates.point,
        flatCoordinates.lineString,
        flatCoordinates.polygon,
        flatCoordinates.multiLineString,
        flatCoordinates.circle,
      ].flat();
    });

    it('should get the flat coordinates of a geometry', () => {
      keys.forEach((key) => {
        const coords = getFlatCoordinateReferences(geometries[key]);
        expect(coords).to.have.deep.members(flatCoordinates[key]);
      });
    });

    it('should get the flat coordinates with a reference to the original', () => {
      keys.forEach((key) => {
        const coords =
          key === 'circle'
            ? [
                geometries[key].getFirstCoordinate(),
                geometries[key].getLastCoordinate(),
              ]
            : geometries[key].getCoordinates();
        const flats = getFlatCoordinateReferences(geometries[key], coords);
        expect(flats).to.have.deep.members(flatCoordinates[key]);
      });
    });
  });

  describe('circleFromCenterRadius', () => {
    it('should create an XYZ circle', () => {
      const circle = circleFromCenterRadius([0, 0, 0], 10);
      expect(circle.getCenter()).to.have.members([0, 0, 0]);
    });

    it('should create an XY circle', () => {
      const circle = circleFromCenterRadius([0, 0], 10);
      expect(circle.getCenter()).to.have.members([0, 0]);
    });
  });

  describe('layout changes', () => {
    describe('XYZ to XY', () => {
      it('should convert a point', () => {
        const geometry = new Point([0, 0, 0], 'XYZ');
        from3Dto2DLayout(geometry);
        expect(geometry.getCoordinates()).to.have.members([0, 0]);
        expect(geometry.getLayout()).to.equal('XY');
      });

      it('should convert a circle', () => {
        const geometry = new Circle([0, 0, 0], 1);
        from3Dto2DLayout(geometry);
        expect(geometry.getCenter()).to.have.members([0, 0]);
        expect(geometry.getLayout()).to.equal('XY');
      });

      it('should convert a multi point', () => {
        const geometry = new MultiPoint(
          [
            [0, 0, 0],
            [1, 1, 0],
          ],
          'XYZ',
        );
        from3Dto2DLayout(geometry);
        expect(geometry.getCoordinates()).to.have.deep.members([
          [0, 0],
          [1, 1],
        ]);
        expect(geometry.getLayout()).to.equal('XY');
      });

      it('should convert a line string', () => {
        const geometry = new LineString(
          [
            [0, 0, 0],
            [1, 1, 0],
          ],
          'XYZ',
        );
        from3Dto2DLayout(geometry);
        expect(geometry.getCoordinates()).to.have.deep.members([
          [0, 0],
          [1, 1],
        ]);
        expect(geometry.getLayout()).to.equal('XY');
      });

      it('should convert a multi line string', () => {
        const geometry = new MultiLineString(
          [
            [
              [0, 0, 0],
              [10, 0, 0],
              [10, 10, 0],
              [0, 10, 0],
              [0, 0, 0],
            ],
            [
              [2, 2, 0],
              [2, 8, 0],
              [8, 8, 0],
              [8, 2, 0],
              [2, 2, 0],
            ],
          ],
          'XYZ',
        );
        from3Dto2DLayout(geometry);
        expect(geometry.getCoordinates()).to.have.deep.members([
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
            [0, 0],
          ],
          [
            [2, 2],
            [2, 8],
            [8, 8],
            [8, 2],
            [2, 2],
          ],
        ]);
        expect(geometry.getLayout()).to.equal('XY');
      });

      it('should convert a polygon', () => {
        const geometry = new Polygon(
          [
            [
              [0, 0, 0],
              [10, 0, 0],
              [10, 10, 0],
              [0, 10, 0],
            ],
            [
              [2, 2, 0],
              [2, 8, 0],
              [8, 8, 0],
              [8, 2, 0],
            ],
          ],
          'XYZ',
        );
        from3Dto2DLayout(geometry);
        expect(geometry.getCoordinates()).to.have.deep.members([
          [
            [0, 0],
            [10, 0],
            [10, 10],
            [0, 10],
          ],
          [
            [2, 2],
            [2, 8],
            [8, 8],
            [8, 2],
          ],
        ]);
        expect(geometry.getLayout()).to.equal('XY');
      });

      it('should convert a multi polygon', () => {
        const geometry = new MultiPolygon(
          [
            [
              [
                [0, 0, 0],
                [10, 0, 0],
                [10, 10, 0],
                [0, 10, 0],
              ],
            ],
            [
              [
                [8, 2, 0],
                [8, 8, 0],
                [2, 8, 0],
                [2, 2, 0],
              ],
            ],
          ],
          'XYZ',
        );
        from3Dto2DLayout(geometry);
        expect(geometry.getCoordinates()).to.have.deep.members([
          [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
            ],
          ],
          [
            [
              [8, 2],
              [8, 8],
              [2, 8],
              [2, 2],
            ],
          ],
        ]);
        expect(geometry.getLayout()).to.equal('XY');
      });

      it('should convert a geometry collection', () => {
        const geometry = new GeometryCollection([
          new Point([0, 0, 0], 'XYZ'),
          new MultiPoint(
            [
              [0, 0, 0],
              [1, 1, 0],
            ],
            'XYZ',
          ),
          new LineString(
            [
              [0, 0, 0],
              [1, 1, 0],
            ],
            'XYZ',
          ),
          new MultiLineString(
            [
              [
                [0, 0, 0],
                [10, 0, 0],
                [10, 10, 0],
                [0, 10, 0],
                [0, 0, 0],
              ],
              [
                [2, 2, 0],
                [2, 8, 0],
                [8, 8, 0],
                [8, 2, 0],
                [2, 2, 0],
              ],
            ],
            'XYZ',
          ),
          new Polygon(
            [
              [
                [0, 0, 0],
                [10, 0, 0],
                [10, 10, 0],
                [0, 10, 0],
              ],
              [
                [2, 2, 0],
                [2, 8, 0],
                [8, 8, 0],
                [8, 2, 0],
              ],
            ],
            'XYZ',
          ),
          new MultiPolygon(
            [
              [
                [
                  [0, 0, 0],
                  [10, 0, 0],
                  [10, 10, 0],
                  [0, 10, 0],
                ],
              ],
              [
                [
                  [8, 2, 0],
                  [8, 8, 0],
                  [2, 8, 0],
                  [2, 2, 0],
                ],
              ],
            ],
            'XYZ',
          ),
        ]);
        from3Dto2DLayout(geometry);
        expect(geometry.getCoordinates()).to.have.deep.members([
          [0, 0],
          [
            [0, 0],
            [1, 1],
          ],
          [
            [0, 0],
            [1, 1],
          ],
          [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
              [0, 0],
            ],
            [
              [2, 2],
              [2, 8],
              [8, 8],
              [8, 2],
              [2, 2],
            ],
          ],
          [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
            ],
            [
              [2, 2],
              [2, 8],
              [8, 8],
              [8, 2],
            ],
          ],
          [
            [
              [
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
              ],
            ],
            [
              [
                [8, 2],
                [8, 8],
                [2, 8],
                [2, 2],
              ],
            ],
          ],
        ]);
        expect(geometry.getLayout()).to.equal('XY');
      });
    });

    describe('XY to XYZ', () => {
      let scene: Scene;

      before(() => {
        scene = getMockScene();
        scene.sampleHeightMostDetailed = (
          positions: Cartographic[],
        ): Promise<Cartographic[]> => {
          positions.forEach((c) => {
            c.height = 0;
          });

          return Promise.resolve(positions);
        };
      });

      after(() => {
        scene.destroy();
      });

      it('should convert a point', async () => {
        const geometry = new Point([0, 0], 'XY');
        await from2Dto3DLayout(
          geometry,
          scene,
          HeightReference.CLAMP_TO_GROUND,
        );
        expect(geometry.getCoordinates()).to.have.members([0, 0, 0]);
        expect(geometry.getLayout()).to.equal('XYZ');
      });

      it('should convert a circle', async () => {
        const geometry = new Circle([0, 0], 1);
        await from2Dto3DLayout(
          geometry,
          scene,
          HeightReference.CLAMP_TO_GROUND,
        );
        expect(geometry.getCenter()).to.have.members([0, 0, 0]);
        expect(geometry.getLayout()).to.equal('XYZ');
      });

      it('should convert a multi point', async () => {
        const geometry = new MultiPoint(
          [
            [0, 0],
            [1, 1],
          ],
          'XY',
        );
        await from2Dto3DLayout(
          geometry,
          scene,
          HeightReference.CLAMP_TO_GROUND,
        );
        expect(geometry.getCoordinates()).to.have.deep.members([
          [0, 0, 0],
          [1, 1, 0],
        ]);
        expect(geometry.getLayout()).to.equal('XYZ');
      });

      it('should convert a line string', async () => {
        const geometry = new LineString(
          [
            [0, 0],
            [1, 1],
          ],
          'XY',
        );
        await from2Dto3DLayout(
          geometry,
          scene,
          HeightReference.CLAMP_TO_GROUND,
        );
        expect(geometry.getCoordinates()).to.have.deep.members([
          [0, 0, 0],
          [1, 1, 0],
        ]);
        expect(geometry.getLayout()).to.equal('XYZ');
      });

      it('should convert a multi line string', async () => {
        const geometry = new MultiLineString(
          [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
              [0, 0],
            ],
            [
              [2, 2],
              [2, 8],
              [8, 8],
              [8, 2],
              [2, 2],
            ],
          ],
          'XY',
        );
        await from2Dto3DLayout(
          geometry,
          scene,
          HeightReference.CLAMP_TO_GROUND,
        );
        expect(geometry.getCoordinates()).to.have.deep.members([
          [
            [0, 0, 0],
            [10, 0, 0],
            [10, 10, 0],
            [0, 10, 0],
            [0, 0, 0],
          ],
          [
            [2, 2, 0],
            [2, 8, 0],
            [8, 8, 0],
            [8, 2, 0],
            [2, 2, 0],
          ],
        ]);
        expect(geometry.getLayout()).to.equal('XYZ');
      });

      it('should convert a polygon', async () => {
        const geometry = new Polygon(
          [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
            ],
            [
              [2, 2],
              [2, 8],
              [8, 8],
              [8, 2],
            ],
          ],
          'XY',
        );
        await from2Dto3DLayout(
          geometry,
          scene,
          HeightReference.CLAMP_TO_GROUND,
        );
        expect(geometry.getCoordinates()).to.have.deep.members([
          [
            [0, 0, 0],
            [10, 0, 0],
            [10, 10, 0],
            [0, 10, 0],
          ],
          [
            [2, 2, 0],
            [2, 8, 0],
            [8, 8, 0],
            [8, 2, 0],
          ],
        ]);
        expect(geometry.getLayout()).to.equal('XYZ');
      });

      it('should convert a multi polygon', async () => {
        const geometry = new MultiPolygon(
          [
            [
              [
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
              ],
            ],
            [
              [
                [8, 2],
                [8, 8],
                [2, 8],
                [2, 2],
              ],
            ],
          ],
          'XY',
        );
        await from2Dto3DLayout(
          geometry,
          scene,
          HeightReference.CLAMP_TO_GROUND,
        );
        expect(geometry.getCoordinates()).to.have.deep.members([
          [
            [
              [0, 0, 0],
              [10, 0, 0],
              [10, 10, 0],
              [0, 10, 0],
            ],
          ],
          [
            [
              [8, 2, 0],
              [8, 8, 0],
              [2, 8, 0],
              [2, 2, 0],
            ],
          ],
        ]);
        expect(geometry.getLayout()).to.equal('XYZ');
      });

      it('should convert a geometry collection', async () => {
        const geometry = new GeometryCollection([
          new Point([0, 0], 'XY'),
          new MultiPoint(
            [
              [0, 0],
              [1, 1],
            ],
            'XY',
          ),
          new LineString(
            [
              [0, 0],
              [1, 1],
            ],
            'XY',
          ),
          new MultiLineString(
            [
              [
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
                [0, 0],
              ],
              [
                [2, 2],
                [2, 8],
                [8, 8],
                [8, 2],
                [2, 2],
              ],
            ],
            'XY',
          ),
          new Polygon(
            [
              [
                [0, 0],
                [10, 0],
                [10, 10],
                [0, 10],
              ],
              [
                [2, 2],
                [2, 8],
                [8, 8],
                [8, 2],
              ],
            ],
            'XY',
          ),
          new MultiPolygon(
            [
              [
                [
                  [0, 0],
                  [10, 0],
                  [10, 10],
                  [0, 10],
                ],
              ],
              [
                [
                  [8, 2],
                  [8, 8],
                  [2, 8],
                  [2, 2],
                ],
              ],
            ],
            'XY',
          ),
        ]);
        await from2Dto3DLayout(
          geometry,
          scene,
          HeightReference.CLAMP_TO_GROUND,
        );
        expect(geometry.getCoordinates()).to.have.deep.members([
          [0, 0, 0],
          [
            [0, 0, 0],
            [1, 1, 0],
          ],
          [
            [0, 0, 0],
            [1, 1, 0],
          ],
          [
            [
              [0, 0, 0],
              [10, 0, 0],
              [10, 10, 0],
              [0, 10, 0],
              [0, 0, 0],
            ],
            [
              [2, 2, 0],
              [2, 8, 0],
              [8, 8, 0],
              [8, 2, 0],
              [2, 2, 0],
            ],
          ],
          [
            [
              [0, 0, 0],
              [10, 0, 0],
              [10, 10, 0],
              [0, 10, 0],
            ],
            [
              [2, 2, 0],
              [2, 8, 0],
              [8, 8, 0],
              [8, 2, 0],
            ],
          ],
          [
            [
              [
                [0, 0, 0],
                [10, 0, 0],
                [10, 10, 0],
                [0, 10, 0],
              ],
            ],
            [
              [
                [8, 2, 0],
                [8, 8, 0],
                [2, 8, 0],
                [2, 2, 0],
              ],
            ],
          ],
        ]);
        expect(geometry.getLayout()).to.equal('XYZ');
      });
    });

    describe('XYZM to XYM', () => {
      it('should convert a point', () => {
        const geometry = new Point([0, 0, 0, 5], 'XYZM');
        from3Dto2DLayout(geometry);
        expect(geometry.getCoordinates()).to.have.members([0, 0, 5]);
        expect(geometry.getLayout()).to.equal('XYM');
      });

      it('should convert a circle', () => {
        const geometry = new Circle([0, 0, 0, 5], 1, 'XYZM');
        from3Dto2DLayout(geometry);
        expect(geometry.getCenter()).to.have.members([0, 0, 5]);
        expect(geometry.getLayout()).to.equal('XYM');
      });

      it('should convert a multi point', () => {
        const geometry = new MultiPoint(
          [
            [0, 0, 0, 5],
            [1, 1, 0, 5],
          ],
          'XYZM',
        );
        from3Dto2DLayout(geometry);
        expect(geometry.getCoordinates()).to.have.deep.members([
          [0, 0, 5],
          [1, 1, 5],
        ]);
        expect(geometry.getLayout()).to.equal('XYM');
      });

      it('should convert a line string', () => {
        const geometry = new LineString(
          [
            [0, 0, 0, 5],
            [1, 1, 0, 5],
          ],
          'XYZM',
        );
        from3Dto2DLayout(geometry);
        expect(geometry.getCoordinates()).to.have.deep.members([
          [0, 0, 5],
          [1, 1, 5],
        ]);
        expect(geometry.getLayout()).to.equal('XYM');
      });

      it('should convert a multi line string', () => {
        const geometry = new MultiLineString(
          [
            [
              [0, 0, 0, 5],
              [10, 0, 0, 5],
              [10, 10, 0, 5],
              [0, 10, 0, 5],
              [0, 0, 0, 5],
            ],
            [
              [2, 2, 0, 5],
              [2, 8, 0, 5],
              [8, 8, 0, 5],
              [8, 2, 0, 5],
              [2, 2, 0, 5],
            ],
          ],
          'XYZM',
        );
        from3Dto2DLayout(geometry);
        expect(geometry.getCoordinates()).to.have.deep.members([
          [
            [0, 0, 5],
            [10, 0, 5],
            [10, 10, 5],
            [0, 10, 5],
            [0, 0, 5],
          ],
          [
            [2, 2, 5],
            [2, 8, 5],
            [8, 8, 5],
            [8, 2, 5],
            [2, 2, 5],
          ],
        ]);
        expect(geometry.getLayout()).to.equal('XYM');
      });

      it('should convert a polygon', () => {
        const geometry = new Polygon(
          [
            [
              [0, 0, 0, 5],
              [10, 0, 0, 5],
              [10, 10, 0, 5],
              [0, 10, 0, 5],
            ],
            [
              [2, 2, 0, 5],
              [2, 8, 0, 5],
              [8, 8, 0, 5],
              [8, 2, 0, 5],
            ],
          ],
          'XYZM',
        );
        from3Dto2DLayout(geometry);
        expect(geometry.getCoordinates()).to.have.deep.members([
          [
            [0, 0, 5],
            [10, 0, 5],
            [10, 10, 5],
            [0, 10, 5],
          ],
          [
            [2, 2, 5],
            [2, 8, 5],
            [8, 8, 5],
            [8, 2, 5],
          ],
        ]);
        expect(geometry.getLayout()).to.equal('XYM');
      });

      it('should convert a multi polygon', () => {
        const geometry = new MultiPolygon(
          [
            [
              [
                [0, 0, 0, 5],
                [10, 0, 0, 5],
                [10, 10, 0, 5],
                [0, 10, 0, 5],
              ],
            ],
            [
              [
                [8, 2, 0, 5],
                [8, 8, 0, 5],
                [2, 8, 0, 5],
                [2, 2, 0, 5],
              ],
            ],
          ],
          'XYZM',
        );
        from3Dto2DLayout(geometry);
        expect(geometry.getCoordinates()).to.have.deep.members([
          [
            [
              [0, 0, 5],
              [10, 0, 5],
              [10, 10, 5],
              [0, 10, 5],
            ],
          ],
          [
            [
              [8, 2, 5],
              [8, 8, 5],
              [2, 8, 5],
              [2, 2, 5],
            ],
          ],
        ]);
        expect(geometry.getLayout()).to.equal('XYM');
      });

      it('should convert a geometry collection', () => {
        const geometry = new GeometryCollection([
          new Point([0, 0, 0, 5], 'XYZM'),
          new MultiPoint(
            [
              [0, 0, 0, 5],
              [1, 1, 0, 5],
            ],
            'XYZM',
          ),
          new LineString(
            [
              [0, 0, 0, 5],
              [1, 1, 0, 5],
            ],
            'XYZM',
          ),
          new MultiLineString(
            [
              [
                [0, 0, 0, 5],
                [10, 0, 0, 5],
                [10, 10, 0, 5],
                [0, 10, 0, 5],
                [0, 0, 0, 5],
              ],
              [
                [2, 2, 0, 5],
                [2, 8, 0, 5],
                [8, 8, 0, 5],
                [8, 2, 0, 5],
                [2, 2, 0, 5],
              ],
            ],
            'XYZM',
          ),
          new Polygon(
            [
              [
                [0, 0, 0, 5],
                [10, 0, 0, 5],
                [10, 10, 0, 5],
                [0, 10, 0, 5],
              ],
              [
                [2, 2, 0, 5],
                [2, 8, 0, 5],
                [8, 8, 0, 5],
                [8, 2, 0, 5],
              ],
            ],
            'XYZM',
          ),
          new MultiPolygon(
            [
              [
                [
                  [0, 0, 0, 5],
                  [10, 0, 0, 5],
                  [10, 10, 0, 5],
                  [0, 10, 0, 5],
                ],
              ],
              [
                [
                  [8, 2, 0, 5],
                  [8, 8, 0, 5],
                  [2, 8, 0, 5],
                  [2, 2, 0, 5],
                ],
              ],
            ],
            'XYZM',
          ),
        ]);
        from3Dto2DLayout(geometry);
        expect(geometry.getCoordinates()).to.have.deep.members([
          [0, 0, 5],
          [
            [0, 0, 5],
            [1, 1, 5],
          ],
          [
            [0, 0, 5],
            [1, 1, 5],
          ],
          [
            [
              [0, 0, 5],
              [10, 0, 5],
              [10, 10, 5],
              [0, 10, 5],
              [0, 0, 5],
            ],
            [
              [2, 2, 5],
              [2, 8, 5],
              [8, 8, 5],
              [8, 2, 5],
              [2, 2, 5],
            ],
          ],
          [
            [
              [0, 0, 5],
              [10, 0, 5],
              [10, 10, 5],
              [0, 10, 5],
            ],
            [
              [2, 2, 5],
              [2, 8, 5],
              [8, 8, 5],
              [8, 2, 5],
            ],
          ],
          [
            [
              [
                [0, 0, 5],
                [10, 0, 5],
                [10, 10, 5],
                [0, 10, 5],
              ],
            ],
            [
              [
                [8, 2, 5],
                [8, 8, 5],
                [2, 8, 5],
                [2, 2, 5],
              ],
            ],
          ],
        ]);
        expect(geometry.getLayout()).to.equal('XYM');
      });
    });

    describe('XYM to XYZM', () => {
      let scene: Scene;

      before(() => {
        scene = getMockScene();
        scene.sampleHeightMostDetailed = (
          positions: Cartographic[],
        ): Promise<Cartographic[]> => {
          positions.forEach((c) => {
            c.height = 0;
          });

          return Promise.resolve(positions);
        };
      });

      after(() => {
        scene.destroy();
      });

      it('should convert a point', async () => {
        const geometry = new Point([0, 0, 5], 'XYM');
        await from2Dto3DLayout(
          geometry,
          scene,
          HeightReference.CLAMP_TO_GROUND,
        );
        expect(geometry.getCoordinates()).to.have.members([0, 0, 0, 5]);
        expect(geometry.getLayout()).to.equal('XYZM');
      });

      it('should convert a circle', async () => {
        const geometry = new Circle([0, 0, 5], 1, 'XYM');
        await from2Dto3DLayout(
          geometry,
          scene,
          HeightReference.CLAMP_TO_GROUND,
        );
        expect(geometry.getCenter()).to.have.members([0, 0, 0, 5]);
        expect(geometry.getLayout()).to.equal('XYZM');
      });

      it('should convert a multi point', async () => {
        const geometry = new MultiPoint(
          [
            [0, 0, 5],
            [1, 1, 5],
          ],
          'XYM',
        );
        await from2Dto3DLayout(
          geometry,
          scene,
          HeightReference.CLAMP_TO_GROUND,
        );
        expect(geometry.getCoordinates()).to.have.deep.members([
          [0, 0, 0, 5],
          [1, 1, 0, 5],
        ]);
        expect(geometry.getLayout()).to.equal('XYZM');
      });

      it('should convert a line string', async () => {
        const geometry = new LineString(
          [
            [0, 0, 5],
            [1, 1, 5],
          ],
          'XYM',
        );
        await from2Dto3DLayout(
          geometry,
          scene,
          HeightReference.CLAMP_TO_GROUND,
        );
        expect(geometry.getCoordinates()).to.have.deep.members([
          [0, 0, 0, 5],
          [1, 1, 0, 5],
        ]);
        expect(geometry.getLayout()).to.equal('XYZM');
      });

      it('should convert a multi line string', async () => {
        const geometry = new MultiLineString(
          [
            [
              [0, 0, 5],
              [10, 0, 5],
              [10, 10, 5],
              [0, 10, 5],
              [0, 0, 5],
            ],
            [
              [2, 2, 5],
              [2, 8, 5],
              [8, 8, 5],
              [8, 2, 5],
              [2, 2, 5],
            ],
          ],
          'XYM',
        );
        await from2Dto3DLayout(
          geometry,
          scene,
          HeightReference.CLAMP_TO_GROUND,
        );
        expect(geometry.getCoordinates()).to.have.deep.members([
          [
            [0, 0, 0, 5],
            [10, 0, 0, 5],
            [10, 10, 0, 5],
            [0, 10, 0, 5],
            [0, 0, 0, 5],
          ],
          [
            [2, 2, 0, 5],
            [2, 8, 0, 5],
            [8, 8, 0, 5],
            [8, 2, 0, 5],
            [2, 2, 0, 5],
          ],
        ]);
        expect(geometry.getLayout()).to.equal('XYZM');
      });

      it('should convert a polygon', async () => {
        const geometry = new Polygon(
          [
            [
              [0, 0, 5],
              [10, 0, 5],
              [10, 10, 5],
              [0, 10, 5],
            ],
            [
              [2, 2, 5],
              [2, 8, 5],
              [8, 8, 5],
              [8, 2, 5],
            ],
          ],
          'XYM',
        );
        await from2Dto3DLayout(
          geometry,
          scene,
          HeightReference.CLAMP_TO_GROUND,
        );
        expect(geometry.getCoordinates()).to.have.deep.members([
          [
            [0, 0, 0, 5],
            [10, 0, 0, 5],
            [10, 10, 0, 5],
            [0, 10, 0, 5],
          ],
          [
            [2, 2, 0, 5],
            [2, 8, 0, 5],
            [8, 8, 0, 5],
            [8, 2, 0, 5],
          ],
        ]);
        expect(geometry.getLayout()).to.equal('XYZM');
      });

      it('should convert a multi polygon', async () => {
        const geometry = new MultiPolygon(
          [
            [
              [
                [0, 0, 5],
                [10, 0, 5],
                [10, 10, 5],
                [0, 10, 5],
              ],
            ],
            [
              [
                [8, 2, 5],
                [8, 8, 5],
                [2, 8, 5],
                [2, 2, 5],
              ],
            ],
          ],
          'XYM',
        );
        await from2Dto3DLayout(
          geometry,
          scene,
          HeightReference.CLAMP_TO_GROUND,
        );
        expect(geometry.getCoordinates()).to.have.deep.members([
          [
            [
              [0, 0, 0, 5],
              [10, 0, 0, 5],
              [10, 10, 0, 5],
              [0, 10, 0, 5],
            ],
          ],
          [
            [
              [8, 2, 0, 5],
              [8, 8, 0, 5],
              [2, 8, 0, 5],
              [2, 2, 0, 5],
            ],
          ],
        ]);
        expect(geometry.getLayout()).to.equal('XYZM');
      });

      it('should convert a geometry collection', async () => {
        const geometry = new GeometryCollection([
          new Point([0, 0, 5], 'XYM'),
          new MultiPoint(
            [
              [0, 0, 5],
              [1, 1, 5],
            ],
            'XYM',
          ),
          new LineString(
            [
              [0, 0, 5],
              [1, 1, 5],
            ],
            'XYM',
          ),
          new MultiLineString(
            [
              [
                [0, 0, 5],
                [10, 0, 5],
                [10, 10, 5],
                [0, 10, 5],
                [0, 0, 5],
              ],
              [
                [2, 2, 5],
                [2, 8, 5],
                [8, 8, 5],
                [8, 2, 5],
                [2, 2, 5],
              ],
            ],
            'XYM',
          ),
          new Polygon(
            [
              [
                [0, 0, 5],
                [10, 0, 5],
                [10, 10, 5],
                [0, 10, 5],
              ],
              [
                [2, 2, 5],
                [2, 8, 5],
                [8, 8, 5],
                [8, 2, 5],
              ],
            ],
            'XYM',
          ),
          new MultiPolygon(
            [
              [
                [
                  [0, 0, 5],
                  [10, 0, 5],
                  [10, 10, 5],
                  [0, 10, 5],
                ],
              ],
              [
                [
                  [8, 2, 5],
                  [8, 8, 5],
                  [2, 8, 5],
                  [2, 2, 5],
                ],
              ],
            ],
            'XYM',
          ),
        ]);
        await from2Dto3DLayout(
          geometry,
          scene,
          HeightReference.CLAMP_TO_GROUND,
        );
        expect(geometry.getCoordinates()).to.have.deep.members([
          [0, 0, 0, 5],
          [
            [0, 0, 0, 5],
            [1, 1, 0, 5],
          ],
          [
            [0, 0, 0, 5],
            [1, 1, 0, 5],
          ],
          [
            [
              [0, 0, 0, 5],
              [10, 0, 0, 5],
              [10, 10, 0, 5],
              [0, 10, 0, 5],
              [0, 0, 0, 5],
            ],
            [
              [2, 2, 0, 5],
              [2, 8, 0, 5],
              [8, 8, 0, 5],
              [8, 2, 0, 5],
              [2, 2, 0, 5],
            ],
          ],
          [
            [
              [0, 0, 0, 5],
              [10, 0, 0, 5],
              [10, 10, 0, 5],
              [0, 10, 0, 5],
            ],
            [
              [2, 2, 0, 5],
              [2, 8, 0, 5],
              [8, 8, 0, 5],
              [8, 2, 0, 5],
            ],
          ],
          [
            [
              [
                [0, 0, 0, 5],
                [10, 0, 0, 5],
                [10, 10, 0, 5],
                [0, 10, 0, 5],
              ],
            ],
            [
              [
                [8, 2, 0, 5],
                [8, 8, 0, 5],
                [2, 8, 0, 5],
                [2, 2, 0, 5],
              ],
            ],
          ],
        ]);
        expect(geometry.getLayout()).to.equal('XYZM');
      });
    });
  });

  describe('placeGeometryOnGround', () => {
    let scene: Scene;

    before(() => {
      scene = getMockScene();
      scene.sampleHeightMostDetailed = (
        cs: Cartographic[],
      ): Promise<Cartographic[]> => {
        cs.forEach((c) => {
          c.height =
            CesiumMath.toDegrees(c.longitude) +
            CesiumMath.toDegrees(c.latitude);
        });
        return Promise.resolve(cs);
      };
    });

    it('should place an XY geometry on ground', async () => {
      const geometry = new LineString([
        Projection.wgs84ToMercator([1, 2]),
        Projection.wgs84ToMercator([3, 4]),
      ]);
      await placeGeometryOnSurface(
        geometry,
        scene,
        HeightReference.CLAMP_TO_GROUND,
      );
      expect(geometry.getFlatCoordinates()).to.have.ordered.members([
        ...Projection.wgs84ToMercator([1, 2, 7]),
        ...Projection.wgs84ToMercator([3, 4, 7]),
      ]);
    });

    it('should place an XYZ geometry on ground', async () => {
      const geometry = new LineString([
        Projection.wgs84ToMercator([1, 2, 1]),
        Projection.wgs84ToMercator([3, 4, 8]),
      ]);
      await placeGeometryOnSurface(
        geometry,
        scene,
        HeightReference.CLAMP_TO_GROUND,
      );
      expect(geometry.getFlatCoordinates()).to.have.ordered.members([
        ...Projection.wgs84ToMercator([1, 2, 3]),
        ...Projection.wgs84ToMercator([3, 4, 10]),
      ]);
    });

    it('should place an XYM geometry on ground', async () => {
      const geometry = new LineString(
        [
          Projection.wgs84ToMercator([1, 2, 1]),
          Projection.wgs84ToMercator([3, 4, 1]),
        ],
        'XYM',
      );
      await placeGeometryOnSurface(
        geometry,
        scene,
        HeightReference.CLAMP_TO_GROUND,
      );
      expect(geometry.getFlatCoordinates()).to.have.ordered.members([
        ...Projection.wgs84ToMercator([1, 2, 7, 1]),
        ...Projection.wgs84ToMercator([3, 4, 7, 1]),
      ]);
    });

    it('should place an XYZM geometry on ground', async () => {
      const geometry = new LineString(
        [
          Projection.wgs84ToMercator([1, 2, 1, 1]),
          Projection.wgs84ToMercator([3, 4, 8, 1]),
        ],
        'XYZM',
      );
      await placeGeometryOnSurface(
        geometry,
        scene,
        HeightReference.CLAMP_TO_GROUND,
      );
      expect(geometry.getFlatCoordinates()).to.have.ordered.members([
        ...Projection.wgs84ToMercator([1, 2, 3, 1]),
        ...Projection.wgs84ToMercator([3, 4, 10, 1]),
      ]);
    });
  });

  describe('drapeGeometryOnGround', () => {
    let scene: Scene;

    before(() => {
      scene = getMockScene();
      scene.sampleHeightMostDetailed = (
        cs: Cartographic[],
      ): Promise<Cartographic[]> => {
        cs.forEach((c) => {
          c.height =
            CesiumMath.toDegrees(c.longitude) +
            CesiumMath.toDegrees(c.latitude);
        });
        return Promise.resolve(cs);
      };
    });

    it('should place an XY geometry on ground', async () => {
      const geometry = new Point(Projection.wgs84ToMercator([1, 2]));
      await drapeGeometryOnSurface(
        geometry,
        scene,
        HeightReference.CLAMP_TO_GROUND,
      );
      expect(geometry.getCoordinates()).to.have.ordered.members(
        Projection.wgs84ToMercator([1, 2, 3]),
      );
    });

    it('should place an XYZ geometry on ground', async () => {
      const geometry = new Point(Projection.wgs84ToMercator([1, 2, 1]));
      await drapeGeometryOnSurface(
        geometry,
        scene,
        HeightReference.CLAMP_TO_GROUND,
      );
      expect(geometry.getCoordinates()).to.have.ordered.members(
        Projection.wgs84ToMercator([1, 2, 3]),
      );
    });

    it('should place an XYM geometry on ground', async () => {
      const geometry = new Point(Projection.wgs84ToMercator([1, 2, 1]), 'XYM');
      await drapeGeometryOnSurface(
        geometry,
        scene,
        HeightReference.CLAMP_TO_GROUND,
      );
      expect(geometry.getCoordinates()).to.have.ordered.members(
        Projection.wgs84ToMercator([1, 2, 3, 1]),
      );
    });

    it('should place an XYZM geometry on ground', async () => {
      const geometry = new Point(
        Projection.wgs84ToMercator([1, 2, 1, 1]),
        'XYZM',
      );
      await drapeGeometryOnSurface(
        geometry,
        scene,
        HeightReference.CLAMP_TO_GROUND,
      );
      expect(geometry.getCoordinates()).to.have.ordered.members(
        Projection.wgs84ToMercator([1, 2, 3, 1]),
      );
    });
  });

  describe('create absolute features', () => {
    let scene: Scene;

    before(() => {
      scene = getMockScene();
      scene.sampleHeightMostDetailed = (
        cs: Cartographic[],
      ): Promise<Cartographic[]> => {
        cs.forEach((c) => {
          c.height =
            CesiumMath.toDegrees(c.longitude) +
            CesiumMath.toDegrees(c.latitude);
        });
        return Promise.resolve(cs);
      };
    });

    after(() => {
      scene.destroy();
    });

    describe('of 3D features', () => {
      let geometries: {
        point: Point;
        lineString: LineString;
        multiPoint: MultiPoint;
        polygon: Polygon;
        multiLineString: MultiLineString;
        circle: Circle;
        multiPolygon: MultiPolygon;
        geometryCollection: GeometryCollection;
      };
      let inputFeatures: Feature[];

      before(() => {
        geometries = {
          point: new Point([1, 1, 1]),
          lineString: new LineString([
            [1, 1, 1],
            [2, 2, 2],
          ]),
          multiPoint: new MultiPoint([
            [1, 1, 1],
            [2, 2, 2],
          ]),
          polygon: new Polygon([
            [
              [0, 0, 0],
              [10, 0, 0],
              [10, 10, 0],
              [0, 10, 0],
            ],
            [
              [2, 2, 0],
              [0, 8, 0],
              [8, 8, 0],
              [8, 0, 0],
            ],
          ]),
          multiLineString: new MultiLineString([
            [
              [1, 1, 1],
              [2, 2, 2],
            ],
            [
              [1, 1, 1],
              [3, 3, 3],
            ],
          ]),
          circle: new Circle([1, 0, 0], 1, 'XYZ'),
          multiPolygon: new MultiPolygon([
            [
              [
                [0, 0, 0],
                [1, 0, 0],
                [0, 1, 0],
              ],
            ],
            [
              [
                [2, 2, 0],
                [2, 5, 0],
                [-2, 5, 0],
              ],
              [
                [1, 3, 0],
                [0, 4, 0],
                [1, 4, 0],
              ],
            ],
          ]),
          geometryCollection: new GeometryCollection([]),
        };
        geometries.geometryCollection = new GeometryCollection([
          geometries.point.clone(),
          geometries.lineString.clone(),
          geometries.polygon.clone(),
          geometries.multiLineString.clone(),
        ]);
        inputFeatures = Object.values(geometries).map((geometry) => {
          geometry.transform(wgs84Projection.proj, mercatorProjection.proj);
          return new Feature({ geometry });
        });
      });

      describe('if they are absolute', () => {
        let vectorProperties: VectorProperties;
        let absoluteFeatures: Feature[];

        before(async () => {
          vectorProperties = new VectorProperties({ altitudeMode: 'absolute' });
          absoluteFeatures = await Promise.all(
            inputFeatures.map(
              (f) =>
                createAbsoluteFeature(
                  f,
                  vectorProperties,
                  scene,
                ) as Promise<Feature>,
            ),
          );
        });

        it('should set olcs_altitudeMode to absolute', () => {
          absoluteFeatures.forEach((f) => {
            expect(f.get('olcs_altitudeMode')).to.equal('absolute');
          });
        });

        it('should not change the height of absolute geometries', () => {
          absoluteFeatures.forEach((f, i) => {
            expect(f.getGeometry()!.getFlatCoordinates()).to.eql(
              inputFeatures[i].getGeometry()!.getFlatCoordinates(),
            );
          });
        });
      });

      describe('if they are absolute & ground level is set', () => {
        let vectorProperties: VectorProperties;
        let absoluteFeatures: Feature[];

        before(async () => {
          vectorProperties = new VectorProperties({
            altitudeMode: 'absolute',
            groundLevel: 5,
          });
          absoluteFeatures = await Promise.all(
            inputFeatures.map(
              (f) =>
                createAbsoluteFeature(
                  f,
                  vectorProperties,
                  scene,
                ) as Promise<Feature>,
            ),
          );
        });

        it('should set olcs_altitudeMode to absolute', () => {
          absoluteFeatures.forEach((f) => {
            expect(f.get('olcs_altitudeMode')).to.equal('absolute');
          });
        });

        it('should set the geometries to ground level', () => {
          absoluteFeatures.forEach((f, i) => {
            const geometry = f.getGeometry()!;
            expect(geometry.getFlatCoordinates()).to.eql(
              inputFeatures[i]
                .getGeometry()!
                .getFlatCoordinates()
                .map((c, j) => {
                  if ((j + 1) % 3 === 0) {
                    return 5;
                  }
                  return c;
                }),
              ` of ${geometry.getType()} coordinate: `,
            );
          });
        });
      });

      describe('if they are clamped', () => {
        let vectorProperties: VectorProperties;
        let absoluteFeatures: Feature[];

        before(async () => {
          vectorProperties = new VectorProperties({
            altitudeMode: 'clampToGround',
          });
          absoluteFeatures = await Promise.all(
            inputFeatures.map(
              (f) =>
                createAbsoluteFeature(
                  f,
                  vectorProperties,
                  scene,
                ) as Promise<Feature>,
            ),
          );
        });

        it('should set olcs_altitudeMode to absolute', () => {
          absoluteFeatures.forEach((f) => {
            expect(f.get('olcs_altitudeMode')).to.equal('absolute');
          });
        });

        it('should place geometries onto the ground', () => {
          absoluteFeatures.forEach((f, i) => {
            const geometry = f.getGeometry()!;
            if (geometry instanceof Circle) {
              expect(
                Projection.mercatorToWgs84(geometry.getCenter()),
              ).to.have.members([1, 0, 1]);
            } else {
              expect(geometry.getFlatCoordinates()).to.eql(
                inputFeatures[i]
                  .getGeometry()!
                  .getFlatCoordinates()
                  .map((c, j, a) => {
                    if ((j + 1) % 3 === 0) {
                      const mercatorCoordinate = [a[j - 2], a[j - 1]];
                      const wgs84 =
                        Projection.mercatorToWgs84(mercatorCoordinate);
                      return wgs84[0] + wgs84[1];
                    }
                    return c;
                  }),
                `coordiantes of ${geometry.getType()} dont match`,
              );
            }
          });
        });
      });

      describe('if they are clamped and ground level is set', () => {
        let vectorProperties: VectorProperties;
        let absoluteFeatures: Feature[];

        before(async () => {
          vectorProperties = new VectorProperties({
            altitudeMode: 'clampToGround',
            groundLevel: 5,
          });
          absoluteFeatures = await Promise.all(
            inputFeatures.map(
              (f) =>
                createAbsoluteFeature(
                  f,
                  vectorProperties,
                  scene,
                ) as Promise<Feature>,
            ),
          );
        });

        it('should set olcs_altitudeMode to absolute', () => {
          absoluteFeatures.forEach((f) => {
            expect(f.get('olcs_altitudeMode')).to.equal('absolute');
          });
        });

        it('should set the geometries to ground level', () => {
          absoluteFeatures.forEach((f, i) => {
            const geometry = f.getGeometry()!;
            expect(geometry.getFlatCoordinates()).to.eql(
              inputFeatures[i]
                .getGeometry()!
                .getFlatCoordinates()
                .map((c, j) => {
                  if ((j + 1) % 3 === 0) {
                    return 5;
                  }
                  return c;
                }),
              ` of ${geometry.getType()} coordinate: `,
            );
          });
        });
      });

      describe('if they are relative to ground', () => {
        let expectedHeightForType: Record<
          ReturnType<typeof Geometry.prototype.getType>,
          number[]
        >;

        before(() => {
          expectedHeightForType = {
            Circle: [1.5, 1.5],
            GeometryCollection: [
              2,
              ...new Array<number>(2).fill(3.000057130632186),
              ...new Array<number>(8).fill(9.5138726697935),
              ...new Array<number>(2).fill(3.000057130632186),
              ...new Array<number>(2).fill(4.00030477991453),
            ].reverse(),
            LinearRing: [0],
            MultiLineString: [
              ...new Array<number>(2).fill(3.000057130632186),
              ...new Array<number>(2).fill(4.00030477991453),
            ].reverse(),
            MultiPoint: [2, 4].reverse(),
            MultiPolygon: [
              ...new Array<number>(3).fill(0.6666817105205824),
              ...new Array<number>(6).fill(4.500635759754239),
            ].reverse(),
            Point: [2],
            LineString: new Array<number>(2).fill(3.000057130632186),
            Polygon: new Array<number>(8).fill(9.5138726697935),
          };
        });

        describe('with height above ground set', () => {
          let vectorProperties: VectorProperties;
          let absoluteFeatures: Feature[];

          before(async () => {
            vectorProperties = new VectorProperties({
              altitudeMode: 'relativeToGround',
              heightAboveGround: 5,
            });
            absoluteFeatures = await Promise.all(
              inputFeatures.map(
                (f) =>
                  createAbsoluteFeature(
                    f,
                    vectorProperties,
                    scene,
                  ) as Promise<Feature>,
              ),
            );
          });

          it('should set olcs_altitudeMode to absolute', () => {
            absoluteFeatures.forEach((f) => {
              expect(f.get('olcs_altitudeMode')).to.equal('absolute');
            });
          });

          it('should place geometries above the ground by height above ground', () => {
            absoluteFeatures.forEach((f, i) => {
              const geometry = f.getGeometry()!;
              const expectedHeights =
                expectedHeightForType[geometry.getType()].slice();
              arrayCloseTo(
                geometry.getFlatCoordinates(),
                inputFeatures[i]
                  .getGeometry()!
                  .getFlatCoordinates()
                  .map((c, j) => {
                    if ((j + 1) % 3 === 0) {
                      return (expectedHeights.pop() ?? 0) + 5;
                    }
                    return c;
                  }),
                undefined,
                ` of ${geometry.getType()} coordinate: `,
              );
            });
          });
        });

        describe('without height above ground set', () => {
          let vectorProperties: VectorProperties;
          let absoluteFeatures: Feature[];

          before(async () => {
            vectorProperties = new VectorProperties({
              altitudeMode: 'relativeToGround',
            });
            absoluteFeatures = await Promise.all(
              inputFeatures.map(
                (f) =>
                  createAbsoluteFeature(
                    f,
                    vectorProperties,
                    scene,
                  ) as Promise<Feature>,
              ),
            );
          });

          it('should place geometries onto the ground at height above Z', () => {
            absoluteFeatures.forEach((f, i) => {
              const geometry = f.getGeometry()!;
              const expectedHeights =
                expectedHeightForType[geometry.getType()].slice();
              arrayCloseTo(
                geometry.getFlatCoordinates(),
                inputFeatures[i]
                  .getGeometry()!
                  .getFlatCoordinates()
                  .map((c, j) => {
                    if ((j + 1) % 3 === 0) {
                      return (expectedHeights.pop() ?? 0) + c;
                    }
                    return c;
                  }),
                undefined,
                ` of ${geometry.getType()} coordinate: `,
              );
            });
          });
        });
      });
    });

    describe('of 2D features', () => {
      let geometries: {
        point: Point;
        lineString: LineString;
        multiPoint: MultiPoint;
        polygon: Polygon;
        multiLineString: MultiLineString;
        circle: Circle;
        multiPolygon: MultiPolygon;
        geometryCollection: GeometryCollection;
      };
      let inputFeatures: Feature[];

      before(() => {
        geometries = {
          point: new Point([1, 1]),
          lineString: new LineString([
            [1, 1],
            [2, 2],
          ]),
          multiPoint: new MultiPoint([
            [1, 1],
            [2, 2],
          ]),
          polygon: new Polygon([
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
            ],
            [
              [2, 2],
              [0, 8],
              [8, 8],
              [8, 0],
            ],
          ]),
          multiLineString: new MultiLineString([
            [
              [1, 1],
              [2, 2],
            ],
            [
              [1, 1],
              [3, 3],
            ],
          ]),
          circle: new Circle([1, 0], 1, 'XY'),
          multiPolygon: new MultiPolygon([
            [
              [
                [0, 0],
                [1, 0],
                [0, 1],
              ],
            ],
            [
              [
                [2, 2],
                [2, 5],
                [-2, 5],
              ],
              [
                [1, 3],
                [0, 4],
                [1, 4],
              ],
            ],
          ]),
          geometryCollection: new GeometryCollection([]),
        };
        geometries.geometryCollection = new GeometryCollection([
          geometries.point.clone(),
          geometries.lineString.clone(),
          geometries.polygon.clone(),
          geometries.multiLineString.clone(),
        ]);
        inputFeatures = Object.values(geometries).map((geometry) => {
          geometry.transform(wgs84Projection.proj, mercatorProjection.proj);
          return new Feature({ geometry });
        });
      });

      describe('if they are absolute', () => {
        let vectorProperties: VectorProperties;
        let absoluteFeatures: Feature[];

        before(async () => {
          vectorProperties = new VectorProperties({ altitudeMode: 'absolute' });
          absoluteFeatures = await Promise.all(
            inputFeatures.map(
              (f) =>
                createAbsoluteFeature(
                  f,
                  vectorProperties,
                  scene,
                ) as Promise<Feature>,
            ),
          );
        });

        it('should set olcs_altitudeMode to absolute', () => {
          absoluteFeatures.forEach((f) => {
            expect(f.get('olcs_altitudeMode')).to.equal('absolute');
          });
        });

        it('should place geometries onto the ground', () => {
          absoluteFeatures.forEach((f, i) => {
            const geometry = f.getGeometry()!;
            if (geometry instanceof Circle) {
              expect(
                Projection.mercatorToWgs84(geometry.getCenter()),
              ).to.have.members([1, 0, 1]);
            } else {
              expect(geometry.getFlatCoordinates()).to.eql(
                inputFeatures[i]
                  .getGeometry()!
                  .getFlatCoordinates()
                  .flatMap((c, j, a) => {
                    if ((j + 1) % 2 === 0) {
                      const mercatorCoordinate = [a[j - 1], a[j]];
                      const wgs84 =
                        Projection.mercatorToWgs84(mercatorCoordinate);
                      return [c, wgs84[0] + wgs84[1]];
                    }
                    return [c];
                  }),
                `coordiantes of ${geometry.getType()} dont match`,
              );
            }
          });
        });
      });

      describe('if they are clamped', () => {
        let vectorProperties: VectorProperties;
        let absoluteFeatures: Feature[];

        before(async () => {
          vectorProperties = new VectorProperties({
            altitudeMode: 'clampToGround',
          });
          absoluteFeatures = await Promise.all(
            inputFeatures.map(
              (f) =>
                createAbsoluteFeature(
                  f,
                  vectorProperties,
                  scene,
                ) as Promise<Feature>,
            ),
          );
        });

        it('should set olcs_altitudeMode to absolute', () => {
          absoluteFeatures.forEach((f) => {
            expect(f.get('olcs_altitudeMode')).to.equal('absolute');
          });
        });

        it('should place geometries onto the ground', () => {
          absoluteFeatures.forEach((f, i) => {
            const geometry = f.getGeometry()!;
            if (geometry instanceof Circle) {
              expect(
                Projection.mercatorToWgs84(geometry.getCenter()),
              ).to.have.members([1, 0, 1]);
            } else {
              expect(geometry.getFlatCoordinates()).to.eql(
                inputFeatures[i]
                  .getGeometry()!
                  .getFlatCoordinates()
                  .flatMap((c, j, a) => {
                    if ((j + 1) % 2 === 0) {
                      const mercatorCoordinate = [a[j - 1], a[j]];
                      const wgs84 =
                        Projection.mercatorToWgs84(mercatorCoordinate);
                      return [c, wgs84[0] + wgs84[1]];
                    }
                    return [c];
                  }),
                `coordiantes of ${geometry.getType()} dont match`,
              );
            }
          });
        });
      });

      describe('if they are relative to ground', () => {
        let expectedHeightForType: Record<
          ReturnType<typeof Geometry.prototype.getType>,
          number[]
        >;

        before(() => {
          expectedHeightForType = {
            Circle: [1.5, 1.5],
            GeometryCollection: [
              2,
              ...new Array<number>(2).fill(3.000057130632186),
              ...new Array<number>(8).fill(9.5138726697935),
              ...new Array<number>(2).fill(3.000057130632186),
              ...new Array<number>(2).fill(4.00030477991453),
            ].reverse(),
            LinearRing: [0],
            MultiLineString: [
              ...new Array<number>(2).fill(3.000057130632186),
              ...new Array<number>(2).fill(4.00030477991453),
            ].reverse(),
            MultiPoint: [2, 4].reverse(),
            MultiPolygon: [
              ...new Array<number>(3).fill(0.6666817105205824),
              ...new Array<number>(6).fill(4.500635759754239),
            ].reverse(),
            Point: [2],
            LineString: new Array<number>(2).fill(3.000057130632186),
            Polygon: new Array<number>(8).fill(9.5138726697935),
          };
        });

        describe('with height above ground set', () => {
          let vectorProperties: VectorProperties;
          let absoluteFeatures: Feature[];

          before(async () => {
            vectorProperties = new VectorProperties({
              altitudeMode: 'relativeToGround',
              heightAboveGround: 5,
            });
            absoluteFeatures = await Promise.all(
              inputFeatures.map(
                (f) =>
                  createAbsoluteFeature(
                    f,
                    vectorProperties,
                    scene,
                  ) as Promise<Feature>,
              ),
            );
          });

          it('should set olcs_altitudeMode to absolute', () => {
            absoluteFeatures.forEach((f) => {
              expect(f.get('olcs_altitudeMode')).to.equal('absolute');
            });
          });

          it('should place geometries above the ground by height above ground', () => {
            absoluteFeatures.forEach((f, i) => {
              const geometry = f.getGeometry()!;
              const expectedHeights =
                expectedHeightForType[geometry.getType()].slice();
              arrayCloseTo(
                geometry.getFlatCoordinates(),
                inputFeatures[i]
                  .getGeometry()!
                  .getFlatCoordinates()
                  .flatMap((c, j) => {
                    if ((j + 1) % 2 === 0) {
                      return [c, (expectedHeights.pop() ?? 0) + 5];
                    }
                    return [c];
                  }),
                undefined,
                ` of ${geometry.getType()} dont match`,
              );
            });
          });
        });

        describe('without height above ground set', () => {
          let vectorProperties: VectorProperties;
          let absoluteFeatures: Feature[];

          before(async () => {
            vectorProperties = new VectorProperties({
              altitudeMode: 'relativeToGround',
            });
            absoluteFeatures = await Promise.all(
              inputFeatures.map(
                (f) =>
                  createAbsoluteFeature(
                    f,
                    vectorProperties,
                    scene,
                  ) as Promise<Feature>,
              ),
            );
          });

          it('should place geometries onto the ground', () => {
            absoluteFeatures.forEach((f, i) => {
              const geometry = f.getGeometry()!;
              const expectedHeights =
                expectedHeightForType[geometry.getType()].slice();
              arrayCloseTo(
                geometry.getFlatCoordinates(),
                inputFeatures[i]
                  .getGeometry()!
                  .getFlatCoordinates()
                  .flatMap((c, j) => {
                    if ((j + 1) % 2 === 0) {
                      return [c, expectedHeights.pop() ?? 0];
                    }
                    return [c];
                  }),
                undefined,
                ` of ${geometry.getType()} dont match`,
              );
            });
          });
        });
      });
    });
  });
});
