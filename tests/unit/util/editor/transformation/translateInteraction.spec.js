import { Feature } from 'ol';
import { Point } from 'ol/geom.js';
import { getCesiumMap } from '../../../helpers/cesiumHelpers.js';
import { createHandlerFeature, patchPickRay, setupTransformationHandler } from './setupTransformationHandler.js';
import {
  AXIS_AND_PLANES,
  TransformationMode,
  EventType,
  TranslateInteraction, mercatorToCartesian,
} from '../../../../../index.js';
import { getOpenlayersMap } from '../../../helpers/openlayersHelpers.js';

describe('TranslateInteraction', () => {
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
      await setup.transformationHandler.setFeatures([new Feature({ geometry: new Point([0, 0, 0]) })]);
      interaction = new TranslateInteraction(setup.transformationHandler);
    });

    after(() => {
      interaction.destroy();
      setup.destroy();
    });

    it('should call translate x/y if dragging the plane handler', async () => {
      const spy = sandbox.spy();
      interaction.translated.addEventListener(spy);
      patchPickRay([
        mercatorToCartesian([0, 0, 0]),
        mercatorToCartesian([1, 2, 0]),
        mercatorToCartesian([1, 4, 0]),
        mercatorToCartesian([1, 4, 0]),
      ], sandbox);
      const feature = createHandlerFeature(AXIS_AND_PLANES.XY);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0, 0, 0],
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
        positionOrPixel: [1, 4, 5],
        windowPosition: [0, 0],
      });

      expect(spy).to.have.been.calledThrice;
      expect(spy.getCall(0).args[0].map(i => Math.round(i))).to.have.members([1, 2, 0]);
      expect(spy.getCall(1).args[0].map(i => Math.round(i))).to.have.members([0, 2, 0]);
      expect(spy.getCall(2).args[0].map(i => Math.round(i))).to.have.members([0, 0, 0]);
    });

    it('should call translate x/z if dragging the plane handler', async () => {
      const spy = sandbox.spy();
      interaction.translated.addEventListener(spy);
      patchPickRay([
        mercatorToCartesian([0, 0, 0]),
        mercatorToCartesian([1, 0, 2]),
        mercatorToCartesian([1, 0, 4]),
        mercatorToCartesian([1, 0, 4]),
      ], sandbox);
      const feature = createHandlerFeature(AXIS_AND_PLANES.XZ);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0, 0, 0],
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
        positionOrPixel: [1, 4, 5],
        windowPosition: [0, 0],
      });

      expect(spy).to.have.been.calledThrice;
      expect(spy.getCall(0).args[0].map(i => Math.round(i))).to.have.members([1, 0, 2]);
      expect(spy.getCall(1).args[0].map(i => Math.round(i))).to.have.members([0, 0, 2]);
      expect(spy.getCall(2).args[0].map(i => Math.round(i))).to.have.members([0, 0, 0]);
    });

    it('should call translate y/z if dragging the plane handler', async () => {
      const spy = sandbox.spy();
      interaction.translated.addEventListener(spy);
      patchPickRay([
        mercatorToCartesian([0, 0, 0]),
        mercatorToCartesian([0, 2, 1]),
        mercatorToCartesian([0, 4, 1]),
        mercatorToCartesian([0, 4, 1]),
      ], sandbox);
      const feature = createHandlerFeature(AXIS_AND_PLANES.XY);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0, 0, 0],
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
        positionOrPixel: [1, 4, 5],
        windowPosition: [0, 0],
      });

      expect(spy).to.have.been.calledThrice;
      expect(spy.getCall(0).args[0].map(i => Math.round(i))).to.have.members([0, 2, 1]);
      expect(spy.getCall(1).args[0].map(i => Math.round(i))).to.have.members([0, 2, 0]);
      expect(spy.getCall(2).args[0].map(i => Math.round(i))).to.have.members([0, 0, 0]);
    });

    it('should call translate x if dragging the x axis handler', async () => {
      const spy = sandbox.spy();
      interaction.translated.addEventListener(spy);
      patchPickRay([
        mercatorToCartesian([0, 0, 0]),
        mercatorToCartesian([1, 2, 2]),
        mercatorToCartesian([1, 4, 4]),
        mercatorToCartesian([1, 4, 4]),
      ], sandbox);
      const feature = createHandlerFeature(AXIS_AND_PLANES.X);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0, 0, 0],
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
      expect(spy.getCall(0).args[0].map(i => Math.round(i))).to.have.members([1, 0, 0]);
      expect(spy.getCall(1).args[0].map(i => Math.round(i))).to.have.members([0, 0, 0]);
      expect(spy.getCall(2).args[0].map(i => Math.round(i))).to.have.members([0, 0, 0]);
    });

    it('should call translate y if dragging the y axis handler', async () => {
      const spy = sandbox.spy();
      interaction.translated.addEventListener(spy);
      patchPickRay([
        mercatorToCartesian([0, 0, 0]),
        mercatorToCartesian([1, 2, 2]),
        mercatorToCartesian([1, 4, 4]),
        mercatorToCartesian([1, 4, 4]),
      ], sandbox);
      const feature = createHandlerFeature(AXIS_AND_PLANES.Y);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0, 0, 0],
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
      expect(spy.getCall(0).args[0].map(i => Math.round(i))).to.have.members([0, 2, 0]);
      expect(spy.getCall(1).args[0].map(i => Math.round(i))).to.have.members([0, 2, 0]);
      expect(spy.getCall(2).args[0].map(i => Math.round(i))).to.have.members([0, 0, 0]);
    });

    it('should call translate z if dragging the z axis handler', async () => {
      const spy = sandbox.spy();
      interaction.translated.addEventListener(spy);
      patchPickRay([
        mercatorToCartesian([0, 0, 0]),
        mercatorToCartesian([1, 2, 2]),
        mercatorToCartesian([1, 4, 4]),
        mercatorToCartesian([1, 4, 4]),
      ], sandbox);
      const feature = createHandlerFeature(AXIS_AND_PLANES.Y);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0, 0, 0],
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
      expect(spy.getCall(0).args[0].map(i => Math.round(i))).to.have.members([0, 0, 2]);
      expect(spy.getCall(1).args[0].map(i => Math.round(i))).to.have.members([0, 0, 2]);
      expect(spy.getCall(2).args[0].map(i => Math.round(i))).to.have.members([0, 0, 0]);
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
      await setup.transformationHandler.setFeatures([new Feature({ geometry: new Point([0, 0, 0]) })]);
      interaction = new TranslateInteraction(setup.transformationHandler);
    });

    after(() => {
      interaction.destroy();
      setup.destroy();
    });

    it('should call translate x/y if dragging the plane handler', async () => {
      const spy = sandbox.spy();
      interaction.translated.addEventListener(spy);
      const feature = createHandlerFeature(AXIS_AND_PLANES.XY);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0, 0, 0],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 2, 0],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 4, 0],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [1, 4, 0],
        windowPosition: [0, 0],
      });

      expect(spy).to.have.been.calledThrice;
      expect(spy.getCall(0).args[0].map(i => Math.round(i))).to.have.members([1, 2, 0]);
      expect(spy.getCall(1).args[0].map(i => Math.round(i))).to.have.members([0, 2, 0]);
      expect(spy.getCall(2).args[0].map(i => Math.round(i))).to.have.members([0, 0, 0]);
    });

    it('should call translate x if dragging the x axis handler', async () => {
      const spy = sandbox.spy();
      interaction.translated.addEventListener(spy);
      const feature = createHandlerFeature(AXIS_AND_PLANES.X);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0, 0, 0],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 2, 0],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 4, 0],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [1, 4, 0],
        windowPosition: [0, 0],
      });

      expect(spy).to.have.been.calledThrice;
      expect(spy.getCall(0).args[0].map(i => Math.round(i))).to.have.members([1, 0, 0]);
      expect(spy.getCall(1).args[0].map(i => Math.round(i))).to.have.members([0, 0, 0]);
      expect(spy.getCall(2).args[0].map(i => Math.round(i))).to.have.members([0, 0, 0]);
    });

    it('should call translate y if dragging the y axis handler', async () => {
      const spy = sandbox.spy();
      interaction.translated.addEventListener(spy);
      const feature = createHandlerFeature(AXIS_AND_PLANES.Y);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0, 0, 0],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 2, 0],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [1, 4, 0],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [1, 4, 0],
        windowPosition: [0, 0],
      });

      expect(spy).to.have.been.calledThrice;
      expect(spy.getCall(0).args[0].map(i => Math.round(i))).to.have.members([0, 2, 0]);
      expect(spy.getCall(1).args[0].map(i => Math.round(i))).to.have.members([0, 2, 0]);
      expect(spy.getCall(2).args[0].map(i => Math.round(i))).to.have.members([0, 0, 0]);
    });
  });
});
