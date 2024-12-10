import { expect } from 'chai';
import sinon from 'sinon';
import { GroundPolylinePrimitive, GroundPrimitive } from '@vcmap-cesium/engine';
import VectorClusterGroupCesiumImpl from '../../../src/vectorCluster/vectorClusterGroupCesiumImpl.js';
import { CesiumMap, VectorClusterGroup } from '../../../index.js';
import { getCesiumMap } from '../helpers/cesiumHelpers.js';

describe('VectorClusterGroupCesiumImpl', () => {
  let map: CesiumMap;
  let vectorClusterGroup: VectorClusterGroup;
  let sandbox: sinon.SinonSandbox;

  before(async () => {
    sandbox = sinon.createSandbox();
    sandbox.stub(GroundPrimitive, 'initializeTerrainHeights');
    sandbox.stub(GroundPolylinePrimitive, 'initializeTerrainHeights');
    map = getCesiumMap();
    await map.activate();
    vectorClusterGroup = new VectorClusterGroup({});
    map.layerCollection.vectorClusterGroups.add(vectorClusterGroup);
  });

  after(() => {
    map.destroy();
    vectorClusterGroup.destroy();
    sandbox.restore();
  });

  describe('initialize', () => {
    let cesiumImpl: VectorClusterGroupCesiumImpl;
    before(async () => {
      cesiumImpl = vectorClusterGroup.getImplementationForMap(
        map,
      ) as VectorClusterGroupCesiumImpl;
      await cesiumImpl.initialize();
    });

    after(() => {
      vectorClusterGroup.removedFromMap(map);
    });

    it('should initialize correctly', () => {
      expect(cesiumImpl.initialized).to.be.true;
    });

    it('should add a cluster data source', () => {
      expect(map.getClusterDatasources().length).to.equal(1);
    });

    it('should only add the data source once', async () => {
      await cesiumImpl.initialize();
      expect(map.getClusterDatasources().length).to.equal(1);
    });
  });

  describe('activation', () => {
    let cesiumImpl: VectorClusterGroupCesiumImpl;

    before(async () => {
      cesiumImpl = vectorClusterGroup.getImplementationForMap(
        map,
      ) as VectorClusterGroupCesiumImpl;
      await cesiumImpl.activate();
    });

    after(() => {
      vectorClusterGroup.removedFromMap(map);
    });
  });

  describe('deactivation', () => {
    let cesiumImpl: VectorClusterGroupCesiumImpl;

    before(async () => {
      cesiumImpl = vectorClusterGroup.getImplementationForMap(
        map,
      ) as VectorClusterGroupCesiumImpl;
      await cesiumImpl.activate();
      cesiumImpl.deactivate();
    });

    after(() => {
      vectorClusterGroup.removedFromMap(map);
    });

    it('should deactivate correctly', () => {
      expect(cesiumImpl.active).to.be.false;
    });
  });

  describe('updateStyle', () => {});

  describe('removed from map', () => {
    let cesiumImpl: VectorClusterGroupCesiumImpl;

    before(async () => {
      cesiumImpl = vectorClusterGroup.getImplementationForMap(
        map,
      ) as VectorClusterGroupCesiumImpl;
      await cesiumImpl.initialize();
      vectorClusterGroup.removedFromMap(map);
    });

    it('should remove the cluster data source from the map', () => {
      expect(map.getClusterDatasources().length).to.equal(0);
    });
  });
});
