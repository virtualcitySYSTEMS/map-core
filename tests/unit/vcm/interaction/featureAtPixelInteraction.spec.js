import Cartesian3 from 'cesium/Source/Core/Cartesian3.js';
import Feature from 'ol/Feature.js';
import Cartesian2 from 'cesium/Source/Core/Cartesian2.js';
import Clock from 'cesium/Source/Core/Clock.js';
import JulianDate from 'cesium/Source/Core/JulianDate.js';
import FeatureAtPixel from '../../../../src/vcs/vcm/interaction/featureAtPixelInteraction.js';
import Openlayers from '../../../../src/vcs/vcm/maps/openlayers.js';
import Layer from '../../../../src/vcs/vcm/layer/layer.js';
import { EventType, ModificationKeyType } from '../../../../src/vcs/vcm/interaction/interactionType.js';
import Projection from '../../../../src/vcs/vcm/util/projection.js';
import Vector from '../../../../src/vcs/vcm/layer/vector.js';
import { setCesiumMap, createDummyCesium3DTileFeature } from '../../helpers/cesiumHelpers.js';
import { getFramework } from '../../helpers/framework.js';
import resetFramework from '../../helpers/resetFramework.js';
import { vcsLayerName } from '../../../../src/vcs/vcm/layer/layerSymbols.js';

