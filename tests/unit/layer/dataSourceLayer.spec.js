import { Entity as CesiumEntity } from '@vcmap/cesium';
import DataSourceLayer from '../../../src/layer/dataSourceLayer.js';
import { vcsLayerName } from '../../../src/layer/layerSymbols.js';
import GlobalHider from '../../../src/layer/globalHider.js';

describe('DataSourceLayer', () => {
  describe('setting globalHider', () => {
    /** @type {import("@vcmap/core").DataSourceLayer} */
    let dataSourceLayer;

    before(() => {
      dataSourceLayer = new DataSourceLayer({});
    });

    after(() => {
      dataSourceLayer.destroy();
    });

    it('should update featureVisibility listeners', () => {
      dataSourceLayer.setGlobalHider(new GlobalHider());
      const entity = new CesiumEntity({});
      const id = dataSourceLayer.addEntity(entity);
      dataSourceLayer.globalHider.hideObjects([id]);
      expect(dataSourceLayer.globalHider.hasFeature(id, entity)).to.be.true;
    });
  });

  describe('handling of feature visibility', () => {
    /** @type {import("@vcmap/core").DataSourceLayer} */
    let layer;

    before(async () => {
      layer = new DataSourceLayer({});
      layer.setGlobalHider(new GlobalHider());
      await layer.initialize();
    });

    after(() => {
      layer.destroy();
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
      layer.globalHider.hideObjects([id]);
      expect(layer.globalHider.hasFeature(id, entity)).to.be.true;
    });

    it('should hide globally hidden entities on adding them', () => {
      const id = 'globalTest';
      layer.globalHider.hideObjects([id]);
      const entity = new CesiumEntity({
        id,
      });
      layer.addEntity(entity);
      expect(layer.globalHider.hasFeature(id, entity)).to.be.true;
    });
  });

  describe('handling of entities', () => {
    /** @type {import("@vcmap/core").DataSourceLayer} */
    let layer;

    before(async () => {
      layer = new DataSourceLayer({});
      layer.setGlobalHider(new GlobalHider());
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
        const config = new DataSourceLayer({}).toJSON();
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
        configuredLayer = new DataSourceLayer(inputConfig);
        outputConfig = configuredLayer.toJSON();
      });

      after(() => {
        configuredLayer.destroy();
      });

      it('should configure genericFeatureProperties', () => {
        expect(outputConfig).to.have.property('genericFeatureProperties')
          .and.to.eql(inputConfig.genericFeatureProperties);
      });
    });
  });
});
