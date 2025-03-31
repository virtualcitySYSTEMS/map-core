import type { PrimitiveCollection } from '@vcmap-cesium/engine';
import { Point } from 'ol/geom.js';
import { expect } from 'chai';
import sinon from 'sinon';
import type { TransformationSetup } from './setupTransformationHandler.js';
import {
  createFeatureWithId,
  setupTransformationHandler,
} from './setupTransformationHandler.js';
import { getCesiumMap } from '../../../helpers/cesiumHelpers.js';
import type { CesiumMap, OpenlayersMap } from '../../../../../index.js';
import {
  AxisAndPlanes,
  handlerSymbol,
  TransformationMode,
} from '../../../../../index.js';
import { timeout } from '../../../helpers/helpers.js';
import { getOpenlayersMap } from '../../../helpers/openlayersHelpers.js';

function collectionHasAxisPrimitive(
  primitiveCollection: PrimitiveCollection,
  axis: AxisAndPlanes,
): boolean {
  for (let i = 0; i < primitiveCollection.length; i++) {
    const p = primitiveCollection.get(i) as { [handlerSymbol]?: AxisAndPlanes };
    if (p[handlerSymbol] === axis) {
      return true;
    }
  }

  return false;
}

describe('createTransformationHandler', () => {
  describe('reacting to feature selection in 3D', () => {
    /**
     * @type {TransformationSetup}
     */
    let setup: TransformationSetup;
    let map: CesiumMap;

    beforeEach(async () => {
      map = getCesiumMap({});
      setup = await setupTransformationHandler(
        map,
        TransformationMode.TRANSLATE,
      );
    });

    afterEach(() => {
      setup.destroy();
    });

    it('should set the center based on the currently set 3D features', () => {
      setup.transformationHandler.setFeatures([
        createFeatureWithId(new Point([1, 1, 1])),
      ]);
      expect(setup.transformationHandler.center).to.have.members([1, 1, 1]);
      setup.transformationHandler.setFeatures([
        createFeatureWithId(new Point([1, 1, 1])),
        createFeatureWithId(new Point([3, 3, 3])),
      ]);
      expect(setup.transformationHandler.center).to.have.members([2, 2, 2]);
    });

    it('should set the center based on the currently set 2D features', () => {
      setup.transformationHandler.setFeatures([
        createFeatureWithId(new Point([1, 1])),
      ]);
      expect(setup.transformationHandler.center).to.have.members([1, 1, 0]);
      setup.transformationHandler.setFeatures([
        createFeatureWithId(new Point([1, 1])),
        createFeatureWithId(new Point([3, 3])),
      ]);
      expect(setup.transformationHandler.center).to.have.members([2, 2, 0]);
    });

    it('should set the center based on the currently set 2D and 3D features', () => {
      setup.transformationHandler.setFeatures([
        createFeatureWithId(new Point([1, 1])),
        createFeatureWithId(new Point([3, 3, 2])),
      ]);
      expect(setup.transformationHandler.center).to.have.members([2, 2, 2]);
    });

    it('should not show, if the feature set is cleared', () => {
      setup.transformationHandler.setFeatures([
        createFeatureWithId(new Point([1, 1, 1])),
      ]);
      setup.transformationHandler.setFeatures([]);
      expect(setup.transformationHandler.showing).to.be.false;
    });

    it('should place the center onto the terrain, if some features do not have height information', () => {
      sinon.stub(map.getScene()!, 'getHeight').callsFake(() => {
        return 1;
      });
      setup.transformationHandler.setFeatures([
        createFeatureWithId(new Point([1, 1])),
      ]);
      expect(setup.transformationHandler.center).to.have.members([1, 1, 1]);
    });

    it('should place the center onto the terrain, if some features are clamp to ground', () => {
      sinon.stub(map.getScene()!, 'getHeight').callsFake(() => {
        return 1;
      });
      setup.transformationHandler.setFeatures([
        createFeatureWithId({
          geometry: new Point([1, 1, 2]),
          olcs_altitudeMode: 'clampToGround',
        }),
      ]);
      expect(setup.transformationHandler.center).to.have.members([1, 1, 1]);
    });

    it('should place the center onto the terrain, if some features are relative to ground, adding the height to the centers height', () => {
      sinon.stub(map.getScene()!, 'getHeight').callsFake(() => {
        return 1;
      });
      setup.transformationHandler.setFeatures([
        createFeatureWithId({
          geometry: new Point([1, 1, 2]),
          olcs_altitudeMode: 'relativeToGround',
        }),
      ]);
      expect(setup.transformationHandler.center).to.have.members([1, 1, 3]);
    });

    it('should not place center of all features are absolute features', () => {
      sinon.stub(map.getScene()!, 'getHeight').callsFake(() => {
        return 1;
      });
      setup.transformationHandler.setFeatures([
        createFeatureWithId({
          geometry: new Point([1, 1, 1]),
          olcs_altitudeMode: 'absolute',
        }),
        createFeatureWithId({
          geometry: new Point([3, 3, 3]),
          olcs_altitudeMode: 'absolute',
        }),
      ]);
      expect(setup.transformationHandler.center).to.have.members([2, 2, 2]);
    });

    describe('greying out of Z hanlders', () => {
      beforeEach(() => {
        sinon.stub(map.getScene()!, 'getHeight').callsFake(() => {
          return 1;
        });
      });

      it('should not grey out Z handler, if all feature are absolute or relative', () => {
        setup.transformationHandler.setFeatures([
          createFeatureWithId({
            geometry: new Point([1, 1, 1]),
            olcs_altitudeMode: 'relativeToGround',
          }),
          createFeatureWithId({
            geometry: new Point([3, 3, 3]),
            olcs_altitudeMode: 'absolute',
          }),
        ]);
        const primitiveCollection = map.getScene()!.primitives;
        expect(
          collectionHasAxisPrimitive(
            primitiveCollection.get(
              primitiveCollection.length - 1,
            ) as PrimitiveCollection,
            AxisAndPlanes.Z,
          ),
        ).to.be.true;
      });

      it('should grey out Z handler, if a feature is clamped', () => {
        setup.transformationHandler.setFeatures([
          createFeatureWithId({
            geometry: new Point([1, 1, 1]),
            olcs_altitudeMode: 'clampToGround',
          }),
          createFeatureWithId({
            geometry: new Point([3, 3, 3]),
            olcs_altitudeMode: 'absolute',
          }),
        ]);
        const primitiveCollection = map.getScene()!.primitives;
        expect(
          collectionHasAxisPrimitive(
            primitiveCollection.get(
              primitiveCollection.length - 1,
            ) as PrimitiveCollection,
            AxisAndPlanes.Z,
          ),
        ).to.be.false;
      });

      it('should grey out Z handler, if a feature is absolute, but has ground level set', () => {
        setup.transformationHandler.setFeatures([
          createFeatureWithId({
            geometry: new Point([1, 1, 1]),
            olcs_altitudeMode: 'absolute',
            olcs_groundLevel: 0,
          }),
          createFeatureWithId({
            geometry: new Point([3, 3, 3]),
            olcs_altitudeMode: 'absolute',
          }),
        ]);
        const primitiveCollection = map.getScene()!.primitives;
        expect(
          collectionHasAxisPrimitive(
            primitiveCollection.get(
              primitiveCollection.length - 1,
            ) as PrimitiveCollection,
            AxisAndPlanes.Z,
          ),
        ).to.be.false;
      });

      it('should grey out Z handler, if a feature is relative, but has height above ground set', () => {
        setup.transformationHandler.setFeatures([
          createFeatureWithId({
            geometry: new Point([1, 1, 1]),
            olcs_altitudeMode: 'relativeToGround',
            olcs_heightAboveGround: 0,
          }),
          createFeatureWithId({
            geometry: new Point([3, 3, 3]),
            olcs_altitudeMode: 'absolute',
          }),
        ]);
        const primitiveCollection = map.getScene()!.primitives;
        expect(
          collectionHasAxisPrimitive(
            primitiveCollection.get(
              primitiveCollection.length - 1,
            ) as PrimitiveCollection,
            AxisAndPlanes.Z,
          ),
        ).to.be.false;
      });

      it('should grey out Z handler, if a feature a feature is 2D', () => {
        setup.transformationHandler.setFeatures([
          createFeatureWithId({
            geometry: new Point([1, 1]),
            olcs_altitudeMode: 'relativeToGround',
          }),
          createFeatureWithId({
            geometry: new Point([3, 3, 3]),
            olcs_altitudeMode: 'absolute',
          }),
        ]);
        const primitiveCollection = map.getScene()!.primitives;
        expect(
          collectionHasAxisPrimitive(
            primitiveCollection.get(
              primitiveCollection.length - 1,
            ) as PrimitiveCollection,
            AxisAndPlanes.Z,
          ),
        ).to.be.false;
      });

      it('should not grey out Z handler, if a feature is absolute, but has height above ground set or relative and has ground level set', () => {
        setup.transformationHandler.setFeatures([
          createFeatureWithId({
            geometry: new Point([1, 1, 1]),
            olcs_altitudeMode: 'absolute',
            olcs_heightAboveGround: 0,
          }),
          createFeatureWithId({
            geometry: new Point([3, 3, 3]),
            olcs_altitudeMode: 'relativeToGround',
            olcs_groundLevel: 0,
          }),
        ]);
        const primitiveCollection = map.getScene()!.primitives;
        expect(
          collectionHasAxisPrimitive(
            primitiveCollection.get(
              primitiveCollection.length - 1,
            ) as PrimitiveCollection,
            AxisAndPlanes.Z,
          ),
        ).to.be.true;
      });

      it('should grey Z handler, if one point feature rendered as a model is selected and mode is not rotate or scale', () => {
        setup.transformationHandler.setFeatures([
          createFeatureWithId({
            geometry: new Point([1, 1, 1]),
            olcs_modelUrl: 'foo.glb',
          }),
        ]);
        const primitiveCollection = map.getScene()!.primitives;
        expect(
          collectionHasAxisPrimitive(
            primitiveCollection.get(
              primitiveCollection.length - 1,
            ) as PrimitiveCollection,
            AxisAndPlanes.Z,
          ),
        ).to.be.false;
      });

      it('should grey Z handler, if one point feature rendered as a primitive is selected and mode is not rotate or scale', () => {
        setup.transformationHandler.setFeatures([
          createFeatureWithId({
            geometry: new Point([1, 1, 1]),
            olcs_primitiveOptions: {
              type: 'sphere',
              geometryOptions: { radius: 1 },
            },
          }),
        ]);
        const primitiveCollection = map.getScene()!.primitives;
        expect(
          collectionHasAxisPrimitive(
            primitiveCollection.get(
              primitiveCollection.length - 1,
            ) as PrimitiveCollection,
            AxisAndPlanes.Z,
          ),
        ).to.be.false;
      });

      describe('model & primitives', () => {
        let rotationSetup: TransformationSetup;

        beforeEach(async () => {
          rotationSetup = await setupTransformationHandler(
            map,
            TransformationMode.ROTATE,
          );
        });

        afterEach(() => {
          rotationSetup.destroy;
        });

        it('should not grey out Z handler, if one point feature rendered as a model is selected and mode is rotate', () => {
          rotationSetup.transformationHandler.setFeatures([
            createFeatureWithId({
              geometry: new Point([1, 1, 1]),
              olcs_modelUrl: 'foo.glb',
            }),
          ]);
          const primitiveCollection = map.getScene()!.primitives;
          expect(
            collectionHasAxisPrimitive(
              primitiveCollection.get(
                primitiveCollection.length - 1,
              ) as PrimitiveCollection,
              AxisAndPlanes.Y,
            ),
          ).to.be.true;
        });

        it('should grey out Z handler, if more then one point feature rendered as a model is selected and mode is rotate', () => {
          rotationSetup.transformationHandler.setFeatures([
            createFeatureWithId({
              geometry: new Point([1, 1, 1]),
              olcs_modelUrl: 'foo.glb',
            }),
            createFeatureWithId({
              geometry: new Point([2, 2, 1]),
              olcs_modelUrl: 'foo.glb',
            }),
          ]);
          const primitiveCollection = map.getScene()!.primitives;
          expect(
            collectionHasAxisPrimitive(
              primitiveCollection.get(
                primitiveCollection.length - 1,
              ) as PrimitiveCollection,
              AxisAndPlanes.Y,
            ),
          ).to.be.false;
        });

        it('should not grey out Z handler, if one point feature rendered as a primitive is selected and mode is rotate', () => {
          rotationSetup.transformationHandler.setFeatures([
            createFeatureWithId({
              geometry: new Point([1, 1, 1]),
              olcs_primitiveOptions: {
                type: 'sphere',
                geometryOptions: { radius: 1 },
              },
            }),
          ]);
          const primitiveCollection = map.getScene()!.primitives;
          expect(
            collectionHasAxisPrimitive(
              primitiveCollection.get(
                primitiveCollection.length - 1,
              ) as PrimitiveCollection,
              AxisAndPlanes.Y,
            ),
          ).to.be.true;
        });

        it('should grey out Z handler, if more then one point feature rendered as a primitive is selected and mode is rotate', () => {
          rotationSetup.transformationHandler.setFeatures([
            createFeatureWithId({
              geometry: new Point([1, 1, 1]),
              olcs_primitiveOptions: {
                type: 'sphere',
                geometryOptions: { radius: 1 },
              },
            }),
            createFeatureWithId({
              geometry: new Point([1, 1, 1]),
              olcs_primitiveOptions: {
                type: 'sphere',
                geometryOptions: { radius: 1 },
              },
            }),
          ]);
          const primitiveCollection = map.getScene()!.primitives;
          expect(
            collectionHasAxisPrimitive(
              primitiveCollection.get(
                primitiveCollection.length - 1,
              ) as PrimitiveCollection,
              AxisAndPlanes.Y,
            ),
          ).to.be.false;
        });
      });
    });
  });

  describe('reacting to feature selection in 2D', () => {
    let setup: TransformationSetup;
    let map: OpenlayersMap;

    beforeEach(async () => {
      map = await getOpenlayersMap({});
      setup = await setupTransformationHandler(
        map,
        TransformationMode.TRANSLATE,
      );
    });

    afterEach(() => {
      setup.destroy();
    });

    it('should set the center based on the currently set features', async () => {
      setup.transformationHandler.setFeatures([
        createFeatureWithId(new Point([1, 1, 1])),
      ]);
      await timeout(0);
      expect(setup.transformationHandler.center).to.have.members([1, 1]);
      setup.transformationHandler.setFeatures([
        createFeatureWithId(new Point([1, 1, 1])),
        createFeatureWithId(new Point([3, 3, 3])),
      ]);
      await timeout(0);
      expect(setup.transformationHandler.center).to.have.members([2, 2]);
    });

    it('should not show, if the feature set is cleared', () => {
      setup.transformationHandler.setFeatures([
        createFeatureWithId(new Point([1, 1, 1])),
      ]);
      setup.transformationHandler.setFeatures([]);
      expect(setup.transformationHandler.showing).to.be.false;
    });

    it('should set the center based on the currently set 2D features', async () => {
      setup.transformationHandler.setFeatures([
        createFeatureWithId(new Point([1, 1])),
      ]);
      await timeout(0);
      expect(setup.transformationHandler.center).to.have.members([1, 1]);
      setup.transformationHandler.setFeatures([
        createFeatureWithId(new Point([1, 1])),
        createFeatureWithId(new Point([3, 3])),
      ]);
      await timeout(0);
      expect(setup.transformationHandler.center).to.have.members([2, 2]);
    });
  });
});
