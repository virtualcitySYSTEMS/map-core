import { expect } from 'chai';
import { Math as CesiumMath } from '@vcmap-cesium/engine';
import {
  getCartesianBearing,
  getCartesianPitch,
  getMidPoint,
  modulo,
} from '../../../index.js';
import { cartesian2Intersection } from '../../../src/util/math.js';

describe('math helpers', () => {
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
      expect(getCartesianBearing([1, 0], [0, 0])).to.equal(
        Math.PI + Math.PI / 2,
      );
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
      expect(getMidPoint([0, 0, 0], [1, 1, 1])).to.have.members([
        0.5, 0.5, 0.5,
      ]);
    });

    it('should not set the mid points Z value to 0 if using 2D coordinates', () => {
      expect(getMidPoint([0, 0], [1, 1])).to.have.members([0.5, 0.5]);
    });
  });

  describe('cartesian2Intersection', () => {
    it('should return an intersection within both segments', () => {
      const intersection = cartesian2Intersection(
        [
          [0, -1],
          [0, 1],
        ],
        [
          [-1, 0],
          [1, 0],
        ],
      );
      expect(intersection).to.have.ordered.members([0, 0]);
    });

    it('should return an intersection outside of the line segments', () => {
      const intersection = cartesian2Intersection(
        [
          [0, -2],
          [0, -1],
        ],
        [
          [-2, 0],
          [-1, 0],
        ],
      );
      expect(intersection).to.have.ordered.members([0, 0]);
    });

    it('should return undefined, if segments are parallel', () => {
      const intersection = cartesian2Intersection(
        [
          [0, -2],
          [0, -1],
        ],
        [
          [-2, 1],
          [-2, 5],
        ],
      );
      expect(intersection).to.be.undefined;
    });
  });
});
