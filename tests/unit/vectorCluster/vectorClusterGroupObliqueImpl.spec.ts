import { expect } from 'chai';
import sinon from 'sinon';
import VectorClusterGroupObliqueImpl from '../../../src/vectorCluster/vectorClusterGroupObliqueImpl.js';
import { ObliqueMap, VectorClusterGroup } from '../../../index.js';
import { getObliqueMap } from '../helpers/obliqueHelpers.js';

describe('VectorClusterObliqueImpl', () => {
  let map: ObliqueMap;
  let vectorClusterGroup: VectorClusterGroup;

  before(async () => {
    map = await getObliqueMap();
    await map.activate();
    vectorClusterGroup = new VectorClusterGroup({});
    map.layerCollection.vectorClusterGroups.add(vectorClusterGroup);
  });

  after(() => {
    vectorClusterGroup.destroy();
    map.destroy();
  });

  describe('initialize', () => {
    let obliqueImpl: VectorClusterGroupObliqueImpl;
    before(async () => {
      obliqueImpl = vectorClusterGroup.getImplementationForMap(
        map,
      ) as VectorClusterGroupObliqueImpl;
      await obliqueImpl.initialize();
    });

    after(() => {
      vectorClusterGroup.removedFromMap(map);
    });

    it('should initialize correctly', () => {
      expect(obliqueImpl.initialized).to.be.true;
    });

    it('should add a layer to the map', () => {
      expect(map.olMap?.getLayers().getLength()).to.equal(1);
    });

    it('should only add the layer once', async () => {
      await obliqueImpl.initialize();
      expect(map.olMap?.getLayers().getLength()).to.equal(1);
    });
  });

  describe('activation', () => {
    let obliqueImpl: VectorClusterGroupObliqueImpl;
    let refresh: sinon.SinonSpy;

    before(async () => {
      obliqueImpl = vectorClusterGroup.getImplementationForMap(
        map,
      ) as VectorClusterGroupObliqueImpl;
      refresh = sinon.spy(obliqueImpl.clusterSource, 'refresh');
      await obliqueImpl.activate();
    });

    after(() => {
      vectorClusterGroup.removedFromMap(map);
    });

    it('should activate correctly', () => {
      expect(obliqueImpl.active).to.be.true;
    });

    it('should unpause the cluster source', () => {
      expect(obliqueImpl.clusterSource.paused).to.be.false;
    });

    it('should refresh the cluster source', () => {
      expect(refresh).to.have.been.calledOnce;
    });

    it('should make the layer visible', () => {
      expect(obliqueImpl.olLayer?.getVisible()).to.be.true;
    });
  });

  describe('deactivation', () => {
    let obliqueImpl: VectorClusterGroupObliqueImpl;

    before(async () => {
      obliqueImpl = vectorClusterGroup.getImplementationForMap(
        map,
      ) as VectorClusterGroupObliqueImpl;
      await obliqueImpl.activate();
      obliqueImpl.deactivate();
    });

    after(() => {
      vectorClusterGroup.removedFromMap(map);
    });

    it('should deactivate correctly', () => {
      expect(obliqueImpl.active).to.be.false;
    });

    it('should pause the cluster source', () => {
      expect(obliqueImpl.clusterSource.paused).to.be.true;
    });

    it('should make the layer invisible', () => {
      expect(obliqueImpl.olLayer?.getVisible()).to.be.false;
    });
  });

  describe('removed from map', () => {
    let obliqueImpl: VectorClusterGroupObliqueImpl;

    before(async () => {
      obliqueImpl = vectorClusterGroup.getImplementationForMap(
        map,
      ) as VectorClusterGroupObliqueImpl;
      await obliqueImpl.initialize();
      vectorClusterGroup.removedFromMap(map);
    });

    it('should remove the layer from the map', () => {
      expect(map.olMap?.getLayers().getLength()).to.equal(0);
    });
  });
});
