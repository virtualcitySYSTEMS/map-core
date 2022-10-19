import {
  Matrix4,
  Cartesian3,
  CylinderGeometry,
  Math as CesiumMath,
  PolylineGeometry,
} from '@vcmap/cesium';
import {
  AXIS_AND_PLANES,
  create3DHandlers,
  handlerSymbol,
  TransformationMode,
} from '../../../../../index.js';
import { getCesiumMap } from '../../../helpers/cesiumHelpers.js';

/**
 * @param {import("@vcmap/cesium").PrimitiveCollection} collection
 * @param {function(import("@vcmap/cesium").Primitive):boolean} predicate
 * @returns {null|import("@vcmap/cesium").Primitive}
 */
function findPrimitive(collection, predicate) {
  const { length } = collection;

  for (let i = 0; i < length; i++) {
    const primitive = collection.get(i);
    if (predicate(primitive)) {
      return primitive;
    }
  }
  return null;
}

/**
 * @param {import("@vcmap/cesium").PrimitiveCollection} collection
 * @param {function(import("@vcmap/cesium").Primitive):boolean} predicate
 * @returns {Array<import("@vcmap/cesium").Primitive>}
 */
function filterPrimitives(collection, predicate) {
  const { length } = collection;

  const primitives = [];
  for (let i = 0; i < length; i++) {
    const primitive = collection.get(i);
    if (predicate(primitive)) {
      primitives.push(primitive);
    }
  }
  return primitives;
}

/**
 * @param {import("@vcmap/cesium").PrimitiveCollection} collection
 * @param {function(import("@vcmap/cesium").Primitive, number):any} cb
 */
function forEachPrimitive(collection, cb) {
  const { length } = collection;
  for (let i = 0; i < length; i++) {
    cb(collection.get(i), i);
  }
}

