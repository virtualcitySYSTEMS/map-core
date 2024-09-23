import { expect } from 'chai';
import sinon, { SinonSandbox, SinonSpy, SinonStub } from 'sinon';
import {
  Cartesian2,
  Cartesian3,
  CesiumWidget,
  Clock,
  Entity,
  JulianDate,
  Scene,
} from '@vcmap-cesium/engine';
import { Coordinate } from 'ol/coordinate.js';
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
import VectorLayer from '../../../src/layer/vectorLayer.js';
import {
  createDummyCesium3DTileFeature,
  setCesiumMap,
} from '../helpers/cesiumHelpers.js';
import VcsApp from '../../../src/vcsApp.js';
import { vcsLayerName } from '../../../src/layer/layerSymbols.js';
import {
  CesiumMap,
  FeatureAtPixelInteraction,
  InteractionEvent,
} from '../../../index.js';

describe('FeatureAtPixelInteraction', () => {
  let sandbox: SinonSandbox;
  let pick: SinonStub;
  let sceneStub: Scene;
  let render: SinonSpy;
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
    render = sandbox.spy(sceneStub, 'render');
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
          pick.returns(null);
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
    it('should differentiate clusters in 2D', () => {
      const normalFeature = new Feature({});
      const clusterFeature = new Feature({ features: [] });
      const dummyLayer = new Feature({ name: 'dummy' });
      dummyLayer[vcsLayerName] = 'dummy';

      const dummyMap = {
        forEachFeatureAtPixel(
          w: Coordinate,
          cb: (...args: Feature[]) => void,
        ): void {
          if (w[0] === 0) {
            cb(normalFeature, dummyLayer);
          } else {
            cb(clusterFeature, dummyLayer);
          }
        },
      };
      const map = new OpenlayersMap({});
      // @ts-expect-error: bad joojoo, but still
      map._olMap = dummyMap;

      const windowPosition = new Cartesian2(0, 0);
      const event: InteractionEvent = {
        pointer: PointerKeyType.LEFT,
        pointerEvent: PointerEventType.MOVE,
        map,
        type: EventType.CLICK,
        key: ModificationKeyType.NONE,
        windowPosition,
      };

      return fap
        .pipe(event)
        .then(() => {
          expect(event)
            .to.have.property('feature')
            .and.to.not.have.property(vcsLayerName);
          windowPosition.x = 1;
          return fap.pipe(event);
        })
        .then(() => {
          expect(event)
            .to.have.property('feature')
            .and.to.have.property(vcsLayerName, 'dummy');
        });
    });

    it('should only pick features if olcs_allowPicking is not false', () => {
      const normalFeature = new Feature({});
      const dummyLayer = new VectorLayer({ name: 'dummy' });

      const dummyMap = {
        forEachFeatureAtPixel(
          w: Coordinate,
          cb: (f: Feature, l: VectorLayer) => void,
        ): void {
          cb(normalFeature, dummyLayer);
        },
      };
      const map = new OpenlayersMap({});
      // @ts-expect-error: bad joojoo, but still
      map._olMap = dummyMap;

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
        pick.returns({});
        const event: InteractionEvent = {
          pointer: PointerKeyType.LEFT,
          pointerEvent: PointerEventType.MOVE,
          windowPosition: new Cartesian2(0, 0),
          map: cesiumMap,
          type: EventType.DRAGSTART,
          key: ModificationKeyType.NONE,
        };

        return fap
          .pipe(event)
          .then(() => {
            expect(positionSpy).to.not.have.been.called;
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
            expect(render).to.not.have.been.called;
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

        sandbox.stub(cesiumMap, 'getCesiumWidget').returns({
          clock: new Clock({}),
        } as CesiumWidget);
        fap.pickTranslucent = false;

        return fap
          .pipe(event)
          .then(() => {
            expect(positionSpy).to.have.been.called;
            expect(render).to.not.have.been.called;
            expect(sceneStub).to.have.property('pickTranslucentDepth', false);
            fap.pickTranslucent = true;
            return fap.pipe(event);
          })
          .then(() => {
            expect(positionSpy).to.have.been.calledTwice;
            expect(render).to.have.been.calledOnce;
            expect(render.getCall(0).args[0]).to.be.an.instanceOf(JulianDate);
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

        sandbox.stub(cesiumMap, 'getCesiumWidget').returns({
          clock: new Clock({}),
        } as CesiumWidget);
        sceneStub.pickTranslucentDepth = true;
        fap.pickTranslucent = true;
        await fap.pipe(event);
        expect(sceneStub).to.have.property('pickTranslucentDepth', true);
      });

      it('should not pick translucent on pointcloud feature with attenuation', () => {
        pick.returns({
          primitive: { pointCloudShading: { attenuation: true } },
        });
        const event = {
          pointer: PointerKeyType.LEFT,
          pointerEvent: PointerEventType.MOVE,
          windowPosition: new Cartesian2(0, 0),
          map: cesiumMap,
          type: EventType.CLICK,
          key: ModificationKeyType.NONE,
        };
        sandbox.stub(cesiumMap, 'getCesiumWidget').returns({
          clock: new Clock({}),
        } as CesiumWidget);
        fap.pickTranslucent = true;

        return fap.pipe(event).then(() => {
          expect(positionSpy).to.have.been.called;
          expect(render).to.not.have.been.called;
          expect(sceneStub).to.have.property('pickTranslucentDepth', false);
        });
      });
    });
  });
});
