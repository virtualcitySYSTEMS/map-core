import { Point } from 'ol/geom.js';

import {
  createFeatureWithId,
  setupTransformationHandler,
} from './setupTransformationHandler.js';
import { getCesiumMap } from '../../../helpers/cesiumHelpers.js';
import { TransformationMode } from '../../../../../index.js';
import { timeout } from '../../../helpers/helpers.js';
import { getOpenlayersMap } from '../../../helpers/openlayersHelpers.js';

describe('createTransformationHandler', () => {
  describe('reacting to feature selection in 3D', () => {
    /**
     * @type {TransformationSetup}
     */
    let setup;
    let map;

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

    it('should set the center based on the currently set features', async () => {
      await setup.transformationHandler.setFeatures([
        createFeatureWithId(new Point([1, 1, 1])),
      ]);
      await timeout(0);
      expect(setup.transformationHandler.center).to.have.members([1, 1, 1]);
      await setup.transformationHandler.setFeatures([
        createFeatureWithId(new Point([1, 1, 1])),
        createFeatureWithId(new Point([3, 3, 3])),
      ]);
      await timeout(0);
      expect(setup.transformationHandler.center).to.have.members([2, 2, 2]);
    });

    it('should not show, if the feature set is cleared', async () => {
      await setup.transformationHandler.setFeatures([
        createFeatureWithId(new Point([1, 1, 1])),
      ]);
      setup.transformationHandler.setFeatures([]);
      expect(setup.transformationHandler.showing).to.be.false;
    });

    it('should place the center onto the terrain, if some features do not have height information', async () => {
      sinon.stub(map, 'getHeightFromTerrain').callsFake(async (coords) => {
        coords[0][2] = 1;
        return coords;
      });
      await setup.transformationHandler.setFeatures([
        createFeatureWithId(new Point([1, 1, 0])),
      ]);
      await timeout(0);
      expect(setup.transformationHandler.center).to.have.members([1, 1, 1]);
    });

    it('should place the center onto the terrain, if some features are clamp to ground', async () => {
      sinon.stub(map, 'getHeightFromTerrain').callsFake(async (coords) => {
        coords[0][2] = 1;
        return coords;
      });
      await setup.transformationHandler.setFeatures([
        createFeatureWithId({
          geometry: new Point([1, 1, 2]),
          olcs_altitudeMode: 'clampToGround',
        }),
      ]);
      await timeout(0);
      expect(setup.transformationHandler.center).to.have.members([1, 1, 1]);
    });

    it('should not place center of all features are absolute features', async () => {
      sinon.stub(map, 'getHeightFromTerrain').callsFake(async (coords) => {
        coords[0][2] = 1;
        return coords;
      });
      await setup.transformationHandler.setFeatures([
        createFeatureWithId({
          geometry: new Point([1, 1, 1]),
          olcs_altitudeMode: 'absolute',
        }),
        createFeatureWithId({
          geometry: new Point([3, 3, 3]),
          olcs_altitudeMode: 'absolute',
        }),
      ]);
      await timeout(0);
      expect(setup.transformationHandler.center).to.have.members([2, 2, 2]);
    });

    it('should set the center sync, if some feature have height info but are clamp to ground', async () => {
      sinon.stub(map, 'getHeightFromTerrain').callsFake(async (coords) => {
        await timeout(0);
        coords[0][2] = 1;
        return coords;
      });
      const promise = setup.transformationHandler.setFeatures([
        // iher promise merken
        createFeatureWithId({
          geometry: new Point([1, 1, 2]),
          olcs_altitudeMode: 'clampToGround',
        }),
      ]);
      expect(setup.transformationHandler.center).to.have.members([1, 1, 2]);
      await promise; // hier promise erwarten
      expect(setup.transformationHandler.center).to.have.members([1, 1, 1]);
    });

    it('should no longer set the center after placing onto the terrain, if the selection set has changed', async () => {
      let time = 50;
      sinon.stub(map, 'getHeightFromTerrain').callsFake(async (coords) => {
        await timeout(time);
        time = 0;
        coords[0][2] = 1;
        return coords;
      });
      await setup.transformationHandler.setFeatures([
        createFeatureWithId({
          geometry: new Point([1, 1, 2]),
          olcs_altitudeMode: 'clampToGround',
        }),
      ]);
      await setup.transformationHandler.setFeatures([
        createFeatureWithId({
          geometry: new Point([3, 3, 3]),
          olcs_altitudeMode: 'clampToGround',
        }),
      ]);
      await timeout(55);
      expect(setup.transformationHandler.center).to.have.members([3, 3, 1]);
    });

    it('should no longer show the center after placing onto the terrain, if the selection set was cleared', async () => {
      sinon.stub(map, 'getHeightFromTerrain').callsFake(async (coords) => {
        await timeout(50);
        coords[0][2] = 1;
        return coords;
      });
      await setup.transformationHandler.setFeatures([
        createFeatureWithId({
          geometry: new Point([1, 1, 2]),
          olcs_altitudeMode: 'clampToGround',
        }),
      ]);
      setup.transformationHandler.setFeatures([]);
      await timeout(55);
      expect(setup.transformationHandler.showing).to.be.false;
    });
  });

  describe('reacting to feature selection in 2D', () => {
    /**
     * @type {TransformationSetup}
     */
    let setup;
    let map;

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
      await setup.transformationHandler.setFeatures([
        createFeatureWithId(new Point([1, 1, 1])),
      ]);
      await timeout(0);
      expect(setup.transformationHandler.center).to.have.members([1, 1, 0]);
      await setup.transformationHandler.setFeatures([
        createFeatureWithId(new Point([1, 1, 1])),
        createFeatureWithId(new Point([3, 3, 3])),
      ]);
      await timeout(0);
      expect(setup.transformationHandler.center).to.have.members([2, 2, 0]);
    });

    it('should not show, if the feature set is cleared', async () => {
      await setup.transformationHandler.setFeatures([
        createFeatureWithId(new Point([1, 1, 1])),
      ]);
      setup.transformationHandler.setFeatures([]);
      expect(setup.transformationHandler.showing).to.be.false;
    });
  });
});
