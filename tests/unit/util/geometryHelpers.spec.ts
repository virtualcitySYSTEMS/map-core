import { expect } from 'chai';
import Circle from 'ol/geom/Circle.js';
import Polygon from 'ol/geom/Polygon.js';
import Point from 'ol/geom/Point.js';
import MultiPoint from 'ol/geom/MultiPoint.js';
import MultiPolygon from 'ol/geom/MultiPolygon.js';
import LineString from 'ol/geom/LineString.js';
import MultiLineString from 'ol/geom/MultiLineString.js';
import GeometryCollection from 'ol/geom/GeometryCollection.js';
import { Coordinate } from 'ol/coordinate.js';
import { Cartographic, HeightReference, Scene } from '@vcmap-cesium/engine';
import {
  circleFromCenterRadius,
  convertGeometryToPolygon,
  from2Dto3DLayout,
  from3Dto2DLayout,
  getFlatCoordinatesFromGeometry,
  getFlatCoordinatesFromSimpleGeometry,
} from '../../../src/util/geometryHelpers.js';
import { getMockScene } from '../helpers/cesiumHelpers.js';

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
      Point: Point;
      LineString: LineString;
      MultiPoint: MultiPoint;
      Polygon: Polygon;
      MultiLineString: MultiLineString;
      Circle: Circle;
      MultiPolygon: MultiPolygon;
      GeometryCollection: GeometryCollection;
    };
    let keys: (keyof typeof geometries)[];
    let flatCoordinates: Record<string, Coordinate[]>;
    before(() => {
      geometries = {
        Point: new Point([1, 1, 1]),
        LineString: new LineString([
          [1, 1, 1],
          [2, 2, 2],
        ]),
        MultiPoint: new MultiPoint([
          [1, 1, 1],
          [2, 2, 2],
        ]),
        Polygon: new Polygon([
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
        MultiLineString: new MultiLineString([
          [
            [1, 1, 1],
            [2, 2, 2],
          ],
          [
            [1, 1, 1],
            [3, 3, 3],
          ],
        ]),
        Circle: new Circle([0, 0, 0], 1, 'XYZ'),
        MultiPolygon: new MultiPolygon([
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
        GeometryCollection: new GeometryCollection([]),
      };
      geometries.GeometryCollection = new GeometryCollection([
        geometries.Point.clone(),
        geometries.LineString.clone(),
        geometries.Polygon.clone(),
        geometries.MultiLineString.clone(),
        geometries.Circle.clone(),
      ]);
      keys = Object.keys(geometries) as (keyof typeof geometries)[];
      flatCoordinates = {
        Point: [[1, 1, 1]],
        LineString: [
          [1, 1, 1],
          [2, 2, 2],
        ],
        MultiPoint: [
          [1, 1, 1],
          [2, 2, 2],
        ],
        Polygon: [
          [0, 0, 0],
          [10, 0, 0],
          [10, 10, 0],
          [0, 10, 0],
          [2, 2, 0],
          [0, 8, 0],
          [8, 8, 0],
          [8, 0, 0],
        ],
        MultiLineString: [
          [1, 1, 1],
          [2, 2, 2],
          [1, 1, 1],
          [3, 3, 3],
        ],
        Circle: [
          [0, 0, 0],
          [1, 0, 0],
        ],
        MultiPolygon: [
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
      };
      flatCoordinates.GeometryCollection = [
        flatCoordinates.Point,
        flatCoordinates.LineString,
        flatCoordinates.Polygon,
        flatCoordinates.MultiLineString,
        flatCoordinates.Circle,
      ].flat();
    });

    it('should get the flat coordinates of a geometry', () => {
      keys.forEach((key) => {
        const coords = getFlatCoordinatesFromGeometry(geometries[key]);
        expect(coords).to.have.deep.members(flatCoordinates[key]);
      });
    });

    it('should get the flat coordinates with a reference to the original', () => {
      keys.forEach((key) => {
        const coords =
          key === 'Circle'
            ? [
                geometries[key].getFirstCoordinate(),
                geometries[key].getLastCoordinate(),
              ]
            : geometries[key].getCoordinates();
        const flats = getFlatCoordinatesFromGeometry(geometries[key], coords);
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
});
