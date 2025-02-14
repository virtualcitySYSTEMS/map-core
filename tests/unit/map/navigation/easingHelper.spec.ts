import { expect } from 'chai';
import { Math as CesiumMath } from '@vcmap-cesium/engine';
import {
  createEasing,
  NavigationEasing,
} from '../../../../src/map/navigation/easingHelper.js';
import {
  ControllerInput,
  getZeroInput,
  fromArray,
  isNonZeroInput,
} from '../../../../src/map/navigation/controller/controllerInput.js';

describe('Easing', () => {
  describe('create easing', () => {
    let easing: NavigationEasing;
    let time: number;
    let origin: ControllerInput;
    let target: ControllerInput;

    beforeEach(() => {
      time = performance.now();
      origin = getZeroInput();
      target = fromArray([1, 2, 3, 4, 5, 6]);
    });

    it('should create an easing for provided duration', () => {
      easing = createEasing(time, 1000, origin, target);

      expect(easing).to.have.property('target', target);
      expect(easing).to.have.property('getMovementAtTime');
    });

    it('should return movement at time', () => {
      for (let i = 100; i < 1000; i += 100) {
        const { movement, finished } = easing.getMovementAtTime(time + i);

        expect(isNonZeroInput(movement.input)).to.be.true;
        expect(movement.time).to.be.closeTo(i / 1000, CesiumMath.EPSILON2);
        expect(finished).to.be.false;
      }
      const { movement, finished } = easing.getMovementAtTime(time + 1000);

      expect(movement.input).to.deep.equal(target);
      expect(finished).to.be.true;
    });
  });
});
