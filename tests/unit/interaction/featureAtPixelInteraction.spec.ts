import { expect } from 'chai';
import type { SinonSandbox, SinonStub } from 'sinon';
import sinon from 'sinon';
import type { Primitive, Scene } from '@vcmap-cesium/engine';
import {
  Cartesian2,
  Cartesian3,
  Clock,
  Entity,
  Ray,
} from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';
import Feature from 'ol/Feature.js';
import FeatureAtPixel from '../../../src/interaction/featureAtPixelInteraction.js';
import OpenlayersMap from '../../../src/map/openlayersMap.js';
import {
  EventType,
  ModificationKeyType,
  PointerEventType,
  PointerKeyType,
} from '../../../src/interaction/interactionType.js';
import Projection from '../../../src/util/projection.js';
import {
  createDummyCesium3DTileFeature,
  setCesiumMap,
} from '../helpers/cesiumHelpers.js';
import VcsApp from '../../../src/vcsApp.js';
import { allowPicking, vcsLayerName } from '../../../src/layer/layerSymbols.js';
import type {
  CesiumMap,
  FeatureAtPixelInteraction,
  InteractionEvent,
} from '../../../index.js';
import { vectorClusterGroupName } from '../../../index.js';
import { primitives } from '../../../src/layer/vectorSymbols.js';
import { arrayCloseTo } from '../helpers/helpers.js';

