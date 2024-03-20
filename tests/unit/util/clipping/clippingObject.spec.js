import { Entity, ClippingPlaneCollection } from '@vcmap-cesium/engine';
import ClippingObject from '../../../../src/util/clipping/clippingObject.js';
import VcsApp from '../../../../src/vcsApp.js';
import VectorLayer from '../../../../src/layer/vectorLayer.js';
import DataSourceLayer from '../../../../src/layer/dataSourceLayer.js';
import LayerState from '../../../../src/layer/layerState.js';
import {
  createEntities,
  createInitializedTilesetLayer,
  setCesiumMap,
} from '../../helpers/cesiumHelpers.js';
import FeatureStoreLayer from '../../../../src/layer/featureStoreLayer.js';
import { setOpenlayersMap } from '../../helpers/openlayersHelpers.js';

describe('util.clipping.ClippingObject', () => {
  let sandbox;
  /** @type {import("@vcmap/core").ClippingObject} */
  let CO;
  let app;
  let cesiumMap;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  beforeEach(async () => {
    app = new VcsApp();
    CO = new ClippingObject();
    cesiumMap = await setCesiumMap(app);
    cesiumMap.setTarget('mapContainer');
    CO.handleMapChanged(cesiumMap);
    CO.setLayerCollection(cesiumMap.layerCollection);
  });

  afterEach(() => {
    app.destroy();
    sandbox.restore();
  });

  describe('clippingPlaneCollection', () => {
    let clippingPlaneCollection;

    before(() => {
      clippingPlaneCollection = new ClippingPlaneCollection();
    });

    it('should set the clippingPlaneCollection', () => {
      CO.clippingPlaneCollection = clippingPlaneCollection;
      expect(CO.clippingPlaneCollection).to.equal(clippingPlaneCollection);
    });

    it('should trigger the clippingPlaneUpdated event', () => {
      const spy = sandbox.spy();
      CO.clippingPlaneUpdated.addEventListener(spy);
      CO.clippingPlaneCollection = clippingPlaneCollection;
      expect(spy).to.have.been.called;
    });

    it('should unset the clippingPlaneCollection', () => {
      CO.clippingPlaneCollection = clippingPlaneCollection;
      CO.clippingPlaneCollection = null;
      expect(CO.clippingPlaneCollection).to.be.null;
    });
  });

  describe('terrain', () => {
    it('should set the terrain flag', () => {
      CO.terrain = true;
      expect(CO.terrain).to.be.true;
    });

    it('should call handleMapChanged', () => {
      const handleMapChanged = sandbox.spy(CO, 'handleMapChanged');
      CO.terrain = true;
      expect(handleMapChanged).to.have.been.calledOnce;
    });

    it('should only call handleMapChanged, if the flag changes', () => {
      const handleMapChanged = sandbox.spy(CO, 'handleMapChanged');
      // eslint-disable-next-line no-self-assign
      CO.terrain = CO.terrain;
      expect(handleMapChanged).to.not.have.been.called;
    });
  });

  describe('local', () => {
    it('should set the local flag', () => {
      CO.local = true;
      expect(CO.local).to.be.true;
    });

    it('should raise the clippingCollectionUpdated event if the local flag changes', () => {
      const spy = sandbox.spy();
      CO.clippingPlaneUpdated.addEventListener(spy);
      CO.local = true;
      CO.local = true;
      expect(spy).to.have.been.calledOnce;
    });
  });

  describe('handleLayerChanged', () => {
    describe('Cesium3DTilesetLayers', () => {
      let tilesetLayer;

      beforeEach(async () => {
        tilesetLayer = await createInitializedTilesetLayer(sandbox, cesiumMap);
        CO.addLayer(tilesetLayer.name);
      });

      describe('layer activated', () => {
        beforeEach(async () => {
          await tilesetLayer.activate();
        });

        it('should add the layers cesium3DTileset to the targets', (done) => {
          CO.handleLayerChanged(tilesetLayer);
          setTimeout(() => {
            expect(CO.targets.has(tilesetLayer.name)).to.be.true;
            expect(CO.targets.get(tilesetLayer.name)).to.equal(
              tilesetLayer.getImplementations()[0].cesium3DTileset,
            );
            done();
          }, 0);
        });

        it('should call the targetsUpdated event', (done) => {
          const spy = sandbox.spy();
          CO.targetsUpdated.addEventListener(spy);
          CO.handleLayerChanged(tilesetLayer);
          setTimeout(() => {
            expect(spy).to.have.been.called;
            done();
          }, 0);
        });

        it('should ignore tileset layer if map is not cesium', (done) => {
          (async () => {
            const olMap = await setOpenlayersMap(app);
            CO.handleMapChanged(olMap);
            CO.handleLayerChanged(tilesetLayer);
            setTimeout(() => {
              expect(CO.targets).to.be.empty;
              done();
            }, 0);
          })();
        });

        it('should remove false layers', (done) => {
          (async () => {
            const vectorLayer = new VectorLayer({});
            CO.addLayer(vectorLayer.name);
            await vectorLayer.activate();
            CO.handleLayerChanged(vectorLayer);
            setTimeout(() => {
              expect(CO.layerNames).to.not.include(vectorLayer.name);
              done();
            }, 0);
          })();
        });

        it('should not add the layer to the targets, if the layer has been removed from the object before readyPromise', () => {
          tilesetLayer.deactivate();
          const activationPromise = tilesetLayer.activate();
          CO.handleLayerChanged(tilesetLayer);
          CO.removeLayer(tilesetLayer.name);
          return activationPromise.then(() => {
            expect(CO.targets).to.be.empty;
          });
        });

        it('should not add the layer to the targets, if the layer is inactive before readyPromise', () => {
          tilesetLayer.deactivate();
          const activationPromise = tilesetLayer.activate();
          CO.handleLayerChanged(tilesetLayer);
          tilesetLayer.deactivate();
          return activationPromise.then(() => {
            expect(CO.targets).to.be.empty;
          });
        });
      });

      describe('layer deactivated', () => {
        beforeEach(() => {
          CO.targets.set(
            tilesetLayer.name,
            tilesetLayer.getImplementations()[0].cesium3DTileset,
          );
        });

        it('should remove the target', () => {
          CO.handleLayerChanged(tilesetLayer);
          expect(CO.targets).to.be.empty;
        });

        it('should raise the targetsUpdated event', () => {
          const spy = sandbox.spy();
          CO.targetsUpdated.addEventListener(spy);
          CO.handleLayerChanged(tilesetLayer);
          expect(spy).to.have.been.called;
        });
      });
    });

    describe('FeatureStoreLayer 2D handling', () => {
      let tiledLayer;

      beforeEach(async () => {
        const olMap = await setOpenlayersMap(app);
        CO.handleMapChanged(olMap);
        tiledLayer = new FeatureStoreLayer({
          name: 'test',
        });
        CO.addLayer('test');
      });

      it('should cache activated TiledLayers if activated in 2D', () => {
        tiledLayer._state = LayerState.ACTIVE;
        CO.handleLayerChanged(tiledLayer);
        expect(CO._cachedLayers.has(tiledLayer)).to.be.true;
      });

      it('should remove a cached TiledLayer if deactivated in 2D', () => {
        CO._cachedLayers.add(tiledLayer);
        CO.handleLayerChanged(tiledLayer);
        expect(CO._cachedLayers).to.be.empty;
      });
    });

    describe('Entity layers', () => {
      let entityLayer;
      let entity1;
      let entity2;

      beforeEach(() => {
        const entities = createEntities(2);
        entityLayer = entities.layer;
        [entity1, entity2] = entities.entities;
        CO.addEntity(entityLayer.name, entity1.id);
        CO.addEntity(entityLayer.name, entity2.id);
        app.layers.add(entityLayer);
      });

      describe('layer activated', () => {
        beforeEach(async () => {
          await entityLayer.activate();
        });

        it('should add all entities of said layer to the targets', () => {
          CO.handleLayerChanged(entityLayer);
          expect(CO.targets.size).to.equal(2);
          expect(CO.targets.get(`${entityLayer.name}-${entity1.id}`)).to.equal(
            entity1,
          );
          expect(CO.targets.get(`${entityLayer.name}-${entity2.id}`)).to.equal(
            entity2,
          );
        });

        it('should trigger the targetsChanged event once', () => {
          const spy = sandbox.spy();
          CO.targetsUpdated.addEventListener(spy);
          CO.handleLayerChanged(entityLayer);
          expect(spy).to.have.been.calledOnce;
        });

        it('should remove entities, which are not part of the layer', () => {
          entityLayer.removeEntityById(entity2.id);
          CO.handleLayerChanged(entityLayer);
          expect(CO.entities).to.have.length(1);
          expect(CO.entities[0].entityId).to.equal(entity1.id);
        });
      });

      describe('layer deactivated', () => {
        beforeEach(async () => {
          await entityLayer.activate();
          CO.handleLayerChanged(entityLayer);
          entityLayer.deactivate();
        });

        it('should remove all entities belonging to this layer', () => {
          CO.handleLayerChanged(entityLayer);
          expect(CO.targets).to.be.empty;
        });

        it('should call the targets changed event once', () => {
          const spy = sandbox.spy();
          CO.targetsUpdated.addEventListener(spy);
          CO.handleLayerChanged(entityLayer);
          expect(spy).to.have.been.calledOnce;
        });
      });
    });
  });

  describe('handleMapChanged', () => {
    it('should add the globe to the targets, if terrain is active', () => {
      CO._terrain = true;
      CO.handleMapChanged(cesiumMap);
      expect(CO.targets.size).to.equal(1);
      CO.targets.forEach((globe, key) => {
        expect(globe).to.equal(cesiumMap.getScene().globe);
        expect(key).to.be.a('symbol');
      });
    });

    it('should remove the globe from the targets, if terrain is false, but the globe is part of the targets', () => {
      CO._terrain = true;
      CO.handleMapChanged(cesiumMap);
      expect(CO.targets.size).to.equal(1);
      CO._terrain = false;
      CO.handleMapChanged(cesiumMap);
      expect(CO.targets).to.be.empty;
    });

    it('should raise the targets changed event on adding or removing the globe', () => {
      const spy = sandbox.spy();
      CO.targetsUpdated.addEventListener(spy);
      CO._terrain = true;
      CO.handleMapChanged(cesiumMap);
      CO._terrain = false;
      CO.handleMapChanged(cesiumMap);
      expect(spy).to.have.been.calledTwice;
    });

    describe('cached tiled layers', () => {
      let tiledLayer;

      beforeEach(() => {
        tiledLayer = new FeatureStoreLayer({});
        CO._cachedLayers.add(tiledLayer);
      });

      it('should call handleLayerChanged for each cached TiledLayer', () => {
        const handleLayerChanged = sandbox.spy(CO, 'handleLayerChanged');
        CO.handleMapChanged(cesiumMap);
        expect(handleLayerChanged).to.have.been.calledWith(tiledLayer);
      });

      it('should clear the cached tiled layers', () => {
        CO.handleMapChanged(cesiumMap);
        expect(CO._cachedLayers).to.be.empty;
      });
    });
  });

  describe('addLayer', () => {
    it('should add a layer name to the layerNames array', () => {
      CO.addLayer('test');
      expect(CO.layerNames).to.include('test');
    });

    it('should add the layer to the targets, if the layer is active', (done) => {
      (async () => {
        const layer = await createInitializedTilesetLayer(sandbox, cesiumMap);
        await layer.activate();
        app.layers.add(layer);
        CO.addLayer(layer.name);
        setTimeout(() => {
          expect(CO.targets.size).to.equal(1);
          expect(CO.targets.get(layer.name)).to.equal(
            layer.getImplementations()[0].cesium3DTileset,
          );
          done();
        }, 0);
      })();
    });

    it('should ignore already added layers', () => {
      CO.addLayer('test');
      CO.addLayer('test');
      expect(CO.layerNames).to.have.length(1);
    });
  });

  describe('removeLayer', () => {
    it('should remove a layer from the layerNames array', () => {
      CO.layerNames.push('test');
      CO.layerNames.push('test1');
      CO.removeLayer('test');
      expect(CO.layerNames).to.not.include('test');
    });

    it('should remove the layers target from the targets list', () => {
      CO.targets.set('test', 'test');
      CO.removeLayer('test');
      expect(CO.targets).to.be.empty;
    });

    it('should call targetsUpdated, if removing a target', () => {
      const spy = sandbox.spy();
      CO.targetsUpdated.addEventListener(spy);
      CO.targets.set('test', 'test');
      CO.removeLayer('test');
      expect(spy).to.have.been.called;
    });
  });

  describe('addEntity', () => {
    it('should add an entity and its layer', () => {
      CO.addEntity('test', 'test');
      expect(CO.entities).to.have.length(1);
      expect(CO.entities[0]).to.have.property('layerName', 'test');
      expect(CO.entities[0]).to.have.property('entityId', 'test');
    });

    it('should add the entity to the targets if the layer is active', () => {
      const entityLayer = new DataSourceLayer({
        name: 'test',
      });
      const entity = new Entity({
        model: {},
      });
      entityLayer.addEntity(entity);
      entityLayer._state = LayerState.ACTIVE;
      app.layers.add(entityLayer);
      CO.addEntity('test', entity.id);
      expect(CO.targets.size).to.equal(1);
      expect(CO.targets.get(`${entityLayer.name}-${entity.id}`)).to.equal(
        entity,
      );
    });

    it('should not add the same entity twice', () => {
      CO.addEntity('test', 'test');
      CO.addEntity('test', 'test');
      expect(CO.entities).to.have.length(1);
    });
  });

  describe('removeEntity', () => {
    it('should remove an entry in the entities array', () => {
      CO.entities.push({ layerName: 'test', entityId: 'test' });
      CO.entities.push({ layerName: 'test', entityId: 'test1' });
      CO.removeEntity('test', 'test');
      expect(CO.entities).to.have.length(1);
      expect(CO.entities[0].entityId).to.equal('test1');
    });

    it('should remove the target, if one is present', () => {
      CO.targets.set('test-test', 'test');
      CO.removeEntity('test', 'test');
      expect(CO.targets).to.be.empty;
    });

    it('should call targets updated if removing a target', () => {
      const spy = sandbox.spy();
      CO.targetsUpdated.addEventListener(spy);
      CO.targets.set('test-test', 'test');
      CO.removeEntity('test', 'test');
      expect(spy).to.have.been.called;
    });
  });
});
