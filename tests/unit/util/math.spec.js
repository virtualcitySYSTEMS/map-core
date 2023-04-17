import { Math as CesiumMath } from '@vcmap-cesium/engine';
import {
  getCartesianBearing,
  getCartesianPitch,
  getMidPoint,
  modulo,
} from '../../../index.js';

describe('modulo', () => {
  it('should return the modulo of 5 % 2', () => {
    expect(modulo(5, 2)).to.equal(1);
  });

  it('should return the modulo of 5 % -2', () => {
    expect(modulo(5, -2)).to.equal(-1);
  });

  it('should return the modulo of -5 % -2', () => {
    expect(modulo(5, -2)).to.equal(-1);
  });

  it('should return the modulo of -5 % 2', () => {
    expect(modulo(-5, 2)).to.equal(1);
  });
});

describe('getCartesianBearing', () => {
  it('should return the bearing of a segment of two cartesian values', () => {
    expect(getCartesianBearing([0, 0], [1, 0])).to.equal(Math.PI / 2);
    expect(getCartesianBearing([1, 0], [0, 0])).to.equal(Math.PI + Math.PI / 2);
    expect(getCartesianBearing([0, 0], [1, 1])).to.equal(Math.PI / 4);
    expect(getCartesianBearing([0, 0], [0, 0])).to.equal(0);
    expect(getCartesianBearing([0, 0], [0, 1])).to.equal(0);
    expect(getCartesianBearing([0, 0], [0, -1])).to.equal(Math.PI);
  });
});

describe('getCartesianPitch', () => {
  it('should return the pitch between two cartesian values', () => {
    expect(getCartesianPitch([0, 0, 0], [1, 0, 1])).to.be.closeTo(
      45,
      CesiumMath.EPSILON5,
    );
    expect(getCartesianPitch([0, 0, 1], [1, 0, 0])).to.be.closeTo(
      -45,
      CesiumMath.EPSILON5,
    );
    expect(getCartesianPitch([0, 0, 1], [1, 0, 1])).to.be.closeTo(
      0,
      CesiumMath.EPSILON5,
    );
  });
});

describe('getMidPoint', () => {
  it('should return the 3D mid point', () => {
    expect(getMidPoint([0, 0, 0], [1, 1, 1])).to.have.members([0.5, 0.5, 0.5]);
  });

  it('should set the mid points Z value to 0 if using 2D coordinates', () => {
    expect(getMidPoint([0, 0], [1, 1])).to.have.members([0.5, 0.5, 0]);
  });
});