describe('FeatureAtPixelInteraction', () => {
  let sandbox: SinonSandbox;
  let pick: SinonStub;
  let sceneStub: Scene;
  /** @type {import("@vcmap/core").FeatureAtPixelInteraction} */
  let fap: FeatureAtPixelInteraction;
  let app: VcsApp;
  let mercatorPosition: Coordinate;
  let cartesianPosition: Cartesian3;
  let positionSpy: SinonStub;
  let cesiumMap: CesiumMap;

  before(async () => {
    sandbox = sinon.createSandbox();
    app = new VcsApp();
    mercatorPosition = [5845000, 1505147, 0];
    cartesianPosition = Cartesian3.fromDegrees(
      ...(Projection.mercatorToWgs84(mercatorPosition) as [
        number,
        number,
        number,
      ]),
    );
    cesiumMap = await setCesiumMap(app);
  });

  beforeEach(() => {
    sceneStub = cesiumMap.getScene()!;
    sceneStub.pickTranslucentDepth = false;
    pick = sandbox.stub(sceneStub, 'pick');
    positionSpy = sandbox
      .stub(sceneStub, 'pickPosition')
      .returns(cartesianPosition.clone());
    fap = new FeatureAtPixel();
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(() => {
    app.destroy();
  });

  function setup3DTest(dummy: unknown): Promise<InteractionEvent> {
    pick.returns(dummy);
    const event: InteractionEvent = {
      pointer: PointerKeyType.LEFT,
      pointerEvent: PointerEventType.MOVE,
      windowPosition: new Cartesian2(0, 0),
      map: cesiumMap,
      type: EventType.DRAGSTART,
      key: ModificationKeyType.NONE,
    };

    return fap.pipe(event).then((returnedEvent) => {
      expect(positionSpy).to.not.have.been.called;
      return returnedEvent;
    });
  }

  describe('dragging features', () => {
    it('should store dragging feature', () => {
      const dummy = { primitive: { olFeature: 'test' } };
      pick.returns(dummy);
      const event = {
        pointer: PointerKeyType.LEFT,
        pointerEvent: PointerEventType.MOVE,
        windowPosition: new Cartesian2(0, 0),
        map: cesiumMap,
        type: EventType.DRAGSTART,
        key: ModificationKeyType.NONE,
      };

      return fap
        .pipe({ ...event })
        .then(() => {
          expect(pick).to.have.been.calledOnce;
          pick.returns({});
          return fap.pipe({ ...event, type: EventType.DRAG });
        })
        .then((returnedEvent) => {
          expect(pick).to.have.been.calledOnce;
          expect(returnedEvent).to.have.property('feature', 'test');
          return fap.pipe({ ...event, type: EventType.DRAGEND });
        })
        .then((returnedEvent) => {
          expect(pick).to.have.been.calledTwice;
          expect(returnedEvent).to.not.have.property('feature', 'test');
          pick.returns(dummy);
          return fap.pipe({ ...event, type: EventType.DRAG });
        })
        .then((returnedEvent) => {
          expect(pick).to.have.been.calledTwice;
          expect(returnedEvent).to.not.have.property('feature', 'test');
        });
    });

    it('should pick the position when dragging a feature, if the pickPositon entails the DRAG event type', () => {
      const dummy = createDummyCesium3DTileFeature(
        {},
        { [vcsLayerName]: 'test' },
      );
      return setup3DTest(dummy)
        .then(() => {
          fap.pickPosition = EventType.DRAGEVENTS;
          return fap.pipe({
            map: cesiumMap,
            type: EventType.DRAG,
            key: ModificationKeyType.NONE,
            pointer: PointerKeyType.LEFT,
            pointerEvent: PointerEventType.MOVE,
            windowPosition: new Cartesian2(0, 0),
          });
        })
        .then(() => {
          expect(positionSpy).to.have.been.called;
        });
    });
  });

  describe('OpenlayersMap', () => {
    let normalFeature: Feature;
    let clusterFeature: Feature;
    let map: OpenlayersMap;

    before(() => {
      normalFeature = new Feature({});

      const dummyMap = {
        forEachFeatureAtPixel(
          w: Coordinate,
          cb: (...args: Feature[]) => void,
        ): void {
          if (w[0] === 0) {
            cb(normalFeature);
          } else {
            cb(clusterFeature);
          }
        },
        setTarget(): void {},
      };
      map = new OpenlayersMap({});
      // @ts-expect-error: bad joojoo, but still
      map._olMap = dummyMap;
    });

    beforeEach(() => {
      clusterFeature = new Feature({
        features: [normalFeature, normalFeature],
      });
      clusterFeature[vectorClusterGroupName] = 'foo';
    });

    after(() => {
      map.destroy();
    });

    it('should pick a feature', async () => {
      const windowPosition = new Cartesian2(0, 0);
      const event: InteractionEvent = {
        pointer: PointerKeyType.LEFT,
        pointerEvent: PointerEventType.MOVE,
        map,
        type: EventType.CLICK,
        key: ModificationKeyType.NONE,
        windowPosition,
      };

      const featureEvent = await fap.pipe(event);
      expect(featureEvent).to.have.property('feature', normalFeature);
    });

    it('should only pick features if olcs_allowPicking is not false', () => {
      const windowPosition = new Cartesian2(0, 0);
      const event: InteractionEvent = {
        pointer: PointerKeyType.LEFT,
        pointerEvent: PointerEventType.MOVE,
        map,
        type: EventType.CLICK,
        key: ModificationKeyType.NONE,
        windowPosition,
      };

      return fap.pipe(event).then(() => {
        expect(event.feature).to.equal(normalFeature);
        normalFeature.set('olcs_allowPicking', false, false);
        event.feature = undefined;
        return fap.pipe(event).then(() => {
          expect(event.feature).to.equal(undefined);
        });
      });
    });
  });

  describe('Cesium', () => {
    it('should add all picked symbols from a TilesetLayer to the feature', () => {
      const test = Symbol('testSymobl');
      const dummy = createDummyCesium3DTileFeature(
        {},
        { [vcsLayerName]: 'test', [test]: true },
      );
      return setup3DTest(dummy).then((event) => {
        expect(event)
          .to.have.property('feature')
          .and.to.have.property(test, true);
      });
    });

    describe('feature detections', () => {
      it('should detect vector primitive features in 3D -> obj.primitive.olFeature', () => {
        const olFeature = 'test';
        const dummy = {
          primitive: { olFeature },
        };
        return setup3DTest(dummy).then((event) => {
          expect(event).to.have.property('feature', 'test');
        });
      });

      it('should detect 3DTileFeatures, aka buildings -> obj.primitive with layerName', () => {
        const dummy = createDummyCesium3DTileFeature(
          {},
          { [vcsLayerName]: 'test' },
        );
        return setup3DTest(dummy).then((event) => {
          expect(event)
            .to.have.property('feature')
            .to.have.property(vcsLayerName, 'test');
        });
      });

      it('should ignore 3DTileFeatures, aka buildings -> obj.primitive with layerName if the have allowPicking symbol set to false', () => {
        const dummy = createDummyCesium3DTileFeature(
          {},
          { [vcsLayerName]: 'test', [allowPicking]: false },
        );
        return setup3DTest(dummy).then((event) => {
          expect(event).to.have.not.property('feature');
        });
      });

      it('should detect vector entity features in 3D -> obj.id.olFeature', () => {
        const olFeature = 'test';
        const dummy = {
          id: { olFeature },
        };
        return setup3DTest(dummy).then((event) => {
          expect(event).to.have.property('feature', 'test');
        });
      });

      it('should detect 3D Entities in 3D -> obj.id with layerName', () => {
        const dummy = {
          id: new Entity(),
        };
        dummy.id[vcsLayerName] = 'test';
        return setup3DTest(dummy).then((event) => {
          expect(event)
            .to.have.property('feature')
            .to.have.property(vcsLayerName, 'test');
        });
      });
    });

    describe('picking behavior', () => {
      it('should only pick position on CLICK by default', () => {
        const dummy = {
          id: new Entity(),
        };
        dummy.id[vcsLayerName] = 'test';

        const event: InteractionEvent = {
          pointer: PointerKeyType.LEFT,
          pointerEvent: PointerEventType.MOVE,
          windowPosition: new Cartesian2(0, 0),
          map: cesiumMap,
          type: EventType.DRAGSTART,
          key: ModificationKeyType.NONE,
        };

        return setup3DTest(dummy)
          .then(() => {
            fap.pickPosition = EventType.DRAGSTART;
            return fap.pipe(event);
          })
          .then(() => {
            expect(positionSpy).to.have.been.calledOnce;
            event.type = EventType.CLICK;
            return fap.pipe(event);
          })
          .then(() => {
            expect(positionSpy).to.have.been.calledOnce;
            fap.pickPosition |= EventType.CLICK;
            return fap.pipe(event);
          })
          .then(() => {
            expect(positionSpy).to.have.been.calledTwice;
          });
      });

      it('should pick translucent on olFeature', () => {
        pick.returns({ primitive: { olFeature: true } });
        const event = {
          pointer: PointerKeyType.LEFT,
          pointerEvent: PointerEventType.MOVE,
          windowPosition: new Cartesian2(0, 0),
          map: cesiumMap,
          type: EventType.CLICK,
          key: ModificationKeyType.NONE,
        };

        fap.pickTranslucent = false;

        return fap
          .pipe(event)
          .then(() => {
            expect(positionSpy).to.have.been.called;
            expect(sceneStub).to.have.property('pickTranslucentDepth', false);
            fap.pickTranslucent = true;
            return fap.pipe(event);
          })
          .then(() => {
            expect(positionSpy).to.have.been.calledTwice;
            expect(sceneStub).to.have.property('pickTranslucentDepth', false);
          });
      });

      it('should reset translucent picking on the scene', async () => {
        pick.returns({ primitive: { olFeature: true } });
        const event = {
          pointer: PointerKeyType.LEFT,
          pointerEvent: PointerEventType.MOVE,
          windowPosition: new Cartesian2(0, 0),
          map: cesiumMap,
          type: EventType.CLICK,
          key: ModificationKeyType.NONE,
        };

        // @ts-expect-error: stub
        sandbox.stub(cesiumMap, 'getCesiumWidget').returns({
          clock: new Clock({}),
        });
        sceneStub.pickTranslucentDepth = true;
        fap.pickTranslucent = true;
        await fap.pipe(event);
        expect(sceneStub).to.have.property('pickTranslucentDepth', true);
      });

      it('should pick using a ray excluding the feature, if the picked feature is excluded from positions', async () => {
        const olFeature = new Feature({});
        const primitive = {};
        olFeature[primitives] = [primitive as Primitive];
        const pickFromRay = sandbox.stub();
        pickFromRay.returns({
          position: Cartesian3.fromDegrees(12, 12, 0),
        });
        sceneStub.pickFromRay = pickFromRay;
        pick.returns({ primitive: { olFeature } });
        fap.excludeFromPickPosition(olFeature);
        fap.pullPickedPosition = EventType.NONE;
        const event = await fap.pipe({
          ray: new Ray(),
          pointer: PointerKeyType.LEFT,
          pointerEvent: PointerEventType.DOWN,
          windowPosition: new Cartesian2(0, 0),
          map: cesiumMap,
          type: EventType.CLICK,
          key: ModificationKeyType.NONE,
        });
        expect(pickFromRay).to.have.been.calledWith(event.ray, [primitive]);
        expect(event).to.have.property('position');
        arrayCloseTo(event.position!, Projection.wgs84ToMercator([12, 12, 0]));
      });

      it('should not update the position if the pickFromRay returns Cartesian.ZERO', async () => {
        const olFeature = new Feature({});
        const primitive = {};
        olFeature[primitives] = [primitive as Primitive];
        const pickFromRay = sandbox.stub();
        pickFromRay.returns({
          position: Cartesian3.ZERO,
        });
        sceneStub.pickFromRay = pickFromRay;
        pick.returns({ primitive: { olFeature } });
        fap.excludeFromPickPosition(olFeature);
        fap.pullPickedPosition = EventType.NONE;
        const event = await fap.pipe({
          ray: new Ray(),
          pointer: PointerKeyType.LEFT,
          pointerEvent: PointerEventType.DOWN,
          windowPosition: new Cartesian2(0, 0),
          map: cesiumMap,
          type: EventType.CLICK,
          key: ModificationKeyType.NONE,
          position: [12, 12, 0],
          positionOrPixel: [12, 12, 0],
        });
        expect(pickFromRay).to.have.been.calledWith(event.ray, [primitive]);
        expect(event).to.have.property('position');
        arrayCloseTo(event.position!, [12, 12, 0]);
      });

      describe('with globe transparency', () => {
        beforeEach(() => {
          sceneStub.globe.translucency.enabled = true;
        });

        afterEach(() => {
          sceneStub.globe.translucency.enabled = false;
        });

        it('should pick underground features, if they arent too far away', async () => {
          const olFeature = new Feature({});
          const primitive = {};
          olFeature[primitives] = [primitive as Primitive];

          const pickFromRay = sandbox.stub();
          pickFromRay.returns({
            position: Cartesian3.fromDegrees(12, 12, -10),
          });
          const globePick = sandbox.stub();
          globePick.returns(Cartesian3.fromDegrees(12, 12, 0));

          sceneStub.pickFromRay = pickFromRay;
          sceneStub.globe.pick = globePick;
          pick.returns({ primitive: { olFeature } });
          fap.excludeFromPickPosition(olFeature);
          fap.pullPickedPosition = EventType.NONE;
          const event = await fap.pipe({
            ray: new Ray(),
            pointer: PointerKeyType.LEFT,
            pointerEvent: PointerEventType.DOWN,
            windowPosition: new Cartesian2(0, 0),
            map: cesiumMap,
            type: EventType.CLICK,
            key: ModificationKeyType.NONE,
          });
          expect(pickFromRay).to.have.been.calledWith(event.ray, [primitive]);
          expect(event).to.have.property('position');
          arrayCloseTo(
            event.position!,
            Projection.wgs84ToMercator([12, 12, -10]),
          );
        });

        it('should not pick underground features, if they aren too far away', async () => {
          const olFeature = new Feature({});
          const primitive = {};
          olFeature[primitives] = [primitive as Primitive];
          const pickFromRay = sandbox.stub();
          pickFromRay.returns({
            position: Cartesian3.fromDegrees(12, 12, -20000),
          });
          const globePick = sandbox.stub();
          globePick.returns(Cartesian3.fromDegrees(12, 12, 0));
          sceneStub.pickFromRay = pickFromRay;
          sceneStub.globe.pick = globePick;
          pick.returns({ primitive: { olFeature } });
          fap.excludeFromPickPosition(olFeature);
          fap.pullPickedPosition = EventType.NONE;
          const event = await fap.pipe({
            ray: new Ray(),
            pointer: PointerKeyType.LEFT,
            pointerEvent: PointerEventType.DOWN,
            windowPosition: new Cartesian2(0, 0),
            map: cesiumMap,
            type: EventType.CLICK,
            key: ModificationKeyType.NONE,
          });
          expect(pickFromRay).to.have.been.calledWith(event.ray, [primitive]);
          expect(event).to.have.property('position');
          arrayCloseTo(
            event.position!,
            Projection.wgs84ToMercator([12, 12, 0]),
          );
        });
      });
    });
  });
});
