import { Feature } from 'ol';
import { Point } from 'ol/geom.js';
import { getCesiumMap } from '../../../helpers/cesiumHelpers.js';
import {
  createHandlerFeature,
  patchPickRay,
  setupTransformationHandler,
} from './setupTransformationHandler.js';
import {
  AxisAndPlanes,
  TransformationMode,
  EventType,
  ScaleInteraction,
  mercatorToCartesian,
} from '../../../../../index.js';
import { getOpenlayersMap } from '../../../helpers/openlayersHelpers.js';

describe('ScaleInteraction', () => {
  let sandbox;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('3D handling', () => {
    let map;
    /** @type {TransformationSetup} */
    let setup;
    let interaction;

    before(async () => {
      map = getCesiumMap({});
      setup = await setupTransformationHandler(map, TransformationMode.SCALE);
      await setup.transformationHandler.setFeatures([
        new Feature({ geometry: new Point([0, 0, 0]) }),
      ]);
      interaction = new ScaleInteraction(setup.transformationHandler);
    });

    after(() => {
      interaction.destroy();
      setup.destroy();
    });

    it('should call scale x/y if dragging the plane handler', async () => {
      const spy = sandbox.spy();
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
        positionOrPixel: [0.5, 0.5, 0],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 2, 2],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 4, 4],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [1, 4, 4],
        windowPosition: [0, 0],
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
      const spy = sandbox.spy();
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
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 2, 2],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 4, 4],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [1, 4, 4],
        windowPosition: [0, 0],
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
      const spy = sandbox.spy();
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
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 2, 2],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 4, 4],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [1, 4, 4],
        windowPosition: [0, 0],
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
    let map;
    /** @type {TransformationSetup} */
    let setup;
    let interaction;

    before(async () => {
      map = await getOpenlayersMap({});
      setup = await setupTransformationHandler(map, TransformationMode.SCALE);
      await setup.transformationHandler.setFeatures([
        new Feature({ geometry: new Point([0, 0]) }),
      ]);
      interaction = new ScaleInteraction(setup.transformationHandler);
    });

    after(() => {
      interaction.destroy();
      setup.destroy();
    });

    it('should call scale x/y if dragging the plane handler', async () => {
      const spy = sandbox.spy();
      interaction.scaled.addEventListener(spy);
      const feature = createHandlerFeature(AxisAndPlanes.XY);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0.5, 0.5],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 2],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 4],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [1, 4],
        windowPosition: [0, 0],
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
      const spy = sandbox.spy();
      interaction.scaled.addEventListener(spy);
      const feature = createHandlerFeature(AxisAndPlanes.X);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0.5, 0.5],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 2],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 4],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [1, 4],
        windowPosition: [0, 0],
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
      const spy = sandbox.spy();
      interaction.scaled.addEventListener(spy);
      const feature = createHandlerFeature(AxisAndPlanes.Y);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0.5, 0.5],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 2],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 4],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [1, 4],
        windowPosition: [0, 0],
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
