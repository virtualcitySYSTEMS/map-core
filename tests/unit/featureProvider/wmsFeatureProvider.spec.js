import WFS from 'ol/format/WFS.js';
import GML from 'ol/format/GML.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import GML3 from 'ol/format/GML3.js';
import WMSGetFeatureInfo from 'ol/format/WMSGetFeatureInfo.js';
import Point from 'ol/geom/Point.js';
import nock from 'nock';
import GML32 from 'ol/format/GML32.js';
import WMSFeatureProvider, {
  getFormat,
} from '../../../src/featureProvider/wmsFeatureProvider.js';
import { mercatorProjection } from '../../../src/util/projection.js';
import Extent from '../../../src/util/extent.js';

describe('WMSFeatureProvider', () => {
  after(() => {
    nock.cleanAll();
  });

  describe('getFeaturesByCoordinate', () => {
    let scope;
    let testGeojson;
    let provider;
    let features;

    before(async () => {
      testGeojson = {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: null, properties: { foo: 'bar' } },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [1, 1, 2] },
            properties: { foo: 'baz' },
          },
        ],
      };
      scope = nock('http://myWmsFeatureProvider')
        .get(/\/wms\?(\S)*/)
        // eslint-disable-next-line
        .reply(function () {
          return [200, testGeojson, { 'Content-Type': 'application/json' }];
        });

      provider = new WMSFeatureProvider('test', {
        url: 'http://myWmsFeatureProvider/wms',
        parameters: { LAYERS: 'one' },
        responseType: 'application/json',
        projection: mercatorProjection.toJSON(),
      });
      features = await provider.getFeaturesByCoordinate([0, 0, 0], 2);
    });

    it('should return all features', () => {
      expect(features).to.be.an('array').with.lengthOf(2);
    });

    it('should set the geometry to the provided coordinate', () => {
      const geometry = features[0].getGeometry();
      expect(geometry).to.be.an.instanceOf(Point);
      expect(geometry.getCoordinates()).to.have.ordered.members([0, 0, 0]);
    });

    it('should retrieve the geometry from the response', () => {
      const geometry = features[1].getGeometry();
      expect(geometry).to.be.an.instanceOf(Point);
      expect(geometry.getCoordinates()).to.have.ordered.members([1, 1, 2]);
    });

    after(() => {
      scope.done();
      provider.destroy();
    });

    describe('extent handling', () => {
      let wmsFeatureProvider;

      before(() => {
        wmsFeatureProvider = new WMSFeatureProvider('testExtent', {
          url: 'http://myWmsFeatureProvider/wms',
          parameters: {},
          responseType: 'text/html',
          projection: mercatorProjection.toJSON(),
          extent: new Extent({
            coordinates: [-1, -1, 1, 1],
            projection: mercatorProjection.toJSON(),
          }),
        });
      });

      it('should return features if coordinate is within the extent', async () => {
        const insideFeatures = await wmsFeatureProvider.getFeaturesByCoordinate(
          [0, 0],
          1,
        );
        expect(insideFeatures).to.be.an('array').with.lengthOf(1);
      });

      it('should return an empty array if coordinate is outside the extent', async () => {
        const outsideFeatures =
          await wmsFeatureProvider.getFeaturesByCoordinate([10, 10], 1);
        expect(outsideFeatures).to.be.an('array').that.is.empty;
      });

      after(() => {
        wmsFeatureProvider.destroy();
      });
    });

    describe('text/html no extent handling', () => {
      let providerNoExtent;

      before(() => {
        providerNoExtent = new WMSFeatureProvider('testNoExtent', {
          url: 'http://myWmsFeatureProvider/wms',
          parameters: {},
          responseType: 'text/html',
          projection: mercatorProjection.toJSON(),
          htmlPositionFeatureTitle: 'HTML Feature',
        });
      });

      it('should return one feature when no extent is configured', async () => {
        const feats = await providerNoExtent.getFeaturesByCoordinate([5, 5], 1);
        expect(feats).to.be.an('array').with.lengthOf(1);
      });

      after(() => {
        providerNoExtent.destroy();
      });
    });
  });

  describe('requestHeaders with getFeaturesByCoordinate', () => {
    let scope;
    let testGeojson;
    let provider;
    let requestHeaders;

    before(async () => {
      testGeojson = {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: null, properties: { foo: 'bar' } },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [1, 1, 2] },
            properties: { foo: 'baz' },
          },
        ],
      };

      provider = new WMSFeatureProvider('test', {
        url: 'http://myWmsFeatureProvider/wms',
        parameters: { LAYERS: 'one' },
        responseType: 'application/json',
        projection: mercatorProjection.toJSON(),
      });
    });

    it('should send configured Headers to the Server', async () => {
      scope = nock('http://myWmsFeatureProvider')
        .get(/\/wms\?(\S)*/)
        .reply(function nockReply() {
          requestHeaders = this.req.headers;
          return [200, testGeojson, { 'Content-Type': 'application/json' }];
        });
      await provider.getFeaturesByCoordinate([0, 0, 0], 2, {
        testheader: 'test',
      });
      expect(requestHeaders).to.have.property('testheader', 'test');
    });

    afterEach(() => {
      scope.done();
      requestHeaders = null;
    });

    after(() => {
      provider.destroy();
    });
  });

  describe('creating of feature formats based on responseType', () => {
    it('should return the WFSLayer format for text/xml', () => {
      const format = getFormat('text/xml');
      expect(format).to.be.an.instanceOf(WFS);
    });

    it('should set the correct GML format', () => {
      const format = getFormat('text/xml', {}, undefined, 'GML');
      expect(format).to.be.an.instanceOf(WFS);
      expect(format)
        .to.have.property('gmlFormat_')
        .and.to.be.an.instanceOf(GML);
    });

    it('should create a WMSFeatureInfo format', () => {
      const format = getFormat('application/vnd.ogc.gml');
      expect(format).to.be.an.instanceOf(WMSGetFeatureInfo);
    });

    it('should create a GML3 format', () => {
      const format = getFormat('application/vnd.ogc.gml/3.1.1');
      expect(format).to.be.an.instanceOf(GML3);
    });

    it('should create a GML32 format', () => {
      const format = getFormat('text/xml; subtype=gml/3.2.1');
      expect(format).to.be.an.instanceOf(GML32);
    });

    it('should return null, if no response type is specified', () => {
      const format = getFormat();
      expect(format).to.be.null;
    });

    describe('geojson response types', () => {
      it('should use application/geojson', () => {
        const format = getFormat('application/geojson');
        expect(format).to.be.an.instanceOf(GeoJSON);
      });

      it('should use application/json', () => {
        const format = getFormat('application/json');
        expect(format).to.be.an.instanceOf(GeoJSON);
      });

      it('should use application/vnd.geo+json', () => {
        const format = getFormat('application/vnd.geo+json');
        expect(format).to.be.an.instanceOf(GeoJSON);
      });
    });
  });

  describe('getting the config', () => {
    describe('of a default feature provider', () => {
      it('should return the type, url and parameters', () => {
        const provider = new WMSFeatureProvider('test', { url: 'example.com' });
        const config = provider.toJSON();
        expect(config).to.have.all.keys(['type', 'url', 'parameters']);
        provider.destroy();
      });
    });

    describe('of a configured WMSLayer feature provider', () => {
      let inputConfig;
      let outputConfig;

      before(() => {
        inputConfig = {
          url: '/wms',
          parameters: { LAYERS: 'one' },
          version: '1.3.0',
          tilingSchema: 'mercator',
          maxLevel: 22,
          minLevel: 3,
          tileSize: [512, 512],
          responseType: 'application/json',
          formatOptions: { geometryName: 'foo' },
          extent: new Extent({
            coordinates: [0, 0, 1, 1],
            projection: mercatorProjection.toJSON(),
          }).toJSON(),
          projection: mercatorProjection.toJSON(),
        };
        const provider = new WMSFeatureProvider('test', inputConfig);
        outputConfig = provider.toJSON();
        provider.destroy();
      });

      it('should configure the responseType', () => {
        expect(outputConfig).to.have.property(
          'responseType',
          inputConfig.responseType,
        );
      });

      it('should configure the tilingSchema', () => {
        expect(outputConfig).to.have.property(
          'tilingSchema',
          inputConfig.tilingSchema,
        );
      });

      it('should configure the minLevel', () => {
        expect(outputConfig).to.have.property('minLevel', inputConfig.minLevel);
      });

      it('should configure the maxLevel', () => {
        expect(outputConfig).to.have.property('maxLevel', inputConfig.maxLevel);
      });

      it('should configure the url', () => {
        expect(outputConfig).to.have.property('url', inputConfig.url);
      });

      it('should configure the version', () => {
        expect(outputConfig).to.have.property('version', inputConfig.version);
      });

      it('should configure the format options', () => {
        expect(outputConfig)
          .to.have.property('formatOptions')
          .and.to.eql(inputConfig.formatOptions);
      });

      it('should configure the projection', () => {
        expect(outputConfig)
          .to.have.property('projection')
          .and.to.eql(inputConfig.projection);
      });

      it('should configure the tileSize', () => {
        expect(outputConfig)
          .to.have.property('tileSize')
          .and.to.eql(inputConfig.tileSize);
      });

      it('should configure the extent', () => {
        expect(outputConfig)
          .to.have.property('extent')
          .and.to.eql(inputConfig.extent);
      });
    });
  });

  describe('GML32 response parsing', () => {
    let scope;
    let provider;
    let features;

    const gml32Response = `<?xml version="1.0" encoding="utf-8"?>
<gml:FeatureCollection gml:id="collection.0"  xmlns:gml="http://www.opengis.net/gml/3.2" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.opengis.net/gml/3.2" xmlns:test="http://example.org/test">
<gml:featureMember>
    <test:Feature gml:id="Feature.123">
      <test:name>Test Feature</test:name>
      <test:geometry>
        <gml:Point srsName="urn:ogc:def:crs:EPSG::4326">
          <gml:pos>1 2</gml:pos>
        </gml:Point>
      </test:geometry>
    </test:Feature>
</gml:featureMember>
</gml:FeatureCollection>`;

    before(async () => {
      scope = nock('http://gml32test')
        .get(/\/wms\?(\S)*/)
        .reply(200, gml32Response);
      provider = new WMSFeatureProvider('gml32test', {
        url: 'http://gml32test/wms',
        parameters: { LAYERS: 'test' },
        responseType: 'text/xml; subtype=gml/3.2.1',
      });
      features = await provider.getFeaturesByCoordinate([0, 0, 0], 1);
    });

    after(() => {
      scope.done();
      provider.destroy();
    });

    it('should parse the GML32 response and return features', () => {
      expect(features).to.be.an('array').with.lengthOf(1);
    });

    it('should parse feature properties correctly', () => {
      expect(features[0].get('name')).to.equal('Test Feature');
    });

    it('should parse geometry correctly', () => {
      const geometry = features[0].getGeometry();
      expect(geometry).to.be.an.instanceOf(Point);

      const coords = geometry.getCoordinates();
      expect(coords[0]).to.equal(2);
      expect(coords[1]).to.equal(1);
    });
  });
});
