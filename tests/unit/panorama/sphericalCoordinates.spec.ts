import { expect } from 'chai';
import { Cartesian3, Math as CesiumMath } from '@vcmap-cesium/engine';
import {
  cartesianToSpherical,
  sphericalToCartesian,
} from '../../../src/panorama/sphericalCoordinates.js';

describe.only('sphericalCoordinates', () => {
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
});
