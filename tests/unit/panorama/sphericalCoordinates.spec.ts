import { expect } from 'chai';
import { Cartesian3, Math as CesiumMath } from '@vcmap-cesium/engine';
import {
  cartesianToSpherical,
  globalCartesianToImageSpherical,
  sphericalToCartesian,
} from '../../../src/panorama/sphericalCoordinates.js';

describe('sphericalCoordinates', () => {
  it('should convert spherical to Cartesian coordinates', () => {
    const cartesian = sphericalToCartesian([Math.PI / 2, Math.PI / 2]);
    expect(
      Cartesian3.equalsEpsilon(
        cartesian,
        new Cartesian3(0, 1, 0),
        CesiumMath.EPSILON10,
      ),
    ).to.be.true;
  });

  it('should cartesian to spherical coordinates', () => {
    const spherical = cartesianToSpherical(new Cartesian3(0, 1, 0));
    expect(spherical).to.eql([Math.PI / 2, Math.PI / 2]);
  });

  it('should be with bounds', () => {
    const northCartesian = sphericalToCartesian([0, 0]);
    expect(
      Cartesian3.equalsEpsilon(
        northCartesian,
        new Cartesian3(0, 0, 1),
        CesiumMath.EPSILON10,
      ),
      'north pole is not 0, 0',
    ).to.be.true;
    const southCartesian = sphericalToCartesian([0, CesiumMath.PI]);
    expect(
      Cartesian3.equalsEpsilon(
        southCartesian,
        new Cartesian3(0, 0, -1),
        CesiumMath.EPSILON10,
      ),
      'south pole is not 0, PI',
    ).to.be.true;
    const eastBounds = sphericalToCartesian([0, CesiumMath.PI_OVER_TWO]);
    expect(
      Cartesian3.equalsEpsilon(
        eastBounds,
        new Cartesian3(1, 0, 0),
        CesiumMath.EPSILON10,
      ),
      'east bounds is not 0, PI / 2',
    ).to.be.true;
    const westBounds = sphericalToCartesian([
      CesiumMath.PI,
      CesiumMath.PI_OVER_TWO,
    ]);
    expect(
      Cartesian3.equalsEpsilon(
        westBounds,
        new Cartesian3(-1, 0, 0),
        CesiumMath.EPSILON10,
      ),
      'west bounds is not PI, PI / 2',
    ).to.be.true;

    const wrappedEastBounds = sphericalToCartesian([
      CesiumMath.TWO_PI,
      CesiumMath.PI / 2,
    ]);
    expect(
      Cartesian3.equalsEpsilon(
        wrappedEastBounds,
        new Cartesian3(1, 0, 0),
        CesiumMath.EPSILON10,
      ),
      'wrapped east bounds is not 0, PI / 2',
    ).to.be.true;

    const forwardBounds = sphericalToCartesian([
      CesiumMath.PI_OVER_TWO,
      CesiumMath.PI_OVER_TWO,
    ]);
    expect(
      Cartesian3.equalsEpsilon(
        forwardBounds,
        new Cartesian3(0, 1, 0),
        CesiumMath.EPSILON10,
      ),
      'west bounds is not 0, PI / 2',
    ).to.be.true;

    const backwardBounds = sphericalToCartesian([
      CesiumMath.PI_OVER_TWO,
      CesiumMath.PI_OVER_TWO,
    ]);
    expect(
      Cartesian3.equalsEpsilon(
        backwardBounds,
        new Cartesian3(0, -1, 0),
        CesiumMath.EPSILON10,
      ),
      'west bounds is not 0, PI / 2',
    ).to.be.true;
  });

  it('should convert spherical to Cartesian coordinates', () => {
    const cartesian = sphericalToCartesian([-Math.PI / 2, Math.PI / 2]);
    expect(
      Cartesian3.equalsEpsilon(
        cartesian,
        new Cartesian3(0, -1, 0),
        CesiumMath.EPSILON10,
      ),
    ).to.be.true;
  });

  it('should cartesian to spherical coordinates', () => {
    const spherical = cartesianToSpherical(new Cartesian3(0, -1, 0));
    expect(spherical).to.eql([-Math.PI / 2, Math.PI / 2]);
  });

  // it('should convert global cartesian to spherical coordinates', () => {
  //   const origin = Cartesian3.fromDegrees(0, 0);
  //   const globalCartesian = Cartesian3.add(
  //     origin,
  //     new Cartesian3(0, 0, 1),
  //     new Cartesian3(),
  //   );
  //   const spherical = globalCartesianToImageSpherical(globalCartesian, origin);
  //   expect(spherical).to.eql([Math.PI / 2, Math.PI / 2]);
  // });
});
