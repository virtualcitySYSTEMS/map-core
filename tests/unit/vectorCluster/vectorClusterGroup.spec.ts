import sinon from 'sinon';
import { expect } from 'chai';
import Feature from 'ol/Feature.js';
import LineString from 'ol/geom/LineString.js';
import Point from 'ol/geom/Point.js';
import Style from 'ol/style/Style.js';
import {
  GlobalHider,
  OpenlayersMap,
  VectorClusterGroup,
  VectorClusterGroupOptions,
  VectorClusterStyleItem,
  VectorLayer,
} from '../../../index.js';
import { getOpenlayersMap } from '../helpers/openlayersHelpers.js';
import VectorClusterGroupImpl from '../../../src/vectorCluster/vectorClusterGroupImpl.js';

function createPointFeature(): Feature<Point> {
  return new Feature({
    geometry: new Point([1, 2]),
  });
}

function createLineFeature(): Feature<LineString> {
  return new Feature({
    geometry: new LineString([
      [1, 1],
      [2, 2],
    ]),
  });
}

describe('VectorClusterGroup', () => {
  describe('adding a layer', () => {
    let vectorCluster: VectorClusterGroup;
    let vectorLayer: VectorLayer;

    beforeEach(() => {
      vectorLayer = new VectorLayer({});
      vectorLayer.addFeatures([
        createPointFeature(),
        createPointFeature(),
        createLineFeature(),
      ]);

      vectorCluster = new VectorClusterGroup({});
    });

    afterEach(() => {
      vectorCluster.destroy();
      vectorLayer.destroy();
    });

    it('should handle feature visibility changes', () => {
      vectorCluster.addLayer(vectorLayer);
      vectorLayer.featureVisibility.hideObjects(['testFeature']);
      expect(vectorCluster.featureVisibility.hiddenObjects).to.have.key(
        'testFeature',
      );
    });

    it('should sync already highlighted features from featureVisibility', () => {
      vectorLayer.featureVisibility.hideObjects(['testFeature']);
      vectorCluster.addLayer(vectorLayer);

      expect(vectorCluster.featureVisibility.hiddenObjects).to.have.key(
        'testFeature',
      );
    });

    it('should add all point features already part of the layer, if the layer is active', async () => {
      await vectorLayer.activate();
      vectorCluster.addLayer(vectorLayer);
      expect(vectorCluster.getFeatures()).to.have.lengthOf(2);
    });
  });

  describe('removing a layer', () => {
    let vectorCluster: VectorClusterGroup;
    let vectorLayer: VectorLayer;

    beforeEach(() => {
      vectorLayer = new VectorLayer({});
      vectorLayer.addFeatures([
        createPointFeature(),
        createPointFeature(),
        createLineFeature(),
      ]);

      vectorCluster = new VectorClusterGroup({});
      vectorCluster.addLayer(vectorLayer);
    });

    afterEach(() => {
      vectorCluster.destroy();
      vectorLayer.destroy();
    });

    it('should not longer listen to feature visibility changes', () => {
      vectorCluster.removeLayer(vectorLayer);
      vectorLayer.featureVisibility.hideObjects(['testFeature']);
      expect(vectorCluster.featureVisibility.hiddenObjects).to.be.empty;
    });

    describe('if the layer is active', () => {
      beforeEach(async () => {
        await vectorLayer.activate();
      });

      it('should remove all features of the layer from the cluster source', () => {
        vectorCluster.removeLayer(vectorLayer);
        expect(vectorCluster.getFeatures()).to.be.empty;
      });
    });

    describe('if the layer is not active', () => {
      it('should no longer listen to activation', async () => {
        vectorCluster.removeLayer(vectorLayer);
        await vectorLayer.activate();
        expect(vectorCluster.getFeatures()).to.be.empty;
      });
    });
  });

  describe('managed layer handling', () => {
    let vectorCluster: VectorClusterGroup;
    let vectorLayer1: VectorLayer;
    let vectorLayer2: VectorLayer;

    beforeEach(() => {
      vectorLayer1 = new VectorLayer({});
      vectorLayer1.addFeatures([
        createPointFeature(),
        createPointFeature(),
        createLineFeature(),
      ]);

      vectorLayer2 = new VectorLayer({});
      vectorLayer2.addFeatures([createPointFeature()]);
      vectorCluster = new VectorClusterGroup({});
      vectorCluster.addLayer(vectorLayer1);
      vectorCluster.addLayer(vectorLayer2);
    });

    afterEach(() => {
      vectorCluster.destroy();
      vectorLayer1.destroy();
      vectorLayer2.destroy();
    });

    describe('if the layer gets activated', () => {
      it('should add all point features already part of the layer', async () => {
        await vectorLayer2.activate();
        await vectorLayer1.activate();
        expect(vectorCluster.getFeatures()).to.have.lengthOf(3);
      });

      it('should handle feature addition', async () => {
        await vectorLayer1.activate();
        const newFeature = createPointFeature();
        vectorLayer1.addFeatures([newFeature]);
        expect(vectorCluster.getFeatures()).to.include(newFeature);
      });

      it('should ignore the addition of non-point features', async () => {
        await vectorLayer1.activate();
        const newFeature = createLineFeature();
        vectorLayer1.addFeatures([newFeature]);
        expect(vectorCluster.getFeatures()).to.not.include(newFeature);
      });

      it('should handle feature removal', async () => {
        await vectorLayer1.activate();
        const newFeature = createPointFeature();
        vectorLayer1.addFeatures([newFeature]);
        vectorLayer1.removeFeaturesById([newFeature.getId()!]);
        expect(vectorCluster.getFeatures()).to.not.include(newFeature);
      });
    });

    describe('if a layer gets deactivated', () => {
      beforeEach(async () => {
        await vectorLayer2.activate();
        await vectorLayer1.activate();
        vectorLayer1.deactivate();
      });

      it('should remove all features belonging to this layer from the cluster source', () => {
        expect(vectorCluster.getFeatures()).to.have.lengthOf(1);
      });

      it('should no longer listen to feature addition', () => {
        const newFeature = createPointFeature();
        vectorLayer1.addFeatures([newFeature]);
        expect(vectorCluster.getFeatures()).to.not.include(newFeature);
      });
    });
  });

  describe('map handling', () => {
    let map: OpenlayersMap;
    let vectorClusterGroup: VectorClusterGroup;
    let globalHider: GlobalHider;

    before(async () => {
      map = await getOpenlayersMap({});
      await map.activate();
      globalHider = new GlobalHider();
    });

    beforeEach(() => {
      vectorClusterGroup = new VectorClusterGroup({});
      vectorClusterGroup.setGlobalHider(globalHider);
    });

    afterEach(() => {
      vectorClusterGroup.destroy();
    });

    after(() => {
      map.destroy();
    });

    describe('mapActivated', () => {
      let impl: VectorClusterGroupImpl<OpenlayersMap>;

      beforeEach(() => {
        impl = vectorClusterGroup.getImplementationForMap(map)!;
      });

      it('should activate all implementations for the map, if active', async () => {
        await vectorClusterGroup.mapActivated(map);
        expect(impl.active).to.be.true;
      });

      it('should not activate implementation from other maps', async () => {
        const map2 = await getOpenlayersMap();
        const impl2 = vectorClusterGroup.getImplementationForMap(map2)!;
        await vectorClusterGroup.mapActivated(map);
        expect(impl2.active).to.be.false;
        map2.destroy();
      });
    });

    describe('mapDeactivated', () => {
      let impl: VectorClusterGroupImpl<OpenlayersMap>;

      beforeEach(async () => {
        impl = vectorClusterGroup.getImplementationForMap(map)!;
        await vectorClusterGroup.mapActivated(map);
      });

      it('should deactivate all implementations for the map, if active', () => {
        vectorClusterGroup.mapDeactivated(map);
        expect(impl.active).to.be.false;
      });

      it('should not deactivate implementation from other maps', async () => {
        const map2 = await getOpenlayersMap();
        await map2.activate();
        const impl2 = vectorClusterGroup.getImplementationForMap(map2)!;
        await impl2.activate();
        vectorClusterGroup.mapDeactivated(map);
        expect(impl2.active).to.be.true;
        map2.destroy();
      });
    });

    describe('removedFromMap', () => {
      let impl: VectorClusterGroupImpl<OpenlayersMap>;

      beforeEach(() => {
        impl = vectorClusterGroup.getImplementationForMap(map)!;
      });

      it('should remove the implementations', () => {
        vectorClusterGroup.removedFromMap(map);
        expect(vectorClusterGroup.getImplementations()).to.be.empty;
      });

      it('should destroy the implementations', () => {
        vectorClusterGroup.removedFromMap(map);
        expect(impl.isDestroyed).to.be.true;
      });
    });

    describe('getting the implementations of a map', () => {
      it('should create the implementation for a map, if they are missing', () => {
        const impl = vectorClusterGroup.getImplementationForMap(map);
        expect(impl).to.be.an.instanceOf(VectorClusterGroupImpl);
      });

      it('should return a previously created implementation for a map', () => {
        const impls1 = vectorClusterGroup.getImplementationForMap(map);
        const impls2 = vectorClusterGroup.getImplementationForMap(map);
        expect(impls1).to.equal(impls2);
      });
    });

    describe('forcing implementation recreation', () => {
      beforeEach(() => {
        vectorClusterGroup.getImplementationForMap(map);
      });

      it('should destroy the impl, if initialized', async () => {
        const impl = vectorClusterGroup.getImplementations()[0];
        await vectorClusterGroup.forceRedraw();
        expect(impl.isDestroyed).to.be.true;
      });

      it('should activate newly created impls', async () => {
        await vectorClusterGroup.mapActivated(map);
        await vectorClusterGroup.forceRedraw();
        expect(vectorClusterGroup.getImplementations()[0].active).to.be.true;
      });
    });
  });

  describe('setting a style', () => {
    let map: OpenlayersMap;
    let impl: VectorClusterGroupImpl<OpenlayersMap>;

    let vectorCluster: VectorClusterGroup;
    let vectorLayer: VectorLayer;
    let features: [Feature, Feature];
    let featureChanged: [sinon.SinonSpy, sinon.SinonSpy];
    let style: VectorClusterStyleItem;

    before(async () => {
      map = await getOpenlayersMap({});
      vectorLayer = new VectorLayer({});
      await vectorLayer.activate();
      style = new VectorClusterStyleItem({});
    });

    beforeEach(() => {
      vectorCluster = new VectorClusterGroup({});
      vectorCluster.addLayer(vectorLayer);
      impl = vectorCluster.getImplementationForMap(map)!;
      features = [createPointFeature(), createPointFeature()];
      vectorLayer.addFeatures(features);
      featureChanged = [sinon.spy(), sinon.spy()];
      features.map((feature, index) =>
        feature.on('change', () => {
          featureChanged[index]();
        }),
      );
    });

    afterEach(() => {
      vectorLayer.removeAllFeatures();
      vectorCluster.destroy();
    });

    after(() => {
      style.destroy();
      vectorLayer.destroy();
      map.destroy();
    });

    it('should set the style on the cluster', () => {
      vectorCluster.setStyle(style);
      expect(vectorCluster.style).to.equal(style);
    });

    it('should call changed on features without a style', () => {
      vectorCluster.setStyle(style);
      featureChanged.forEach((spy) => {
        expect(spy).to.have.been.called;
      });
    });

    it('should not call changed on features with a style', () => {
      features[0].setStyle(new Style({}));
      featureChanged.forEach((spy) => {
        spy.resetHistory();
      });
      vectorCluster.setStyle(style);
      expect(featureChanged[0]).to.not.have.been.called;
      expect(featureChanged[1]).to.have.been.called;
    });

    it('should update the style function on the impl', () => {
      const implStyle = impl.style;
      vectorCluster.setStyle(style);
      expect(impl.style).to.not.equal(implStyle);
    });
  });

  describe('getting a config', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default vector cluster group', () => {
        const config = new VectorClusterGroup({}).toJSON();
        expect(config).to.have.all.keys('name', 'type');
      });
    });

    describe('of a configured vector cluster group', () => {
      let inputConfig: VectorClusterGroupOptions;
      let outputConfig: VectorClusterGroupOptions;
      let configureVectorCluster: VectorClusterGroup;

      before(() => {
        inputConfig = {
          clusterDistance: 12,
          style: {
            breaks: [1, 2, 3],
          },
          highlightStyle: {
            breaks: [4, 5, 6],
          },
        };
        configureVectorCluster = new VectorClusterGroup(inputConfig);
        outputConfig = configureVectorCluster.toJSON();
      });

      after(() => {
        configureVectorCluster.destroy();
      });

      it('should configure clusterDistance', () => {
        expect(outputConfig).to.have.property(
          'clusterDistance',
          inputConfig.clusterDistance,
        );
      });

      it('should configure style', () => {
        expect(outputConfig)
          .to.have.property('style')
          .and.to.eql(inputConfig.style);
      });

      it('should configure highlightStyle', () => {
        expect(outputConfig)
          .to.have.property('highlightStyle')
          .and.to.eql(inputConfig.highlightStyle);
      });
    });
  });
});
