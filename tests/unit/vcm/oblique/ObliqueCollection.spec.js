import { get as getProjection } from 'ol/proj.js';
import { boundingExtent } from 'ol/extent.js';
import Feature from 'ol/Feature.js';
import ObliqueCollection from '../../../../src/vcs/vcm/oblique/ObliqueCollection.js';
import ObliqueDataSet, { DataState } from '../../../../src/vcs/vcm/oblique/ObliqueDataSet.js';
import imageJson from '../../../data/oblique/imageData/imagev35.json';
import setTiledObliqueImageServer, { tiledMercatorCoordinate, tiledMercatorCoordinate2 } from '../../helpers/obliqueData.js';
import { ObliqueViewDirection } from '../../../../src/vcs/vcm/oblique/ObliqueViewDirection.js';
import { getCesiumEventSpy } from '../../helpers/cesiumHelpers.js';

describe('ObliqueCollection', () => {
  let projection;
  let url;
  let sandbox;

  before(() => {
    projection = getProjection('EPSG:25833');
    url = 'http://localhost/tiledOblique/image.json';
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('adding datasets', () => {
    let obliqueCollection;
    let dataSet;

    beforeEach(() => {
      dataSet = new ObliqueDataSet(url, projection);
    });

    afterEach(() => {
      obliqueCollection.destroy();
    });

    describe('in constructor', () => {
      it('should add passed in data sets', () => {
        obliqueCollection = new ObliqueCollection({
          dataSets: [dataSet],
        });
        expect(obliqueCollection.dataSets).to.include(dataSet);
      });

      it('should add a loaded data set, adding its images', () => {
        dataSet.initialize(imageJson);
        obliqueCollection = new ObliqueCollection({
          dataSets: [dataSet],
        });
        expect(obliqueCollection.dataSets).to.include(dataSet);
        const setImage = dataSet.images[0];
        const image = obliqueCollection.getImageByName(setImage.name);
        expect(image).to.be.equal(setImage);
      });

      it('should listen loaded images, adding them to the collection', () => {
        obliqueCollection = new ObliqueCollection({
          dataSets: [dataSet],
        });
        expect(obliqueCollection.dataSets).to.include(dataSet);
        dataSet.initialize(imageJson);
        const setImage = dataSet.images[0];
        const image = obliqueCollection.getImageByName(setImage.name);
        expect(image).to.be.equal(setImage);
      });

      it('should emit imagesLoaded Event', () => {
        obliqueCollection = new ObliqueCollection({
          dataSets: [dataSet],
        });
        const spy = getCesiumEventSpy(sandbox, obliqueCollection.imagesLoaded);
        dataSet.initialize(imageJson);
        expect(spy).to.have.been.calledOnce;
        expect(spy).to.have.been.calledWith(obliqueCollection.images);
      });
    });

    describe('with addDataSet', () => {
      beforeEach(() => {
        obliqueCollection = new ObliqueCollection({});
      });

      it('should add passed in data sets', async () => {
        await obliqueCollection.addDataSet(dataSet);
        expect(obliqueCollection.dataSets).to.include(dataSet);
      });

      it('should add a loaded data set, adding its images', async () => {
        dataSet.initialize(imageJson);
        await obliqueCollection.addDataSet(dataSet);
        const setImage = dataSet.images[0];
        const image = obliqueCollection.getImageByName(setImage.name);
        expect(image).to.be.equal(setImage);
      });

      it('should listen loaded images, adding them to the collection', async () => {
        await obliqueCollection.addDataSet(dataSet);
        dataSet.initialize(imageJson);
        const setImage = dataSet.images[0];
        const image = obliqueCollection.getImageByName(setImage.name);
        expect(image).to.be.equal(setImage);
      });

      it('should emit imagesLoaded Event', async () => {
        await obliqueCollection.addDataSet(dataSet);
        const spy = getCesiumEventSpy(sandbox, obliqueCollection.imagesLoaded);
        dataSet.initialize(imageJson);
        expect(spy).to.have.been.calledOnce;
        expect(spy).to.have.been.calledWith(obliqueCollection.images);
      });

      describe('with a loaded collection', () => {
        beforeEach(async () => {
          await obliqueCollection.load();
          setTiledObliqueImageServer(sandbox.useFakeServer());
        });

        it('should load the dataset', async () => {
          await obliqueCollection.addDataSet(dataSet);
          expect(dataSet.state).to.equal(DataState.READY);
        });

        it('should add tile features, if the tiled feature source exists', async () => {
          const { tileFeatureSource } = obliqueCollection;
          await obliqueCollection.addDataSet(dataSet);
          expect(tileFeatureSource.getFeatures()).to.have.lengthOf(Object.keys(dataSet.getTiles()).length);
        });
      });
    });
  });

  describe('loading the collection', () => {
    let obliqueCollection;
    let dataSet;

    beforeEach(() => {
      dataSet = new ObliqueDataSet(url, projection);
      obliqueCollection = new ObliqueCollection({ dataSets: [dataSet] });
      setTiledObliqueImageServer(sandbox.useFakeServer());
    });

    afterEach(() => {
      obliqueCollection.destroy();
    });

    it('should load each dataset', async () => {
      await obliqueCollection.load();
      expect(dataSet.state).to.equal(DataState.READY);
    });

    it('should add tiled features to the tiled vector source', async () => {
      const { tileFeatureSource } = obliqueCollection;
      await obliqueCollection.load();
      expect(tileFeatureSource.getFeatures()).to.have.lengthOf(Object.keys(obliqueCollection.getTiles()).length);
    });

    it('should be loaded after loading', async () => {
      const p = obliqueCollection.load();
      expect(obliqueCollection.loaded).to.be.false;
      await p;
      expect(obliqueCollection.loaded).to.be.true;
    });
  });

  describe('querying available tiles', () => {
    let obliqueCollection;
    let dataSet;

    beforeEach(async () => {
      dataSet = new ObliqueDataSet(url, projection);
      obliqueCollection = new ObliqueCollection({ dataSets: [dataSet] });
      setTiledObliqueImageServer(sandbox.useFakeServer());
      await obliqueCollection.load();
    });

    afterEach(() => {
      obliqueCollection.destroy();
    });

    it('should return all available tiles', () => {
      const tiles = obliqueCollection.getTiles();
      expect(Object.keys(tiles)).to.have.members(Object.keys(dataSet.getTiles()));
    });

    it('should return the state of tiles', async () => {
      await obliqueCollection.loadDataForCoordinate(tiledMercatorCoordinate);
      const tiles = obliqueCollection.getTiles();
      expect(tiles).to.have.property('12/2200/1343', DataState.READY);
    });

    it('should return pending, if a tile is not loaded in another data set', async () => {
      await obliqueCollection.loadDataForCoordinate(tiledMercatorCoordinate);
      await obliqueCollection.addDataSet(new ObliqueDataSet(url, projection));
      const tiles = obliqueCollection.getTiles();
      expect(tiles).to.have.property('12/2200/1343', DataState.PENDING);
    });
  });

  describe('querying data state', () => {
    let obliqueCollection;
    let dataSet;
    let mercatorExtent;

    before(() => {
      mercatorExtent = boundingExtent([tiledMercatorCoordinate, tiledMercatorCoordinate2]);
    });

    beforeEach(async () => {
      dataSet = new ObliqueDataSet(url, projection);
      obliqueCollection = new ObliqueCollection({ dataSets: [dataSet] });
      setTiledObliqueImageServer(sandbox.useFakeServer());
      await obliqueCollection.load();
    });

    afterEach(() => {
      obliqueCollection.destroy();
    });

    it('should return the state of a coordinate', async () => {
      expect(obliqueCollection.getDataStateForCoordinate(tiledMercatorCoordinate)).to.equal(DataState.PENDING);
      await obliqueCollection.loadDataForCoordinate(tiledMercatorCoordinate);
      expect(obliqueCollection.getDataStateForCoordinate(tiledMercatorCoordinate)).to.equal(DataState.READY);
    });

    it('should return pending, if a coordinate is not loaded in another data set', async () => {
      await obliqueCollection.loadDataForCoordinate(tiledMercatorCoordinate);
      await obliqueCollection.addDataSet(new ObliqueDataSet(url, projection));
      expect(obliqueCollection.getDataStateForCoordinate(tiledMercatorCoordinate)).to.equal(DataState.PENDING);
    });

    it('should return the state of an extent', async () => {
      expect(obliqueCollection.getDataStateForExtent(mercatorExtent)).to.equal(DataState.PENDING);
      await obliqueCollection.loadDataForExtent(mercatorExtent);
      expect(obliqueCollection.getDataStateForExtent(mercatorExtent)).to.equal(DataState.READY);
    });

    it('should return pending, if an extent is not loaded in another data set', async () => {
      await obliqueCollection.loadDataForExtent(mercatorExtent);
      await obliqueCollection.addDataSet(new ObliqueDataSet(url, projection));
      expect(obliqueCollection.getDataStateForExtent(mercatorExtent)).to.equal(DataState.PENDING);
    });
  });

  describe('querying available Viewdirections', () => {
    let obliqueCollection;
    let dataSet;

    beforeEach(async () => {
      dataSet = new ObliqueDataSet(url, projection);
      obliqueCollection = new ObliqueCollection({ dataSets: [dataSet] });
      setTiledObliqueImageServer(sandbox.useFakeServer());
      await obliqueCollection.load();
    });

    afterEach(() => {
      obliqueCollection.destroy();
    });

    it('should return an empty array if no data has been loaded', async () => {
      expect(obliqueCollection.getAvailableViewDirections()).to.be.empty;
    });

    it('should return all available viewdirections', async () => {
      await obliqueCollection.loadDataForCoordinate(tiledMercatorCoordinate);
      expect(obliqueCollection.getAvailableViewDirections()).to.have.members([1, 2, 3, 4]);
    });
  });

  describe('querying images by coordinate', () => {
    let obliqueCollection;
    let dataSet;

    beforeEach(async () => {
      dataSet = new ObliqueDataSet(url, projection);
      obliqueCollection = new ObliqueCollection({ dataSets: [dataSet] });
      setTiledObliqueImageServer(sandbox.useFakeServer());
      await obliqueCollection.load();
    });

    afterEach(() => {
      obliqueCollection.destroy();
    });

    describe('sync', () => {
      beforeEach(async () => {
        await obliqueCollection.loadDataForCoordinate(tiledMercatorCoordinate2);
      });

      it('should return the image to the coordinate', () => {
        const image = obliqueCollection.getImageForCoordinate(tiledMercatorCoordinate2, ObliqueViewDirection.NORTH);
        expect(image.name).to.equal('025_070_119003689');
      });

      it('should return the closest image to a coordinate', () => {
        const coord = [tiledMercatorCoordinate2[0] - 2000, tiledMercatorCoordinate2[1] + 2000];
        const image = obliqueCollection.getImageForCoordinate(coord, ObliqueViewDirection.NORTH);
        expect(image.name).to.equal('025_076_119003695');
      });

      it('should return an image for another direction, should there be no image for the given direction', () => {
        const image = obliqueCollection.getImageForCoordinate(tiledMercatorCoordinate2, ObliqueViewDirection.NADIR);
        expect(image.name).to.equal('025_070_119003689');
      });
    });

    describe('async', () => {
      it('should load the data for a given coordinate first', async () => {
        const image = await obliqueCollection
          .loadImageForCoordinate(tiledMercatorCoordinate2, ObliqueViewDirection.NORTH);
        expect(image.name).to.equal('025_070_119003689');
      });

      it('should determine, if the closest image intersects the coordinate given', async () => {
        const hasImage = await obliqueCollection
          .hasImageAtCoordinate(tiledMercatorCoordinate2, ObliqueViewDirection.NORTH);
        expect(hasImage).to.be.true;

        const coord = [tiledMercatorCoordinate2[0] - 2000, tiledMercatorCoordinate2[1] + 2000];
        const hasNoImage = await obliqueCollection.hasImageAtCoordinate(coord, ObliqueViewDirection.NORTH);
        expect(hasNoImage).to.be.false;
      });

      it('should load images adjacent to a given image', async () => {
        const image = await obliqueCollection
          .loadImageForCoordinate(tiledMercatorCoordinate2, ObliqueViewDirection.NORTH);
        const adjacentImage = await obliqueCollection.loadAdjacentImage(image, 0);
        expect(adjacentImage.name).to.equal('026_070_116003847');
      });

      it('should return undefined, if there is no image adjacent to a given image', async () => {
        const coord = [tiledMercatorCoordinate2[0] - 2000, tiledMercatorCoordinate2[1] + 2000];
        const image = obliqueCollection.loadImageForCoordinate(coord, ObliqueViewDirection.NORTH);
        const adjacentImage = await obliqueCollection.loadAdjacentImage(image, Math.PI / 2);
        expect(adjacentImage).to.be.undefined;
      });
    });
  });

  describe('provided feature sources', () => {
    describe('for tiles', () => {
      let obliqueCollection;
      let dataSet;

      before(async () => {
        setTiledObliqueImageServer(sandbox.useFakeServer());
        dataSet = new ObliqueDataSet(url, projection);
        obliqueCollection = new ObliqueCollection({ dataSets: [dataSet] });
        await obliqueCollection.load();
      });

      after(() => {
        obliqueCollection.destroy();
      });

      it('should have a feature for each tile', () => {
        const { tileFeatureSource } = obliqueCollection;
        expect(tileFeatureSource.getFeatures()).to.have.lengthOf(Object.keys(obliqueCollection.getTiles()).length);
      });

      it('should set the tile name as a features id', async () => {
        const { tileFeatureSource } = obliqueCollection;
        const tile = tileFeatureSource.getFeatureById('12/2199/1342');
        expect(tile).to.be.an.instanceOf(Feature);
      });

      it('should set the tiles state on the feature', async () => {
        setTiledObliqueImageServer(sandbox.useFakeServer());
        const { tileFeatureSource } = obliqueCollection;
        const tile = tileFeatureSource.getFeatureById('12/2199/1342');
        expect(tile.get('state')).to.equal(DataState.PENDING);
        await obliqueCollection.loadDataForCoordinate(tiledMercatorCoordinate2);
        expect(tile.get('state')).to.equal(DataState.READY);
      });
    });

    describe('for images', () => {
      let obliqueCollection;
      let dataSet;

      before(async () => {
        setTiledObliqueImageServer(sandbox.useFakeServer());
        dataSet = new ObliqueDataSet(url, projection);
        obliqueCollection = new ObliqueCollection({ dataSets: [dataSet] });
        await obliqueCollection.load();
        await obliqueCollection.loadDataForCoordinate(tiledMercatorCoordinate2);
      });

      after(() => {
        obliqueCollection.destroy();
      });

      it('should have a feature for each image', () => {
        const { imageFeatureSource } = obliqueCollection;
        expect(imageFeatureSource.getFeatures()).to.have.lengthOf(obliqueCollection.images.length);
      });

      it('should set the image name as the id of a feature', () => {
        const { imageFeatureSource } = obliqueCollection;
        const image = imageFeatureSource.getFeatureById('025_070_119003689');
        expect(image).to.be.an.instanceOf(Feature);
      });

      it('should set the viewDirection of an image on the feature', () => {
        const { imageFeatureSource } = obliqueCollection;
        const image = imageFeatureSource.getFeatureById('025_070_119003689');
        expect(image.get('viewDirection')).to.equal(ObliqueViewDirection.NORTH);
      });
    });
  });
});