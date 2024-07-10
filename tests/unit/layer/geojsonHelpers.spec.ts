import Point from 'ol/geom/Point.js';
import Circle from 'ol/geom/Circle.js';
import Feature from 'ol/Feature.js';
import Polygon from 'ol/geom/Polygon.js';
import {
  Feature as GeoJSONFeature,
  FeatureCollection,
  Geometry as GeoJSONGeometry,
  GeometryCollection as GeoJSONGeometryCollection,
  Point as GeoJSONPoint,
  Polygon as GeojSONPolygon,
} from 'geojson';
import { expect } from 'chai';

import {
  getEPSGCodeFromGeojson,
  parseGeoJSON,
  writeGeoJSON,
  writeGeoJSONFeature,
  updateLegacyFeature,
} from '../../../src/layer/geojsonHelpers.js';
import Projection, {
  mercatorProjection,
  wgs84Projection,
} from '../../../src/util/projection.js';
import { featureStoreStateSymbol } from '../../../src/layer/featureStoreLayerState.js';
import importJSON from '../helpers/importJSON.js';
import { alreadyTransformedToMercator } from '../../../src/layer/vectorSymbols.js';

const testGeoJSON = (await importJSON('./tests/data/testGeoJSON.json')) as {
  geometries: Exclude<GeoJSONGeometry, GeoJSONGeometryCollection>[];
  feature: GeoJSONFeature;
  circle: GeoJSONFeature<GeoJSONPoint> & { radius: number };
  featureCollection: FeatureCollection;
};

