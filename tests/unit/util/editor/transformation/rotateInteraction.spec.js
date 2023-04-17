import { Feature } from 'ol';
import { Point } from 'ol/geom.js';
import { Math as CesiumMath } from '@vcmap-cesium/engine';
import { getCesiumMap } from '../../../helpers/cesiumHelpers.js';
import { createHandlerFeature, patchPickRay, setupTransformationHandler } from './setupTransformationHandler.js';
import {
  EventType,
  AXIS_AND_PLANES,
  TransformationMode,
  RotateInteraction, mercatorToCartesian,
} from '../../../../../index.js';
import { getOpenlayersMap } from '../../../helpers/openlayersHelpers.js';

function ensureRotateEvent(event, angle, axis) {
  expect(event).to.have.property('axis', axis);
  expect(event).to.have.property('angle')
    .and.to.satisfy(a => CesiumMath.equalsEpsilon(a, angle, CesiumMath.EPSILON5));
}

describe('RotateInteraction', () => {
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
      interaction = new RotateInteraction(setup.transformationHandler);
    });

    after(() => {
      interaction.destroy();
      setup.destroy();
    });

    it('should rotate around the Z axis', async () => {
      const spy = sandbox.spy();
      interaction.rotated.addEventListener(spy);
      patchPickRay([
        mercatorToCartesian([0.5, 0.5, 0]),
        mercatorToCartesian([-0.5, -0.5, 2]),
        mercatorToCartesian([0.5, -0.5, 4]),
        mercatorToCartesian([0.5, -0.5, 4]),
      ], sandbox);
      const feature = createHandlerFeature(AXIS_AND_PLANES.Z);
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
        positionOrPixel: [-0.5, -0.5, 2],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [0.5, -0.5, 4],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [0.5, -0.5, 4],
        windowPosition: [0, 0],
      });

      expect(spy).to.have.been.calledThrice;
      ensureRotateEvent(spy.getCall(0).args[0], -Math.PI, AXIS_AND_PLANES.Z);
      ensureRotateEvent(spy.getCall(1).args[0], Math.PI / 2, AXIS_AND_PLANES.Z);
      ensureRotateEvent(spy.getCall(2).args[0], 0, AXIS_AND_PLANES.Z);
    });

    it('should rotate around the X axis', async () => {
      const spy = sandbox.spy();
      interaction.rotated.addEventListener(spy);
      patchPickRay([
        mercatorToCartesian([0, 0.5, 0.5]),
        mercatorToCartesian([2, -0.5, -0.5]),
        mercatorToCartesian([2, 0.5, -0.5]),
        mercatorToCartesian([5, 0.5, -0.5]),
      ], sandbox);
      const feature = createHandlerFeature(AXIS_AND_PLANES.X);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0, 0.5, 0.5],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [2, -0.5, -0.5],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [2, 0.5, -0.5],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [5, 0.5, -0.5],
        windowPosition: [0, 0],
      });

      expect(spy).to.have.been.calledThrice;
      ensureRotateEvent(spy.getCall(0).args[0], Math.PI, AXIS_AND_PLANES.X);
      ensureRotateEvent(spy.getCall(1).args[0], Math.PI / 2, AXIS_AND_PLANES.X);
      ensureRotateEvent(spy.getCall(2).args[0], 0, AXIS_AND_PLANES.X);
    });

    it('should rotate around the Y axis', async () => {
      const spy = sandbox.spy();
      interaction.rotated.addEventListener(spy);
      patchPickRay([
        mercatorToCartesian([0.5, 0, 0.5]),
        mercatorToCartesian([-0.5, 2, -0.5]),
        mercatorToCartesian([0.5, 2, -0.5]),
        mercatorToCartesian([0.5, 5, -0.5]),
      ], sandbox);
      const feature = createHandlerFeature(AXIS_AND_PLANES.Y);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0, 0.5, 0.5],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [2, -0.5, -0.5],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [2, 0.5, -0.5],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [5, 0.5, -0.5],
        windowPosition: [0, 0],
      });

      expect(spy).to.have.been.calledThrice;
      ensureRotateEvent(spy.getCall(0).args[0], -Math.PI, AXIS_AND_PLANES.Y);
      ensureRotateEvent(spy.getCall(1).args[0], Math.PI / 2, AXIS_AND_PLANES.Y);
      ensureRotateEvent(spy.getCall(2).args[0], 0, AXIS_AND_PLANES.Y);
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
      interaction = new RotateInteraction(setup.transformationHandler);
    });

    after(() => {
      interaction.destroy();
      setup.destroy();
    });

    it('should rotate around the Z axis', async () => {
      const spy = sandbox.spy();
      interaction.rotated.addEventListener(spy);
      const feature = createHandlerFeature(AXIS_AND_PLANES.Z);
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
        positionOrPixel: [-0.5, -0.5, 0],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [0.5, -0.5, 0],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [0.5, -0.5, 0],
        windowPosition: [0, 0],
      });

      expect(spy).to.have.been.calledThrice;
      ensureRotateEvent(spy.getCall(0).args[0], -Math.PI, AXIS_AND_PLANES.Z);
      ensureRotateEvent(spy.getCall(1).args[0], Math.PI / 2, AXIS_AND_PLANES.Z);
      ensureRotateEvent(spy.getCall(2).args[0], 0, AXIS_AND_PLANES.Z);
    });
  });
});
