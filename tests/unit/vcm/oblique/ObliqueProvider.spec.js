import { get as getProjection } from 'ol/proj.js';
import OLMap from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import CesiumTerrainProvider from '@vcmap/cesium/Source/Core/CesiumTerrainProvider.js';
import ObliqueCollection from '../../../../src/vcs/vcm/oblique/ObliqueCollection.js';
import ObliqueDataSet, { DataState } from '../../../../src/vcs/vcm/oblique/ObliqueDataSet.js';
import ObliqueProvider from '../../../../src/vcs/vcm/oblique/ObliqueProvider.js';
import setTiledObliqueImageServer, { tiledMercatorCoordinate, tiledMercatorCoordinate2, imagev35MercatorCoordinate } from '../../helpers/obliqueData.js';
import { ObliqueViewDirection } from '../../../../src/vcs/vcm/oblique/ObliqueViewDirection.js';
import { setTerrainServer } from '../../helpers/terrain/terrainData.js';
import imageJson from '../../../data/oblique/imageData/imagev35.json';
import { getCesiumEventSpy } from '../../helpers/cesiumHelpers.js';

describe('ObliqueProvider', () => {
  let sandbox;
  let olMap;
  let projection;
  let url;

  before(async () => {
    const target = document.createElement('div');
    olMap = new OLMap({ target, view: new View() });
    sandbox = sinon.createSandbox();
    url = 'http://localhost/tiledOblique/image.json';
    projection = getProjection('EPSG:25833');
  });

  after(() => {
    sandbox.restore();
    olMap.setTarget(null);
  });

  describe('setting a collection', () => {
    let obliqueProvider;
    let collection;

    beforeEach(async () => {
      obliqueProvider = new ObliqueProvider(olMap);
      const dataSet = new ObliqueDataSet(url, projection);
      dataSet.initialize(imageJson);
      collection = new ObliqueCollection({ dataSets: [dataSet] });
    });

    afterEach(() => {
      collection.destroy();
      obliqueProvider.destroy();
    });

    it('should set a loaded collection on the provider', async () => {
      await collection.load();
      obliqueProvider.setCollection(collection);
      expect(obliqueProvider.collection).to.equal(collection);
    });

    it('should not set an unloaded collection', () => {
      obliqueProvider.setCollection(collection);
      expect(obliqueProvider.collection).to.be.null;
    });

    describe('with a previously loaded collection', () => {
      beforeEach(async () => {
        await collection.load();
        obliqueProvider.setCollection(collection);
        const image = await collection.loadImageForCoordinate(imagev35MercatorCoordinate, ObliqueViewDirection.NORTH);
        obliqueProvider.activate();
        await obliqueProvider.setImage(image);
      });

      it('should unset the current view', () => {
        const view = olMap.getView();
        obliqueProvider.setCollection(collection);
        expect(olMap.getView()).to.not.equal(view);
      });

      it('should remove the current layer', () => {
        obliqueProvider.setCollection(collection);
        expect(olMap.getLayers().getArray()).to.be.empty;
      });

      it('should unset the currentImage', () => {
        obliqueProvider.setCollection(collection);
        expect(obliqueProvider.currentImage).to.be.null;
      });
    });
  });

  describe('activating the oblique provider', () => {
    let obliqueProvider;
    let collection;

    beforeEach(async () => {
      obliqueProvider = new ObliqueProvider(olMap);
      const dataSet = new ObliqueDataSet(url, projection);
      dataSet.initialize(imageJson);
      collection = new ObliqueCollection({ dataSets: [dataSet] });
      await collection.load();
    });

    afterEach(() => {
      collection.destroy();
      obliqueProvider.destroy();
    });

    it('should throw, if there is no set collection', () => {
      expect(obliqueProvider.activate.bind(obliqueProvider)).to.throw;
    });

    it('should set the oblique provider active', () => {
      obliqueProvider.setCollection(collection);
      obliqueProvider.activate();
      expect(obliqueProvider.active).to.be.true;
    });

    it('should add the post render listener', async () => {
      obliqueProvider.setCollection(collection);
      obliqueProvider.activate();
      await obliqueProvider.setView(imagev35MercatorCoordinate, ObliqueViewDirection.NORTH);
      olMap.getView().setCenter(obliqueProvider.currentImage.meta.size);
      olMap.renderSync();
      expect(obliqueProvider.loading).to.be.true;
    });

    it('should add the current images layer, if there is a current image', async () => {
      obliqueProvider.setCollection(collection);
      await obliqueProvider.setView(tiledMercatorCoordinate2, ObliqueViewDirection.NORTH);
      expect(olMap.getLayers().getArray()).to.be.empty;
      obliqueProvider.activate();
      expect(olMap.getLayers().getArray()).to.have.lengthOf(1);
    });
  });

  describe('deactivating the oblique provider', () => {
    let obliqueProvider;
    let collection;

    beforeEach(async () => {
      obliqueProvider = new ObliqueProvider(olMap);
      const dataSet = new ObliqueDataSet(url, projection);
      dataSet.initialize(imageJson);
      collection = new ObliqueCollection({ dataSets: [dataSet] });
      await collection.load();
      obliqueProvider.setCollection(collection);
      obliqueProvider.activate();
    });

    afterEach(() => {
      collection.destroy();
      obliqueProvider.destroy();
    });

    it('should set the provider to not be active', () => {
      obliqueProvider.deactivate();
      expect(obliqueProvider.active).to.be.false;
    });

    it('should remove the current images layer', async () => {
      await obliqueProvider.setView(imagev35MercatorCoordinate, ObliqueViewDirection.NORTH);
      obliqueProvider.deactivate();
      expect(olMap.getLayers().getArray()).to.be.empty;
    });

    it('should unset the current images view', async () => {
      await obliqueProvider.setView(imagev35MercatorCoordinate, ObliqueViewDirection.NORTH);
      const view = olMap.getView();
      obliqueProvider.deactivate();
      expect(olMap.getView()).to.not.equal(view);
    });

    it('should remove the post render listener', async () => {
      await obliqueProvider.setView(imagev35MercatorCoordinate, ObliqueViewDirection.NORTH);
      obliqueProvider.deactivate();
      olMap.getView().setCenter(obliqueProvider.currentImage.meta.size);
      olMap.renderSync();
      expect(obliqueProvider.loading).to.be.false;
    });
  });

  describe('moving the map (aka. post render event handling)', () => {
    let obliqueProvider;
    let collection;

    beforeEach(async () => {
      obliqueProvider = new ObliqueProvider(olMap);
      collection = new ObliqueCollection({
        dataSets: [new ObliqueDataSet('http://localhost/tiledOblique/image.json', getProjection('EPSG:25833'))],
      });
      setTiledObliqueImageServer(sandbox.useFakeServer());
      await collection.load();
      obliqueProvider.setCollection(collection);
      obliqueProvider.activate();
      await obliqueProvider.setView(tiledMercatorCoordinate, ObliqueViewDirection.NORTH);
    });

    afterEach(() => {
      collection.destroy();
      obliqueProvider.destroy();
    });

    it('should not load new images, if the current views center is within the bounds of the current image', () => {
      olMap.renderSync();
      expect(obliqueProvider.loading).to.be.false;
    });

    it('should load data at the current center, if it is PENDING', () => {
      olMap.getView().setCenter([0, 0]);
      olMap.renderSync();
      expect(collection.getTiles()).to.have.property('12/2199/1344', DataState.LOADING);
    });

    it('should load the next image, if the data is READY', () => {
      olMap.getView().setCenter(obliqueProvider.currentImage.meta.size);
      olMap.renderSync();
      expect(obliqueProvider.loading).to.be.true;
    });
  });

  describe('setting an image', () => {
    let obliqueProvider;
    let collection;
    let image;

    before(async () => {
      setTerrainServer(sandbox.useFakeServer());
      const terrainProvider = new CesiumTerrainProvider({ url: 'http://localhost/terrain' });
      await terrainProvider.readyPromise;
      const dataSet = new ObliqueDataSet(url, projection, terrainProvider);
      dataSet.initialize(imageJson);
      collection = new ObliqueCollection({ dataSets: [dataSet] });
      await collection.load();
      image = await collection.loadImageForCoordinate(tiledMercatorCoordinate, ObliqueViewDirection.NORTH);
    });

    beforeEach(() => {
      obliqueProvider = new ObliqueProvider(olMap);
      obliqueProvider.setCollection(collection);
    });

    afterEach(() => {
      obliqueProvider.destroy();
    });

    after(() => {
      collection.destroy();
    });

    it.skip('should calculate the current images average height', async () => { // XXX failing do to previous specs. cleanup issue
      await obliqueProvider.setImage(image);
      expect(image.averageHeight).to.be.greaterThan(0);
    });

    it('should set the current image', async () => {
      await obliqueProvider.setImage(image);
      expect(obliqueProvider.currentImage).to.equal(image);
    });

    it('should raise the image changed event', async () => {
      const spy = getCesiumEventSpy(sandbox, obliqueProvider.imageChanged);
      await obliqueProvider.setImage(image);
      expect(spy).to.have.been.called;
      expect(spy).to.have.been.calledWith(image);
    });

    it('should add the current images layer', async () => {
      obliqueProvider.activate();
      await obliqueProvider.setImage(image);
      const layer = olMap.getLayers().getArray()[0];
      expect(layer).to.be.an.instanceOf(TileLayer);
      expect(layer.getSource().getTileUrlFunction()([0, 1, -1]))
        .to.equal(`${image.meta.url}/${image.name}/0/1/0.${image.meta.format}`);
    });

    it('should add the current images layer as the base layer', async () => {
      obliqueProvider.activate();
      const layer = new TileLayer();
      olMap.addLayer(layer);
      await obliqueProvider.setImage(image);
      expect(olMap.getLayers().item(1)).to.equal(layer);
      olMap.removeLayer(layer);
    });

    it('should set the current view to the center of the image', async () => {
      obliqueProvider.activate();
      await obliqueProvider.setImage(image);
      const [width, height] = obliqueProvider.currentImage.meta.size;
      const center = [width / 2, height / 2];
      expect(olMap.getView().getCenter()).to.have.members(center);
    });

    it('should set an optional center', async () => {
      await obliqueProvider.setImage(image, imagev35MercatorCoordinate);
      const { center } = await obliqueProvider.getView();
      expect(center[0]).to.be.closeTo(imagev35MercatorCoordinate[0], 0.001);
      expect(center[1]).to.be.closeTo(imagev35MercatorCoordinate[1], 0.001);
    });

    it('should truncate the provided center to be within the bounds of the image', async () => {
      obliqueProvider.activate();
      const coords = [imagev35MercatorCoordinate[0] - 2000, imagev35MercatorCoordinate[1] - 2000];
      await obliqueProvider.setImage(image, coords);
      expect(olMap.getView().getCenter()).to.have.members([0, 0]);
    });

    describe('parallel loading', () => {
      let adjacentImage;

      before(async () => {
        adjacentImage = await collection.loadAdjacentImage(image, 0);
      });

      it('should set the newest image set, if the provider is loading another image', async () => {
        const p1 = obliqueProvider.setImage(image);
        const p2 = obliqueProvider.setImage(adjacentImage);
        await Promise.all([p1, p2]);
        expect(obliqueProvider.currentImage).to.equal(adjacentImage);
      });

      it('should set the newest passed center, if the provider is loading another image', async () => {
        obliqueProvider.activate();
        const coords = [imagev35MercatorCoordinate[0] - 2000, imagev35MercatorCoordinate[1] - 2000];
        const p1 = obliqueProvider.setImage(adjacentImage);
        const p2 = obliqueProvider.setImage(image, coords);
        await Promise.all([p1, p2]);
        expect(olMap.getView().getCenter()).to.have.members([0, 0]);
      });
    });

    describe('with a current image set', () => {
      let nextImage;

      before(async () => {
        nextImage = await collection.loadImageForCoordinate(tiledMercatorCoordinate, ObliqueViewDirection.SOUTH);
      });

      beforeEach(async () => {
        obliqueProvider.activate();
        await obliqueProvider.setImage(image);
      });

      it('should not raise the image changed event, if the image is the same', async () => {
        const spy = getCesiumEventSpy(sandbox, obliqueProvider.imageChanged);
        await obliqueProvider.setImage(image);
        expect(spy).to.not.have.been.called;
      });

      it('should remove the previous images layer, if providing an image with a different image meta', async () => {
        const layer = olMap.getLayers().getArray()[0];
        await obliqueProvider.setImage(nextImage);
        const layers = olMap.getLayers().getArray();
        expect(layers).to.have.lengthOf(1);
        expect(layers).to.not.include(layer);
      });

      it('should change the view, if providing an image with a different image meta', async () => {
        const view = olMap.getView();
        await obliqueProvider.setImage(nextImage);
        expect(olMap.getView()).to.not.equal(view);
      });

      it('should not remove the previous images layer, if providing an image with the same image meta, but set the new url function', async () => {
        const layer = olMap.getLayers().getArray()[0];
        const sameMeta = collection.images.find(i => i.meta === image.meta && i !== image);
        await obliqueProvider.setImage(sameMeta);
        const layers = olMap.getLayers().getArray();
        expect(layers).to.have.lengthOf(1);
        expect(layers[0]).to.equal(layer);
        expect(layers[0].getSource().getTileUrlFunction()([0, 1, -1]))
          .to.equal(`${image.meta.url}/${sameMeta.name}/0/1/0.${image.meta.format}`);
      });

      it('should not change the view, if providing an image with the same image meta', async () => {
        const sameMeta = collection.images.find(i => i.meta === image.meta && i !== image);
        const view = olMap.getView();
        await obliqueProvider.setImage(sameMeta);
        expect(olMap.getView()).to.equal(view);
      });
    });
  });

  describe('setting a view', () => {
    let obliqueProvider;
    let collection;
    let dataSet;

    before(async () => {
      dataSet = new ObliqueDataSet(url, projection);
      dataSet.initialize(imageJson);
      collection = new ObliqueCollection({ dataSets: [dataSet] });
      await collection.load();
    });

    beforeEach(async () => {
      obliqueProvider = new ObliqueProvider(olMap);
      obliqueProvider.setCollection(collection);
    });

    afterEach(() => {
      obliqueProvider.destroy();
    });

    after(() => {
      collection.destroy();
    });

    it('should set the image for the given coordinate', async () => {
      await obliqueProvider.setView(imagev35MercatorCoordinate, ObliqueViewDirection.NORTH);
      const image = await collection.loadImageForCoordinate(imagev35MercatorCoordinate, ObliqueViewDirection.NORTH);
      expect(obliqueProvider.currentImage).to.equal(image);
    });

    it('should use the provided coordinate as the center', async () => {
      await obliqueProvider.setView(imagev35MercatorCoordinate, ObliqueViewDirection.NORTH);
      const { center } = await obliqueProvider.getView();
      expect(center[0]).to.be.closeTo(imagev35MercatorCoordinate[0], 0.001);
      expect(center[1]).to.be.closeTo(imagev35MercatorCoordinate[1], 0.001);
    });

    it('should set an optionally provided zoom', async () => {
      await obliqueProvider.setView(imagev35MercatorCoordinate, ObliqueViewDirection.NORTH, 3);
      const { zoom } = await obliqueProvider.getView();
      expect(zoom).to.equal(3);
    });

    describe('parallel loading', () => {
      it('should set the last set coordinate', async () => {
        const p1 = obliqueProvider.setView(imagev35MercatorCoordinate, ObliqueViewDirection.NORTH);
        const coords = [imagev35MercatorCoordinate[0] + 1200, imagev35MercatorCoordinate[1] + 1200];
        const p2 = obliqueProvider.setView(coords, ObliqueViewDirection.NORTH);
        await Promise.all([p1, p2]);
        const image = await collection.loadImageForCoordinate(coords, ObliqueViewDirection.NORTH);
        expect(obliqueProvider.currentImage).to.equal(image);
      });

      it('should set the last set direction', async () => {
        const p1 = obliqueProvider.setView(imagev35MercatorCoordinate, ObliqueViewDirection.SOUTH);
        const p2 = obliqueProvider.setView(imagev35MercatorCoordinate, ObliqueViewDirection.NORTH);
        await Promise.all([p1, p2]);
        const image = await collection.loadImageForCoordinate(imagev35MercatorCoordinate, ObliqueViewDirection.NORTH);
        expect(obliqueProvider.currentImage).to.equal(image);
      });

      it('should set the last set zoom', async () => {
        const p1 = obliqueProvider.setView(imagev35MercatorCoordinate, ObliqueViewDirection.NORTH, 1);
        const p2 = obliqueProvider.setView(imagev35MercatorCoordinate, ObliqueViewDirection.NORTH, 3);
        await Promise.all([p1, p2]);
        const { zoom } = await obliqueProvider.getView();
        expect(zoom).to.equal(3);
      });
    });
  });

  describe('getting a view', () => {
    let obliqueProvider;
    let collection;
    let dataSet;

    before(async () => {
      dataSet = new ObliqueDataSet(url, projection);
      dataSet.initialize(imageJson);
      collection = new ObliqueCollection({ dataSets: [dataSet] });
      await collection.load();
      obliqueProvider = new ObliqueProvider(olMap);
      obliqueProvider.setCollection(collection);
    });

    after(() => {
      collection.destroy();
      obliqueProvider.destroy();
    });

    describe('without an view set', () => {
      it('should return null', async () => {
        expect(await obliqueProvider.getView()).to.be.null;
      });
    });

    describe('with an view set', () => {
      let view;

      before(async () => {
        await obliqueProvider.setView(imagev35MercatorCoordinate, ObliqueViewDirection.NORTH, 3);
        view = await obliqueProvider.getView();
      });

      it('should return the center of the current view', () => {
        expect(view).to.have.property('center').and.to.be.an('array').with.lengthOf(3);
      });

      it('should return mercator coordinates of the current view', () => {
        const { center } = view;
        expect(center[0]).to.be.closeTo(imagev35MercatorCoordinate[0], 0.001);
        expect(center[1]).to.be.closeTo(imagev35MercatorCoordinate[1], 0.001);
      });

      it('should return the current direction', () => {
        expect(view).to.have.property('direction', ObliqueViewDirection.NORTH);
      });

      it('should return the current views zoom', () => {
        expect(view).to.have.property('zoom', 3);
      });
    });
  });
});
