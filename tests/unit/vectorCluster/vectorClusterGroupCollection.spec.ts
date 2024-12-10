import { expect } from 'chai';
import VectorClusterGroupCollection from '../../../src/vectorCluster/vectorClusterGroupCollection.js';
import GlobalHider from '../../../src/layer/globalHider.js';
import VectorClusterGroup from '../../../src/vectorCluster/vectorClusterGroup.js';
import { destroyCollection } from '../../../src/vcsModuleHelpers.js';

describe('VectorClusterGroupCollection', () => {
  let globalHider: GlobalHider;
  let collection: VectorClusterGroupCollection;

  beforeEach(() => {
    globalHider = new GlobalHider();
    collection = new VectorClusterGroupCollection(globalHider);
  });

  afterEach(() => {
    destroyCollection(collection);
  });

  describe('Setting / Unsetting the Global Hider', () => {
    it('should set the global hider on added VectorClusterGroup', () => {
      const vectorClusterGroup = new VectorClusterGroup({});
      collection.add(vectorClusterGroup);

      expect(vectorClusterGroup.globalHider).to.equal(globalHider);
    });

    it('should unset the global hider on removed VectorClusterGroup', () => {
      const vectorClusterGroup = new VectorClusterGroup({});
      collection.add(vectorClusterGroup);
      collection.remove(vectorClusterGroup);

      expect(vectorClusterGroup.globalHider).to.be.undefined;
    });
  });

  describe('Setting the Global Hider on the Collection', () => {
    it('should set the global hider on all VectorClusterGroups in the collection', () => {
      const vectorClusterGroup1 = new VectorClusterGroup({});
      const vectorClusterGroup2 = new VectorClusterGroup({});
      collection.add(vectorClusterGroup1);
      collection.add(vectorClusterGroup2);

      const newGlobalHider = new GlobalHider();
      collection.globalHider = newGlobalHider;

      expect(vectorClusterGroup1.globalHider).to.equal(newGlobalHider);
      expect(vectorClusterGroup2.globalHider).to.equal(newGlobalHider);
    });
  });
});
