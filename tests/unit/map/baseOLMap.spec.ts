import { expect } from 'chai';
import OLLayer from 'ol/layer/Layer.js';
import Layer from '../../../src/layer/layer.js';
import LayerCollection from '../../../src/util/layerCollection.js';
import BaseOLMap from '../../../src/map/baseOLMap.js';
import { vcsLayerName } from '../../../src/layer/layerSymbols.js';
import { VectorClusterGroup, vectorClusterGroupName } from '../../../index.js';

describe('BaseOLMap', () => {
  let layer1: Layer;
  let layer2: Layer;
  let olLayer1: OLLayer;
  let olLayer2: OLLayer;

  before(() => {
    layer1 = new Layer({ name: 'layer1' });
    olLayer1 = new OLLayer({});
    olLayer1[vcsLayerName] = layer1.name;
    layer2 = new Layer({ name: 'layer2' });
    olLayer2 = new OLLayer({});
    olLayer2[vcsLayerName] = layer2.name;
  });

  after(() => {
    layer1.destroy();
    layer2.destroy();
  });

  describe('adding ol layers', () => {
    let map: BaseOLMap;
    let layerCollection: LayerCollection;

    before(() => {
      layerCollection = LayerCollection.from([layer1, layer2]);
    });

    beforeEach(async () => {
      map = new BaseOLMap({ layerCollection });
      await map.initialize();
    });

    afterEach(() => {
      map.destroy();
    });

    after(() => {
      layerCollection.destroy();
    });

    it('should add a layer to the olMap', () => {
      map.addOLLayer(olLayer1);
      expect(map.olMap!.getLayers().getArray()).to.include(olLayer1);
    });

    it('should not add a visualization twice', () => {
      map.addOLLayer(olLayer1);
      map.addOLLayer(olLayer1);
      expect(map.olMap!.getLayers().getArray()).to.have.lengthOf(1);
    });

    it('should add a visualization at the correct index based on the index in the layer collection', () => {
      map.addOLLayer(olLayer2);
      map.addOLLayer(olLayer1);
      expect(map.olMap!.getLayers().getArray()).to.have.ordered.members([
        olLayer1,
        olLayer2,
      ]);
    });

    it('should not add an olLayer without a vcsLayerName symbol', () => {
      const layer = new OLLayer({});
      map.addOLLayer(layer);
      expect(map.olMap!.getLayers().getArray()).to.be.empty;
    });

    it('should not add an olLayer with a vcsLayerName not corresponding to a layer in the layerCollection', () => {
      const layer = new OLLayer({});
      layer[vcsLayerName] = 'test';
      map.addOLLayer(layer);
      expect(map.olMap!.getLayers().getArray()).to.be.empty;
    });
  });

  describe('moving of layers within the layer collection', () => {
    it('should rearrange the layers to place them at the right index', async () => {
      const layerCollection = LayerCollection.from([layer1, layer2]);
      const map = new BaseOLMap({ layerCollection });
      await map.initialize();
      map.addOLLayer(olLayer2);
      map.addOLLayer(olLayer1);
      layerCollection.raise(layer1);
      expect(map.olMap!.getLayers().getArray()).to.have.ordered.members([
        olLayer2,
        olLayer1,
      ]);
      map.destroy();
      layerCollection.destroy();
    });
  });

  describe('removing of layers', () => {
    let map: BaseOLMap;
    let layerCollection: LayerCollection;

    before(() => {
      layerCollection = LayerCollection.from([layer1, layer2]);
    });

    beforeEach(async () => {
      map = new BaseOLMap({ layerCollection });
      await map.initialize();
      map.addOLLayer(olLayer1);
      map.addOLLayer(olLayer2);
    });

    afterEach(() => {
      map.destroy();
    });

    after(() => {
      layerCollection.destroy();
    });

    it('should remove the layer from the map', () => {
      map.removeOLLayer(olLayer1);
      expect(map.olMap!.getLayers().getArray()).to.not.include(olLayer1);
    });

    it('should no longer place the layer at an index, if it has been removed after the removal of its visualization', () => {
      map.removeOLLayer(olLayer1);
      layerCollection.raise(layer1);
      expect(map.olMap!.getLayers().getArray()).to.not.include(olLayer1);
    });
  });

  describe('getting current resolution', () => {
    let map: BaseOLMap;

    beforeEach(() => {
      map = new BaseOLMap({});
    });

    afterEach(() => {
      map.destroy();
    });

    it('should return 1, if there is not current view', () => {
      expect(map.getCurrentResolution([0, 0])).to.equal(1);
    });

    it('should return the current views resolution', async () => {
      await map.initialize();
      map.olMap!.getView().setResolution(3);
      expect(map.getCurrentResolution([0, 0])).to.equal(3);
    });
  });

  describe('post render event', () => {
    it('should raise the post render event', async () => {
      const map = new BaseOLMap({});
      await map.initialize();
      let event = null;
      map.postRender.addEventListener((e) => {
        event = e;
      });
      map.requestRender();
      await new Promise((resolve) => {
        setTimeout(resolve, 100);
      });
      expect(event).to.not.be.null;
      expect(event).to.have.property('map', map);
      map.destroy();
    });
  });

  describe('adding a layer belonging to a vector cluster group', () => {
    let map: BaseOLMap;
    let layerCollection: LayerCollection;
    let vectorClusterGroup: VectorClusterGroup;
    let olLayer3: OLLayer;

    before(() => {
      layerCollection = LayerCollection.from([layer1, layer2]);
    });

    beforeEach(async () => {
      vectorClusterGroup = new VectorClusterGroup({
        zIndex: 1,
      });
      olLayer3 = new OLLayer({});
      olLayer3[vectorClusterGroupName] = vectorClusterGroup.name;
      layerCollection.vectorClusterGroups.add(vectorClusterGroup);
      map = new BaseOLMap({ layerCollection });
      await map.initialize();
    });

    afterEach(() => {
      layerCollection.vectorClusterGroups.remove(vectorClusterGroup);
      vectorClusterGroup.destroy();

      map.destroy();
    });

    after(() => {
      layerCollection.destroy();
    });

    it('should add a layer to the olMap', () => {
      map.addOLLayer(olLayer3);
      expect(map.olMap!.getLayers().getArray()).to.include(olLayer3);
    });

    it('should not add a visualization twice', () => {
      map.addOLLayer(olLayer3);
      map.addOLLayer(olLayer3);
      expect(map.olMap!.getLayers().getArray()).to.have.lengthOf(1);
    });
  });

  describe('z index handling', () => {
    let map: BaseOLMap;
    let layerCollection: LayerCollection;
    let vectorClusterGroup: VectorClusterGroup;
    let olLayer3: OLLayer;
    let olLayer4: OLLayer;
    let olLayer5: OLLayer;
    let olLayer6: OLLayer;
    let olLayer7: OLLayer;

    before(async () => {
      const layer4 = new Layer({ name: 'layer4', zIndex: 4 });
      olLayer4 = new OLLayer({});
      olLayer4[vcsLayerName] = layer4.name;

      const layer5 = new Layer({ name: 'layer5', zIndex: 1 });
      olLayer5 = new OLLayer({});
      olLayer5[vcsLayerName] = layer5.name;

      const layer6 = new Layer({ name: 'layer6', zIndex: 4 });
      olLayer6 = new OLLayer({});
      olLayer6[vcsLayerName] = layer6.name;

      layerCollection = LayerCollection.from([
        layer1,
        layer2,
        layer4,
        layer5,
        layer6,
      ]);

      vectorClusterGroup = new VectorClusterGroup({
        name: 'layer3',
        zIndex: 1,
      });
      olLayer3 = new OLLayer({});
      olLayer3[vectorClusterGroupName] = vectorClusterGroup.name;
      layerCollection.vectorClusterGroups.add(vectorClusterGroup);

      const vectorClusterGroup2 = new VectorClusterGroup({
        name: 'layer7',
        zIndex: 4,
      });
      olLayer7 = new OLLayer({});
      olLayer7[vectorClusterGroupName] = vectorClusterGroup2.name;
      layerCollection.vectorClusterGroups.add(vectorClusterGroup2);

      map = new BaseOLMap({ layerCollection });
      await map.initialize();
    });

    afterEach(() => {
      map.removeOLLayer(olLayer1);
      map.removeOLLayer(olLayer2);
      map.removeOLLayer(olLayer3);
      map.removeOLLayer(olLayer4);
      map.removeOLLayer(olLayer5);
      map.removeOLLayer(olLayer6);
      map.removeOLLayer(olLayer7);
      map.olMap?.getLayers().clear();
    });

    after(() => {
      layerCollection.destroy();
      map.destroy();
    });

    it('should maintain order of the adding of the layers to the layer colletion', () => {
      map.addOLLayer(olLayer1);
      map.addOLLayer(olLayer2);
      expect(map.olMap!.getLayers().getArray()).to.have.ordered.members([
        olLayer1,
        olLayer2,
      ]);
    });

    it('should ensure, the vector cluster group is placed at the end of layers with the same zIndex', () => {
      map.addOLLayer(olLayer4);
      map.addOLLayer(olLayer6);
      map.addOLLayer(olLayer7);
      expect(map.olMap!.getLayers().getArray()).to.have.ordered.members([
        olLayer4,
        olLayer6,
        olLayer7,
      ]);
    });

    it('should ensure layers with the same zIndex are placed in the order they were added', () => {
      map.addOLLayer(olLayer4);
      map.addOLLayer(olLayer5);
      map.addOLLayer(olLayer6);

      expect(map.olMap!.getLayers().getArray()).to.have.ordered.members([
        olLayer5,
        olLayer4,
        olLayer6,
      ]);
    });

    it('should place cluster groups with lower zIndices before higher zIndices', () => {
      map.addOLLayer(olLayer3);
      map.addOLLayer(olLayer7);
      expect(map.olMap!.getLayers().getArray()).to.have.ordered.members([
        olLayer3,
        olLayer7,
      ]);
    });

    it('should treat sneaky custom ol layers directly added to the ol map as having a zIndex of -1', () => {
      const newLayer = new OLLayer({});
      map.olMap!.addLayer(newLayer);
      map.addOLLayer(olLayer1);
      map.addOLLayer(olLayer5);
      const otherNewLayer = new OLLayer({});
      map.olMap!.addLayer(otherNewLayer);
      map.addOLLayer(olLayer4);

      expect(map.olMap!.getLayers().getArray()).to.have.ordered.members([
        newLayer,
        olLayer1,
        olLayer5,
        otherNewLayer,
        olLayer4,
      ]);
    });

    it('all together', () => {
      map.addOLLayer(olLayer1);
      map.addOLLayer(olLayer2);
      map.addOLLayer(olLayer3);
      map.addOLLayer(olLayer4);
      map.addOLLayer(olLayer5);
      map.addOLLayer(olLayer6);
      map.addOLLayer(olLayer7);

      expect(map.olMap!.getLayers().getArray()).to.have.ordered.members([
        olLayer1,
        olLayer2,
        olLayer5,
        olLayer3,
        olLayer4,
        olLayer6,
        olLayer7,
      ]);
    });
  });
});
