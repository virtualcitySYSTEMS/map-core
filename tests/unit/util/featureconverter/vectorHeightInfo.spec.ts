import Feature from 'ol/Feature.js';
import { LineString, Point } from 'ol/geom.js';
import { Coordinate } from 'ol/coordinate.js';
import { expect } from 'chai';
import { HeightReference } from '@vcmap-cesium/engine';
import VectorProperties, {
  PrimitiveOptionsType,
} from '../../../../src/layer/vectorProperties.js';
import {
  getGeometryHeight,
  getHeightInfo,
  mercatorToWgs84TransformerForHeightInfo,
  RelativeHeightReference,
  VectorHeightInfo,
} from '../../../../src/util/featureconverter/vectorHeightInfo.js';
import Projection from '../../../../src/util/projection.js';
import { arrayCloseTo } from '../../helpers/helpers.js';

describe('VectorHeightInfo', () => {
  describe('getHeightInfo', () => {
    let vectorProperties: VectorProperties;

    before(() => {
      vectorProperties = new VectorProperties({});
    });

    after(() => {
      vectorProperties.destroy();
    });

    describe('XY layout', () => {
      let geometry: Point;
      let feature: Feature;

      beforeEach(() => {
        geometry = new Point([0, 0]);
        feature = new Feature({
          geometry,
        });
      });

      describe('clamped height reference', () => {
        beforeEach(() => {
          feature.set('olcs_altitudeMode', 'clampToGround');
        });

        it('should return clamped height info', () => {
          const heightInfo = getHeightInfo(feature, geometry, vectorProperties);
          expect(heightInfo.heightReference).to.equal(
            HeightReference.CLAMP_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XY');
        });

        it('should change the reference to relative to ground with height above ground of 0 if the geometry is extruded', () => {
          feature.set('olcs_extrudedHeight', 20);

          const heightInfo = getHeightInfo(
            feature,
            geometry,
            vectorProperties,
          ) as VectorHeightInfo<RelativeHeightReference>;
          expect(heightInfo.heightReference).to.equal(
            HeightReference.RELATIVE_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XY');
          expect(heightInfo.heightAboveGround).to.equal(0);
          expect(heightInfo.extruded).to.be.true;
        });

        it('should change the reference to relative to ground with height above ground of 0 if the point is a model', () => {
          feature.set('olcs_modelUrl', 'foo.glb');
          const heightInfo = getHeightInfo(
            feature,
            geometry,
            vectorProperties,
          ) as VectorHeightInfo<RelativeHeightReference>;
          expect(heightInfo.heightReference).to.equal(
            HeightReference.RELATIVE_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XY');
          expect(heightInfo.heightAboveGround).to.equal(0);
        });

        it('should not change the reference to relative to ground, if the geometry is not a point but a model url is set', () => {
          feature.set('olcs_modelUrl', 'foo.glb');
          const heightInfo = getHeightInfo(
            feature,
            new LineString([
              [0, 0],
              [1, 1],
            ]),
            vectorProperties,
          );
          expect(heightInfo.heightReference).to.equal(
            HeightReference.CLAMP_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XY');
        });

        it('should change the reference to relative to ground with height above ground of 0 if the point is a primitive', () => {
          feature.set('olcs_primitiveOptions', {
            geometryOptions: {
              type: PrimitiveOptionsType.SPHERE,
              radius: 5,
            },
          });
          const heightInfo = getHeightInfo(
            feature,
            geometry,
            vectorProperties,
          ) as VectorHeightInfo<RelativeHeightReference>;
          expect(heightInfo.heightReference).to.equal(
            HeightReference.RELATIVE_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XY');
          expect(heightInfo.heightAboveGround).to.equal(0);
        });

        it('should not change the reference to relative to ground, if the geometry is not a point but primitive options is set', () => {
          feature.set('olcs_primitiveOptions', {
            geometryOptions: {
              type: PrimitiveOptionsType.SPHERE,
              radius: 5,
            },
          });
          const heightInfo = getHeightInfo(
            feature,
            new LineString([
              [0, 0],
              [1, 1],
            ]),
            vectorProperties,
          );
          expect(heightInfo.heightReference).to.equal(
            HeightReference.CLAMP_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XY');
        });
      });

      describe('relative height reference', () => {
        beforeEach(() => {
          feature.set('olcs_altitudeMode', 'relativeToGround');
        });

        it('should return relative height info, defaulting to height above ground of 0', () => {
          const heightInfo = getHeightInfo(
            feature,
            geometry,
            vectorProperties,
          ) as VectorHeightInfo<RelativeHeightReference>;
          expect(heightInfo.heightReference).to.equal(
            HeightReference.RELATIVE_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XY');
          expect(heightInfo.heightAboveGround).to.equal(0);
        });

        it('should use height above ground provided', () => {
          feature.set('olcs_heightAboveGround', 10);
          const heightInfo = getHeightInfo(
            feature,
            geometry,
            vectorProperties,
          ) as VectorHeightInfo<RelativeHeightReference>;
          expect(heightInfo.heightReference).to.equal(
            HeightReference.RELATIVE_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XY');
          expect(heightInfo.heightAboveGround).to.equal(10);
        });
      });

      describe('absolute height reference', () => {
        beforeEach(() => {
          feature.set('olcs_altitudeMode', 'absolute');
        });

        it('should return absolute height info if ground level is provided', () => {
          feature.set('olcs_groundLevel', 0);
          const heightInfo = getHeightInfo(feature, geometry, vectorProperties);
          expect(heightInfo.heightReference).to.equal(HeightReference.NONE);
          expect(heightInfo.layout).to.equal('XY');
        });

        it('should set the height reference to clamp to ground', () => {
          const heightInfo = getHeightInfo(feature, geometry, vectorProperties);
          expect(heightInfo.heightReference).to.equal(
            HeightReference.CLAMP_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XY');
        });

        it('should set the height reference to relative to ground with height above ground 0, if extruded', () => {
          feature.set('olcs_extrudedHeight', 20);
          const heightInfo = getHeightInfo(
            feature,
            geometry,
            vectorProperties,
          ) as VectorHeightInfo<RelativeHeightReference>;
          expect(heightInfo.heightReference).to.equal(
            HeightReference.RELATIVE_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XY');
          expect(heightInfo.heightAboveGround).to.equal(0);
        });

        it('should set the height reference to relative to ground with height above ground of 0 if the point is a model', () => {
          feature.set('olcs_modelUrl', 'foo.glb');
          const heightInfo = getHeightInfo(
            feature,
            geometry,
            vectorProperties,
          ) as VectorHeightInfo<RelativeHeightReference>;
          expect(heightInfo.heightReference).to.equal(
            HeightReference.RELATIVE_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XY');
          expect(heightInfo.heightAboveGround).to.equal(0);
        });

        it('should set the height reference to clamp to ground, if the geometry is not a point but a model url is set', () => {
          feature.set('olcs_modelUrl', 'foo.glb');
          const heightInfo = getHeightInfo(
            feature,
            new LineString([
              [0, 0],
              [1, 1],
            ]),
            vectorProperties,
          );
          expect(heightInfo.heightReference).to.equal(
            HeightReference.CLAMP_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XY');
        });

        it('should set the height reference to relative to ground with height above ground of 0 if the point is a primitive', () => {
          feature.set('olcs_primitiveOptions', {
            geometryOptions: {
              type: PrimitiveOptionsType.SPHERE,
              radius: 5,
            },
          });
          const heightInfo = getHeightInfo(
            feature,
            geometry,
            vectorProperties,
          ) as VectorHeightInfo<RelativeHeightReference>;
          expect(heightInfo.heightReference).to.equal(
            HeightReference.RELATIVE_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XY');
          expect(heightInfo.heightAboveGround).to.equal(0);
        });

        it('should set the height reference to clamp to ground, if the geometry is not a point but primitive options is set', () => {
          feature.set('olcs_primitiveOptions', {
            geometryOptions: {
              type: PrimitiveOptionsType.SPHERE,
              radius: 5,
            },
          });
          const heightInfo = getHeightInfo(
            feature,
            new LineString([
              [0, 0],
              [1, 1],
            ]),
            vectorProperties,
          );
          expect(heightInfo.heightReference).to.equal(
            HeightReference.CLAMP_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XY');
        });
      });
    });

    describe('XYZ layout', () => {
      let geometry: Point;
      let feature: Feature;

      beforeEach(() => {
        geometry = new Point([0, 0, 0]);
        feature = new Feature({
          geometry,
        });
      });

      describe('clamped height reference', () => {
        beforeEach(() => {
          feature.set('olcs_altitudeMode', 'clampToGround');
        });

        it('should return clamped height info', () => {
          const heightInfo = getHeightInfo(feature, geometry, vectorProperties);
          expect(heightInfo.heightReference).to.equal(
            HeightReference.CLAMP_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XYZ');
        });

        it('should change the reference to relative to ground with height above ground of 0 if the geometry is extruded', () => {
          feature.set('olcs_extrudedHeight', 20);

          const heightInfo = getHeightInfo(
            feature,
            geometry,
            vectorProperties,
          ) as VectorHeightInfo<RelativeHeightReference>;
          expect(heightInfo.heightReference).to.equal(
            HeightReference.RELATIVE_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XYZ');
          expect(heightInfo.heightAboveGround).to.equal(0);
          expect(heightInfo.extruded).to.be.true;
        });

        it('should change the reference to relative to ground with height above ground of 0 if the point is a model', () => {
          feature.set('olcs_modelUrl', 'foo.glb');
          const heightInfo = getHeightInfo(
            feature,
            geometry,
            vectorProperties,
          ) as VectorHeightInfo<RelativeHeightReference>;
          expect(heightInfo.heightReference).to.equal(
            HeightReference.RELATIVE_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XYZ');
          expect(heightInfo.heightAboveGround).to.equal(0);
        });

        it('should not change the reference to relative to ground, if the geometry is not a point but a model url is set', () => {
          feature.set('olcs_modelUrl', 'foo.glb');
          const heightInfo = getHeightInfo(
            feature,
            new LineString([
              [0, 0, 0],
              [1, 1, 1],
            ]),
            vectorProperties,
          );
          expect(heightInfo.heightReference).to.equal(
            HeightReference.CLAMP_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XYZ');
        });

        it('should change the reference to relative to ground with height above ground of 0 if the point is a primitive', () => {
          feature.set('olcs_primitiveOptions', {
            geometryOptions: {
              type: PrimitiveOptionsType.SPHERE,
              radius: 5,
            },
          });
          const heightInfo = getHeightInfo(
            feature,
            geometry,
            vectorProperties,
          ) as VectorHeightInfo<RelativeHeightReference>;
          expect(heightInfo.heightReference).to.equal(
            HeightReference.RELATIVE_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XYZ');
          expect(heightInfo.heightAboveGround).to.equal(0);
        });

        it('should not change the reference to relative to ground, if the geometry is not a point but primitive options is set', () => {
          feature.set('olcs_primitiveOptions', {
            geometryOptions: {
              type: PrimitiveOptionsType.SPHERE,
              radius: 5,
            },
          });
          const heightInfo = getHeightInfo(
            feature,
            new LineString([
              [0, 0, 0],
              [1, 1, 1],
            ]),
            vectorProperties,
          );
          expect(heightInfo.heightReference).to.equal(
            HeightReference.CLAMP_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XYZ');
        });
      });

      describe('relative height reference', () => {
        beforeEach(() => {
          feature.set('olcs_altitudeMode', 'relativeToGround');
        });

        it('should return relative height info, without setting height above ground', () => {
          const heightInfo = getHeightInfo(
            feature,
            geometry,
            vectorProperties,
          ) as VectorHeightInfo<RelativeHeightReference>;
          expect(heightInfo.heightReference).to.equal(
            HeightReference.RELATIVE_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XYZ');
          expect(heightInfo.heightAboveGround).to.be.undefined;
        });

        it('should use height above ground provided', () => {
          feature.set('olcs_heightAboveGround', 10);
          const heightInfo = getHeightInfo(
            feature,
            geometry,
            vectorProperties,
          ) as VectorHeightInfo<RelativeHeightReference>;
          expect(heightInfo.heightReference).to.equal(
            HeightReference.RELATIVE_TO_GROUND,
          );
          expect(heightInfo.layout).to.equal('XYZ');
          expect(heightInfo.heightAboveGround).to.equal(10);
        });
      });

      describe('absolute height reference', () => {
        beforeEach(() => {
          feature.set('olcs_altitudeMode', 'absolute');
        });

        it('should return absolute height info', () => {
          const heightInfo = getHeightInfo(feature, geometry, vectorProperties);
          expect(heightInfo.heightReference).to.equal(HeightReference.NONE);
          expect(heightInfo.layout).to.equal('XYZ');
        });

        it('should be absolute even if extruded', () => {
          feature.set('olcs_extrudedHeight', 20);
          const heightInfo = getHeightInfo(feature, geometry, vectorProperties);
          expect(heightInfo.heightReference).to.equal(HeightReference.NONE);
          expect(heightInfo.layout).to.equal('XYZ');
        });

        it('should be absolute even if the point is a model', () => {
          feature.set('olcs_modelUrl', 'foo.glb');
          const heightInfo = getHeightInfo(feature, geometry, vectorProperties);
          expect(heightInfo.heightReference).to.equal(HeightReference.NONE);
          expect(heightInfo.layout).to.equal('XYZ');
        });

        it('should be absolute even if the point is a primitive', () => {
          feature.set('olcs_primitiveOptions', {
            geometryOptions: {
              type: PrimitiveOptionsType.SPHERE,
              radius: 5,
            },
          });
          const heightInfo = getHeightInfo(feature, geometry, vectorProperties);
          expect(heightInfo.heightReference).to.equal(HeightReference.NONE);
          expect(heightInfo.layout).to.equal('XYZ');
        });

        it('should extract the minimum z value as the groundLevelOrMinHeight from the coordinates', () => {
          const heightInfo = getHeightInfo(
            feature,
            new LineString([
              [1, 1, 0],
              [2, 2, 5],
              [1, 2, -3],
            ]),
            vectorProperties,
          ) as VectorHeightInfo<HeightReference.NONE>;
          expect(heightInfo.groundLevelOrMinHeight).to.equal(-3);
        });
      });
    });

    describe('extrusion handling', () => {
      let geometry: Point;

      before(() => {
        geometry = new Point([1, 1, 1]);
      });

      it('storeys above and below ground above 100 should be set to 100', () => {
        const feature = new Feature({
          geometry,
          olcs_storeysAboveGround: 150,
          olcs_storeyHeightsAboveGround: 150,
          olcs_storeysBelowGround: 150,
          olcs_storeyHeightsBelowGround: 150,
        });
        const heightInfo = getHeightInfo(
          feature,
          geometry,
          vectorProperties,
        ) as VectorHeightInfo<RelativeHeightReference>;
        expect(heightInfo.extruded).to.equal(true);
        expect(heightInfo.storeyHeightsAboveGround).to.have.lengthOf(100);
        expect(heightInfo.storeyHeightsBelowGround).to.have.lengthOf(100);
      });

      it('if storeysAboveGround or storeysBelowGround without storeyHeight is set, it should return 0', () => {
        const feature = new Feature({
          geometry,
          olcs_altitudeMode: 'absolute',
          olcs_storeysAboveGround: 1,
          olcs_storeysBelowGround: 1,
        });
        const heightInfo = getHeightInfo(
          feature,
          geometry,
          vectorProperties,
        ) as VectorHeightInfo<RelativeHeightReference>;
        expect(heightInfo.extruded).to.equal(false);
        expect(heightInfo.storeyHeightsAboveGround).to.be.empty;
        expect(heightInfo.storeyHeightsBelowGround).to.be.empty;
      });

      it('if only one storeyHeight is set, it should return 0', () => {
        const feature = new Feature({
          geometry,
          olcs_altitudeMode: 'absolute',
          olcs_storeyHeightsAboveGround: [1],
          olcs_storeyHeightsBelowGround: [1],
        });
        const heightInfo = getHeightInfo(
          feature,
          geometry,
          vectorProperties,
        ) as VectorHeightInfo<RelativeHeightReference>;
        expect(heightInfo.extruded).to.equal(false);
        expect(heightInfo.storeyHeightsAboveGround).to.be.empty;
        expect(heightInfo.storeyHeightsBelowGround).to.be.empty;
      });
    });

    describe('calculating clamp origin', () => {
      let geometry: Point;
      let feature: Feature;

      beforeEach(() => {
        geometry = new Point([0, 0, 0]);
        feature = new Feature({
          olcs_altitudeMode: 'relativeToGround',
          geometry,
        });
      });

      it('should return undefined if a ground level is given', () => {
        feature.set('olcs_groundLevel', 0);
        const heightInfo = getHeightInfo(
          feature,
          geometry,
          vectorProperties,
        ) as VectorHeightInfo<RelativeHeightReference>;
        expect(heightInfo.clampOrigin).to.be.undefined;
      });

      it('should calculate the centroid of a geometry', () => {
        const heightInfo = getHeightInfo(
          feature,
          new LineString([
            [0, 0, 0],
            [1, 1, 0],
          ]),
          vectorProperties,
        ) as VectorHeightInfo<RelativeHeightReference>;
        expect(heightInfo.clampOrigin).to.have.members([0.5, 0.5]);
      });
    });
    describe('determining per position height', () => {
      describe('of an absolute height reference', () => {
        let geometry: Point;
        let feature: Feature;

        beforeEach(() => {
          geometry = new Point([0, 0, 0]);
          feature = new Feature({
            olcs_altitudeMode: 'absolute',
            geometry,
          });
        });

        it('should set per PositionHeight to true, if a z coordinate is given', () => {
          const heightInfo = getHeightInfo(
            feature,
            geometry,
            vectorProperties,
          ) as VectorHeightInfo<HeightReference.NONE>;
          expect(heightInfo.perPositionHeight).to.equal(true);
        });

        it('should set per PositionHeight to false, if a z coordinate is given and more than 1 storeys', () => {
          feature.set('olcs_storeysAboveGround', 10);
          feature.set('olcs_storeyHeightsAboveGround', 10);

          const heightInfo = getHeightInfo(
            feature,
            geometry,
            vectorProperties,
          ) as VectorHeightInfo<HeightReference.NONE>;
          expect(heightInfo.perPositionHeight).to.equal(false);
        });

        it('should set per PositionHeight to false, if ground level is given, even if a z coordinate is given', () => {
          feature.set('olcs_groundLevel', 12);
          const heightInfo = getHeightInfo(
            feature,
            geometry,
            vectorProperties,
          ) as VectorHeightInfo<HeightReference.NONE>;
          expect(heightInfo.perPositionHeight).to.equal(false);
        });
      });

      describe('of a relative height reference', () => {
        let geometry: Point;
        let feature: Feature;

        beforeEach(() => {
          geometry = new Point([0, 0, 0]);
          feature = new Feature({
            olcs_altitudeMode: 'relativeToGround',
            geometry,
          });
        });

        it('should set per PositionHeight to true, if a z coordinate is given', () => {
          const heightInfo = getHeightInfo(
            feature,
            geometry,
            vectorProperties,
          ) as VectorHeightInfo<RelativeHeightReference>;
          expect(heightInfo.perPositionHeight).to.equal(true);
        });

        it('should set per PositionHeight to false, if a z coordinate is given and more than 1 storeys', () => {
          feature.set('olcs_storeysAboveGround', 10);
          feature.set('olcs_storeyHeightsAboveGround', 10);

          const heightInfo = getHeightInfo(
            feature,
            geometry,
            vectorProperties,
          ) as VectorHeightInfo<RelativeHeightReference>;
          expect(heightInfo.perPositionHeight).to.equal(false);
        });

        it('should not set perPositonHeight to false, if ground level is given', () => {
          feature.set('olcs_groundLevel', 12);
          const heightInfo = getHeightInfo(
            feature,
            geometry,
            vectorProperties,
          ) as VectorHeightInfo<HeightReference.NONE>;
          expect(heightInfo.perPositionHeight).to.equal(true);
        });

        it('should set perPositionHeight to false, if heightAboveGround is provided', () => {
          feature.set('olcs_heightAboveGround', 12);
          const heightInfo = getHeightInfo(
            feature,
            geometry,
            vectorProperties,
          ) as VectorHeightInfo<HeightReference.NONE>;
          expect(heightInfo.perPositionHeight).to.equal(false);
        });
      });
    });
  });

  describe('getGeometryHeight', () => {
    let geometry: LineString;

    before(() => {
      geometry = new LineString([
        [1, 1, 0],
        [1, 2, -3],
        [2, 2, 2],
      ]);
    });

    it('should return 0 for clamped height info', () => {
      const height = getGeometryHeight(geometry, {
        heightReference: HeightReference.CLAMP_TO_TERRAIN,
        layout: 'XYZ',
      });
      expect(height).to.equal(0);
    });

    it('should return groundLevelOrMinHeight for absolute height info', () => {
      const heightInfo: VectorHeightInfo<HeightReference.NONE> = {
        extruded: false,
        groundLevelOrMinHeight: 10,
        perPositionHeight: false,
        skirt: 0,
        storeyHeightsAboveGround: [],
        storeyHeightsBelowGround: [],
        heightReference: HeightReference.NONE,
        layout: 'XYZ',
      };
      const height = getGeometryHeight(geometry, heightInfo);
      expect(height).to.equal(10);
    });

    it('should return height above ground if set', () => {
      const heightInfo: VectorHeightInfo<RelativeHeightReference> = {
        clampOrigin: [0, 0],
        extruded: false,
        groundLevel: 0,
        skirt: 0,
        storeyHeightsAboveGround: [],
        perPositionHeight: false,
        storeyHeightsBelowGround: [],
        heightAboveGround: 20,
        heightReference: HeightReference.RELATIVE_TO_TERRAIN,
        layout: 'XYZ',
      };
      const height = getGeometryHeight(geometry, heightInfo);
      expect(height).to.equal(20);
    });

    it('should return min height, if height above ground is not set', () => {
      const heightInfo: VectorHeightInfo<RelativeHeightReference> = {
        clampOrigin: [0, 0],
        extruded: false,
        groundLevel: 0,
        skirt: 0,
        storeyHeightsAboveGround: [],
        perPositionHeight: false,
        storeyHeightsBelowGround: [],
        heightReference: HeightReference.RELATIVE_TO_TERRAIN,
        layout: 'XYZ',
      };
      const height = getGeometryHeight(geometry, heightInfo);
      expect(height).to.equal(-3);
    });

    it('should adjust height above ground with ground level', () => {
      const heightInfo: VectorHeightInfo<RelativeHeightReference> = {
        clampOrigin: [0, 0],
        extruded: false,
        groundLevel: 10,
        skirt: 0,
        storeyHeightsAboveGround: [],
        perPositionHeight: false,
        storeyHeightsBelowGround: [],
        heightAboveGround: 20,
        heightReference: HeightReference.RELATIVE_TO_TERRAIN,
        layout: 'XYZ',
      };
      const height = getGeometryHeight(geometry, heightInfo);
      expect(height).to.equal(30);
    });

    it('should adjust height above ground with min level, if height above ground is not defined', () => {
      const heightInfo: VectorHeightInfo<RelativeHeightReference> = {
        clampOrigin: [0, 0],
        extruded: false,
        groundLevel: 10,
        skirt: 0,
        storeyHeightsAboveGround: [],
        perPositionHeight: false,
        storeyHeightsBelowGround: [],
        heightReference: HeightReference.RELATIVE_TO_TERRAIN,
        layout: 'XYZ',
      };
      const height = getGeometryHeight(geometry, heightInfo);
      expect(height).to.equal(7);
    });
  });

  describe('mercatorToWgs84TransformerForHeightInfo', () => {
    let input2DCoordinate: Coordinate;
    let expected2DCoordinate: Coordinate;

    before(() => {
      expected2DCoordinate = [13, 52];
      input2DCoordinate = Projection.wgs84ToMercator(expected2DCoordinate);
    });

    describe('of a clamped height info', () => {
      it('should return 2D coordinates with height 0', () => {
        const transformer = mercatorToWgs84TransformerForHeightInfo({
          heightReference: HeightReference.CLAMP_TO_GROUND,
          layout: 'XY',
        });
        const output = transformer(input2DCoordinate);
        arrayCloseTo(output, [...expected2DCoordinate, 0]);
      });

      it('should maintain 3D height, if given a 3D coordinates', () => {
        const transformer = mercatorToWgs84TransformerForHeightInfo({
          heightReference: HeightReference.CLAMP_TO_GROUND,
          layout: 'XYZ',
        });
        const output = transformer([...input2DCoordinate, 2]);
        arrayCloseTo(output, [...expected2DCoordinate, 2]);
      });
    });

    describe('of relative height info', () => {
      it('should maintain 3D height, if given a 3D coordinates', () => {
        const transformer = mercatorToWgs84TransformerForHeightInfo({
          clampOrigin: [0, 0],
          extruded: false,
          groundLevel: 0,
          skirt: 0,
          storeyHeightsAboveGround: [],
          perPositionHeight: false,
          storeyHeightsBelowGround: [],
          heightReference: HeightReference.RELATIVE_TO_TERRAIN,
          layout: 'XYZ',
        });
        const output = transformer([...input2DCoordinate, 2]);
        arrayCloseTo(output, [...expected2DCoordinate, 2]);
      });

      it('should set height above ground as Z', () => {
        const transformer = mercatorToWgs84TransformerForHeightInfo({
          clampOrigin: [0, 0],
          extruded: false,
          groundLevel: 0,
          skirt: 0,
          storeyHeightsAboveGround: [],
          perPositionHeight: false,
          storeyHeightsBelowGround: [],
          heightAboveGround: 10,
          heightReference: HeightReference.RELATIVE_TO_TERRAIN,
          layout: 'XYZ',
        });
        const output = transformer([...input2DCoordinate, 2]);
        arrayCloseTo(output, [...expected2DCoordinate, 10]);
      });

      it('should adjust height above ground height with ground level, if provided', () => {
        const transformer = mercatorToWgs84TransformerForHeightInfo({
          clampOrigin: [0, 0],
          extruded: false,
          groundLevel: 10,
          skirt: 0,
          storeyHeightsAboveGround: [],
          perPositionHeight: false,
          storeyHeightsBelowGround: [],
          heightAboveGround: 10,
          heightReference: HeightReference.RELATIVE_TO_TERRAIN,
          layout: 'XYZ',
        });
        const output = transformer([...input2DCoordinate, 2]);
        arrayCloseTo(output, [...expected2DCoordinate, 20]);
      });

      it('should adjust Z height with ground level, if provided', () => {
        const transformer = mercatorToWgs84TransformerForHeightInfo({
          clampOrigin: [0, 0],
          extruded: false,
          groundLevel: 10,
          skirt: 0,
          storeyHeightsAboveGround: [],
          perPositionHeight: false,
          storeyHeightsBelowGround: [],
          heightReference: HeightReference.RELATIVE_TO_TERRAIN,
          layout: 'XYZ',
        });
        const output = transformer([...input2DCoordinate, 2]);
        arrayCloseTo(output, [...expected2DCoordinate, 12]);
      });
    });

    describe('of absolute height info', () => {
      it('should maintain 3D height, if given a 3D coordinates and per position heights is true', () => {
        const transformer = mercatorToWgs84TransformerForHeightInfo({
          groundLevelOrMinHeight: 0,
          extruded: false,
          skirt: 0,
          storeyHeightsAboveGround: [],
          perPositionHeight: true,
          storeyHeightsBelowGround: [],
          heightReference: HeightReference.NONE,
          layout: 'XYZ',
        });
        const output = transformer([...input2DCoordinate, 2]);
        arrayCloseTo(output, [...expected2DCoordinate, 2]);
      });

      it('should set height above ground as Z if per position height is false', () => {
        const transformer = mercatorToWgs84TransformerForHeightInfo({
          groundLevelOrMinHeight: 10,
          extruded: false,
          skirt: 0,
          storeyHeightsAboveGround: [],
          perPositionHeight: false,
          storeyHeightsBelowGround: [],
          heightReference: HeightReference.NONE,
          layout: 'XYZ',
        });
        const output = transformer([...input2DCoordinate, 2]);
        arrayCloseTo(output, [...expected2DCoordinate, 10]);
      });
    });
  });
});
