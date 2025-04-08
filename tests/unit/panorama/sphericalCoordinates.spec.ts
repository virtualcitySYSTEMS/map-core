import { expect } from 'chai';
import {
  Cartesian3,
  Math as CesiumMath,
  Matrix4,
  Transforms,
} from '@vcmap-cesium/engine';
import {
  cartesianToImageSpherical,
  globalCartesianToImageSpherical,
  imageSphericalToCartesian,
} from '../../../src/panorama/sphericalCoordinates.js';

describe('sphericalCoordinates', () => {
  it('should convert spherical to Cartesian coordinates', () => {
    const cartesian = imageSphericalToCartesian([
      CesiumMath.PI_OVER_TWO,
      CesiumMath.PI_OVER_TWO,
    ]);
    expect(
      Cartesian3.equalsEpsilon(
        cartesian,
        new Cartesian3(0, -1, 0),
        CesiumMath.EPSILON10,
      ),
    ).to.be.true;
  });

  it('should cartesian to spherical coordinates', () => {
    const spherical = cartesianToImageSpherical(new Cartesian3(0, -1, 0));
    expect(spherical).to.eql([CesiumMath.PI_OVER_TWO, CesiumMath.PI_OVER_TWO]);
  });

  it('should be with bounds', () => {
    const northCartesian = imageSphericalToCartesian([0, 0]);
    expect(
      Cartesian3.equalsEpsilon(
        northCartesian,
        new Cartesian3(0, 0, 1),
        CesiumMath.EPSILON10,
      ),
      'north pole is not 0, 0',
    ).to.be.true;
    const southCartesian = imageSphericalToCartesian([0, CesiumMath.PI]);
    expect(
      Cartesian3.equalsEpsilon(
        southCartesian,
        new Cartesian3(0, 0, -1),
        CesiumMath.EPSILON10,
      ),
      'south pole is not 0, PI',
    ).to.be.true;
    const eastBounds = imageSphericalToCartesian([0, CesiumMath.PI_OVER_TWO]);
    expect(
      Cartesian3.equalsEpsilon(
        eastBounds,
        new Cartesian3(1, 0, 0),
        CesiumMath.EPSILON10,
      ),
      'east bounds is not 0, PI / 2',
    ).to.be.true;
    const westBounds = imageSphericalToCartesian([
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

    const wrappedEastBounds = imageSphericalToCartesian([
      CesiumMath.TWO_PI,
      CesiumMath.PI_OVER_TWO,
    ]);
    expect(
      Cartesian3.equalsEpsilon(
        wrappedEastBounds,
        new Cartesian3(1, 0, 0),
        CesiumMath.EPSILON10,
      ),
      'wrapped east bounds is not 0, PI / 2',
    ).to.be.true;

    const forwardBounds = imageSphericalToCartesian([
      CesiumMath.PI_OVER_TWO,
      CesiumMath.PI_OVER_TWO,
    ]);
    expect(
      Cartesian3.equalsEpsilon(
        forwardBounds,
        new Cartesian3(0, -1, 0),
        CesiumMath.EPSILON10,
      ),
      'forward bounds is not 0, PI / 2',
    ).to.be.true;

    const backwardBounds = imageSphericalToCartesian([
      -CesiumMath.PI_OVER_TWO,
      CesiumMath.PI_OVER_TWO,
    ]);
    expect(
      Cartesian3.equalsEpsilon(
        backwardBounds,
        new Cartesian3(0, 1, 0),
        CesiumMath.EPSILON10,
      ),
      'backward bounds is not 0, PI / 2',
    ).to.be.true;
  });

  it('should handle wrapping around the globe', () => {
    const cartesian = imageSphericalToCartesian([
      CesiumMath.TWO_PI + CesiumMath.PI_OVER_TWO,
      CesiumMath.PI_OVER_TWO,
    ]);
    expect(
      Cartesian3.equalsEpsilon(
        cartesian,
        new Cartesian3(0, -1, 0),
        CesiumMath.EPSILON10,
      ),
    ).to.be.true;
  });

  it('should handle wrapping around the pole', () => {
    const cartesian = imageSphericalToCartesian([
      CesiumMath.PI_OVER_TWO,
      CesiumMath.PI + CesiumMath.PI_OVER_TWO,
    ]);
    expect(
      Cartesian3.equalsEpsilon(
        cartesian,
        new Cartesian3(0, 1, 0),
        CesiumMath.EPSILON10,
      ),
    ).to.be.true;
  });

  it('should convert negative spherical to Cartesian coordinates', () => {
    const cartesian = imageSphericalToCartesian([
      -CesiumMath.PI_OVER_TWO,
      CesiumMath.PI_OVER_TWO,
    ]);
    expect(
      Cartesian3.equalsEpsilon(
        cartesian,
        new Cartesian3(0, 1, 0),
        CesiumMath.EPSILON10,
      ),
    ).to.be.true;
  });

  it('should convert negative cartesian to spherical coordinates', () => {
    const spherical = cartesianToImageSpherical(new Cartesian3(0, -1, 0));
    expect(spherical).to.eql([CesiumMath.PI_OVER_TWO, CesiumMath.PI_OVER_TWO]);
  });

  it('should convert global cartesian to spherical coordinates', () => {
    const origin = Cartesian3.fromDegrees(0, 0);
    const globalCartesian = Cartesian3.add(
      origin,
      new Cartesian3(0, 0, 1),
      new Cartesian3(),
    );
    const invMatrix = Matrix4.inverse(
      Transforms.eastNorthUpToFixedFrame(origin),
      new Matrix4(),
    );
    const spherical = globalCartesianToImageSpherical(
      globalCartesian,
      invMatrix,
    );
    expect(spherical).to.eql([
      CesiumMath.TWO_PI - CesiumMath.PI_OVER_TWO,
      CesiumMath.PI_OVER_TWO,
    ]);
  });
});
