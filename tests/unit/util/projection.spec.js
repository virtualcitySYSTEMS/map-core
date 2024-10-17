import proj4 from 'proj4';
import Projection, {
  setDefaultProjectionOptions,
} from '../../../src/util/projection.js';

describe('Projection', () => {
  let sandbox;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });
  describe('constructor', () => {
    describe('should parse EPSG Code', () => {
      it('should handle epsg numbers', () => {
        const projection = new Projection({ epsg: 3857 });
        expect(projection.epsg).to.equal('EPSG:3857');
      });
      it('should handle epsg strings', () => {
        const projection = new Projection({ epsg: '3857' });
        expect(projection.epsg).to.equal('EPSG:3857');
      });
      it('should handle epsg strings with starting epsg:', () => {
        const projection = new Projection({ epsg: 'epsg:3857' });
        expect(projection.epsg).to.equal('EPSG:3857');
      });
      it('should handle epsg strings with starting EPSG:', () => {
        const projection = new Projection({ epsg: 'EPSG:3857' });
        expect(projection.epsg).to.equal('EPSG:3857');
      });
    });

    describe('should parse proj4 Code', () => {
      let epsg;
      let proj4Option;

      before(() => {
        epsg = 25832;
        proj4Option = '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs';
      });

      it('should handle proj4 string', () => {
        const projection = new Projection({ epsg, proj4: proj4Option });
        expect(projection.epsg).to.equal('EPSG:25832');
        expect(projection.proj4).to.equal(proj4Option);
      });

      it('should add the projection to proj4js', () => {
        const spy = sandbox.spy(proj4, 'defs');
        // eslint-disable-next-line no-unused-vars
        const projection = new Projection({ epsg, proj4: proj4Option });
        expect(spy).to.have.been.calledWith('EPSG:25832');
      });
    });
    describe('should parse aliases', () => {
      let epsg;
      let proj4Option;
      let alias;

      before(() => {
        epsg = 25832;
        proj4Option = '+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs';
        alias = ['testAlias', 'test2Alias'];
      });

      it('should add aliase to proj definitions', () => {
        const spy = sandbox.spy(proj4, 'defs');
        // eslint-disable-next-line no-unused-vars
        const projection = new Projection({ epsg, proj4: proj4Option, alias });
        expect(spy).to.have.been.calledWith('testAlias');
        expect(spy).to.have.been.calledWith('test2Alias');
      });
    });
    describe('handling of custom prefixes', () => {
      it('should allow custom prefixes', () => {
        const projection = new Projection({
          epsg: 'FOO:25833',
          proj4: '+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs',
          prefix: 'FOO:',
        });
        expect(projection).to.have.property('epsg', 'FOO:25833');
      });
      it('should handle nullish prefix', () => {
        const projection = new Projection({
          epsg: '25833',
          proj4: '+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs',
          prefix: null,
        });
        expect(projection).to.have.property('epsg', '25833');
      });
    });
    describe('should use project Default Projection on invalid options', () => {
      it('should return default projection', () => {
        setDefaultProjectionOptions({ epsg: 3857 });
        const projection = new Projection({ epsg: 'test' });
        expect(projection.epsg).to.equal('EPSG:3857');
      });
    });
  });
  describe('validateOptions', () => {
    it('should return true on known projections 4326', () => {
      const validate = Projection.validateOptions({
        epsg: 4326,
      });
      expect(validate).to.be.true;
    });
    it('should return true on known projections EPSG:4326', () => {
      const validate = Projection.validateOptions({
        epsg: 'EPSG:4326',
      });
      expect(validate).to.be.true;
    });
    it('should return true on known projections 3857', () => {
      const validate = Projection.validateOptions({
        epsg: 3857,
      });
      expect(validate).to.be.true;
    });
    it('should return false on unknown projections', () => {
      const validate = Projection.validateOptions({
        epsg: 43857,
      });
      expect(validate).to.be.false;
    });
    it('should return true on unknown projections which proj4 definitions', () => {
      const validate = Projection.validateOptions({
        epsg: 43857,
        proj4:
          '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
      });
      expect(validate).to.be.true;
    });
    it('should return false on invalid proj4 definitions', () => {
      const validate = Projection.validateOptions({
        epsg: 4326,
        proj4: '+units=m +no_defs',
      });
      expect(validate).to.be.false;
    });
    it('should return false on an empty epsg code', () => {
      const validate = Projection.validateOptions({
        epsg: '',
      });
      expect(validate).to.be.false;
    });
  });
  describe('parseEPSGCode', () => {
    it('should handle valid epsg codes and return `EPSG:4326`', () => {
      expect(Projection.parseEPSGCode('4326')).to.equal('EPSG:4326');
      expect(Projection.parseEPSGCode(4326)).to.equal('EPSG:4326');
      expect(Projection.parseEPSGCode('epsg:4326')).to.equal('EPSG:4326');
      expect(Projection.parseEPSGCode('EPSG:4326')).to.equal('EPSG:4326');
    });
    it('should handle  invalid epsg codes and return empty string', () => {
      expect(Projection.parseEPSGCode('asd4326')).to.equal('');
      expect(Projection.parseEPSGCode(null)).to.equal('');
      expect(Projection.parseEPSGCode(undefined)).to.equal('');
      expect(Projection.parseEPSGCode('EPSGasd:4326')).to.equal('');
    });
    it('should handle custom prefixes, adding a prefix to a numeric', () => {
      expect(Projection.parseEPSGCode('4326', 'FOO:')).to.equal('FOO:4326');
      expect(Projection.parseEPSGCode(4326, 'FOO:')).to.equal('FOO:4326');
      expect(Projection.parseEPSGCode('FOO:4326', 'FOO:')).to.equal('FOO:4326');
      expect(Projection.parseEPSGCode('epsg:4326', '')).to.equal('');
      expect(Projection.parseEPSGCode('EPSG:4326', '')).to.equal('');
    });
  });
  describe('serialization', () => {
    describe('of an empty collection', () => {
      it('should return an object with type and name for default layers', () => {
        const config = new Projection({}).toJSON();
        expect(config).to.have.all.keys('epsg', 'type');
      });
    });

    describe('of a configured collection', () => {
      let outputConfig;
      let inputConfig;

      before(() => {
        inputConfig = {
          epsg: 'FOO:10111',
          alias: ['CRS:FOO'],
          proj4: '+proj=longlat +datum=WGS84 +no_defs ',
          prefix: 'FOO:',
        };
        outputConfig = new Projection(inputConfig).toJSON();
      });

      it('should configure epsg', () => {
        expect(outputConfig).to.have.property('epsg', inputConfig.epsg);
      });

      it('should configure proj4', () => {
        expect(outputConfig).to.have.property('proj4', inputConfig.proj4);
      });

      it('should configure prefix', () => {
        expect(outputConfig).to.have.property('prefix', inputConfig.prefix);
      });

      it('should configure alias', () => {
        expect(outputConfig)
          .to.have.property('alias')
          .and.to.have.members(inputConfig.alias);
      });
    });
  });
});