describe('vcs.vcm.interaction.FeatureAtPixelInteraction', () => {
  let sandbox;
  let pick;
  let sceneStub;
  let render;
  /** @type {vcs.vcm.interaction.FeatureAtPixelInteraction} */
  let fap;
  let mercatorPosition;
  let cartesianPosition;
  let positionSpy;
  let cesiumMap;

  before(async () => {
    sandbox = sinon.createSandbox();
    mercatorPosition = [5845000, 1505147, 0];
    cartesianPosition = Cartesian3.fromDegrees(...Projection.mercatorToWgs84(mercatorPosition));
    cesiumMap = await setCesiumMap(getFramework());
  });

  beforeEach(() => {
    sceneStub = cesiumMap.getScene();
    sceneStub.pickPositionSupported = true;
    sceneStub.pickTranslucentDepth = false;
    render = sandbox.spy(sceneStub, 'render');
    pick = sandbox.stub(sceneStub, 'pick');
    positionSpy = sandbox.stub(sceneStub, 'pickPosition')
      .returns(cartesianPosition.clone());
    fap = new FeatureAtPixel();
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(() => {
    resetFramework();
  });

  function setup3DTest(dummy) {
    pick.returns(dummy);
    const event = {
      map: cesiumMap,
      type: EventType.DRAGSTART,
      key: ModificationKeyType.NONE,
    };

    return fap
      .pipe(event)
      .then((returnedEvent) => {
        expect(positionSpy).to.not.have.been.called;
        return returnedEvent;
      });
  }

  describe('dragging features', () => {
    it('should store dragging feature', () => {
      const dummy = { primitive: { olFeature: 'test' } };
      pick.returns(dummy);
      const event = {
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
      const dummy = createDummyCesium3DTileFeature({}, { [Layer.vcsLayerNameSymbol]: 'test' });
      return setup3DTest(dummy)
        .then(() => {
          fap.pickPosition = EventType.DRAGEVENTS;
          return fap.pipe({ map: cesiumMap, type: EventType.DRAG });
        })
        .then(() => {
          expect(positionSpy).to.have.been.called;
        });
    });
  });

  describe('Openlayers', () => {
    it('should differentiate clusters in 2D', () => {
      const normalFeature = new Feature({});
      const clusterFeature = new Feature({ features: [] });
      const dummyLayer = new Feature({ name: 'dummy' });
      dummyLayer[vcsLayerName] = 'dummy';

      const dummyMap = {
        forEachFeatureAtPixel(w, cb) {
          if (w[0] === 0) {
            cb(normalFeature, dummyLayer);
          } else {
            cb(clusterFeature, dummyLayer);
          }
        },
      };
      const map = new Openlayers({});
      map._olMap = dummyMap;

      const windowPosition = new Cartesian2(0, 0);
      const event = {
        map,
        type: EventType.CLICK,
        key: ModificationKeyType.NONE,
        windowPosition,
      };

      return fap
        .pipe(event)
        .then(() => {
          expect(event).to.have.property('feature')
            .and.to.not.have.property(vcsLayerName);
          windowPosition.x = 1;
          return fap.pipe(event);
        })
        .then(() => {
          expect(event).to.have.property('feature')
            .and.to.have.property(vcsLayerName, 'dummy');
        });
    });

    it('should only pick features if olcs_allowPicking is not false', () => {
      const normalFeature = new Feature({});
      const dummyLayer = new Vector({ name: 'dummy' });

      const dummyMap = {
        forEachFeatureAtPixel(w, cb) {
          cb(normalFeature, dummyLayer);
        },
      };
      const map = new Openlayers({});
      map._olMap = dummyMap;

      const windowPosition = new Cartesian2(0, 0);
      const event = {
        map,
        type: EventType.CLICK,
        key: ModificationKeyType.NONE,
        windowPosition,
      };

      return fap
        .pipe(event)
        .then(() => {
          expect(event.feature).to.equal(normalFeature);
          normalFeature.set('olcs_allowPicking', false, false);
          event.feature = undefined;
          return fap.pipe(event)
            .then(() => {
              expect(event.feature).to.equal(undefined);
            });
        });
    });
  });

  describe('Cesium', () => {
    it('should add all picked symbols from a TilesetLayer to the feature', () => {
      const test = Symbol('testSymobl');
      const dummy = createDummyCesium3DTileFeature({}, { [Layer.vcsLayerNameSymbol]: 'test', [test]: true });
      return setup3DTest(dummy)
        .then((event) => {
          expect(event).to.have.property('feature')
            .and.to.have.property(test, true);
        });
    });

    describe('feature detections', () => {
      it('should detect vector primitive features in 3D -> obj.primitive.olFeature', () => {
        const olFeature = 'test';
        const dummy = {
          primitive: { olFeature },
        };
        return setup3DTest(dummy)
          .then((event) => {
            expect(event).to.have.property('feature', 'test');
          });
      });

      it('should detect 3DTileFeatures, aka buildings -> obj.primitive with layerName', () => {
        const dummy = createDummyCesium3DTileFeature({}, { [Layer.vcsLayerNameSymbol]: 'test' });
        return setup3DTest(dummy)
          .then((event) => {
            expect(event)
              .to.have.property('feature')
              .to.have.property(Layer.vcsLayerNameSymbol, 'test');
          });
      });

      it('should detect vector entity features in 3D -> obj.id.olFeature', () => {
        const olFeature = 'test';
        const dummy = {
          id: { olFeature },
        };
        return setup3DTest(dummy)
          .then((event) => {
            expect(event).to.have.property('feature', 'test');
          });
      });

      it('should detect 3D Entities in 3D -> obj.id with layerName', () => {
        const dummy = {
          id: { [Layer.vcsLayerNameSymbol]: 'test' },
        };
        return setup3DTest(dummy)
          .then((event) => {
            expect(event)
              .to.have.property('feature')
              .to.have.property(Layer.vcsLayerNameSymbol, 'test');
          });
      });
    });

    describe('picking behavior', () => {
      it('should only pick position on CLICK by default', () => {
        pick.returns({});
        const event = {
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

      it('should apply the excluded picking events, when setting pickPosition', () => {
        fap.excludedPickPositionEvents = EventType.MOVE | EventType.DRAG;
        fap.pickPosition = EventType.CLICKMOVE;
        expect(fap).to.have.property('pickPosition', EventType.CLICK);
      });

      it('should pick translucent on olFeature', () => {
        pick.returns({ primitive: { olFeature: true } });
        const event = {
          map: cesiumMap,
          type: EventType.CLICK,
          key: ModificationKeyType.NONE,
        };

        sandbox.stub(cesiumMap, 'getCesiumWidget').returns({
          clock: new Clock({}),
        });
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
          map: cesiumMap,
          type: EventType.CLICK,
          key: ModificationKeyType.NONE,
        };

        sandbox.stub(cesiumMap, 'getCesiumWidget').returns({
          clock: new Clock({}),
        });
        sceneStub.pickTranslucentDepth = true;
        fap.pickTranslucent = true;
        await fap.pipe(event);
        expect(sceneStub).to.have.property('pickTranslucentDepth', true);
      });

      it('should not pick translucent on pointcloud feature with attenuation', () => {
        pick.returns({ primitive: { pointCloudShading: { attenuation: true } } });
        const event = {
          map: cesiumMap,
          type: EventType.CLICK,
          key: ModificationKeyType.NONE,
        };
        sandbox.stub(cesiumMap, 'getCesiumWidget').returns({
          clock: new Clock({}),
        });
        fap.pickTranslucent = true;

        return fap
          .pipe(event)
          .then(() => {
            expect(positionSpy).to.have.been.called;
            expect(render).to.not.have.been.called;
            expect(sceneStub).to.have.property('pickTranslucentDepth', false);
          });
      });
    });
  });
});
