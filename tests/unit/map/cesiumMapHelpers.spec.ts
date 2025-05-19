import { Cartesian3, Math as CesiumMath } from '@vcmap-cesium/engine';
import { expect } from 'chai';
import sinon from 'sinon';
import { getCesiumMap } from '../helpers/cesiumHelpers.js';
import Projection from '../../../src/util/projection.js';
import {
  getResolution,
  getViewpointFromScene,
} from '../../../src/map/cesiumMapHelpers.js';
import { mercatorToCartesian } from '../../../src/util/math.js';
import Viewpoint from '../../../src/util/viewpoint.js';
import type { CesiumMap } from '../../../index.js';
import { arrayCloseTo } from '../helpers/helpers.js';

describe('cesiumMapHelpers', () => {
  let map: CesiumMap;

  before(() => {
    map = getCesiumMap();
  });

  after(() => {
    map.destroy();
  });

  describe('getting current resolution', () => {
    it('should return the resolution (snapshot test)', async () => {
      await map.gotoViewpoint(
        new Viewpoint({
          groundPosition: [0, 0, 0],
          cameraPosition: [0, 0, 100],
          distance: 100,
          pitch: -90,
          animate: false,
        }),
      );

      sinon.stub(map.mapElement, 'offsetHeight').get(() => 100);
      sinon.stub(map.mapElement, 'offsetWidth').get(() => 100);

      const resolution = getResolution(
        mercatorToCartesian(Projection.wgs84ToMercator([0, 0, 0])),
        map.getScene()!.camera,
        map.mapElement,
        0,
      );
      expect(resolution).to.be.closeTo(1.15470053, CesiumMath.EPSILON8);
    });
  });

  describe('getting the current viewpoint', () => {
    let inputViewpoint: Viewpoint;
    let outputViewpoint: Viewpoint;

    before(async () => {
      inputViewpoint = new Viewpoint({
        groundPosition: [0, 0, 10],
        cameraPosition: [1, 1, 100],
        distance: 100,
        animate: false,
        heading: 45,
        pitch: -45,
      });

      await map.gotoViewpoint(inputViewpoint);
      sinon
        .stub(map.getScene()!.globe, 'pick')
        .returns(Cartesian3.fromDegrees(0, 0, 10)); // there are not globe tiles rendered
      outputViewpoint = getViewpointFromScene(map.getScene()!);
    });

    it('should get the current viewpoints ground position in 3D', () => {
      expect(outputViewpoint.groundPosition).to.have.ordered.members([
        0, 0, 10,
      ]);
    });

    it('should get the current camera position in 3D', () => {
      const { cameraPosition } = outputViewpoint;
      expect(cameraPosition).to.have.lengthOf(3);
      arrayCloseTo(cameraPosition!, [1, 1, 100], 0.0001);
    });

    it('should determine the distance of the current viewpoint', () => {
      expect(outputViewpoint.distance).to.be.closeTo(156896.9689, 0.001);
    });

    it('should get the current pitch', () => {
      expect(outputViewpoint.pitch).to.equal(inputViewpoint.pitch);
    });

    it('should get the current heading', () => {
      expect(outputViewpoint.heading).to.equal(inputViewpoint.heading);
    });
  });
});