describe('create3DHandlers', () => {
  describe('showing handlers', () => {
    let map;
    let handlers;
    let primitiveCollection;

    before(async () => {
      map = getCesiumMap({});
      handlers = create3DHandlers(map, TransformationMode.TRANSLATE);
      handlers.show = true;
      primitiveCollection = map.getScene().primitives.get(0);
    });

    after(() => {
      handlers.destroy();
      map.destroy();
    });

    it('should add a single primitive collection to the primitives', () => {
      expect(map.getScene().primitives).to.have.property('length', 1);
    });

    it('should show the primitive collection', () => {
      expect(primitiveCollection).to.have.property('show', true);
    });

    it('should create an X axis handler', () => {
      const primitives = filterPrimitives(primitiveCollection, (f => f.olFeature[handlerSymbol] === AXIS_AND_PLANES.X));
      expect(primitives).to.have.lengthOf(2);
    });

    it('should create an Y axis handler', () => {
      const primitives = filterPrimitives(primitiveCollection, (f => f.olFeature[handlerSymbol] === AXIS_AND_PLANES.Y));
      expect(primitives).to.have.lengthOf(2);
    });

    it('should create an Z axis handler', () => {
      const primitives = filterPrimitives(primitiveCollection, (f => f.olFeature[handlerSymbol] === AXIS_AND_PLANES.Z));
      expect(primitives).to.have.lengthOf(2);
    });

    it('should create an XY plane handler', () => {
      const primitives =
        filterPrimitives(primitiveCollection, (f => f.olFeature[handlerSymbol] === AXIS_AND_PLANES.XY));
      expect(primitives).to.have.lengthOf(1);
    });

    it('should create an XZ plane handler', () => {
      const primitives =
        filterPrimitives(primitiveCollection, (f => f.olFeature[handlerSymbol] === AXIS_AND_PLANES.XZ));
      expect(primitives).to.have.lengthOf(1);
    });

    it('should create an YZ plane handler', () => {
      const primitives =
        filterPrimitives(primitiveCollection, (f => f.olFeature[handlerSymbol] === AXIS_AND_PLANES.YZ));
      expect(primitives).to.have.lengthOf(1);
    });
  });

  describe('hiding handlers', () => {
    let map;
    let handlers;

    before(async () => {
      map = getCesiumMap({});
      handlers = create3DHandlers(map, TransformationMode.TRANSLATE);
      handlers.show = true;
      handlers.show = false;
    });

    after(() => {
      handlers.destroy();
      map.destroy();
    });

    it('should add a single primitive collection to the primitives', () => {
      expect(map.getScene().primitives).to.have.property('length', 1);
    });

    it('should hide the primitive collection', () => {
      expect(map.getScene().primitives.get(0)).to.have.property('show', false);
    });
  });

  describe('setting the center', () => {
    let map;
    let handlers;
    let primitiveCollection;

    before(async () => {
      map = getCesiumMap({});
      handlers = create3DHandlers(map, TransformationMode.TRANSLATE);
      handlers.show = true;
      primitiveCollection = map.getScene().primitives.get(0);
    });

    after(() => {
      handlers.destroy();
      map.destroy();
    });

    it('should update the modelMatrix on every handler', () => {
      const modelMatrices = [];
      forEachPrimitive(primitiveCollection, (p) => {
        modelMatrices.push(p.modelMatrix);
      });
      handlers.setCenter([1, 1, 1]);
      forEachPrimitive(primitiveCollection, (p, i) => {
        if (p?.geometryInstances?.[0]?.geometry instanceof CylinderGeometry) {
          return; // handler cylinders have an override
        }
        const sub = Matrix4.subtract(modelMatrices[i], p.modelMatrix, new Matrix4());
        const res = Matrix4.getTranslation(sub, new Cartesian3());
        expect(Cartesian3.magnitude(res)).to.be.closeTo(1.72819454, 0.00001);
      });
    });
  });

  describe('post render scaling', () => {
    let map;
    let handlers;
    let primitiveCollection;

    before(async () => {
      map = getCesiumMap({});
      handlers = create3DHandlers(map, TransformationMode.TRANSLATE);
      handlers.show = true;
      primitiveCollection = map.getScene().primitives.get(0);
      handlers.setCenter([1, 1, 0]);
      sinon.stub(map, 'getCurrentResolution').returns(1 / 30);
      map.getScene().postRender.raiseEvent();
    });

    after(() => {
      handlers.destroy();
      map.destroy();
    });

    it('should update the modelMatrix on every handler', () => {
      forEachPrimitive(primitiveCollection, (p) => {
        if (p?.geometryInstances?.[0]?.geometry instanceof CylinderGeometry) {
          return; // handler cylinders have an override
        }
        const scale = Matrix4.getScale(p.modelMatrix, new Cartesian3());
        expect(Cartesian3.equalsEpsilon(scale, new Cartesian3(2, 2, 2), CesiumMath.EPSILON8)).to.be.true;
      });
    });

    describe('setting the center after scaling', () => {
      it('should maintain the scaling again', () => {
        handlers.setCenter([2, 2, 0]);
        forEachPrimitive(primitiveCollection, (p) => {
          if (p?.geometryInstances?.[0]?.geometry instanceof CylinderGeometry) {
            return; // handler cylinders have an override
          }
          const scale = Matrix4.getScale(p.modelMatrix, new Cartesian3());
          expect(Cartesian3.equalsEpsilon(scale, new Cartesian3(2, 2, 2), CesiumMath.EPSILON8)).to.be.true;
        });
      });
    });
  });

  describe('creating shadows', () => {
    describe('creating X axis shadows', () => {
      let map;
      let handlers;
      let primitiveCollection;

      before(async () => {
        map = getCesiumMap({});
        handlers = create3DHandlers(map, TransformationMode.TRANSLATE);
        handlers.show = true;
        handlers.showAxis = AXIS_AND_PLANES.X;
        handlers.setCenter([1, 1, 1]);
        primitiveCollection = map.getScene().primitives.get(0);
      });

      after(() => {
        handlers.destroy();
        map.destroy();
      });

      it('should add the X axis primitive & X shadows', () => {
        const features = filterPrimitives(primitiveCollection, p => !p.olFeature);
        expect(features).to.have.lengthOf(2);
        expect(features[0]).to.have.property('length', 1);
        expect(features[1]).to.have.property('length', 2);
      });

      it('should set the X axis shadow to the original center', () => {
        const handlerModelMatrix = findPrimitive(
          primitiveCollection,
          p => p?.olFeature?.[handlerSymbol] === AXIS_AND_PLANES.X &&
            p.geometryInstances[0].geometry instanceof PolylineGeometry,
        ).modelMatrix;

        const [, shadowCollection] = filterPrimitives(primitiveCollection, p => !p.olFeature);
        const shadowModelMatrix = findPrimitive(
          shadowCollection,
          p => p.geometryInstances[0].geometry instanceof PolylineGeometry,
        ).modelMatrix;

        const sub = Matrix4.subtract(shadowModelMatrix, handlerModelMatrix, new Matrix4());
        const res = Matrix4.getTranslation(sub, new Cartesian3());
        expect(Cartesian3.magnitude(res)).to.be.closeTo(1.72819454, 0.00001);
      });
    });

    describe('creating Y axis shadows', () => {
      let map;
      let handlers;
      let primitiveCollection;

      before(async () => {
        map = getCesiumMap({});
        handlers = create3DHandlers(map, TransformationMode.TRANSLATE);
        handlers.show = true;
        handlers.showAxis = AXIS_AND_PLANES.Y;
        handlers.setCenter([1, 1, 1]);
        primitiveCollection = map.getScene().primitives.get(0);
      });

      after(() => {
        handlers.destroy();
        map.destroy();
      });

      it('should add the Y axis primitive & X shadows', () => {
        const features = filterPrimitives(primitiveCollection, p => !p.olFeature);
        expect(features).to.have.lengthOf(2);
        expect(features[0]).to.have.property('length', 1);
        expect(features[1]).to.have.property('length', 2);
      });

      it('should set the Y axis shadow to the original center', () => {
        const handlerModelMatrix = findPrimitive(
          primitiveCollection,
          p => p?.olFeature?.[handlerSymbol] === AXIS_AND_PLANES.Y &&
            p.geometryInstances[0].geometry instanceof PolylineGeometry,
        ).modelMatrix;

        const [, shadowCollection] = filterPrimitives(primitiveCollection, p => !p.olFeature);
        const shadowModelMatrix = findPrimitive(
          shadowCollection,
          p => p.geometryInstances[0].geometry instanceof PolylineGeometry,
        ).modelMatrix;

        const sub = Matrix4.subtract(shadowModelMatrix, handlerModelMatrix, new Matrix4());
        const res = Matrix4.getTranslation(sub, new Cartesian3());
        expect(Cartesian3.magnitude(res)).to.be.closeTo(1.72819454, 0.00001);
      });
    });

    describe('creating Z axis shadows', () => {
      let map;
      let handlers;
      let primitiveCollection;

      before(async () => {
        map = getCesiumMap({});
        handlers = create3DHandlers(map, TransformationMode.TRANSLATE);
        handlers.show = true;
        handlers.showAxis = AXIS_AND_PLANES.Z;
        handlers.setCenter([1, 1, 1]);
        primitiveCollection = map.getScene().primitives.get(0);
      });

      after(() => {
        handlers.destroy();
        map.destroy();
      });

      it('should add the Z axis primitive & Z shadows', () => {
        const features = filterPrimitives(primitiveCollection, p => !p.olFeature);
        expect(features).to.have.lengthOf(2);
        expect(features[0]).to.have.property('length', 1);
        expect(features[1]).to.have.property('length', 2);
      });

      it('should set the Z axis shadow to the original center', () => {
        const handlerModelMatrix = findPrimitive(
          primitiveCollection,
          p => p?.olFeature?.[handlerSymbol] === AXIS_AND_PLANES.Y &&
            p.geometryInstances[0].geometry instanceof PolylineGeometry,
        ).modelMatrix;

        const [, shadowCollection] = filterPrimitives(primitiveCollection, p => !p.olFeature);
        const shadowModelMatrix = findPrimitive(
          shadowCollection,
          p => p.geometryInstances[0].geometry instanceof PolylineGeometry,
        ).modelMatrix;

        const sub = Matrix4.subtract(shadowModelMatrix, handlerModelMatrix, new Matrix4());
        const res = Matrix4.getTranslation(sub, new Cartesian3());
        expect(Cartesian3.magnitude(res)).to.be.closeTo(1.72819454, 0.00001);
      });
    });

    describe('creating XY axis shadows', () => {
      let map;
      let handlers;
      let primitiveCollection;

      before(async () => {
        map = getCesiumMap({});
        handlers = create3DHandlers(map, TransformationMode.TRANSLATE);
        handlers.show = true;
        handlers.showAxis = AXIS_AND_PLANES.XY;
        handlers.setCenter([1, 1, 1]);
        primitiveCollection = map.getScene().primitives.get(0);
      });

      after(() => {
        handlers.destroy();
        map.destroy();
      });

      it('should add the XY axis primitive & XY shadows', () => {
        const features = filterPrimitives(primitiveCollection, p => !p.olFeature);
        expect(features).to.have.lengthOf(2);
        expect(features[0]).to.have.property('length', 2);
        expect(features[1]).to.have.property('length', 1);
      });

      it('should set the XY axis shadow to the original center', () => {
        const handlerModelMatrix = findPrimitive(
          primitiveCollection,
          p => p?.olFeature?.[handlerSymbol] === AXIS_AND_PLANES.XY,
        ).modelMatrix;

        const [, shadowCollection] = filterPrimitives(primitiveCollection, p => !p.olFeature);
        const shadowModelMatrix = shadowCollection.get(0).modelMatrix;

        const sub = Matrix4.subtract(shadowModelMatrix, handlerModelMatrix, new Matrix4());
        const res = Matrix4.getTranslation(sub, new Cartesian3());
        expect(Cartesian3.magnitude(res)).to.be.closeTo(1.72819454, 0.00001);
      });
    });

    describe('creating XZ axis shadows', () => {
      let map;
      let handlers;
      let primitiveCollection;

      before(async () => {
        map = getCesiumMap({});
        handlers = create3DHandlers(map, TransformationMode.TRANSLATE);
        handlers.show = true;
        handlers.showAxis = AXIS_AND_PLANES.XZ;
        handlers.setCenter([1, 1, 1]);
        primitiveCollection = map.getScene().primitives.get(0);
      });

      after(() => {
        handlers.destroy();
        map.destroy();
      });

      it('should add the XZ axis primitive & XZ shadows', () => {
        const features = filterPrimitives(primitiveCollection, p => !p.olFeature);
        expect(features).to.have.lengthOf(2);
        expect(features[0]).to.have.property('length', 2);
        expect(features[1]).to.have.property('length', 1);
      });

      it('should set the XZ axis shadow to the original center', () => {
        const handlerModelMatrix = findPrimitive(
          primitiveCollection,
          p => p?.olFeature?.[handlerSymbol] === AXIS_AND_PLANES.XZ,
        ).modelMatrix;

        const [, shadowCollection] = filterPrimitives(primitiveCollection, p => !p.olFeature);
        const shadowModelMatrix = shadowCollection.get(0).modelMatrix;

        const sub = Matrix4.subtract(shadowModelMatrix, handlerModelMatrix, new Matrix4());
        const res = Matrix4.getTranslation(sub, new Cartesian3());
        expect(Cartesian3.magnitude(res)).to.be.closeTo(1.72819454, 0.00001);
      });
    });

    describe('creating YZ axis shadows', () => {
      let map;
      let handlers;
      let primitiveCollection;

      before(async () => {
        map = getCesiumMap({});
        handlers = create3DHandlers(map, TransformationMode.TRANSLATE);
        handlers.show = true;
        handlers.showAxis = AXIS_AND_PLANES.YZ;
        handlers.setCenter([1, 1, 1]);
        primitiveCollection = map.getScene().primitives.get(0);
      });

      after(() => {
        handlers.destroy();
        map.destroy();
      });

      it('should add the YZ axis primitive & YZ shadows', () => {
        const features = filterPrimitives(primitiveCollection, p => !p.olFeature);
        expect(features).to.have.lengthOf(2);
        expect(features[0]).to.have.property('length', 2);
        expect(features[1]).to.have.property('length', 1);
      });

      it('should set the YZ axis shadow to the original center', () => {
        const handlerModelMatrix = findPrimitive(
          primitiveCollection,
          p => p?.olFeature?.[handlerSymbol] === AXIS_AND_PLANES.YZ,
        ).modelMatrix;

        const [, shadowCollection] = filterPrimitives(primitiveCollection, p => !p.olFeature);
        const shadowModelMatrix = shadowCollection.get(0).modelMatrix;

        const sub = Matrix4.subtract(shadowModelMatrix, handlerModelMatrix, new Matrix4());
        const res = Matrix4.getTranslation(sub, new Cartesian3());
        expect(Cartesian3.magnitude(res)).to.be.closeTo(1.72819454, 0.00001);
      });
    });

    describe('creating axis shadows on a scaled map', () => {
      let map;
      let handlers;
      let primitiveCollection;

      before(async () => {
        map = getCesiumMap({});
        handlers = create3DHandlers(map, TransformationMode.TRANSLATE);
        handlers.setCenter([1, 1, 0]);
        sinon.stub(map, 'getCurrentResolution').returns(1 / 30);
        map.getScene().postRender.raiseEvent();
        handlers.show = true;
        handlers.showAxis = AXIS_AND_PLANES.X;
        handlers.setCenter([2, 2, 1]);
        primitiveCollection = map.getScene().primitives.get(0);
      });

      after(() => {
        handlers.destroy();
        map.destroy();
      });

      it('should add the X axis primitive & X shadows', () => {
        const features = filterPrimitives(primitiveCollection, p => !p.olFeature);
        expect(features).to.have.lengthOf(2);
        expect(features[0]).to.have.property('length', 1);
        expect(features[1]).to.have.property('length', 2);
      });

      it('should set the X axis shadow to the original center', () => {
        const handlerModelMatrix = findPrimitive(
          primitiveCollection,
          p => p?.olFeature?.[handlerSymbol] === AXIS_AND_PLANES.X &&
            p.geometryInstances[0].geometry instanceof PolylineGeometry,
        ).modelMatrix;

        const [, shadowCollection] = filterPrimitives(primitiveCollection, p => !p.olFeature);
        const shadowModelMatrix = findPrimitive(
          shadowCollection,
          p => p.geometryInstances[0].geometry instanceof PolylineGeometry,
        ).modelMatrix;

        const sub = Matrix4.subtract(shadowModelMatrix, handlerModelMatrix, new Matrix4());
        const res = Matrix4.getTranslation(sub, new Cartesian3());
        expect(Cartesian3.magnitude(res)).to.be.closeTo(1.72819454, 0.00001);
      });

      it('should properly apply scaling', () => {
        const [, shadowCollection] = filterPrimitives(primitiveCollection, p => !p.olFeature);
        const shadowModelMatrix = findPrimitive(
          shadowCollection,
          p => p.geometryInstances[0].geometry instanceof PolylineGeometry,
        ).modelMatrix;
        const scale = Matrix4.getScale(shadowModelMatrix, new Cartesian3());
        expect(Cartesian3.equalsEpsilon(scale, new Cartesian3(2, 2, 2), CesiumMath.EPSILON8)).to.be.true;
      });
    });
  });

  describe('greying out Z axis', () => {
    let map;
    let handlers;
    let primitiveCollection;

    beforeEach(async () => {
      map = getCesiumMap({});
      handlers = create3DHandlers(map, TransformationMode.TRANSLATE);
      handlers.show = true;
      primitiveCollection = map.getScene().primitives.get(0);
    });

    afterEach(() => {
      handlers.destroy();
      map.destroy();
    });

    it('should replace Z handlers', () => {
      const currentZHandlers = filterPrimitives(
        primitiveCollection, p => p.olFeature[handlerSymbol] === AXIS_AND_PLANES.Z ||
          p.olFeature[handlerSymbol] === AXIS_AND_PLANES.XZ ||
          p.olFeature[handlerSymbol] === AXIS_AND_PLANES.YZ,
      );
      handlers.greyOutZ = true;
      expect(currentZHandlers.every(p => p.isDestroyed())).to.be.true;
      const newZHandlers = filterPrimitives(
        primitiveCollection, p => !p.olFeature,
      );
      expect(newZHandlers).to.have.lengthOf(currentZHandlers.length);
    });

    it('should reinstate z handlers', () => {
      handlers.greyOutZ = true;
      handlers.greyOutZ = false;
      const currentZHandlers = filterPrimitives(
        primitiveCollection, p => p.olFeature[handlerSymbol] === AXIS_AND_PLANES.Z ||
          p.olFeature[handlerSymbol] === AXIS_AND_PLANES.XZ ||
          p.olFeature[handlerSymbol] === AXIS_AND_PLANES.YZ,
      );
      expect(currentZHandlers).to.not.be.empty;
    });
  });
});
