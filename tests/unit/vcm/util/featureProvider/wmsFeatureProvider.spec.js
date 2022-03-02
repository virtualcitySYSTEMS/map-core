import WFS from 'ol/format/WFS.js';
import GML from 'ol/format/GML.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import GML2 from 'ol/format/GML2.js';
import GML3 from 'ol/format/GML3.js';
import Point from 'ol/geom/Point.js';
import nock from 'nock';
import WMSFeatureProvider, { getFormat } from '../../../../../src/vcs/vcm/util/featureProvider/wmsFeatureProvider.js';
import { mercatorProjection } from '../../../../../src/vcs/vcm/util/projection.js';
import Extent from '../../../../../src/vcs/vcm/util/extent.js';

describe('vcs.vcm.util.featureProvider.WMSFeatureProvider', () => {
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
          {
            type: 'Feature',
            geometry: null,
            properties: {
              foo: 'bar',
            },
          },
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [1, 1, 2],
            },
            properties: {
              foo: 'baz',
            },
          },
        ],
      };
      scope = nock('http://myWmsFeatureProvider')
        .get(/\/wms\?(\S)*/)
        .reply(() => {
          return [200, testGeojson, { 'Content-Type': 'application/json' }];
        });

      provider = new WMSFeatureProvider(
        'test',
        {
          url: 'http://myWmsFeatureProvider/wms',
          parameters: {
            LAYERS: 'one',
          },
          responseType: 'application/json',
          projection: mercatorProjection.toJSON(),
        },
      );
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
  });

  describe('creating of feature formats based on responseType', () => {
    it('should return the WFS format for text/xml', () => {
      const format = getFormat('text/xml');
      expect(format).to.be.an.instanceOf(WFS);
    });

    it('should set the correct GML format', () => {
      const options = {
        gmlFormat: 'GML',
      };

      const format = getFormat('text/xml', options);
      expect(format).to.be.an.instanceOf(WFS);
      expect(options.gmlFormat).to.be.an.instanceOf(GML);
    });

    it('should create a GML2 format', () => {
      const format = getFormat('application/vnd.ogc.gml');
      expect(format).to.be.an.instanceOf(GML2);
    });

    it('should create a GML3 format', () => {
      const format = getFormat('application/vnd.ogc.gml/3.1.1');
      expect(format).to.be.an.instanceOf(GML3);
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
        const provider = new WMSFeatureProvider('test', {});
        const config = provider.toJSON();
        expect(config).to.have.all.keys(['type', 'url', 'parameters']);
        provider.destroy();
      });
    });

    describe('of a configured WMS feature provider', () => {
      let inputConfig;
      let outputConfig;

      before(() => {
        inputConfig = {
          url: '/wms',
          parameters: {
            LAYERS: 'one',
          },
          version: '1.3.0',
          tilingSchema: 'mercator',
          maxLevel: 22,
          minLevel: 3,
          tileSize: [512, 512],
          responseType: 'application/json',
          formatOptions: {
            geometryName: 'foo',
          },
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
        expect(outputConfig).to.have.property('responseType', inputConfig.responseType);
      });

      it('should configure the tilingSchema', () => {
        expect(outputConfig).to.have.property('tilingSchema', inputConfig.tilingSchema);
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
        expect(outputConfig).to.have.property('formatOptions')
          .and.to.eql(inputConfig.formatOptions);
      });

      it('should configure the projection', () => {
        expect(outputConfig).to.have.property('projection')
          .and.to.eql(inputConfig.projection);
      });

      it('should configure the tileSize', () => {
        expect(outputConfig).to.have.property('tileSize')
          .and.to.eql(inputConfig.tileSize);
      });

      it('should configure the extent', () => {
        expect(outputConfig).to.have.property('extent')
          .and.to.eql(inputConfig.extent);
      });
    });
  });
});