describe('GeoJSONLayer', () => {
  let features: Feature[];

  beforeEach(() => {
    features = [
      new Feature({
        name: 'point',
        geometry: new Point([392017.6, 5817532.02, 20]),
      }),
      new Feature({
        name: 'circle',
        geometry: new Circle([392017, 5817532, 0], 28.946, 'XYZ'),
      }),
    ];
  });

  describe('~parseGeoJSON', () => {
    it('should correctly parse a geometry, removing the last vertex of polygons', () => {
      testGeoJSON.geometries.forEach((geomObject) => {
        const text = JSON.stringify(geomObject);
        const [feature] = parseGeoJSON(text, {
          targetProjection: wgs84Projection,
        }).features;
        const geometry = feature.getGeometry();
        let testCoords = geomObject.coordinates;
        if (geomObject.type === 'Polygon') {
          testCoords = geomObject.coordinates.map((coords) => {
            const noEnding = coords.slice();
            noEnding.pop();
            return noEnding;
          });
        } else if (geomObject.type === 'MultiPolygon') {
          testCoords = geomObject.coordinates.map((poly) =>
            poly.map((ring) => {
              const noEnding = ring.slice();
              noEnding.pop();
              return noEnding;
            }),
          );
        }
        expect(geometry?.getCoordinates()).to.have.deep.members(testCoords);
      });
    });

    it('should read a feature', () => {
      const [feature] = parseGeoJSON(JSON.stringify(testGeoJSON.feature), {
        targetProjection: wgs84Projection,
      }).features;
      const properties = feature.getProperties();
      expect(properties).to.have.property('foo', 1);
      expect(properties).to.have.property('bar', 'test');
      expect(feature.getId()).to.equal('test');
      const geometry = feature.getGeometry();
      expect(geometry).to.be.an.instanceOf(Point);
      expect(geometry?.getCoordinates()).to.have.members([1, 1, 1]);
    });

    it('should read geometry in Mercator if no targetProjection is given, also should set alreadyTransformed Symbol', () => {
      const [feature] = parseGeoJSON(
        JSON.stringify(testGeoJSON.feature),
      ).features;
      const geometry = feature.getGeometry();
      expect(geometry).to.be.an.instanceOf(Point);
      expect(geometry?.[alreadyTransformedToMercator]).to.be.true;
      expect(geometry?.getCoordinates()).to.have.members([
        111319.49079327358, 111325.14286638486, 1,
      ]);
    });

    it('should read a circle', () => {
      const [feature] = parseGeoJSON(JSON.stringify(testGeoJSON.circle), {
        targetProjection: wgs84Projection,
      }).features;
      const geometry = feature.getGeometry() as Circle;
      expect(geometry).to.be.an.instanceOf(Circle);
      expect(geometry.getRadius()).to.equal(testGeoJSON.circle.radius);
    });

    it('should read a circle, forceing XYZ layout', () => {
      const twoDCircle = structuredClone(testGeoJSON.circle);
      twoDCircle.geometry.coordinates.pop();
      const [feature] = parseGeoJSON(JSON.stringify(twoDCircle), {
        targetProjection: wgs84Projection,
      }).features;
      const geometry = feature.getGeometry() as Circle;
      expect(geometry).to.be.an.instanceOf(Circle);
      expect(geometry.getRadius()).to.equal(testGeoJSON.circle.radius);
    });

    it('should read a FeatureCollection', () => {
      const parsedFeatures = parseGeoJSON(
        JSON.stringify(testGeoJSON.featureCollection),
      ).features;
      expect(parsedFeatures).to.have.length(2);
      parsedFeatures.forEach((f) => {
        expect(f.get('name')).to.exist;
      });
    });

    it('should set the featureStore state on feature store objects', () => {
      const featureObj: GeoJSONFeature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [0, 0, 1],
        },
        properties: {},
        state: 'dynamic',
      };
      const fArray = parseGeoJSON(featureObj).features;
      expect(fArray).to.have.length(1);
      expect(fArray[0]).to.have.property(featureStoreStateSymbol, 'dynamic');
    });

    it('should exclude features without a geometry', () => {
      const withoutGeometry = {
        type: 'Feature',
        properties: {
          test: true,
        },
      };
      const options: FeatureCollection = {
        type: 'FeatureCollection',
        features: [structuredClone(testGeoJSON.feature)],
      };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      options.features.push(structuredClone(withoutGeometry));
      const feats = parseGeoJSON(options).features;
      expect(feats).to.have.length(1);
      expect(feats[0].get('foo')).to.equal(1);

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const feat = parseGeoJSON(withoutGeometry).features;
      expect(feat).to.be.an('array').and.to.be.empty;
    });

    it('should read the style, adding it to the feature');
    it('should extend the feature style, if using dynamics');
    it('should set custom icons');
    it('should read the layers style');
    it('should read legacy styles');
  });

  describe('writeGeoJsonFeature', () => {
    it('should not write olcs_allowPicking to properties', () => {
      const feat = features[0];
      feat.set('olcs_allowPicking', false);
      const featObj = writeGeoJSONFeature(feat);
      expect(featObj)
        .to.have.property('properties')
        .and.to.not.have.property('olcs_allowPicking');
    });

    it('should not write geometry to properties', () => {
      const feat = features[0];
      feat.set('olcs_allowPicking', false);
      const featObj = writeGeoJSONFeature(feat);
      expect(featObj)
        .to.have.property('properties')
        .and.to.not.have.property('geometry');
    });
    it('should write ID to feature if writeOptions.writeId is set', () => {
      const feat = features[0];
      feat.setId('myId');
      const featObjWithoutId = writeGeoJSONFeature(feat, { writeId: false });
      expect(featObjWithoutId).to.not.have.property('id');
      const featObjWithId = writeGeoJSONFeature(feat, { writeId: true });
      expect(featObjWithId).to.have.property('id').and.to.equal('myId');
    });
  });

  describe('~writeGeoJSON', () => {
    it('should write features to a string', () => {
      const string = writeGeoJSON({ features });
      const json = JSON.parse(string) as FeatureCollection;
      expect(json).to.have.property('type', 'FeatureCollection');
      expect(json).to.have.property('features').and.to.have.length(2);

      const jsonFeatures = json.features;
      jsonFeatures.forEach((f) => {
        expect(f).to.have.property('properties').and.to.have.property('name');
        expect(f)
          .to.have.property('geometry')
          .and.to.have.property('type', 'Point');

        if (f.properties?.name === 'circle') {
          expect(f)
            .to.have.property('geometry')
            .and.to.have.property('olcs_radius')
            .and.to.be.closeTo(20, 0.001);
        }
      });
    });

    it('should write out polygons closed', () => {
      const coords = [
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
      ];

      coords.forEach((ring) => {
        ring.forEach((coord) => {
          Projection.wgs84ToMercator(coord, true);
        });
      });
      const feature = new Feature({
        name: 'circle',
        geometry: new Polygon(coords, 'XYZ'),
      });
      const featureCollection = writeGeoJSON(
        { features: [feature] },
        { asObject: true },
      );
      expect(featureCollection)
        .to.have.property('features')
        .and.to.have.length(1);
      const polygon = testGeoJSON.geometries.find((g) => g.type === 'Polygon');
      expect(featureCollection.features[0])
        .to.have.property('geometry')
        .and.to.have.property('coordinates')
        .and.to.have.deep.members(polygon!.coordinates);
    });

    it('should write feature styles');
    it('should write layer styles');
    it('should embed custom icons');
  });

  describe('~write/parseGeoJSON', () => {
    it('should parse what has been written', () => {
      const written = writeGeoJSON({ features });
      const parsedAgain = parseGeoJSON(written, {
        targetProjection: mercatorProjection,
      });
      expect(parsedAgain).to.have.property('features').to.have.length(2);
      parsedAgain.features.forEach((f, i) => {
        const original = features[i];
        expect(f.get('name')).to.equal(original.get('name'));
        const geom = f.getGeometry();
        const originalGeom = original.getGeometry();
        expect(geom?.getType()).to.equal(originalGeom?.getType());
        if (geom?.getType() !== 'Circle') {
          expect(
            (geom as Point).getCoordinates().map((c) => Math.round(c)),
          ).to.have.deep.members(
            (originalGeom as Point).getCoordinates().map((c) => Math.round(c)),
          );
        } else {
          expect(
            (geom as Circle).getCenter().map((c) => Math.round(c)),
          ).to.have.deep.members(
            (originalGeom as Circle).getCenter().map((c) => Math.round(c)),
          );
          expect((geom as Circle).getRadius()).to.be.closeTo(
            (originalGeom as Circle).getRadius(),
            0.00001,
          );
        }
      });
    });
  });

  describe('getEPSGCodeFromGeojson', () => {
    it('should parse crs from old 0.8 geojson', () => {
      const geojson: FeatureCollection = {
        type: 'FeatureCollection',
        crs: {
          type: 'name',
          properties: {
            name: 'EPSG:25832',
          },
        },
        features: [],
      };
      expect(getEPSGCodeFromGeojson(geojson)).to.equal('EPSG:25832');
    });
    it('should parse crs from old 0.8 geojson if only epsg code is set', () => {
      const geojson: FeatureCollection = {
        type: 'FeatureCollection',
        crs: {
          type: 'EPSG',
          properties: {
            code: '25832',
          },
        },
        features: [],
      };
      expect(getEPSGCodeFromGeojson(geojson)).to.equal('EPSG:25832');
    });
    it('should return null, if no valid crs definition is found', () => {
      const geojson = {
        crs: {
          notvalid: true,
        },
      };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(getEPSGCodeFromGeojson(geojson)).to.equal(null);
    });
  });

  describe('updateLegacyFeature', () => {
    it('should update legacy 3.4 extruded heights correctly', () => {
      const feature = new Feature({
        geometry: new Polygon([
          [
            [4.472404169852551, 51.90566886796559],
            [4.471902575347758, 51.90568433758505],
            [4.471902575347758, 51.90568433758505],
            [4.47147602187269, 51.90542997359516],
            [4.4717330905952934, 51.904883784475246],
            [4.472984942240982, 51.905165587752684],
            [4.472404169852551, 51.90566886796559],
          ],
        ]),
        drawingType: 'polygon',
        color: [255, 151, 0],
        opacity: 0.8,
        altitudeMode: 'clampToGround',
        extrudedHeight: 20,
      });

      updateLegacyFeature(feature);
      expect(feature.get('olcs_altitudeMode')).to.equal('clampToGround');
      expect(feature.get('olcs_extrudedHeight')).to.equal(20);
    });

    it('should update legacy 3.5 extruded absolute heights correctly', () => {
      const feature = new Feature({
        altitudeMode: 'absolute',
        allowPicking: true,
        extrudedHeight: 119.49952175519141,
        skirt: 5,
        geometry: new Polygon([
          [
            [7.687832228411122, 51.53441657199687, 109.49952175519141],
            [7.687127714734608, 51.53441657199687, 109.94002081544221],
            [7.687127714734608, 51.53400717019798, 110.9365584493321],
            [7.687832228411122, 51.53400717019798, 110.34990194214842],
            [7.687832228411122, 51.53441657199687, 109.49952175519141],
          ],
        ]),
      });

      updateLegacyFeature(feature);
      expect(feature.get('olcs_altitudeMode')).to.equal('absolute');
      expect(feature.get('olcs_extrudedHeight')).to.equal(10);
      expect(feature.get('olcs_skirt')).to.equal(5);
    });
  });

  describe('XY layout data', () => {
    describe('parsing of XY layout data', () => {
      it('should parse a geojson feature', () => {
        const geojsonFeature: GeoJSONFeature = {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: [0, 0],
          },
        };
        const [olFeature] = parseGeoJSON(geojsonFeature).features;
        expect(olFeature.getGeometry()?.getLayout()).to.equal('XY');
      });

      it('should parse a geojson circle', () => {
        const geojsonFeature: GeoJSONFeature = {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: [0, 0],
            olcs_radius: 12,
          },
        };
        const [olFeature] = parseGeoJSON(geojsonFeature).features;
        expect(olFeature.getGeometry()).to.be.an.instanceOf(Circle);
        expect(olFeature.getGeometry()?.getLayout()).to.equal('XY');
      });
    });

    describe('writing of XY layout data', () => {
      it('should write ol feature', () => {
        const feature = new Feature({
          geometry: new Point([0, 0], 'XY'),
        });
        const string = writeGeoJSON({ features: [feature] });
        const fc = JSON.parse(string) as FeatureCollection;
        expect(fc.features).to.have.lengthOf(1);
        expect(
          (fc.features[0] as GeoJSONFeature<GeoJSONPoint>).geometry
            ?.coordinates,
        ).to.have.members([0, 0]);
      });

      it('should write a circle', () => {
        const feature = new Feature({
          geometry: new Circle([0, 0], 12),
        });
        const string = writeGeoJSON({ features: [feature] });
        const fc = JSON.parse(string) as FeatureCollection;
        expect(fc.features).to.have.lengthOf(1);
        expect(
          (fc.features[0] as GeoJSONFeature<GeoJSONPoint>).geometry
            ?.coordinates,
        ).to.have.members([0, 0]);
        expect(fc.features).to.have.lengthOf(1);
        expect((fc.features[0] as GeoJSONFeature<GeoJSONPoint>).geometry)
          .to.have.property('olcs_radius')
          .and.to.be.closeTo(12, 0.1);
      });

      it('should write a polygon', () => {
        const feature = new Feature({
          geometry: new Polygon(
            [
              [
                [0, 0],
                [1, 0],
                [1, 1],
              ].map((c) => Projection.wgs84ToMercator(c)),
            ],
            'XY',
          ),
        });
        const string = writeGeoJSON({ features: [feature] });
        const fc = JSON.parse(string) as FeatureCollection;
        expect(fc.features).to.have.lengthOf(1);
        expect(
          (fc.features[0] as GeoJSONFeature<GeojSONPolygon>).geometry
            .coordinates,
        ).to.have.deep.members([
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ]);
      });
    });
  });
});
