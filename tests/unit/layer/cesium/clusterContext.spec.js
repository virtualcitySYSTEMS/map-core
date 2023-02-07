import { CustomDataSource } from '@vcmap-cesium/engine';
import Feature from 'ol/Feature.js';
import ClusterContext from '../../../../src/layer/cesium/clusterContext.js';

describe('ClusterContext', () => {
  /** @type {import("@vcmap/core").ClusterContext} */
  let clusterContext;
  let dataSource;

  before(() => {
    dataSource = new CustomDataSource();
  });

  beforeEach(() => {
    clusterContext = new ClusterContext(dataSource);
  });

  afterEach(() => {
    clusterContext.clear();
  });

  describe('billboards', () => {
    let billboardOptions;
    let feature;

    beforeEach(() => {
      billboardOptions = {};
      feature = new Feature({});
    });

    it('should add the feature to the billboards and the featureToBillboardMap', () => {
      clusterContext.addBillboards([billboardOptions], feature, true);
      const billboards = clusterContext.featureToBillboardMap.get(feature);
      expect(billboards).to.have.lengthOf(1);
      expect(clusterContext.entities.contains(billboards[0])).to.be.true;
    });

    it('should set the reference for picking, if allowPicking is true', () => {
      clusterContext.addBillboards([billboardOptions], feature, true);
      const billboard = clusterContext.featureToBillboardMap.get(feature)[0];
      expect(billboard).to.have.property('olFeature', feature);
    });

    it('should not set the reference for picking, if allowPicking is false', () => {
      clusterContext.addBillboards([billboardOptions], feature, false);
      const billboard = clusterContext.featureToBillboardMap.get(feature)[0];
      expect(billboard).to.not.have.property('olFeature');
    });

    it('should add/remove entities billboard based on the feature', () => {
      clusterContext.addBillboards([billboardOptions], feature, true);
      const billboard = clusterContext.featureToBillboardMap.get(feature)[0];
      expect(clusterContext.entities.contains(billboard)).to.be.true;
      clusterContext.removeFeature(feature);
      expect(clusterContext.entities.contains(billboard)).to.be.false;
      expect(clusterContext.featureToBillboardMap).to.be.empty;
    });
  });

  describe('labels', () => {
    let labelOptions;
    let feature;

    beforeEach(() => {
      labelOptions = {};
      feature = new Feature({});
    });

    it('should add the feature to the entities and the featureToLabelMap', () => {
      clusterContext.addLabels([labelOptions], feature, true);
      const labels = clusterContext.featureToLabelMap.get(feature);
      expect(labels).to.have.lengthOf(1);
      expect(clusterContext.entities.contains(labels[0])).to.be.true;
    });

    it('should set the reference for picking, if allowPicking is true', () => {
      clusterContext.addLabels([labelOptions], feature, true);
      const label = clusterContext.featureToLabelMap.get(feature)[0];
      expect(label).to.have.property('olFeature', feature);
    });

    it('should not set the reference for picking, if allowPicking is false', () => {
      clusterContext.addLabels([labelOptions], feature, false);
      const label = clusterContext.featureToLabelMap.get(feature)[0];
      expect(label).to.not.have.property('olFeature');
    });

    it('should remove entities based on the feature', () => {
      clusterContext.addLabels([labelOptions], feature, true);
      const label = clusterContext.featureToLabelMap.get(feature)[0];
      expect(clusterContext.entities.contains(label)).to.be.true;
      clusterContext.removeFeature(feature);
      expect(clusterContext.entities.contains(label)).to.be.false;
      expect(clusterContext.featureToBillboardMap).to.be.empty;
    });
  });

  describe('caching feature resources', () => {
    let feature;

    before(() => {
      feature = new Feature({});
    });

    describe('creating a cache', () => {
      let context;
      let cache;

      before(() => {
        context = new ClusterContext(dataSource);
        context.addBillboards([{}], feature, true);
        context.addLabels([{}], feature, true);
        cache = context.createFeatureCache(feature);
      });

      after(() => {
        context.clear();
      });

      it('should cache all billboards', () => {
        expect(cache).to.have.property('billboards').and.to.have.lengthOf(1);
      });

      it('should cache all labels', () => {
        expect(cache).to.have.property('labels').and.to.have.lengthOf(1);
      });
    });

    describe('clearing of a cache', () => {
      let context;
      let billboard;
      let lablel;

      before(() => {
        context = new ClusterContext(dataSource);
        context.addBillboards([{}], feature, true);
        context.addLabels([{}], feature, true);
        const cache = context.createFeatureCache(feature);
        [billboard] = cache.billboards;
        [lablel] = cache.labels;
        context.clearFeatureCache(cache);
      });

      after(() => {
        context.clear();
      });

      it('should clear all billboards', () => {
        expect(dataSource.entities.contains(billboard)).to.be.false;
      });

      it('should clear all lablel', () => {
        expect(dataSource.entities.contains(lablel)).to.be.false;
      });
    });
  });

  describe('clear', () => {
    it('should remove all primitives, billboards, labels and features', () => {
      const feature = new Feature({});
      clusterContext.addBillboards([{}], feature, true);
      clusterContext.addLabels([{}], feature, true);

      clusterContext.clear();
      expect(clusterContext.entities.values).to.be.empty;
      expect(clusterContext.featureToBillboardMap).to.be.empty;
      expect(clusterContext.featureToLabelMap).to.be.empty;
    });
  });
});
