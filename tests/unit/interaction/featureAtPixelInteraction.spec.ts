import { expect } from 'chai';
import type { SinonSandbox, SinonStub } from 'sinon';
import sinon from 'sinon';
import type { I3SNode, Primitive, Scene } from '@vcmap-cesium/engine';
import {
  Cartesian2,
  Cartesian3,
  Clock,
  Entity,
  I3SDataProvider,
  Ray,
} from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';
import Feature from 'ol/Feature.js';
import FeatureAtPixel, {
  getFeatureFromPickObject,
} from '../../../src/interaction/featureAtPixelInteraction.js';
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
import {
  allowPicking,
  i3sData,
  vcsLayerName,
} from '../../../src/layer/layerSymbols.js';
import {
  cartesianToMercator,
  isProvidedFeature,
  vectorClusterGroupName,
  type CesiumMap,
  type FeatureAtPixelInteraction,
  type InteractionEvent,
  type PanoramaImage,
  type PanoramaMap,
} from '../../../index.js';
import { primitives } from '../../../src/layer/vectorSymbols.js';
import { arrayCloseTo } from '../helpers/helpers.js';
import {
  getPanoramaImage,
  getPanoramaMap,
} from '../helpers/panoramaHelpers.js';

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
    describe('i3s feature picking', () => {
      let i3sNode: I3SNode;
      let dataProvider: I3SDataProvider;
      let i3sPickObject: { content: { tile: { i3sNode: I3SNode } } };

      beforeEach(() => {
        dataProvider = new I3SDataProvider({});
        // eslint-disable-next-line @typescript-eslint/naming-convention
        i3sNode = { _dataProvider: dataProvider } as unknown as I3SNode;
        i3sPickObject = { content: { tile: { i3sNode } } };
      });

      it('should return the Cesium3DTileFeature and set vcsLayerName if object is a Cesium3DTileFeature', () => {
        dataProvider[vcsLayerName] = 'i3sLayer';
        const feature = {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          __proto__: createDummyCesium3DTileFeature(),
          content: { tile: { i3sNode } },
        };
        const result = getFeatureFromPickObject(
          feature as unknown as { content: { tile: { i3sNode: I3SNode } } },
        );
        expect(result).to.deep.include({
          content: { tile: { i3sNode } },
        });
        expect(result?.[vcsLayerName]).to.equal('i3sLayer');
      });

      it('should not create a feature if allowPicking is false', () => {
        dataProvider[allowPicking] = false;
        const result = getFeatureFromPickObject(i3sPickObject);
        expect(result).to.be.undefined;
      });

      it('should create a provided feature if allowPicking is not false and not Cesium3DTileFeature', () => {
        dataProvider[vcsLayerName] = 'i3sLayer';
        delete dataProvider[allowPicking];
        const result = getFeatureFromPickObject(i3sPickObject);
        expect(result).to.be.instanceOf(Feature);
        expect(result?.getId()).to.be.a('string');
        expect(result?.[vcsLayerName]).to.equal('i3sLayer');
        expect((result as Feature)?.[i3sData]).to.have.property(
          'i3sNode',
          i3sNode,
        );
        expect((result as Feature)?.[isProvidedFeature]).to.be.true;
      });
    });

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

        it('should not pick underground features, if they are too far away', async () => {
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

  describe('panorama', () => {
    let panoramaMap: PanoramaMap;
    let panoramaImage: PanoramaImage;
    let destroyPanoramaImage: () => void;
    let imagePosition10: Cartesian3;
    let imagePosition20: Cartesian3;

    before(async () => {
      panoramaMap = getPanoramaMap();
      ({ panoramaImage, destroy: destroyPanoramaImage } =
        await getPanoramaImage());
      app.maps.add(panoramaMap);
      await app.maps.setActiveMap(panoramaMap.name);
      panoramaMap.setCurrentImage(panoramaImage);
      imagePosition10 = Cartesian3.add(
        panoramaImage.position,
        new Cartesian3(10, 0, 0),
        new Cartesian3(),
      );
      imagePosition20 = Cartesian3.add(
        panoramaImage.position,
        new Cartesian3(20, 0, 0),
        new Cartesian3(),
      );
    });

    beforeEach(() => {
      sceneStub = panoramaMap.getCesiumWidget().scene!;
      sceneStub.pickTranslucentDepth = false;
      pick = sandbox.stub(sceneStub, 'pick');

      positionSpy = sandbox
        .stub(sceneStub, 'pickPosition')
        .returns(imagePosition10.clone());
      fap = new FeatureAtPixel();
    });

    after(async () => {
      await app.maps.setActiveMap(cesiumMap.name);
      panoramaMap.setCurrentImage();
      destroyPanoramaImage();
    });

    it('should set the picked position, if its closer to the camera then the existing position', async () => {
      pick.returns({ primitive: { olFeature: true } });
      const event = await fap.pipe({
        pointer: PointerKeyType.LEFT,
        pointerEvent: PointerEventType.UP,
        windowPosition: new Cartesian2(0, 0),
        map: panoramaMap,
        type: EventType.CLICK,
        key: ModificationKeyType.NONE,
        position: cartesianToMercator(imagePosition20),
      });

      expect(event).to.have.property('position').and.to.be.an('array');
      arrayCloseTo(event.position!, cartesianToMercator(imagePosition10));
    });

    it('should not set the picked position, if its farther away from the camera then the existing position', async () => {
      pick.returns({ primitive: { olFeature: true } });
      const event = await fap.pipe({
        pointer: PointerKeyType.LEFT,
        pointerEvent: PointerEventType.UP,
        windowPosition: new Cartesian2(0, 0),
        map: panoramaMap,
        type: EventType.CLICK,
        key: ModificationKeyType.NONE,
        position: cartesianToMercator(panoramaImage.position),
      });

      expect(event).to.have.property('position').and.to.be.an('array');
      arrayCloseTo(
        event.position!,
        cartesianToMercator(panoramaImage.position),
      );
    });

    it('should pick the position, if there is no position yet', async () => {
      pick.returns({ primitive: { olFeature: true } });
      const event = await fap.pipe({
        pointer: PointerKeyType.LEFT,
        pointerEvent: PointerEventType.UP,
        windowPosition: new Cartesian2(0, 0),
        map: panoramaMap,
        type: EventType.CLICK,
        key: ModificationKeyType.NONE,
      });

      expect(event).to.have.property('position').and.to.be.an('array');
      arrayCloseTo(event.position!, cartesianToMercator(imagePosition10));
    });

    describe('without an image', () => {
      before(() => {
        panoramaMap.setCurrentImage();
      });

      after(() => {
        panoramaMap.setCurrentImage(panoramaImage);
      });

      it('should not pick a position', async () => {
        pick.returns({ primitive: { olFeature: true } });
        const event = await fap.pipe({
          pointer: PointerKeyType.LEFT,
          pointerEvent: PointerEventType.UP,
          windowPosition: new Cartesian2(0, 0),
          map: panoramaMap,
          type: EventType.CLICK,
          key: ModificationKeyType.NONE,
        });

        expect(event).to.not.have.property('position');
      });
    });
  });
});
