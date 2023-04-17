import OLLayer from 'ol/layer/Layer.js';
import Layer from '../../../src/layer/layer.js';
import LayerCollection from '../../../src/util/layerCollection.js';
import BaseOLMap from '../../../src/map/baseOLMap.js';
import { vcsLayerName } from '../../../src/layer/layerSymbols.js';

describe('BaseOLMap', () => {
  let layer1;
  let layer2;
  let olLayer1;
  let olLayer2;

  before(() => {
    layer1 = new Layer({});
    olLayer1 = new OLLayer({});
    olLayer1[vcsLayerName] = layer1.name;
    layer2 = new Layer({});
    olLayer2 = new OLLayer({});
    olLayer2[vcsLayerName] = layer2.name;
  });

  after(() => {
    layer1.destroy();
    layer2.destroy();
  });

  describe('adding ol layers', () => {
    /** @type {import("@vcmap/core").BaseOLMap} */
    let map;
    let layerCollection;

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
      expect(map.olMap.getLayers().getArray()).to.include(olLayer1);
    });

    it('should not add a visualization twice', () => {
      map.addOLLayer(olLayer1);
      map.addOLLayer(olLayer1);
      expect(map.olMap.getLayers().getArray()).to.have.lengthOf(1);
    });

    it('should add a visualization at the correct index based on the index in the layer collection', () => {
      map.addOLLayer(olLayer2);
      map.addOLLayer(olLayer1);
      expect(map.olMap.getLayers().getArray()).to.have.ordered.members([
        olLayer1,
        olLayer2,
      ]);
    });

    it('should not add an olLayer without a vcsLayerName symbol', () => {
      const layer = new OLLayer({});
      map.addOLLayer(layer);
      expect(map.olMap.getLayers().getArray()).to.be.empty;
    });

    it('should not add an olLayer with a vcsLayerName not corresponding to a layer in the layerCollection', () => {
      const layer = new OLLayer({});
      layer[vcsLayerName] = 'test';
      map.addOLLayer(layer);
      expect(map.olMap.getLayers().getArray()).to.be.empty;
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
      expect(map.olMap.getLayers().getArray()).to.have.ordered.members([
        olLayer2,
        olLayer1,
      ]);
      map.destroy();
      layerCollection.destroy();
    });
  });

  describe('removing of layers', () => {
    /** @type {import("@vcmap/core").BaseOLMap} */
    let map;
    let layerCollection;

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
      expect(map.olMap.getLayers().getArray()).to.not.include(olLayer1);
    });

    it('should no longer place the layer at an index, if it has been removed after the removal of its visualization', () => {
      map.removeOLLayer(olLayer1);
      layerCollection.raise(layer1);
      expect(map.olMap.getLayers().getArray()).to.not.include(olLayer1);
    });
  });

  describe('getting current resolution', () => {
    /** @type {import("@vcmap/core").BaseOLMap} */
    let map;

    beforeEach(async () => {
      map = new BaseOLMap({});
    });

    afterEach(() => {
      map.destroy();
    });

    it('should return 1, if there is not current view', () => {
      expect(map.getCurrentResolution()).to.equal(1);
    });

    it('should return the current views resolution', async () => {
      await map.initialize();
      map.olMap.getView().setResolution(3);
      expect(map.getCurrentResolution()).to.equal(3);
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
});
