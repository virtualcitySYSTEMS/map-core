import type { SinonFakeTimers, SinonSandbox } from 'sinon';
import sinon from 'sinon';
import { expect } from 'chai';
import { Math as CesiumMath } from '@vcmap-cesium/engine';
import Navigation, {
  getZeroMovement,
} from '../../../../src/map/navigation/navigation.js';
import Controller from '../../../../src/map/navigation/controller/controller.js';
import type { ControllerInput } from '../../../../src/map/navigation/controller/controllerInput.js';
import {
  fromArray,
  getZeroInput,
  inputEquals,
  multiplyByScalar,
} from '../../../../src/map/navigation/controller/controllerInput.js';
import type { CesiumMap } from '../../../../index.js';
import { getCesiumMap, getVcsEventSpy } from '../../helpers/cesiumHelpers.js';

const zeroMovement = getZeroMovement();

const tick = 16;
const times = 5;

describe('Navigation', () => {
  let sandbox: SinonSandbox;
  let clock: SinonFakeTimers;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  beforeEach(() => {
    clock = sandbox.useFakeTimers(performance.now());
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('adding a controller', () => {
    let navigation: Navigation;
    let controller: Controller;
    let controllerInputSpy: sinon.SinonSpy;
    let applyInputSpy: sinon.SinonSpy;
    let updateNavigationSpy: sinon.SinonSpy;

    beforeEach(() => {
      sandbox
        .stub(global, 'requestAnimationFrame')
        .callsFake((callback: FrameRequestCallback) => {
          return setTimeout(() => {
            callback(performance.now());
          }, tick) as unknown as number;
        });
      sandbox.stub(global, 'cancelAnimationFrame').callsFake((id: number) => {
        clearTimeout(id);
      });

      navigation = new Navigation();
      controller = new Controller({ id: 'test' });
      navigation.addController(controller);
      controllerInputSpy = sandbox.spy(controller, 'getInputs');
      applyInputSpy = sandbox.spy(navigation, 'applyInput');
      updateNavigationSpy = sandbox.spy(navigation, 'updateNavigation');
      clock.tick(tick * times);
    });

    afterEach(() => {
      navigation.destroy();
    });

    it('should register controller', () => {
      expect(navigation.getControllers()).to.have.members([controller]);
    });

    it('should start input loop', () => {
      expect(applyInputSpy.callCount).to.be.equal(times);
      expect(updateNavigationSpy.callCount).to.be.equal(times);
    });

    // Todo fix this test, with fakeTimers, at the moment it has too many erratic failures

    it('should request controllers', () => {
      expect(controllerInputSpy.callCount).to.be.equal(times);
    });
  });

  describe('removing a controller', () => {
    let navigation: Navigation;
    let controller: Controller;
    let controllerInputSpy: sinon.SinonSpy;
    let applyInputSpy: sinon.SinonSpy;
    let updateNavigationSpy: sinon.SinonSpy;

    beforeEach(() => {
      navigation = new Navigation();
      controller = new Controller({ id: 'test' });
      navigation.addController(controller);
      navigation.removeController(controller.id);
      controllerInputSpy = sandbox.spy(controller, 'getInputs');
      applyInputSpy = sandbox.spy(navigation, 'applyInput');
      updateNavigationSpy = sandbox.spy(navigation, 'updateNavigation');
      clock.tick(tick * times);
    });

    afterEach(() => {
      navigation.destroy();
    });

    it('should remove controller', () => {
      expect(navigation.getControllers()).to.have.length(0);
    });

    it('should stop input loop', () => {
      expect(applyInputSpy).to.not.have.been.called;
      expect(updateNavigationSpy).to.not.have.been.called;
    });

    it('should not request controllers', () => {
      expect(controllerInputSpy).to.not.have.been.called;
    });
  });

  describe('applying one input', () => {
    let navigation: Navigation;

    beforeEach(() => {
      navigation = new Navigation();
      clock.tick(tick * times);
    });

    afterEach(() => {
      navigation.destroy();
    });

    it('should apply input to movement and create easing', () => {
      const input: ControllerInput = fromArray([1, 2, 3, 4, 5, 6]);

      expect(navigation.movement).to.deep.equal(zeroMovement);

      navigation.applyInput(performance.now(), input);

      expect(navigation.movement).to.be.not.undefined;
    });
  });

  describe('applying sequential inputs', () => {
    let navigation: Navigation;
    let time: number;

    beforeEach(() => {
      time = performance.now();
      navigation = new Navigation();
    });

    afterEach(() => {
      navigation.destroy();
    });

    it('should ease movement to input, as long as input does not change', () => {
      const input: ControllerInput = fromArray([1, 2, 3, 4, 5, 6]);
      const inputScratch = getZeroInput();

      expect(navigation.movement).to.deep.equal(zeroMovement);

      for (let i = 0; i < 1000; i += 100) {
        navigation.applyInput(time + i, input);
        expect(navigation.movement.time).to.be.closeTo(
          i / 1000,
          CesiumMath.EPSILON2,
        );
        expect(
          inputEquals(
            navigation.movement.input,
            multiplyByScalar(input, i / 1000, inputScratch),
          ),
        ).to.be.true;
      }

      navigation.applyInput(time + 1000, input);

      expect(navigation.movement.time).to.be.closeTo(1, CesiumMath.EPSILON2);
      expect(inputEquals(navigation.movement.input, input)).to.be.true;
    });

    it('should update easing, if input changes', () => {
      const input: ControllerInput = fromArray([1, 2, 3, 4, 5, 6]);
      const input2: ControllerInput = fromArray([2, 2, 2, 3, 3, 3]);

      expect(navigation.movement).to.deep.equal(zeroMovement);

      for (let i = 0; i < 1000; i += 100) {
        if (i < 500) {
          navigation.applyInput(time + i, input);
          expect(navigation.movement.time).to.be.closeTo(
            i / 1000,
            CesiumMath.EPSILON2,
          );
        } else {
          navigation.applyInput(time + i, input2);
          expect(navigation.movement.time).to.be.closeTo(
            i / 1000,
            CesiumMath.EPSILON2,
          );
        }
      }

      navigation.applyInput(time + 1000, input2);

      expect(navigation.movement.time).to.be.closeTo(1, CesiumMath.EPSILON2);
      expect(inputEquals(navigation.movement.input, input2)).to.be.true;
    });

    it('should ease out for zero input', () => {
      const input: ControllerInput = fromArray([1, 2, 3, 4, 5, 6]);
      navigation.applyInput(time, input);
      navigation.applyInput(time + 1000, input);
      expect(navigation.movement.input).to.deep.equal(input);
      const zeroInput = getZeroInput();
      navigation.applyInput(time + 1000, zeroInput);
      navigation.applyInput(time + 2000, zeroInput);
      expect(navigation.movement.input).to.deep.equal(zeroInput);
    });
  });

  describe('current navigation impl', () => {
    let navigation: Navigation;
    let map: CesiumMap;

    before(() => {
      map = getCesiumMap();
    });

    beforeEach(() => {
      navigation = new Navigation();
      navigation.mapActivated(map);
      clock.tick(tick * times);
    });

    afterEach(() => {
      navigation.destroy();
    });

    after(() => {
      map.destroy();
    });

    it('should set current navigation impl', () => {
      expect(navigation.currentNavigation).to.be.not.undefined;
    });

    it('should fire changed event', () => {
      const spy = getVcsEventSpy(navigation.currentNavigationChanged, sandbox);
      navigation.mapActivated(map);
      expect(spy).to.have.been.called;
    });

    it('should update current navigation impl, if current movement is not zero', () => {
      const updateSpy = sandbox.spy(navigation.currentNavigation!, 'update');
      const input: ControllerInput = fromArray([1, 2, 3, 4, 5, 6]);
      navigation.applyInput(0, input);
      navigation.applyInput(1000, input);
      navigation.updateNavigation();
      expect(updateSpy).to.have.been.called;
    });

    it('should not update current navigation impl, if current movement is zero', () => {
      const updateSpy = sandbox.spy(navigation.currentNavigation!, 'update');
      const input: ControllerInput = getZeroInput();
      navigation.applyInput(0, input);
      navigation.updateNavigation();
      expect(updateSpy).to.not.have.been.called;
    });

    it('should not update current navigation impl, if movement key events are disabled on active map', () => {
      const updateSpy = sandbox.spy(navigation.currentNavigation!, 'update');
      map.disableMovement(true);
      const input: ControllerInput = fromArray([1, 2, 3, 4, 5, 6]);
      navigation.applyInput(0, input);
      navigation.applyInput(1000, input);
      navigation.updateNavigation();
      expect(updateSpy).to.not.have.been.called;
      map.disableMovement(false);
    });
  });
});
