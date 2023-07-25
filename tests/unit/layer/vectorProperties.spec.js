/* eslint-disable no-self-assign */
import Feature from 'ol/Feature.js';
import {
  ClassificationType,
  HeightReference,
  NearFarScalar,
  Cartesian3,
} from '@vcmap-cesium/engine';
import VectorProperties, {
  parseCartesian3,
  parseNearFarScalar,
  parseStoreyHeights,
} from '../../../src/layer/vectorProperties.js';
import { PrimitiveOptionsType } from '../../../index.js';

describe('VectorProperties', () => {
  describe('parseNearFarScalar', () => {
    let defaultValue;

    before(() => {
      defaultValue = new NearFarScalar(0, 0, 1, 0);
    });

    it('should return the default value if value is null', () => {
      const nearFarScalar = parseNearFarScalar(null, defaultValue);
      expect(nearFarScalar).to.be.equal(defaultValue);
    });

    it('should return the default value if value is not a valid nearFarScalar', () => {
      const nearFarScalar = parseNearFarScalar([12, 12, 12], defaultValue);
      expect(nearFarScalar).to.be.equal(defaultValue);
    });

    it('should return the default value if values are not parsable', () => {
      const nearFarScalar = parseNearFarScalar(
        ['212', 'a12', 12, 23],
        defaultValue,
      );
      expect(nearFarScalar).to.be.equal(defaultValue);
    });

    it('should return a valid NearFarScalar value', () => {
      const nearFarScalar = parseNearFarScalar([1, 2, 3, 4], defaultValue);
      expect(nearFarScalar).to.not.be.equal(defaultValue);
      expect(nearFarScalar).to.be.a.instanceOf(NearFarScalar);
      expect(nearFarScalar.near).to.be.equal(1);
      expect(nearFarScalar.nearValue).to.be.equal(2);
      expect(nearFarScalar.far).to.be.equal(3);
      expect(nearFarScalar.farValue).to.be.equal(4);
    });

    it('should return a valid NearFarScalar value on parsable Strings', () => {
      const nearFarScalar = parseNearFarScalar(
        ['1', '2', '3', '4'],
        defaultValue,
      );
      expect(nearFarScalar).to.not.be.equal(defaultValue);
      expect(nearFarScalar).to.be.a.instanceOf(NearFarScalar);
      expect(nearFarScalar.near).to.be.equal(1);
      expect(nearFarScalar.nearValue).to.be.equal(2);
      expect(nearFarScalar.far).to.be.equal(3);
      expect(nearFarScalar.farValue).to.be.equal(4);
    });
  });

  describe('parseCartesian3', () => {
    let defaultValue;

    before(() => {
      defaultValue = new Cartesian3(1, 1, 0);
    });

    it('should return the default value if value is null', () => {
      const cartesian = parseCartesian3(null, defaultValue);
      expect(cartesian).to.be.equal(defaultValue);
    });

    it('return the default value if value has the wrong array size', () => {
      const cartesian = parseNearFarScalar([12, 12], defaultValue);
      expect(cartesian).to.be.equal(defaultValue);
    });

    it('return the default value if array values ar not parsable', () => {
      const cartesian = parseNearFarScalar(
        ['212', 'a12', 12, 23],
        defaultValue,
      );
      expect(cartesian).to.be.equal(defaultValue);
    });

    it('should return a valid Cartesian3 Value', () => {
      const cartesian = parseCartesian3([1, 2, 3], defaultValue);
      expect(cartesian).to.not.be.equal(defaultValue);
      expect(cartesian).to.be.a.instanceOf(Cartesian3);
      expect(cartesian.x).to.be.equal(1);
      expect(cartesian.y).to.be.equal(2);
      expect(cartesian.z).to.be.equal(3);
    });

    it('should return a valid Cartesian3 value if values are parsable', () => {
      const cartesian = parseCartesian3(['1', '2', '3'], defaultValue);
      expect(cartesian).to.not.be.equal(defaultValue);
      expect(cartesian).to.be.a.instanceOf(Cartesian3);
      expect(cartesian.x).to.be.equal(1);
      expect(cartesian.y).to.be.equal(2);
      expect(cartesian.z).to.be.equal(3);
    });
  });

  describe('parseStoreyHeights', () => {
    it('should return only valid numbers > 0', () => {
      const storeyHeights = parseStoreyHeights([0, 1, 2], [1]);
      expect(storeyHeights).to.be.have.ordered.members([1, 2]);
    });

    it('return an array if only one valid number > 0 is provided', () => {
      const storeyHeights = parseStoreyHeights(2, [1]);
      expect(storeyHeights).to.be.have.ordered.members([2]);
    });

    it('should return default value for invalid <=0 values', () => {
      const storeyHeights = parseStoreyHeights(-2, [1]);
      expect(storeyHeights).to.be.have.ordered.members([1]);
    });

    it('should return defaultStoreyHeights, if no valid storeyHeight is given', () => {
      const storeyHeights = parseStoreyHeights('test', [1]);
      expect(storeyHeights).to.be.have.ordered.members([1]);
    });

    it('should create an array for defaultStoreyHeights', () => {
      const storeyHeights = parseStoreyHeights('test', 1);
      expect(storeyHeights).to.be.have.ordered.members([1]);
    });
  });

  describe('VectorProperties', () => {
    let vectorProperties;
    let sandbox;
    let eventListener;

    before(() => {
      sandbox = sinon.createSandbox();
    });

    beforeEach(() => {
      vectorProperties = new VectorProperties({
        altitudeMode: 'absolute',
        allowPicking: false,
        classificationType: 'both',
        scaleByDistance: [1, 1, 2, 1],
        eyeOffset: [2, 3, 4],
        heightAboveGround: 12,
        skirt: 5,
        groundLevel: 13,
        extrudedHeight: 20,
        storeysAboveGround: 2,
        storeysBelowGround: 3,
        storeyHeightsAboveGround: [1, 2, 3],
        storeyHeightsBelowGround: [2, 3],
        modelUrl: 'http://localhost/test.glb',
        modelPitch: 180,
        modelRoll: 180,
        modelHeading: 180,
        modelScaleX: 2,
        modelScaleY: 2,
        modelScaleZ: 2,
        modelOptions: {},
        modelAutoScale: true,
        baseUrl: 'http://other',
        primitiveOptions: {
          type: PrimitiveOptionsType.SPHERE,
          geometryOptions: {},
        },
      });
      eventListener = sandbox.spy();
      vectorProperties.propertyChanged.addEventListener(eventListener);
    });

    afterEach(() => {
      vectorProperties.destroy();
      sandbox.reset();
    });

    describe('altitudeMode', () => {
      it('should parse value altitudeMode', () => {
        expect(vectorProperties.altitudeMode).to.be.equal(HeightReference.NONE);
      });

      it('should not set altitudeMode and not raiseEvent, if value did not change', () => {
        vectorProperties.altitudeMode = vectorProperties.altitudeMode;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set altitudeMode and raiseEvent, if value changed', () => {
        vectorProperties.altitudeMode = HeightReference.RELATIVE_TO_GROUND;
        expect(vectorProperties.altitudeMode).to.be.equal(
          HeightReference.RELATIVE_TO_GROUND,
        );
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['altitudeMode']);
      });

      it('should get vectorProperties altitudeMode if not set on the feature', () => {
        const altitudeModeDefault = vectorProperties.getAltitudeMode(
          new Feature({}),
        );
        expect(altitudeModeDefault).to.be.equal(vectorProperties.altitudeMode);
      });

      it('should extract altitudeMode from feature if set', () => {
        const altitudeModeFeature = vectorProperties.getAltitudeMode(
          new Feature({ olcs_altitudeMode: 'relativeToGround' }),
        );
        expect(altitudeModeFeature).to.be.equal(
          HeightReference.RELATIVE_TO_GROUND,
        );
      });
    });

    describe('allowPicking', () => {
      it('should parse value allowPicking', () => {
        expect(vectorProperties.allowPicking).to.be.equal(false);
      });

      it('should not set allowPicking and not raiseEvent, if value did not changed', () => {
        vectorProperties.allowPicking = vectorProperties.allowPicking;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set allowPicking and raiseEvent, if value changed', () => {
        vectorProperties.allowPicking = !vectorProperties.allowPicking;
        expect(vectorProperties.allowPicking).to.be.equal(true);
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['allowPicking']);
      });

      it('should get the default allowPicking if not set on the feature', () => {
        const allowPickingDefault = vectorProperties.getAllowPicking(
          new Feature({}),
        );
        expect(allowPickingDefault).to.be.equal(vectorProperties.allowPicking);
      });

      it('should get the allowPicking from the feature', () => {
        const allowPickingFeature = vectorProperties.getAllowPicking(
          new Feature({ olcs_allowPicking: true }),
        );
        expect(allowPickingFeature).to.be.equal(true);
      });
    });

    describe('classificationType', () => {
      it('should parse value classificationType', () => {
        expect(vectorProperties.classificationType).to.be.equal(
          ClassificationType.BOTH,
        );
      });

      it('should not set classificationType and not raiseEvent, if value does not change', () => {
        vectorProperties.classificationType =
          vectorProperties.classificationType;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set classificationType and raiseEvent, if value changed', () => {
        vectorProperties.classificationType = ClassificationType.TERRAIN;
        expect(vectorProperties.classificationType).to.be.equal(
          ClassificationType.TERRAIN,
        );
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['classificationType']);
      });

      it('should get default classificationType if not set on the feature', () => {
        const classificationTypeDefault =
          vectorProperties.getClassificationType(new Feature({}));
        expect(classificationTypeDefault).to.be.equal(
          vectorProperties.classificationType,
        );
      });

      it('should get the classificationType from the feature', () => {
        const classificationTypeFeature =
          vectorProperties.getClassificationType(
            new Feature({
              olcs_classificationType: 'cesium3DTile',
            }),
          );
        expect(classificationTypeFeature).to.be.equal(
          ClassificationType.CESIUM_3D_TILE,
        );
      });
    });

    describe('scaleByDistance', () => {
      it('should parse value scaleByDistance', () => {
        const scaleByDistance = new NearFarScalar(1, 1, 2, 1);
        expect(
          NearFarScalar.equals(
            scaleByDistance,
            vectorProperties.scaleByDistance,
          ),
        ).to.be.true;
      });

      it('should not set scaleByDistance and not raiseEvent, if value does not change', () => {
        vectorProperties.scaleByDistance = new NearFarScalar(1, 1, 2, 1);
        expect(eventListener).to.have.not.been.called;
      });

      it('should set scaleByDistance and raiseEvent, if value changed', () => {
        const scaleByDistance = new NearFarScalar(2, 2, 3, 2);
        vectorProperties.scaleByDistance = scaleByDistance;
        expect(vectorProperties.scaleByDistance).to.be.equal(scaleByDistance);
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['scaleByDistance']);
      });

      it('should get the default scaleByDistance if not set on the feature', () => {
        const scaleByDistanceDefault = vectorProperties.getScaleByDistance(
          new Feature({}),
        );
        expect(scaleByDistanceDefault).to.be.equal(
          vectorProperties.scaleByDistance,
        );
      });

      it('should get the scaleByDistance from the feature', () => {
        const scaleByDistance = new NearFarScalar(2, 2, 3, 2);
        const scaleByDistanceFeature = vectorProperties.getScaleByDistance(
          new Feature({
            olcs_scaleByDistance: [2, 2, 3, 2],
          }),
        );
        expect(NearFarScalar.equals(scaleByDistanceFeature, scaleByDistance)).to
          .be.true;
      });
    });

    describe('eyeOffset', () => {
      it('should parse value eyeOffset', () => {
        const eyeOffset = new Cartesian3(2, 3, 4);
        expect(Cartesian3.equals(eyeOffset, vectorProperties.eyeOffset)).to.be
          .true;
      });

      it('should not set eyeOffset and not raiseEvent, if value does not change', () => {
        vectorProperties.eyeOffset = vectorProperties.eyeOffset;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set eyeOffset and raiseEvent, if value changed', () => {
        const eyeOffset = new Cartesian3(2, 2, 3);
        vectorProperties.eyeOffset = eyeOffset;
        expect(vectorProperties.eyeOffset).to.be.equal(eyeOffset);
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['eyeOffset']);
      });

      it('should get default eyeOffset if not set on the feature', () => {
        const eyeOffsetDefault = vectorProperties.getEyeOffset(new Feature({}));
        expect(eyeOffsetDefault).to.be.equal(vectorProperties.eyeOffset);
      });

      it('should get the eyeOffset from the feature', () => {
        const eyeOffset = new Cartesian3(2, 2, 3);
        const eyeOffsetFeature = vectorProperties.getEyeOffset(
          new Feature({
            olcs_eyeOffset: [2, 2, 3],
          }),
        );
        expect(Cartesian3.equals(eyeOffsetFeature, eyeOffset)).to.be.true;
      });

      it('should get the eyeOffset from from legacy zCoordinateEyeOffset', () => {
        const eyeOffset = new Cartesian3(0, 0, 3);
        const eyeOffsetFeature = vectorProperties.getEyeOffset(
          new Feature({
            olcs_zCoordinateEyeOffset: 3,
          }),
        );
        expect(Cartesian3.equals(eyeOffsetFeature, eyeOffset)).to.be.true;
      });
    });

    describe('heightAboveGround', () => {
      it('should parse value heightAboveGround', () => {
        expect(vectorProperties.heightAboveGround).to.be.equal(12);
      });

      it('should not set heightAboveGround and not raiseEvent, if value does not change', () => {
        vectorProperties.heightAboveGround = vectorProperties.heightAboveGround;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set heightAboveGround and raiseEvent, if value changed', () => {
        vectorProperties.heightAboveGround = 15;
        expect(vectorProperties.heightAboveGround).to.be.equal(15);
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['heightAboveGround']);
      });

      it('should get default heightAboveGround if not set on the feature', () => {
        const heightAboveGroundDefault = vectorProperties.getHeightAboveGround(
          new Feature({}),
        );
        expect(heightAboveGroundDefault).to.be.equal(
          vectorProperties.heightAboveGround,
        );
      });

      it('should get the heightAboveGround from the feature', () => {
        const heightAboveGroundFeature = vectorProperties.getHeightAboveGround(
          new Feature({
            olcs_heightAboveGround: 15,
          }),
        );
        expect(heightAboveGroundFeature).to.be.equal(15);
      });
    });

    describe('skirt', () => {
      it('should parse value skirt', () => {
        expect(vectorProperties.skirt).to.be.equal(5);
      });

      it('should not set skirt and not raiseEvent, if value does not change', () => {
        vectorProperties.skirt = vectorProperties.skirt;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set skirt and raiseEvent, if value changed', () => {
        vectorProperties.skirt = 15;
        expect(vectorProperties.skirt).to.be.equal(15);
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['skirt']);
      });

      it('should get default skirt if not set on the feature', () => {
        const skirtDefault = vectorProperties.getSkirt(new Feature({}));
        expect(skirtDefault).to.be.equal(vectorProperties.skirt);
      });

      it('should get the skirt from the feature', () => {
        const skirtFeature = vectorProperties.getSkirt(
          new Feature({
            olcs_skirt: 15,
          }),
        );
        expect(skirtFeature).to.be.equal(15);
      });
    });

    describe('groundLevel', () => {
      it('should parse value groundLevel', () => {
        expect(vectorProperties.groundLevel).to.be.equal(13);
      });

      it('should not set groundLevel and not raiseEvent, if value does not change', () => {
        vectorProperties.groundLevel = vectorProperties.groundLevel;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set groundLevel and raiseEvent, if value changed', () => {
        vectorProperties.groundLevel = 15;
        expect(vectorProperties.groundLevel).to.be.equal(15);
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['groundLevel']);
      });

      it('should get default groundLevel if not set on the feature', () => {
        const groundLevelDefault = vectorProperties.getGroundLevel(
          new Feature({}),
        );
        expect(groundLevelDefault).to.be.equal(vectorProperties.groundLevel);
      });

      it('should get the groundLevel from the feature', () => {
        const groundLevelFeature = vectorProperties.getGroundLevel(
          new Feature({
            olcs_groundLevel: 15,
          }),
        );
        expect(groundLevelFeature).to.be.equal(15);
      });
    });

    describe('extrudedHeight', () => {
      it('should parse value extrudedHeight', () => {
        expect(vectorProperties.extrudedHeight).to.be.equal(20);
      });

      it('should not set extrudedHeight and not raiseEvent, if value does not change', () => {
        vectorProperties.extrudedHeight = vectorProperties.extrudedHeight;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set extrudedHeight and raiseEvent, if value changed', () => {
        vectorProperties.extrudedHeight = 15;
        expect(vectorProperties.extrudedHeight).to.be.equal(15);
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['extrudedHeight']);
      });

      it('should get default extrudedHeight if not set on the feature', () => {
        const extrudedHeightDefault = vectorProperties.getExtrudedHeight(
          new Feature({}),
        );
        expect(extrudedHeightDefault).to.be.equal(
          vectorProperties.extrudedHeight,
        );
      });

      it('should get the extrudedHeight from the feature', () => {
        const extrudedHeightFeature = vectorProperties.getExtrudedHeight(
          new Feature({
            olcs_extrudedHeight: 15,
          }),
        );
        expect(extrudedHeightFeature).to.be.equal(15);
      });
    });

    describe('storeysAboveGround', () => {
      it('should parse value storeysAboveGround', () => {
        expect(vectorProperties.storeysAboveGround).to.be.equal(2);
      });

      it('should not set storeysAboveGround and not raiseEvent, if value does not change', () => {
        vectorProperties.storeysAboveGround =
          vectorProperties.storeysAboveGround;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set storeysAboveGround and raiseEvent, if value changed', () => {
        vectorProperties.storeysAboveGround = 15;
        expect(vectorProperties.storeysAboveGround).to.be.equal(15);
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['storeysAboveGround']);
      });

      it('should get default storeysAboveGround if not set on the feature', () => {
        const storeysAboveGroundDefault =
          vectorProperties.getStoreysAboveGround(new Feature({}));
        expect(storeysAboveGroundDefault).to.be.equal(
          vectorProperties.storeysAboveGround,
        );
      });

      it('should get the storeysAboveGround from the feature', () => {
        const storeysAboveGroundFeature =
          vectorProperties.getStoreysAboveGround(
            new Feature({
              olcs_storeysAboveGround: 15,
            }),
          );
        expect(storeysAboveGroundFeature).to.be.equal(15);
      });
    });

    describe('storeysBelowGround', () => {
      it('should parse value storeysBelowGround', () => {
        expect(vectorProperties.storeysBelowGround).to.be.equal(3);
      });

      it('should not set storeysBelowGround and not raiseEvent, if value does not change', () => {
        vectorProperties.storeysBelowGround =
          vectorProperties.storeysBelowGround;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set storeysBelowGround and raiseEvent, if value changed', () => {
        vectorProperties.storeysBelowGround = 15;
        expect(vectorProperties.storeysBelowGround).to.be.equal(15);
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['storeysBelowGround']);
      });

      it('should get default storeysBelowGround if not set on the feature', () => {
        const storeysBelowGroundDefault =
          vectorProperties.getStoreysBelowGround(new Feature({}));
        expect(storeysBelowGroundDefault).to.be.equal(
          vectorProperties.storeysBelowGround,
        );
      });

      it('should get the storeysBelowGround from the feature', () => {
        const storeysBelowGroundDefault =
          vectorProperties.getStoreysBelowGround(new Feature({}));
        expect(storeysBelowGroundDefault).to.be.equal(3);
        const storeysBelowGroundFeature =
          vectorProperties.getStoreysBelowGround(
            new Feature({
              olcs_storeysBelowGround: 15,
            }),
          );
        expect(storeysBelowGroundFeature).to.be.equal(15);
      });
    });

    describe('storeyHeightsAboveGround', () => {
      it('should parse value storeyHeightsAboveGround', () => {
        expect(
          vectorProperties.storeyHeightsAboveGround,
        ).to.have.ordered.members([1, 2, 3]);
      });

      it('should not set storeyHeightsAboveGround and not raiseEvent, if value does not change', () => {
        vectorProperties.storeyHeightsAboveGround =
          vectorProperties.storeyHeightsAboveGround;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set storeyHeightsAboveGround and raiseEvent, if value changed', () => {
        vectorProperties.storeyHeightsAboveGround = [2, 3, 4];
        expect(
          vectorProperties.storeyHeightsAboveGround,
        ).to.have.ordered.members([2, 3, 4]);
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith([
          'storeyHeightsAboveGround',
        ]);
      });

      it('should get default storeyHeightsAboveGround if not set on the feature', () => {
        const storeyHeightsAboveGroundDefault =
          vectorProperties.getStoreyHeightsAboveGround(new Feature({}));
        expect(storeyHeightsAboveGroundDefault).to.have.ordered.members(
          vectorProperties.storeyHeightsAboveGround,
        );
      });

      it('should get the storeyHeightsAboveGround from the feature', () => {
        const storeyHeightsAboveGroundFeature =
          vectorProperties.getStoreyHeightsAboveGround(
            new Feature({
              olcs_storeyHeightsAboveGround: [2, 3, 4],
            }),
          );
        expect(storeyHeightsAboveGroundFeature).to.have.ordered.members([
          2, 3, 4,
        ]);
      });

      it('should have immutable storeyHeightsAboveGround', () => {
        const { storeyHeightsAboveGround } = vectorProperties;
        storeyHeightsAboveGround.splice(0);
        expect(vectorProperties.storeyHeightsAboveGround).to.not.be.empty;
      });
    });

    describe('storeyHeightsBelowGround', () => {
      it('should parse value storeyHeightsBelowGround', () => {
        expect(
          vectorProperties.storeyHeightsBelowGround,
        ).to.have.ordered.members([2, 3]);
      });

      it('should not set storeyHeightsBelowGround and not raiseEvent, if value does not change', () => {
        vectorProperties.storeyHeightsBelowGround =
          vectorProperties.storeyHeightsBelowGround;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set storeyHeightsBelowGround and raiseEvent, if value changed', () => {
        vectorProperties.storeyHeightsBelowGround = [3, 4];
        expect(
          vectorProperties.storeyHeightsBelowGround,
        ).to.have.ordered.members([3, 4]);
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith([
          'storeyHeightsBelowGround',
        ]);
      });

      it('should get default storeyHeightsBelowGround if not set on the feature', () => {
        const storeyHeightsBelowGroundDefault =
          vectorProperties.getStoreyHeightsBelowGround(new Feature({}));
        expect(storeyHeightsBelowGroundDefault).to.have.ordered.members(
          vectorProperties.storeyHeightsBelowGround,
        );
      });

      it('should get the storeyHeightsBelowGround from the feature', () => {
        const storeyHeightsBelowGroundFeature =
          vectorProperties.getStoreyHeightsBelowGround(
            new Feature({
              olcs_storeyHeightsBelowGround: [3, 4],
            }),
          );
        expect(storeyHeightsBelowGroundFeature).to.have.ordered.members([3, 4]);
      });

      it('should have immutable storeyHeightsBelowGround', () => {
        const { storeyHeightsBelowGround } = vectorProperties;
        storeyHeightsBelowGround.splice(0);
        expect(vectorProperties.storeyHeightsBelowGround).to.not.be.empty;
      });
    });

    describe('modelUrl', () => {
      it('should parse value modelUrl', () => {
        expect(vectorProperties.modelUrl).to.be.equal(
          'http://localhost/test.glb',
        );
      });

      it('should not set modelUrl and not raiseEvent, if value does not change', () => {
        vectorProperties.modelUrl = vectorProperties.modelUrl;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set modelUrl and raiseEvent, if value changed', () => {
        vectorProperties.modelUrl = 'http://localhost/test2.glb';
        expect(vectorProperties.modelUrl).to.be.equal(
          'http://localhost/test2.glb',
        );
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['modelUrl']);
      });
    });

    describe('modelHeading', () => {
      it('should parse value modelHeading', () => {
        expect(vectorProperties.modelHeading).to.be.equal(180);
      });

      it('should not set modelHeading and not raiseEvent, if value does not change', () => {
        vectorProperties.modelHeading = vectorProperties.modelHeading;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set modelHeading and raiseEvent, if value changed', () => {
        vectorProperties.modelHeading = 270;
        expect(vectorProperties.modelHeading).to.be.equal(270);
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['modelHeading']);
      });
    });

    describe('modelPitch', () => {
      it('should parse value modelPitch', () => {
        expect(vectorProperties.modelPitch).to.be.equal(180);
      });

      it('should not set modelPitch and not raiseEvent, if value does not change', () => {
        vectorProperties.modelPitch = vectorProperties.modelPitch;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set modelPitch and raiseEvent, if value changed', () => {
        vectorProperties.modelPitch = 270;
        expect(vectorProperties.modelPitch).to.be.equal(270);
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['modelPitch']);
      });
    });

    describe('modelRoll', () => {
      it('should parse value modelRoll', () => {
        expect(vectorProperties.modelRoll).to.be.equal(180);
      });

      it('should not set modelRoll and not raiseEvent, if value does not change', () => {
        vectorProperties.modelRoll = vectorProperties.modelRoll;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set modelRoll and raiseEvent, if value changed', () => {
        vectorProperties.modelRoll = 270;
        expect(vectorProperties.modelRoll).to.be.equal(270);
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['modelRoll']);
      });
    });

    describe('modelScaleX', () => {
      it('should parse value modelScaleX', () => {
        expect(vectorProperties.modelScaleX).to.be.equal(2);
      });

      it('should not set modelScaleX and not raiseEvent, if value does not change', () => {
        vectorProperties.modelScaleX = vectorProperties.modelScaleX;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set modelScaleX and raiseEvent, if value changed', () => {
        vectorProperties.modelScaleX = 3;
        expect(vectorProperties.modelScaleX).to.be.equal(3);
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['modelScaleX']);
      });
    });

    describe('modelScaleY', () => {
      it('should parse value modelScaleY', () => {
        expect(vectorProperties.modelScaleY).to.be.equal(2);
      });

      it('should not set modelScaleY and not raiseEvent, if value does not change', () => {
        vectorProperties.modelScaleY = vectorProperties.modelScaleY;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set modelScaleY and raiseEvent, if value changed', () => {
        vectorProperties.modelScaleY = 3;
        expect(vectorProperties.modelScaleY).to.be.equal(3);
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['modelScaleY']);
      });
    });

    describe('modelScaleZ', () => {
      it('should parse value modelScaleZ', () => {
        expect(vectorProperties.modelScaleZ).to.be.equal(2);
      });

      it('should not set modelScaleZ and not raiseEvent, if value does not change', () => {
        vectorProperties.modelScaleZ = vectorProperties.modelScaleZ;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set modelScaleZ and raiseEvent, if value changed', () => {
        vectorProperties.modelScaleZ = 3;
        expect(vectorProperties.modelScaleZ).to.be.equal(3);
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['modelScaleZ']);
      });
    });

    describe('modelOptions', () => {
      it('should set modelOptions', () => {
        expect(vectorProperties.modelOptions).to.be.an('object').and.to.be
          .empty;
      });

      it('should not set modelOptions and not raiseEvent, if the value does not change', () => {
        vectorProperties.modelOptions = vectorProperties.modelOptions;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set modelOptions and raiseEvent, if value changed', () => {
        vectorProperties.modelOptions = undefined;
        expect(vectorProperties.modelOptions).to.be.undefined;
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['modelOptions']);
      });
    });

    describe('modelAutoScale', () => {
      it('should parse value modelAutoScale', () => {
        expect(vectorProperties.modelAutoScale).to.be.true;
      });

      it('should not set modelAutoScale and not raiseEvent, if value does not change', () => {
        vectorProperties.modelAutoScale = vectorProperties.modelAutoScale;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set modelScaleZ and raiseEvent, if value changed', () => {
        vectorProperties.modelAutoScale = false;
        expect(vectorProperties.modelAutoScale).to.be.false;
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['modelAutoScale']);
      });
    });

    describe('baseUrl', () => {
      it('should parse value baseUrl', () => {
        expect(vectorProperties.baseUrl).to.be.equal('http://other');
      });

      it('should not set baseUrl and not raiseEvent, if value does not change', () => {
        vectorProperties.baseUrl = vectorProperties.baseUrl;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set modelScaleZ and raiseEvent, if value changed', () => {
        vectorProperties.baseUrl = 'http://other2';
        expect(vectorProperties.baseUrl).to.be.equal('http://other2');
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['baseUrl']);
      });
    });

    describe('primitiveOptions', () => {
      it('should parse value modelAutoScale', () => {
        expect(vectorProperties.primitiveOptions).to.eql({
          type: PrimitiveOptionsType.SPHERE,
          geometryOptions: {},
        });
      });

      it('should not set primitiveOptions and not raiseEvent, if value does not change', () => {
        vectorProperties.primitiveOptions = vectorProperties.primitiveOptions;
        expect(eventListener).to.have.not.been.called;
      });

      it('should set primitiveOptions and raiseEvent, if value changed', () => {
        vectorProperties.primitiveOptions = undefined;
        expect(vectorProperties.primitiveOptions).to.be.undefined;
        expect(eventListener).to.have.been.calledOnce;
        expect(eventListener).to.have.been.calledWith(['primitiveOptions']);
      });
    });

    describe('getting model', () => {
      let feature;

      beforeEach(() => {
        feature = new Feature({});
      });

      it('should return the model base options for a feature', () => {
        const modelOptions = vectorProperties.getModel(feature);
        expect(modelOptions).to.be.an('object');
      });

      it('should not return the model base options, if the feature unsets', () => {
        feature.set('olcs_modelUrl', null);
        const modelOptions = vectorProperties.getModel(feature);
        expect(modelOptions).to.be.null;
      });

      it('should create a scale array', () => {
        vectorProperties.modelScaleY = 4;
        vectorProperties.modelScaleZ = 8;
        const modelOptions = vectorProperties.getModel(feature);
        expect(modelOptions)
          .to.be.an('object')
          .and.to.have.property('scale')
          .and.to.have.ordered.members([2, 4, 8]);
      });

      it('should make relatives URL resolve to a baseUrl', () => {
        feature.set('olcs_modelUrl', 'test.glb');
        const modelOptions = vectorProperties.getModel(feature);
        expect(modelOptions).to.have.property('url', 'http://other/test.glb');
      });

      it('should return modelOptions for a feature', () => {
        const options = {};
        feature.set('olcs_modelOptions', options);
        const modelOptions = vectorProperties.getModelOptions(feature);
        expect(modelOptions).to.be.equal(options);
      });

      it('should return vectorProperties modelOptions', () => {
        const options = {};
        vectorProperties.modelOptions = options;
        const modelOptions = vectorProperties.getModelOptions(feature);
        expect(modelOptions).to.be.equal(options);
      });

      it('should return an empty object modelOptions, if both feature and vectorProperties modelOptions are undefined', () => {
        vectorProperties.modelOptions = undefined;
        const modelOptions = vectorProperties.getModelOptions(feature);
        expect(modelOptions).to.be.an('object').and.to.be.empty;
      });
    });

    describe('getting a primitive', () => {
      let feature;

      beforeEach(() => {
        feature = new Feature({});
      });

      it('should return the model base options for a feature', () => {
        const primitiveOptions = vectorProperties.getPrimitive(feature);
        expect(primitiveOptions).to.be.an('object');
      });

      it('should not return the model base options, if the feature unsets', () => {
        feature.set('olcs_primitiveOptions', null);
        const primitiveOptions = vectorProperties.getPrimitive(feature);
        expect(primitiveOptions).to.be.null;
      });

      it('should create a scale array', () => {
        vectorProperties.modelScaleY = 4;
        vectorProperties.modelScaleZ = 8;
        const primitiveOptions = vectorProperties.getPrimitive(feature);
        expect(primitiveOptions)
          .to.be.an('object')
          .and.to.have.property('scale')
          .and.to.have.ordered.members([2, 4, 8]);
      });

      it('should not return a primitive if geometryOptions is missing', () => {
        vectorProperties.primitiveOptions = {
          type: PrimitiveOptionsType.SPHERE,
        };
        const primitiveOptions = vectorProperties.getPrimitive(feature);
        expect(primitiveOptions).to.be.null;
      });
    });
  });
});
