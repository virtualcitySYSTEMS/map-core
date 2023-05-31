import { Feature } from 'ol';
import { Point } from 'ol/geom.js';
import { Cartographic } from '@vcmap-cesium/engine';
import { getCesiumMap } from '../../../helpers/cesiumHelpers.js';
import {
  AxisAndPlanes,
  EventType,
  ExtrudeInteraction,
  TransformationMode,
} from '../../../../../index.js';
import {
  setupTransformationHandler,
  createHandlerFeature,
  patchPickRay,
} from './setupTransformationHandler.js';

describe('ExtrudeInteraction', () => {
  let sandbox;
  let map;
  /** @type {TransformationSetup} */
  let setup;

  before(async () => {
    sandbox = sinon.createSandbox();
    map = getCesiumMap({});
    setup = await setupTransformationHandler(map, TransformationMode.EXTRUDE);
    await setup.transformationHandler.setFeatures([
      new Feature({ geometry: new Point([0, 0, 0]) }),
    ]);
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(() => {
    setup.destroy();
  });

  describe('extruding', () => {
    it('should call extruded if dragging a handler', async () => {
      const interaction = new ExtrudeInteraction(setup.transformationHandler);
      const spy = sandbox.spy();
      interaction.extruded.addEventListener(spy);
      patchPickRay(
        [
          Cartographic.toCartesian(new Cartographic(0, 0, 1)),
          Cartographic.toCartesian(new Cartographic(0, 0, 2)),
          Cartographic.toCartesian(new Cartographic(0, 0, 4)),
          Cartographic.toCartesian(new Cartographic(0, 0, 4)),
        ],
        sandbox,
      );
      const feature = createHandlerFeature(AxisAndPlanes.Z);
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGSTART,
        positionOrPixel: [0, 0, 2],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [0, 0, 2],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAG,
        positionOrPixel: [0, 0, 4],
        windowPosition: [0, 0],
      });
      await interaction.pipe({
        map,
        feature,
        type: EventType.DRAGEND,
        positionOrPixel: [0, 0, 4],
        windowPosition: [0, 0],
      });
      interaction.destroy();

      expect(spy).to.have.been.calledThrice;
      expect(spy.getCall(0).args.map((i) => Math.round(i))).to.have.members([
        1,
      ]);
      expect(spy.getCall(1).args.map((i) => Math.round(i))).to.have.members([
        2,
      ]);
      expect(spy.getCall(2).args.map((i) => Math.round(i))).to.have.members([
        0,
      ]);
    });
  });
});
