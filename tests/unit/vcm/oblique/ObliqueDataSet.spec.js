import { get as getProjection } from 'ol/proj.js';
import { boundingExtent } from 'ol/extent.js';
import Circle from 'ol/geom/Circle.js';
import ObliqueDataSet, { DataState } from '../../../../src/vcs/vcm/oblique/ObliqueDataSet.js';
import legacyImageJson from '../../../data/oblique/imageData/imagev34.json';
import imageJson from '../../../data/oblique/imageData/imagev35.json';
import tiledImageData from '../../../data/oblique/tiledImageData/image.json';
import setTiledObliqueImageServer, {
  tiledMercatorCoordinate,
  imagev35MercatorCoordinate,
  tiledMercatorCoordinate2,
} from '../../helpers/obliqueData.js';
import { getCesiumEventSpy } from '../../helpers/cesiumHelpers.js';

describe('ObliqueDataSet', () => {
  let sandbox;
  let url;
  let projection;

  before(() => {
    sandbox = sinon.createSandbox();
    projection = getProjection('EPSG:25833');
    url = 'http://localhost/image.json';
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('parsing of legacy config', () => {
    it('should load a legacy configs images', () => {
      const obliqueDataSet = new ObliqueDataSet(url, projection);
      obliqueDataSet.initialize(legacyImageJson);
      expect(obliqueDataSet.images).to.have.lengthOf(3);
      obliqueDataSet.destroy();
    });

    it('should emit images loaded', () => {
      const obliqueDataSet = new ObliqueDataSet(url, projection);
      const spy = getCesiumEventSpy(sandbox, obliqueDataSet.imagesLoaded);
      obliqueDataSet.initialize(legacyImageJson);
      expect(spy).to.have.been.calledOnce;
      expect(spy).to.have.been.calledWith(obliqueDataSet.images);
    });
  });

  describe('parsing of non-tiled image config', () => {
    it('should load the configs images', () => {
      const obliqueDataSet = new ObliqueDataSet(url, projection);
      obliqueDataSet.initialize(imageJson);
      expect(obliqueDataSet.images).to.have.lengthOf(8);
      obliqueDataSet.destroy();
    });

    it('should emit images loaded', () => {
      const obliqueDataSet = new ObliqueDataSet(url, projection);
      const spy = getCesiumEventSpy(sandbox, obliqueDataSet.imagesLoaded);
      obliqueDataSet.initialize(imageJson);
      expect(spy).to.have.been.calledOnce;
      expect(spy).to.have.been.calledWith(obliqueDataSet.images);
    });
  });

  describe('parsing of tile image config', () => {
    let obliqueDataSet;

    before(() => {
      obliqueDataSet = new ObliqueDataSet(url, projection);
      obliqueDataSet.initialize(tiledImageData);
    });

    after(() => {
      obliqueDataSet.destroy();
    });

    it('should not load the configs images', () => {
      expect(obliqueDataSet.images).to.be.empty;
    });

    it('should add each available tile', () => {
      const tiles = obliqueDataSet.getTiles();
      expect(tiles).to.be.an('object');
      const tileNames = Object.keys(tiles);
      expect(tileNames).to.have.members(tiledImageData.availableTiles);
    });

    it('should set each tile PENDING', () => {
      const tiles = obliqueDataSet.getTiles();
      expect(tiles).to.be.an('object');
      const tileStates = Object.values(tiles);
      expect(tileStates).to.have.members(new Array(tileStates.length).fill(DataState.PENDING));
    });
  });

  describe('url handling', () => {
    it('should add image.json if pointing to a directory path', () => {
      const obliqueDataSet = new ObliqueDataSet('http://localhost/test/', projection);
      expect(obliqueDataSet.url).to.equal('http://localhost/test/image.json');
      expect(obliqueDataSet.baseUrl).to.equal('http://localhost/test');
      obliqueDataSet.destroy();
    });

    it('should add image.json if missing json file extension', () => {
      const obliqueDataSet = new ObliqueDataSet('http://localhost/test', projection);
      expect(obliqueDataSet.url).to.equal('http://localhost/test/image.json');
      expect(obliqueDataSet.baseUrl).to.equal('http://localhost/test');
      obliqueDataSet.destroy();
    });

    it('should not add image json, if there is a .json file', () => {
      const obliqueDataSet = new ObliqueDataSet('http://localhost/test/other.json', projection);
      expect(obliqueDataSet.url).to.equal('http://localhost/test/other.json');
      expect(obliqueDataSet.baseUrl).to.equal('http://localhost/test');
      obliqueDataSet.destroy();
    });
  });

  describe('initialize', () => {
    let obliqueDataSet;

    before(() => {
      obliqueDataSet = new ObliqueDataSet(url, projection);
      obliqueDataSet.initialize(tiledImageData);
    });

    after(() => {
      obliqueDataSet.destroy();
    });

    it('should set the tile STATE to READY', () => {
      expect(obliqueDataSet.state).to.equal(DataState.READY);
    });

    it('should throw, if called twice', () => {
      expect(obliqueDataSet.initialize.bind(obliqueDataSet, tiledImageData)).to.throw;
    });
  });

  describe('load', () => {
    let obliqueDataSet;

    before(async () => {
      obliqueDataSet = new ObliqueDataSet('http://localhost/tiledOblique/image.json', projection);
      setTiledObliqueImageServer(sandbox.useFakeServer());
      await obliqueDataSet.load();
    });

    after(() => {
      obliqueDataSet.destroy();
    });

    it('should set the tile STATE to READY', () => {
      expect(obliqueDataSet.state).to.equal(DataState.READY);
    });

    it('should return the same promise, if called multiple times', () => {
      const p1 = obliqueDataSet.load();
      const p2 = obliqueDataSet.load();
      expect(p1).to.equal(p2);
    });

    it('should set the state loading before resolving the request', async () => {
      const obliqueDataSet2 = new ObliqueDataSet('http://localhost/tiledOblique', projection);
      setTiledObliqueImageServer(sandbox.useFakeServer());
      const promise = obliqueDataSet2.load();
      expect(obliqueDataSet2.state).to.equal(DataState.LOADING);
      await promise;
      expect(obliqueDataSet2.state).to.equal(DataState.READY);
    });
  });

  describe('API usage for non-tiled imageJson', () => {
    let obliqueDataSet;

    beforeEach(() => {
      obliqueDataSet = new ObliqueDataSet(url, projection);
      obliqueDataSet.initialize(imageJson);
    });

    afterEach(() => {
      obliqueDataSet.destroy();
    });

    describe('getDataStateForCoordinate', () => {
      it('should return the state of the data set', () => {
        expect(obliqueDataSet.getDataStateForCoordinate(imagev35MercatorCoordinate)).to.equal(obliqueDataSet.state);
        const obliqueDataSet2 = new ObliqueDataSet(url, projection);
        expect(obliqueDataSet2.getDataStateForCoordinate(imagev35MercatorCoordinate)).to.equal(obliqueDataSet2.state);
        obliqueDataSet2.destroy();
      });
    });

    describe('getDataStateForExtent', () => {
      it('should return the state of the data set', () => {
        const extent = (new Circle(imagev35MercatorCoordinate, 200)).getExtent();
        expect(obliqueDataSet.getDataStateForExtent(extent)).to.equal(obliqueDataSet.state);
        const obliqueDataSet2 = new ObliqueDataSet(url, projection);
        expect(obliqueDataSet2.getDataStateForExtent(extent)).to.equal(obliqueDataSet2.state);
        obliqueDataSet2.destroy();
      });
    });
  });

  describe('API usage for tile image json', () => {
    let obliqueDataSet;
    let mercatorExtent;

    before(() => {
      mercatorExtent = boundingExtent([tiledMercatorCoordinate, tiledMercatorCoordinate2]);
    });

    beforeEach(() => {
      obliqueDataSet = new ObliqueDataSet('http://localhost/tiledOblique', projection);
      obliqueDataSet.initialize(tiledImageData);
      setTiledObliqueImageServer(sandbox.useFakeServer());
    });

    afterEach(() => {
      obliqueDataSet.destroy();
    });

    describe('getDataStateForCoordinate', () => {
      it('should return PENDING, if the tile is not loaded', () => {
        expect(obliqueDataSet.getDataStateForCoordinate(tiledMercatorCoordinate)).to.equal(DataState.PENDING);
      });

      it('should return LOADING, if the tile is loading', () => {
        const p = obliqueDataSet.loadDataForCoordinate(tiledMercatorCoordinate);
        expect(obliqueDataSet.getDataStateForCoordinate(tiledMercatorCoordinate)).to.equal(DataState.LOADING);
        return p;
      });

      it('should return READY, if the tile is loaded', async () => {
        await obliqueDataSet.loadDataForCoordinate(tiledMercatorCoordinate);
        expect(obliqueDataSet.getDataStateForCoordinate(tiledMercatorCoordinate)).to.equal(DataState.READY);
      });

      it('should return the data state of the closest available tile', async () => {
        await obliqueDataSet.loadDataForCoordinate(tiledMercatorCoordinate2);
        const coord = [tiledMercatorCoordinate2[0] - 2000, tiledMercatorCoordinate2[1] + 2000, 0];
        expect(obliqueDataSet.getDataStateForCoordinate(coord)).to.equal(DataState.READY);
      });
    });

    describe('getDataStateForExtent', () => {
      it('should return PENDING, if the tile is not loaded', () => {
        expect(obliqueDataSet.getDataStateForExtent(mercatorExtent)).to.equal(DataState.PENDING);
      });

      it('should return LOADING, if the tile is loading', () => {
        const p = obliqueDataSet.loadDataForExtent(mercatorExtent);
        expect(obliqueDataSet.getDataStateForExtent(mercatorExtent)).to.equal(DataState.LOADING);
        return p;
      });

      it('should return READY, if the tile is loaded', async () => {
        await obliqueDataSet.loadDataForExtent(mercatorExtent);
        expect(obliqueDataSet.getDataStateForExtent(mercatorExtent)).to.equal(DataState.READY);
      });
    });

    describe('loadDataForCoordinate', () => {
      it('should load the data of a tile', async () => {
        await obliqueDataSet.loadDataForCoordinate(tiledMercatorCoordinate);
        expect(obliqueDataSet.getTiles()).to.have.property('12/2200/1343', DataState.READY);
      });

      it('should load the closest tile to a coordinate', async () => {
        const coord = [tiledMercatorCoordinate2[0] - 2000, tiledMercatorCoordinate2[1] + 2000, 0];
        await obliqueDataSet.loadDataForCoordinate(coord);
        expect(obliqueDataSet.getTiles()).to.have.property('12/2199/1342', DataState.READY);
      });

      it('should emit imagesLoaded for the loaded tile', async () => {
        const spy = getCesiumEventSpy(sandbox, obliqueDataSet.imagesLoaded);
        await obliqueDataSet.loadDataForCoordinate(tiledMercatorCoordinate);
        expect(spy).to.have.been.calledOnce;
        expect(spy).to.have.been.calledWith(obliqueDataSet.images, '12/2200/1343')
      });
    });

    describe('loadDataForExtent', () => {
      let tileCoordinates;

      before(() => {
        tileCoordinates = ['12/2199/1342', '12/2199/1343', '12/2200/1342', '12/2200/1343'];
      });

      it('should load all tiles within the extent', async () => {
        await obliqueDataSet.loadDataForExtent(mercatorExtent);
        const tiles = obliqueDataSet.getTiles();
        tileCoordinates.forEach((tileCoord) => {
          expect(tiles).to.have.property(tileCoord, DataState.READY);
        });
      });

      it('should emit imagesLoaded for the every loaded tile', async () => {
        const spy = sandbox.spy();
        let allImages = [];
        const listener = obliqueDataSet.imagesLoaded.addEventListener((images, tileCoord) => {
          allImages = allImages.concat(images);
          expect(tileCoordinates).to.include(tileCoord);
          spy();
        });
        await obliqueDataSet.loadDataForExtent(mercatorExtent);
        expect(spy.callCount).to.equal(4);
        expect(allImages).to.have.members(obliqueDataSet.images);
        listener();
      });
    });
  });
});
