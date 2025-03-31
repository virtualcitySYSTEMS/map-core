import { expect } from 'chai';
import type { StyleFunction } from 'ol/style/Style.js';
import Style from 'ol/style/Style.js';
import VectorClusterGroupImpl from '../../../src/vectorCluster/vectorClusterGroupImpl.js';
import ClusterEnhancedVectorSource from '../../../src/ol/source/ClusterEnhancedVectorSource.js';
import FeatureVisibility from '../../../src/layer/featureVisibility.js';
import VcsMap from '../../../src/map/vcsMap.js';
import { GlobalHider, VectorProperties } from '../../../index.js';
import VcsCluster from '../../../src/ol/source/VcsCluster.js';

describe('VectorClusterGroupImpl', () => {
  let map: VcsMap;
  let source: ClusterEnhancedVectorSource;
  let featureVisibility: FeatureVisibility;
  let style: StyleFunction;
  let vectorProperties: VectorProperties;
  let globalHider: GlobalHider;
  let clusterSource: VcsCluster;
  let vectorClusterGroupImpl: VectorClusterGroupImpl<VcsMap>;

  before(async () => {
    map = new VcsMap({});
    await map.activate();
    source = new ClusterEnhancedVectorSource();
    clusterSource = new VcsCluster({ source }, 'test');
    featureVisibility = new FeatureVisibility();
    vectorProperties = new VectorProperties({});
    style = (): Style => new Style({});
    globalHider = new GlobalHider();
  });

  beforeEach(async () => {
    vectorClusterGroupImpl = new VectorClusterGroupImpl(map, {
      name: 'test',
      style,
      vectorProperties,
      source,
      featureVisibility,
      globalHider,
      clusterDistance: 40,
      getLayerByName: (): undefined => undefined,
    });
    await vectorClusterGroupImpl.activate();
  });

  afterEach(() => {
    vectorClusterGroupImpl.destroy();
  });

  after(() => {
    map.destroy();
    featureVisibility.destroy();
    globalHider.destroy();
    vectorProperties.destroy();
    clusterSource.dispose();
    source.dispose();
  });

  it('should activate correctly', () => {
    expect(vectorClusterGroupImpl.active).to.be.true;
    expect(vectorClusterGroupImpl.initialized).to.be.true;
  });

  it('should deactivate correctly', () => {
    vectorClusterGroupImpl.deactivate();
    expect(vectorClusterGroupImpl.active).to.be.false;
  });

  it('should destroy correctly', () => {
    vectorClusterGroupImpl.destroy();
    expect(vectorClusterGroupImpl.initialized).to.be.false;
    expect(() => vectorClusterGroupImpl.map).to.throw();
  });
});
