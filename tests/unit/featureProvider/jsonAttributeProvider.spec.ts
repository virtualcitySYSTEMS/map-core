import Feature from 'ol/Feature.js';
import { expect } from 'chai';
import nock from 'nock';
import JsonAttributeProvider from '../../../src/featureProvider/jsonAttributeProvider.js';

describe('JsonAttributeProvider', () => {
  let feature: Feature;

  before(() => {
    feature = new Feature({});
    feature.setId('1');
  });

  describe('data loading', () => {
    describe('when data is provided as an object', () => {
      it('should parse inline JSON data', async () => {
        const jsonData = {
          features: [
            { id: '1', properties: { name: 'Alice', age: '30' } },
            { id: '2', properties: { name: 'Bob', age: '25' } },
          ],
        };
        const provider = new JsonAttributeProvider({ data: jsonData });
        await provider.augmentFeature(feature);
        expect(feature.getProperties()).to.include({
          name: 'Alice',
          age: '30',
        });
      });

      it('should parse inline JSON data with numeric ids', async () => {
        const jsonData = {
          features: [
            { id: 1, properties: { name: 'Alice', age: '30' } },
            { id: 2, properties: { name: 'Bob', age: '25' } },
          ],
        };
        const provider = new JsonAttributeProvider({ data: jsonData });
        await provider.augmentFeature(feature);
        expect(feature.getProperties()).to.include({
          name: 'Alice',
          age: '30',
        });
      });

      it('should filter out missing ids', async () => {
        const jsonData = [
          { id: '1', properties: { name: 'Alice', age: '30' } },
          { properties: { name: 'Bob', age: '25' } },
        ];
        // @ts-expect-error missing id
        const provider = new JsonAttributeProvider({ data: jsonData });
        await provider.augmentFeature(feature);
        expect(feature.getProperties()).to.include({
          name: 'Alice',
          age: '30',
        });
        const feature1 = new Feature({});
        feature1.setId('2');
        await provider.augmentFeature(feature1);
        expect(feature1.getProperties()).to.not.have.property('name');
      });

      it('should filter out missing properties', async () => {
        const jsonData = [
          { id: '1', properties: { name: 'Alice', age: '30' } },
          { id: '2' },
        ];
        // @ts-expect-error missing properties
        const provider = new JsonAttributeProvider({ data: jsonData });
        await provider.augmentFeature(feature);
        expect(feature.getProperties()).to.include({
          name: 'Alice',
          age: '30',
        });

        const feature1 = new Feature({});
        feature1.setId('2');
        await provider.augmentFeature(feature1);
        expect(feature1.getProperties()).to.not.have.property('name');
      });
    });

    describe('when data is provided as a URL', () => {
      before(() => {
        nock('http://localhost')
          .get('/data.json')
          .reply(200, [
            { id: '1', properties: { name: 'Alice', age: '30' } },
            { id: '2', properties: { name: 'Bob', age: '25' } },
          ]);
      });

      after(() => {
        nock.cleanAll();
      });

      it('should fetch JSON data from a valid URL', async () => {
        const provider = new JsonAttributeProvider({
          data: 'http://localhost/data.json',
        });
        await provider.augmentFeature(feature);
        expect(feature.getProperties()).to.include({
          name: 'Alice',
          age: '30',
        });
      });
    });
  });
});
