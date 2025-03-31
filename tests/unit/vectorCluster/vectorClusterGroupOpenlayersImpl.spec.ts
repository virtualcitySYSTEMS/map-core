import { expect } from 'chai';
import sinon from 'sinon';
import type VectorClusterGroupOpenlayersImpl from '../../../src/vectorCluster/vectorClusterGroupOpenlayersImpl.js';
import type OpenlayersMap from '../../../src/map/openlayersMap.js';
import { getOpenlayersMap } from '../helpers/openlayersHelpers.js';
import { VectorClusterGroup } from '../../../index.js';

describe('VectorClusterOpenlayersImpl', () => {
  let map: OpenlayersMap;
  let vectorClusterGroup: VectorClusterGroup;

  before(async () => {
    map = await getOpenlayersMap();
    await map.activate();
    vectorClusterGroup = new VectorClusterGroup({});
    map.layerCollection.vectorClusterGroups.add(vectorClusterGroup);
  });

  after(() => {
    vectorClusterGroup.destroy();
    map.destroy();
  });

  describe('initialize', () => {
    let openlayersImpl: VectorClusterGroupOpenlayersImpl;

    before(async () => {
      openlayersImpl = vectorClusterGroup.getImplementationForMap(
        map,
      ) as VectorClusterGroupOpenlayersImpl;
      await openlayersImpl.initialize();
    });

    after(() => {
      vectorClusterGroup.removedFromMap(map);
    });

    it('should initialize correctly', () => {
      expect(openlayersImpl.initialized).to.be.true;
    });

    it('should add a layer to the map', () => {
      expect(map.olMap?.getLayers().getLength()).to.equal(1);
    });

    it('should only add the layer once', async () => {
      await openlayersImpl.initialize();
      expect(map.olMap?.getLayers().getLength()).to.equal(1);
    });
  });

  describe('activation', () => {
    let openlayersImpl: VectorClusterGroupOpenlayersImpl;
    let refresh: sinon.SinonSpy;

    before(async () => {
      openlayersImpl = vectorClusterGroup.getImplementationForMap(
        map,
      ) as VectorClusterGroupOpenlayersImpl;
      refresh = sinon.spy(openlayersImpl.clusterSource, 'refresh');
      await openlayersImpl.activate();
    });

    after(() => {
      vectorClusterGroup.removedFromMap(map);
    });

    it('should activate correctly', () => {
      expect(openlayersImpl.active).to.be.true;
    });

    it('should unpause the cluster source', () => {
      expect(openlayersImpl.clusterSource.paused).to.be.false;
    });

    it('should refresh the cluster source', () => {
      expect(refresh).to.have.been.calledOnce;
    });

    it('should make the layer visible', () => {
      expect(openlayersImpl.olLayer?.getVisible()).to.be.true;
    });
  });

  describe('deactivation', () => {
    let openlayersImpl: VectorClusterGroupOpenlayersImpl;

    before(async () => {
      openlayersImpl = vectorClusterGroup.getImplementationForMap(
        map,
      ) as VectorClusterGroupOpenlayersImpl;
      await openlayersImpl.activate();
      openlayersImpl.deactivate();
    });

    after(() => {
      vectorClusterGroup.removedFromMap(map);
    });

    it('should deactivate correctly', () => {
      expect(openlayersImpl.active).to.be.false;
    });

    it('should pause the cluster source', () => {
      expect(openlayersImpl.clusterSource.paused).to.be.true;
    });

    it('should make the layer invisible', () => {
      expect(openlayersImpl.olLayer?.getVisible()).to.be.false;
    });
  });

  describe('removed from map', () => {
    let openlayersImpl: VectorClusterGroupOpenlayersImpl;

    before(async () => {
      openlayersImpl = vectorClusterGroup.getImplementationForMap(
        map,
      ) as VectorClusterGroupOpenlayersImpl;
      await openlayersImpl.initialize();
      vectorClusterGroup.removedFromMap(map);
    });

    it('should remove the layer from the map', () => {
      expect(map.olMap?.getLayers().getLength()).to.equal(0);
    });
  });
});
