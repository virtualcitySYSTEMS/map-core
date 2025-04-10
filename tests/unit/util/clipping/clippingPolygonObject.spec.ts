import sinon from 'sinon';
import { expect } from 'chai';
import type { ClippingPolygonObjectOptions } from '../../../../src/util/clipping/clippingPolygonObject.js';
import ClippingPolygonObject from '../../../../src/util/clipping/clippingPolygonObject.js';

const coordinates = [
  [13, 52],
  [14, 53],
  [13, 54],
];

describe('clippingPolygonObject', () => {
  describe('activate', () => {
    let clippingPolygonObject: ClippingPolygonObject;

    beforeEach(() => {
      clippingPolygonObject = new ClippingPolygonObject({
        coordinates,
      });
    });

    afterEach(() => {
      clippingPolygonObject.destroy();
    });

    it('should change state', () => {
      clippingPolygonObject.activate();
      expect(clippingPolygonObject.active).to.be.true;
      clippingPolygonObject.deactivate();
    });

    it('should raise event', () => {
      const stateChanged = sinon.spy();
      clippingPolygonObject.stateChanged.addEventListener(stateChanged);
      clippingPolygonObject.activate();
      expect(stateChanged).to.have.been.calledOnce;
      clippingPolygonObject.deactivate();
    });

    it('should raise event once, if called twice', () => {
      const stateChanged = sinon.spy();
      clippingPolygonObject.stateChanged.addEventListener(stateChanged);
      clippingPolygonObject.activate();
      clippingPolygonObject.activate();
      expect(stateChanged).to.have.been.calledOnce;
      clippingPolygonObject.deactivate();
    });
  });

  describe('deactivate', () => {
    let clippingPolygonObject: ClippingPolygonObject;

    beforeEach(() => {
      clippingPolygonObject = new ClippingPolygonObject({
        coordinates,
      });
    });

    afterEach(() => {
      clippingPolygonObject.destroy();
    });

    it('should change state', () => {
      clippingPolygonObject.activate();
      clippingPolygonObject.deactivate();
      expect(clippingPolygonObject.active).to.be.false;
    });

    it('should raise event', () => {
      clippingPolygonObject.activate();
      const stateChanged = sinon.spy();
      clippingPolygonObject.stateChanged.addEventListener(stateChanged);
      clippingPolygonObject.deactivate();
      expect(stateChanged).to.have.been.calledOnce;
    });

    it('should raise event once, if called twice', () => {
      clippingPolygonObject.activate();
      const stateChanged = sinon.spy();
      clippingPolygonObject.stateChanged.addEventListener(stateChanged);
      clippingPolygonObject.deactivate();
      clippingPolygonObject.deactivate();
      expect(stateChanged).to.have.been.calledOnce;
    });
  });

  describe('handle terrain', () => {
    let clippingPolygonObject: ClippingPolygonObject;

    beforeEach(() => {
      clippingPolygonObject = new ClippingPolygonObject({
        coordinates,
      });
    });

    afterEach(() => {
      clippingPolygonObject.destroy();
    });

    it('should change state', () => {
      clippingPolygonObject.terrain = true;
      expect(clippingPolygonObject.terrain).to.be.true;
    });

    it('should raise event', () => {
      const terrainChanged = sinon.spy();
      clippingPolygonObject.terrainChanged.addEventListener(terrainChanged);
      clippingPolygonObject.terrain = true;
      expect(terrainChanged).to.have.been.calledOnce;
    });
  });

  describe('set layers', () => {
    let clippingPolygonObject: ClippingPolygonObject;

    before(() => {
      clippingPolygonObject = new ClippingPolygonObject({
        coordinates,
      });
    });

    after(() => {
      clippingPolygonObject.destroy();
    });

    it('should set layer names array and raise event', () => {
      expect(clippingPolygonObject).to.have.property('layerNames', 'all');
      const layersChanged = sinon.spy();
      const listener =
        clippingPolygonObject.layersChanged.addEventListener(layersChanged);
      clippingPolygonObject.setLayerNames(['layer1']);
      expect(clippingPolygonObject.layerNames).to.have.members(['layer1']);
      expect(layersChanged).to.be.calledWith({
        oldValue: 'all',
        newValue: ['layer1'],
      });
      listener();
    });

    it('should set layer names all and raise event', () => {
      expect(clippingPolygonObject.layerNames).to.have.members(['layer1']);
      const layersChanged = sinon.spy();
      const listener =
        clippingPolygonObject.layersChanged.addEventListener(layersChanged);
      clippingPolygonObject.setLayerNames('all');
      expect(clippingPolygonObject).to.have.property('layerNames', 'all');
      expect(layersChanged).to.be.calledWith({
        oldValue: ['layer1'],
        newValue: 'all',
      });
      listener();
    });

    it('should unset layers and raise event', () => {
      expect(clippingPolygonObject).to.have.property('layerNames', 'all');
      const layersChanged = sinon.spy();
      const listener =
        clippingPolygonObject.layersChanged.addEventListener(layersChanged);
      clippingPolygonObject.setLayerNames([]);
      expect(clippingPolygonObject.layerNames).to.have.members([]);
      expect(layersChanged).to.be.calledWith({
        oldValue: 'all',
        newValue: [],
      });
      listener();
    });
  });

  describe('update coordinates', () => {
    let clippingPolygonObject: ClippingPolygonObject;

    beforeEach(() => {
      clippingPolygonObject = new ClippingPolygonObject({
        coordinates,
      });
    });

    afterEach(() => {
      clippingPolygonObject.destroy();
    });

    it('should throw, if providing no valid coordinates array', () => {
      expect(() => {
        clippingPolygonObject.setCoordinates([[], [], []]);
      }).to.throw;
    });

    it('should return, if providing less than 3 coordinates', () => {
      const clippingPolygonChangedSpy = sinon.spy();
      clippingPolygonObject.clippingPolygonChanged.addEventListener(
        clippingPolygonChangedSpy,
      );
      clippingPolygonObject.setCoordinates([[11, 48]]);
      expect(clippingPolygonObject.coordinates).to.deep.equal(coordinates);
      expect(clippingPolygonChangedSpy).to.not.have.been.called;
    });

    it('should return, if providing the same coordinates', () => {
      const clippingPolygonChangedSpy = sinon.spy();
      clippingPolygonObject.clippingPolygonChanged.addEventListener(
        clippingPolygonChangedSpy,
      );
      clippingPolygonObject.setCoordinates(coordinates);
      expect(clippingPolygonObject.coordinates).to.deep.equal(coordinates);
      expect(clippingPolygonChangedSpy).to.not.have.been.called;
    });

    it('should update the coordinates', () => {
      expect(clippingPolygonObject.coordinates).to.deep.equal(coordinates);
      const newCoordinates = [
        [11, 48],
        [12, 49],
        [11, 50],
        [10, 49],
      ];
      clippingPolygonObject.setCoordinates(newCoordinates);
      expect(clippingPolygonObject.coordinates).to.deep.equal(newCoordinates);
    });

    it('should raise a clippingPolygonChanged event', () => {
      const clippingPolygonChangedSpy = sinon.spy();
      clippingPolygonObject.clippingPolygonChanged.addEventListener(
        clippingPolygonChangedSpy,
      );
      clippingPolygonObject.setCoordinates([
        [11, 48],
        [12, 49],
        [11, 50],
        [10, 49],
      ]);
      expect(clippingPolygonChangedSpy).to.have.been.calledOnce;
    });

    it('should update the clipping polygon', () => {
      expect(clippingPolygonObject.clippingPolygon?.positions).to.have.lengthOf(
        3,
      );
      clippingPolygonObject.setCoordinates([
        [11, 48],
        [12, 49],
        [11, 50],
        [10, 49],
      ]);
      expect(clippingPolygonObject.clippingPolygon?.positions).to.have.lengthOf(
        4,
      );
    });
  });

  describe('toJSON', () => {
    describe('of a default object', () => {
      it('should return an object with name, type and coordinates', () => {
        const clippingPolygonObject = new ClippingPolygonObject({
          coordinates: [],
        });
        const config = clippingPolygonObject.toJSON();
        clippingPolygonObject.destroy();
        expect(config).to.have.all.keys('name', 'type', 'coordinates');
      });
    });

    describe('optional keys', () => {
      let clippingPolygonObject: ClippingPolygonObject;
      let input: ClippingPolygonObjectOptions;
      let output: ClippingPolygonObjectOptions;

      before(() => {
        input = {
          activeOnStartup: true,
          layerNames: ['layer1', 'layer2'],
          terrain: true,
          coordinates,
        };
        clippingPolygonObject = new ClippingPolygonObject(input);
        output = clippingPolygonObject.toJSON();
      });

      after(() => {
        clippingPolygonObject.destroy();
      });

      it('should configure activeOnStartup', () => {
        expect(output.activeOnStartup).to.equal(input.activeOnStartup);
      });

      it('should configure layerNames', () => {
        expect(output.layerNames).to.deep.equal(input.layerNames);
      });

      it('should configure terrain', () => {
        expect(output.terrain).to.equal(input.terrain);
      });

      it('should configure coordinates', () => {
        expect(output.coordinates).to.deep.equal(input.coordinates);
      });
    });
  });
});
