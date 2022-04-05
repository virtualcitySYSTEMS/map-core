import { createEmpty } from 'ol/extent.js';
import Projection, { mercatorProjection, wgs84Projection } from '../../../src/util/projection.js';
import Extent from '../../../src/util/extent.js';

describe('Extent', () => {
  let sandbox;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => { sandbox.restore(); });
  const mercatorWorldCoords = [-20037508.342789244, -238107693.26496765, 20037508.342789244, 238107693.26496765];
  describe('constructor', () => {
    it('should create an extent based on an epsg code and coordiantes', () => {
      const EX = new Extent({
        projection: wgs84Projection.toJSON(),
        coordinates: [0, 0, 1, 1],
      });
      expect(EX).to.have.property('extent').and.to.have.members([0, 0, 1, 1]);
      expect(EX).to.have.property('projection').and.to.have.property('epsg', 'EPSG:4326');
    });

    it('it should assign the projections validity extent to the extent, if there are no input coordinates', () => {
      const EX = new Extent({ projection: wgs84Projection.toJSON() });
      expect(EX).to.have.property('extent').and.to.have.members([-180, -90, 180, 90]);
    });
  });

  describe('getCoordinatesInProjection', () => {
    it('should return the extent in a given projection', () => {
      const EX = new Extent({ projection: wgs84Projection.toJSON() });
      const mercatorProj = mercatorProjection;
      const mercatorWorld = EX.getCoordinatesInProjection(mercatorProj);
      expect(mercatorWorld)
        .to.have.members(mercatorWorldCoords);
    });

    it('should mutate a result', () => {
      const EX = new Extent({ projection: wgs84Projection.toJSON() });
      const mercatorProj = mercatorProjection;
      const mercatorWorld = [];
      EX.getCoordinatesInProjection(mercatorProj, mercatorWorld);
      expect(mercatorWorld)
        .to.have.members(mercatorWorldCoords);
    });

    it('should return a copy of the extent, if the extents are the same', () => {
      const EX = new Extent({ projection: wgs84Projection.toJSON() });
      const wgs84 = wgs84Projection;
      const getTransformer = sandbox.spy(Projection, 'getTransformer');
      const result = EX.getCoordinatesInProjection(wgs84);
      expect(result).to.have.members(EX.extent);
      expect(result).to.not.equal(EX.extent);
      expect(getTransformer).to.not.have.been.called;
    });

    it('should copy the extent onto a result, if the extents are the same', () => {
      const EX = new Extent({ projection: wgs84Projection.toJSON() });
      const wgs84 = wgs84Projection;
      const getTransformer = sandbox.spy(Projection, 'getTransformer');
      const result = [0, 0, 0, 0];
      EX.getCoordinatesInProjection(wgs84, result);
      expect(result).to.have.members(EX.extent);
      expect(result).to.not.equal(EX.extent);
      expect(getTransformer).to.not.have.been.called;
    });
  });

  describe('isValid', () => {
    it('validates a valid bbox extent', () => {
      const EX = new Extent({ coordinates: [0, 0, 1, 1] });
      expect(EX.isValid()).to.be.true;
    });

    it('validates a valid point extent', () => {
      const EX = new Extent({ coordinates: [1, 1, 1, 1] });
      expect(EX.isValid()).to.be.true;
    });

    it('validates a valid line extent', () => {
      const EX = new Extent({ coordinates: [0, 1, 1, 1] });
      expect(EX.isValid()).to.be.true;
    });

    it('needs extent to exist and be an array of length 4', () => {
      const EX = new Extent();
      EX.extent = {};
      expect(EX.isValid()).to.be.false;
      EX.extent = [];
      expect(EX.isValid()).to.be.false;
      EX.extent = [1, 1, 1, 2, 2, 2];
      expect(EX.isValid()).to.be.false;
    });

    it('needs all coordinates to be finite numbers', () => {
      const EX = new Extent();
      EX.extent = ['1', 1, 2, 2];
      expect(EX.isValid()).to.be.false;
      EX.extent = [null, 1, 2, 2];
      expect(EX.isValid()).to.be.false;
      EX.extent = createEmpty();
      expect(EX.isValid()).to.be.false;
    });

    it('needs the lower left corner to be smaller then the upper right', () => {
      const EX = new Extent({
        coordinates: [2, 2, 0, 0],
      });
      expect(EX.isValid()).to.be.false;
    });
  });

  describe('validateOptions', () => {
    it('should return false on invalid coordinate parameters', () => {
      const options = {
        projection: wgs84Projection.toJSON(),
        coordinates: ['asd'],
      };
      expect(Extent.validateOptions(options)).to.be.false;
    });
    it('should return true on valid coordinates parameters', () => {
      const options = {
        projection: {
          epsg: 4326,
        },
        coordinates: [0, 0, 1, 1],
      };
      expect(Extent.validateOptions(options)).to.be.true;
    });
    it('should return false on invalid projection parameters', () => {
      const options = {
        projection: {
          epsg: 'asdasd',
          proj4: 'asdasd',
        },
        coordinates: [0, 0, 1, 1],
      };
      expect(Extent.validateOptions(options)).to.be.false;
    });
    it('should return true on valid projection parameters', () => {
      const options = {
        projection: {
          epsg: '25833',
          proj4: '+proj=utm +zone=33 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs ',
        },
        coordinates: [0, 0, 1, 1],
      };
      expect(Extent.validateOptions(options)).to.be.true;
    });
  });

  describe('determining equality', () => {
    it('should be true for the same extetnt', () => {
      const e = new Extent({});
      expect(e.equals(e)).to.be.true;
    });

    it('should be false for invalid extents', () => {
      const e1 = new Extent({
        coordinates: [1, 1, 0, 0],
      });
      const e2 = new Extent({});
      expect(e1.equals(e2)).to.be.false;
    });

    it('should be false for differing extents', () => {
      const e1 = new Extent({
        coordinates: [0, 0, 1, 1],
      });
      const e2 = new Extent({
        coordinates: [1, 1, 2, 2],
      });
      expect(e1.equals(e2)).to.be.false;
    });

    it('should be false for extents with differing projections', () => {
      const e1 = new Extent({
        coordinates: [0, 0, 1, 1],
        epsg: mercatorProjection.toJSON(),
      });
      const e2 = new Extent({
        coordinates: [0, 0, 1, 1],
        projection: wgs84Projection.toJSON(),
      });
      expect(e1.equals(e2)).to.be.false;
    });
  });
});
