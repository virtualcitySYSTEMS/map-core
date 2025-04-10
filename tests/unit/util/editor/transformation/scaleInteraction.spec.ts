import { expect } from 'chai';
import type { SinonSandbox, SinonSpy } from 'sinon';
import sinon from 'sinon';
import { Cartesian2 } from '@vcmap-cesium/engine';
import { Feature } from 'ol';
import { Point } from 'ol/geom.js';
import { getCesiumMap } from '../../../helpers/cesiumHelpers.js';
import type { TransformationSetup } from './setupTransformationHandler.js';
import {
  createHandlerFeature,
  patchPickRay,
  setupTransformationHandler,
} from './setupTransformationHandler.js';
import type {
  CesiumMap,
  ScaleEvent,
  OpenlayersMap,
} from '../../../../../index.js';
import {
  AxisAndPlanes,
  TransformationMode,
  EventType,
  ScaleInteraction,
  mercatorToCartesian,
  ModificationKeyType,
  PointerKeyType,
  PointerEventType,
} from '../../../../../index.js';
import { getOpenlayersMap } from '../../../helpers/openlayersHelpers.js';

describe('ScaleInteraction', () => {
  let sandbox: SinonSandbox;
  let eventBase: {
    key: ModificationKeyType;
    pointer: PointerKeyType;
    pointerEvent: PointerEventType;
    windowPosition: Cartesian2;
  };

  before(() => {
    sandbox = sinon.createSandbox();
    eventBase = {
      key: ModificationKeyType.NONE,
      pointer: PointerKeyType.ALL,
      pointerEvent: PointerEventType.UP,
      windowPosition: new Cartesian2(0, 0),
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('3D handling', () => {
    let map: CesiumMap;
    let setup: TransformationSetup;
    let interaction: ScaleInteraction;

    before(async () => {
      map = getCesiumMap({});
      setup = await setupTransformationHandler(map, TransformationMode.SCALE);
      setup.transformationHandler.setFeatures([
        new Feature({ geometry: new Point([0, 0, 0]) }),
      ]);
      interaction = new ScaleInteraction(setup.transformationHandler);
    });

    after(() => {
      interaction.destroy();
      setup.destroy();
    });

    it('should call scale x/y if dragging the plane handler', async () => {
      const spy = sandbox.spy() as SinonSpy<[ScaleEvent]>;
      interaction.scaled.addEventListener(spy);
      patchPickRay(
        [
          mercatorToCartesian([0.5, 0.5, 0]),
          mercatorToCartesian([1, 2, 2]),
          mercatorToCartesian([1, 4, 4]),
          mercatorToCartesian([1, 4, 4]),
        ],
        sandbox,
      );
      const feature = createHandlerFeature(AxisAndPlanes.XY);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        position: [0.5, 0.5, 0],
        positionOrPixel: [0.5, 0.5, 0],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 2, 2],
        position: [1, 2, 2],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 4, 4],
        position: [1, 4, 4],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [1, 4, 4],
        position: [1, 4, 4],
        ...eventBase,
      });

      expect(spy).to.have.been.calledThrice;
      expect(spy.getCall(0).args[0].map((i) => Math.round(i))).to.have.members([
        3, 3, 1,
      ]);
      expect(spy.getCall(1).args[0].map((i) => Math.round(i))).to.have.members([
        2, 2, 1,
      ]);
      expect(spy.getCall(2).args[0].map((i) => Math.round(i))).to.have.members([
        1, 1, 1,
      ]);
    });

    it('should call scale x/y/z if dragging the box handler', async () => {
      const spy = sandbox.spy() as SinonSpy<[ScaleEvent]>;
      interaction.scaled.addEventListener(spy);
      patchPickRay(
        [
          mercatorToCartesian([0.5, 0.5, 0]),
          mercatorToCartesian([1, 2, 2]),
          mercatorToCartesian([1, 4, 4]),
          mercatorToCartesian([1, 4, 4]),
        ],
        sandbox,
      );
      const feature = createHandlerFeature(AxisAndPlanes.XYZ);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        position: [0.5, 0.5, 0],
        positionOrPixel: [0.5, 0.5, 0],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 2, 2],
        position: [1, 2, 2],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 4, 4],
        position: [1, 4, 4],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [1, 4, 4],
        position: [1, 4, 4],
        ...eventBase,
      });

      expect(spy).to.have.been.calledThrice;
      expect(spy.getCall(0).args[0].map((i) => Math.round(i))).to.have.members([
        4, 4, 4,
      ]);
      expect(spy.getCall(1).args[0].map((i) => Math.round(i))).to.have.members([
        2, 2, 2,
      ]);
      expect(spy.getCall(2).args[0].map((i) => Math.round(i))).to.have.members([
        1, 1, 1,
      ]);
    });

    it('should call scale x if dragging the x axis handler', async () => {
      const spy = sandbox.spy() as SinonSpy<[ScaleEvent]>;
      interaction.scaled.addEventListener(spy);
      patchPickRay(
        [
          mercatorToCartesian([0.5, 0.5, 0]),
          mercatorToCartesian([1, 2, 2]),
          mercatorToCartesian([1, 4, 4]),
          mercatorToCartesian([1, 4, 4]),
        ],
        sandbox,
      );
      const feature = createHandlerFeature(AxisAndPlanes.X);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0.5, 0.5, 0],
        position: [0.5, 0.5, 0],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 2, 2],
        position: [1, 2, 2],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 4, 4],
        position: [1, 4, 4],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [1, 4, 4],
        position: [1, 4, 4],
        ...eventBase,
      });

      expect(spy).to.have.been.calledThrice;
      expect(spy.getCall(0).args[0].map((i) => Math.round(i))).to.have.members([
        2, 1, 1,
      ]);
      expect(spy.getCall(1).args[0].map((i) => Math.round(i))).to.have.members([
        1, 1, 1,
      ]);
      expect(spy.getCall(2).args[0].map((i) => Math.round(i))).to.have.members([
        1, 1, 1,
      ]);
    });

    it('should call scale y if dragging the y axis handler', async () => {
      const spy = sandbox.spy() as SinonSpy<[ScaleEvent]>;
      interaction.scaled.addEventListener(spy);
      patchPickRay(
        [
          mercatorToCartesian([0.5, 0.5, 0]),
          mercatorToCartesian([1, 2, 2]),
          mercatorToCartesian([1, 4, 4]),
          mercatorToCartesian([1, 4, 4]),
        ],
        sandbox,
      );
      const feature = createHandlerFeature(AxisAndPlanes.Y);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0.5, 0.5, 0],
        position: [0.5, 0.5, 0],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 2, 2],
        position: [1, 2, 2],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 4, 4],
        position: [1, 4, 4],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [1, 4, 4],
        position: [1, 4, 4],
        ...eventBase,
      });

      expect(spy).to.have.been.calledThrice;
      expect(spy.getCall(0).args[0].map((i) => Math.round(i))).to.have.members([
        1, 4, 1,
      ]);
      expect(spy.getCall(1).args[0].map((i) => Math.round(i))).to.have.members([
        1, 2, 1,
      ]);
      expect(spy.getCall(2).args[0].map((i) => Math.round(i))).to.have.members([
        1, 1, 1,
      ]);
    });

    it('should call scale z if dragging the z axis handler', async () => {
      const spy = sandbox.spy() as SinonSpy<[ScaleEvent]>;
      interaction.scaled.addEventListener(spy);
      patchPickRay(
        [
          mercatorToCartesian([0.5, 0.5, 0.5]),
          mercatorToCartesian([1, 2, 2]),
          mercatorToCartesian([1, 4, 4]),
          mercatorToCartesian([1, 4, 4.0000001]),
        ],
        sandbox,
      );
      const feature = createHandlerFeature(AxisAndPlanes.Z);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0.5, 0.5, 0],
        position: [0.5, 0.5, 0],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 2, 2],
        position: [1, 2, 2],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 4, 4],
        position: [1, 4, 4],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [1, 4, 4],
        position: [1, 4, 4],
        ...eventBase,
      });

      expect(spy).to.have.been.calledThrice;
      expect(spy.getCall(0).args[0].map((i) => Math.round(i))).to.have.members([
        1, 4, 1,
      ]);
      expect(spy.getCall(1).args[0].map((i) => Math.round(i))).to.have.members([
        1, 2, 1,
      ]);
      expect(spy.getCall(2).args[0].map((i) => Math.round(i))).to.have.members([
        1, 1, 1,
      ]);
    });
  });

  describe('2D handling', () => {
    let map: OpenlayersMap;
    let setup: TransformationSetup;
    let interaction: ScaleInteraction;

    before(async () => {
      map = await getOpenlayersMap({});
      setup = await setupTransformationHandler(map, TransformationMode.SCALE);
      setup.transformationHandler.setFeatures([
        new Feature({ geometry: new Point([0, 0]) }),
      ]);
      interaction = new ScaleInteraction(setup.transformationHandler);
    });

    after(() => {
      interaction.destroy();
      setup.destroy();
    });

    it('should call scale x/y if dragging the plane handler', async () => {
      const spy = sandbox.spy() as SinonSpy<[ScaleEvent]>;
      interaction.scaled.addEventListener(spy);
      const feature = createHandlerFeature(AxisAndPlanes.XY);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0.5, 0.5],
        position: [0.5, 0.5],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 2],
        position: [1, 2],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 4],
        position: [1, 4],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [1, 4],
        position: [1, 4],
        ...eventBase,
      });

      expect(spy).to.have.been.calledThrice;
      expect(spy.getCall(0).args[0].map((i) => Math.round(i))).to.have.members([
        3, 3, 1,
      ]);
      expect(spy.getCall(1).args[0].map((i) => Math.round(i))).to.have.members([
        2, 2, 1,
      ]);
      expect(spy.getCall(2).args[0].map((i) => Math.round(i))).to.have.members([
        1, 1, 1,
      ]);
    });

    it('should call scale x if dragging the x axis handler', async () => {
      const spy = sandbox.spy() as SinonSpy<[ScaleEvent]>;
      interaction.scaled.addEventListener(spy);
      const feature = createHandlerFeature(AxisAndPlanes.X);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0.5, 0.5],
        position: [0.5, 0.5],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 2],
        position: [1, 2],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 4],
        position: [1, 4],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [1, 4],
        position: [1, 4],
        ...eventBase,
      });

      expect(spy).to.have.been.calledThrice;
      expect(spy.getCall(0).args[0].map((i) => Math.round(i))).to.have.members([
        2, 1, 1,
      ]);
      expect(spy.getCall(1).args[0].map((i) => Math.round(i))).to.have.members([
        1, 1, 1,
      ]);
      expect(spy.getCall(2).args[0].map((i) => Math.round(i))).to.have.members([
        1, 1, 1,
      ]);
    });

    it('should call scale y if dragging the y axis handler', async () => {
      const spy = sandbox.spy() as SinonSpy<[ScaleEvent]>;
      interaction.scaled.addEventListener(spy);
      const feature = createHandlerFeature(AxisAndPlanes.Y);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0.5, 0.5],
        position: [0.5, 0.5],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 2],
        position: [1, 2],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 4],
        position: [1, 4],
        ...eventBase,
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [1, 4],
        position: [1, 4],
        ...eventBase,
      });

      expect(spy).to.have.been.calledThrice;
      expect(spy.getCall(0).args[0].map((i) => Math.round(i))).to.have.members([
        1, 4, 1,
      ]);
      expect(spy.getCall(1).args[0].map((i) => Math.round(i))).to.have.members([
        1, 2, 1,
      ]);
      expect(spy.getCall(2).args[0].map((i) => Math.round(i))).to.have.members([
        1, 1, 1,
      ]);
    });
  });
});
