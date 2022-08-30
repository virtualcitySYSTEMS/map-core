import Entity from '@vcmap/cesium/Source/DataSources/Entity.js';
import { setCesiumMap } from '../../../helpers/cesiumHelpers.js';
import { getFramework } from '../../../helpers/framework.js';
import resetFramework from '../../../helpers/resetFramework.js';
import DataSource from '../../../../../src/vcs/vcm/layer/dataSource.js';

describe('vcs.vcm.layer.cesium.DataSourceCesium', () => {
  let map;

  before(async () => {
    map = await setCesiumMap(getFramework());
  });

  after(() => {
    resetFramework();
  });

  describe('synchronizing of entity collections', () => {
    /** @type {vcs.vcm.layer.DataSource} */
    let layer;
    /** @type {vcs.vcm.layer.cesium.DataSourceCesium} */
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