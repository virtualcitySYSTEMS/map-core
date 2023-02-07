import { Entity } from '@vcmap-cesium/engine';
import { setCesiumMap } from '../../helpers/cesiumHelpers.js';
import VcsApp from '../../../../src/vcsApp.js';
import DataSourceLayer from '../../../../src/layer/dataSourceLayer.js';
import GlobalHider from '../../../../src/layer/globalHider.js';

describe('DataSourceCesiumImpl', () => {
  let app;
  let map;

  before(async () => {
    app = new VcsApp();
    map = await setCesiumMap(app);
  });

  after(() => {
    app.destroy();
  });

  describe('synchronizing of entity collections', () => {
    /** @type {import("@vcmap/core").DataSourceLayer} */
    let layer;
    /** @type {import("@vcmap/core").DataSourceCesiumImpl} */
    let impl;
    let initialEntity;

    before(async () => {
      layer = new DataSourceLayer({});
      initialEntity = new Entity();
      layer.addEntity(initialEntity);
      layer.setGlobalHider(new GlobalHider());
      await layer.initialize();
      [impl] = layer.getImplementationsForMap(map);
      await impl.initialize();
    });

    after(() => {
      layer.destroy();
    });

    it('should add initial entities to the data source', () => {
      const entity = impl.dataSource.entities.getById(initialEntity.id);
      expect(entity).to.equal(initialEntity);
    });

    it('should add newly added entities to the data source', () => {
      const id = layer.addEntity({});
      expect(impl.dataSource.entities.getById(id)).to.be.an.instanceof(Entity);
    });

    it('should remove previously added entities', () => {
      const id = layer.addEntity({});
      layer.removeEntityById(id);
      expect(impl.dataSource.entities.getById(id)).to.be.undefined;
    });
  });
});
