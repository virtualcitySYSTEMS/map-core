import { Entity } from '@vcmap/cesium';
import { setCesiumMap } from '../../../helpers/cesiumHelpers.js';
import VcsApp from '../../../../../src/vcs/vcm/vcsApp.js';
import DataSource from '../../../../../src/vcs/vcm/layer/dataSource.js';

describe('vcs.vcm.layer.cesium.DataSourceCesium', () => {
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
    /** @type {import("@vcmap/core").DataSource} */
    let layer;
    /** @type {import("@vcmap/core").DataSourceCesium} */
    let impl;
    let initialEntity;

    before(async () => {
      layer = new DataSource({});
      initialEntity = new Entity();
      layer.addEntity(initialEntity);
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
