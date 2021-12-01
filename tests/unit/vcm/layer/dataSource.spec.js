import { Entity as CesiumEntity } from '@vcmap/cesium';
import { getGlobalHider } from '../../../../src/vcs/vcm/layer/globalHider.js';
import DataSource from '../../../../src/vcs/vcm/layer/dataSource.js';
import { vcsLayerName } from '../../../../src/vcs/vcm/layer/layerSymbols.js';

describe('vcs.vcm.layer.DataSource', () => {
  describe('handling of feature visibility', () => {
    /** @type {import("@vcmap/core").DataSource} */
    let layer;

    before(async () => {
      layer = new DataSource({});
      await layer.initialize();
    });

    after(() => {
      layer.destroy();
      getGlobalHider().destroy();
    });

    it('should add entities to the feature visibility', () => {
      const entity = new CesiumEntity({});
      const id = layer.addEntity(entity);
      layer.featureVisibility.hideObjects([id]);
      expect(layer.featureVisibility.hasHiddenFeature(id, entity)).to.be.true;
    });

    it('should hide entities on adding them', () => {
      const id = 'test';
      layer.featureVisibility.hideObjects([id]);
      const entity = new CesiumEntity({
        id,
      });
      layer.addEntity(entity);
      expect(layer.featureVisibility.hasHiddenFeature(id, entity)).to.be.true;
    });

    it('should hide globally hidden entities', () => {
      const entity = new CesiumEntity({});
      const id = layer.addEntity(entity);
      getGlobalHider().hideObjects([id]);
      expect(getGlobalHider().hasFeature(id, entity)).to.be.true;
    });

    it('should hide globally hidden entities on adding them', () => {
      const id = 'globalTest';
      getGlobalHider().hideObjects([id]);
      const entity = new CesiumEntity({
        id,
      });
      layer.addEntity(entity);
      expect(getGlobalHider().hasFeature(id, entity)).to.be.true;
    });
  });

  describe('handling of entities', () => {
    /** @type {import("@vcmap/core").DataSource} */
    let layer;

    before(async () => {
      layer = new DataSource({});
      await layer.initialize();
    });

    after(() => {
      layer.destroy();
    });

    describe('adding of entities', () => {
      it('should add an entity by its options', () => {
        const options = { id: 'test1' };
        layer.addEntity(options);
        const entity = layer.entities.getById('test1');
        expect(entity).to.be.an.instanceof(CesiumEntity);
      });

      it('should add an entity', () => {
        const entity = new CesiumEntity({});
        const id = layer.addEntity(entity);
        const addedEntity = layer.entities.getById(id);
        expect(addedEntity).to.equal(entity);
      });

      it('should add the layer name symbol', () => {
        const entity = new CesiumEntity({});
        layer.addEntity(entity);
        expect(entity).to.have.property(vcsLayerName, layer.name);
      });

      it('should add optional additional attributes', () => {
        const attributes = {};
        const entity = new CesiumEntity({});
        layer.addEntity(entity, attributes);
        expect(entity).to.have.property('attributes', attributes);
      });

      it('should set optional allow picking', () => {
        const attributes = {};
        const entity = new CesiumEntity({});
        layer.addEntity(entity, attributes, false);
        expect(entity).to.have.property('allowPicking', false);
      });
    });

    describe('removing of entities', () => {
      it('should remove an entity by its id', () => {
        const entity = new CesiumEntity({});
        const id = layer.addEntity(entity);
        layer.removeEntityById(id);
        expect(layer.entities.getById(id)).to.be.undefined;
      });
    });
  });

  describe('getting a config', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const config = new DataSource({}).toJSON();
        expect(config).to.have.all.keys('name', 'type');
      });
    });

    describe('of a configured layer', () => {
      let inputConfig;
      let outputConfig;
      let configuredLayer;

      before(() => {
        inputConfig = {
          genericFeatureProperties: {
            test: true,
          },
        };
        configuredLayer = new DataSource(inputConfig);
        outputConfig = configuredLayer.toJSON();
      });

      after(() => {
        configuredLayer.dispose();
      });

      it('should configure genericFeatureProperties', () => {
        expect(outputConfig).to.have.property('genericFeatureProperties')
          .and.to.eql(inputConfig.genericFeatureProperties);
      });
    });
  });
});
