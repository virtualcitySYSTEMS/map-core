import Feature from 'ol/Feature.js';
import { expect } from 'chai';
import nock from 'nock';
import CsvAttributeProvider from '../../../src/featureProvider/csvAttributeProvider.js';

describe('CsvAttributeProvider', () => {
  let feature: Feature;

  before(() => {
    feature = new Feature({});
    feature.setId('1');
  });

  describe('data loading', () => {
    describe('when data is provided as a string', () => {
      it('should parse inline CSV data with newlines', async () => {
        const csvData = `id,name,age
1,Alice,30
2,Bob,25`;
        const provider = new CsvAttributeProvider({ data: csvData });
        await provider.augmentFeature(feature);
        expect(feature.getProperties()).to.include({
          name: 'Alice',
          age: '30',
        });
      });

      it('should handle Windows line endings (\\r\\n)', async () => {
        const csvData = `id,name,age\r\n1,Alice,30\r\n2,Bob,25`;
        const provider = new CsvAttributeProvider({ data: csvData });
        await provider.augmentFeature(feature);
        expect(feature.getProperties()).to.include({
          name: 'Alice',
          age: '30',
        });
      });

      it('should filter out empty lines', async () => {
        const csvData = `id,name,age
1,Alice,30

2,Bob,25

`;
        const provider = new CsvAttributeProvider({ data: csvData });
        await provider.augmentFeature(feature);
        expect(feature.getProperties()).to.include({
          name: 'Alice',
          age: '30',
        });
      });
    });

    describe('when data is provided as a URL', () => {
      before(() => {
        nock('http://localhost')
          .get('/data.csv')
          .reply(
            200,
            `id,name,age
1,Alice,30
2,Bob,25`,
          );
      });

      after(() => {
        nock.cleanAll();
      });

      it('should fetch CSV data from a valid URL', async () => {
        const provider = new CsvAttributeProvider({
          data: 'http://localhost/data.csv',
        });
        await provider.augmentFeature(feature);
        expect(feature.getProperties()).to.include({
          name: 'Alice',
          age: '30',
        });
      });
    });
  });

  describe('CSV parsing', () => {
    describe('header handling', () => {
      it('should use provided headers array when supplied', async () => {
        const csvData = `1,Alice,30
2,Bob,25`;
        const headers = ['id', 'name', 'age'];
        const provider = new CsvAttributeProvider({
          data: csvData,
          headers,
        });
        await provider.augmentFeature(feature);
        expect(feature.getProperties()).to.include({
          name: 'Alice',
          age: '30',
        });
      });

      it('should generate column names for missing headers', async () => {
        const csvData = `id,name
1,Alice,30
2,Bob,25`;
        const provider = new CsvAttributeProvider({ data: csvData });
        await provider.augmentFeature(feature);
        expect(feature.getProperties()).to.include({
          name: 'Alice',
          // eslint-disable-next-line @typescript-eslint/naming-convention
          column_2: '30',
        });
      });
    });

    describe('delimiter handling', () => {
      it('should parse CSV with custom delimiter', async () => {
        const csvData = `id;name;age
1;Alice;30
2;Bob;25`;
        const provider = new CsvAttributeProvider({
          data: csvData,
          delimiter: ';',
        });
        await provider.augmentFeature(feature);
        expect(feature.getProperties()).to.include({
          name: 'Alice',
          age: '30',
        });
      });

      it('should trim whitespace around delimited values', async () => {
        const csvData = `id , name , age
1 , Alice , 30
2 , Bob , 25`;
        const provider = new CsvAttributeProvider({ data: csvData });
        await provider.augmentFeature(feature);
        expect(feature.getProperties()).to.include({
          name: 'Alice',
          age: '30',
        });
      });
    });

    describe('ID column handling', () => {
      it('should use the specified idColumn to map features', async () => {
        const csvData = `identifier,name,age
1,Alice,30
2,Bob,25`;
        const provider = new CsvAttributeProvider({
          data: csvData,
          idColumn: 'identifier',
        });
        await provider.augmentFeature(feature);
        expect(feature.getProperties()).to.include({
          name: 'Alice',
          age: '30',
        });
      });

      it('should skip rows where ID is not a string', async () => {
        const csvData = `id,name,age
,Bob,25
1,Alice,30
3,Charlie,28`;
        const provider = new CsvAttributeProvider({ data: csvData });
        await provider.augmentFeature(feature);
        expect(feature.getProperties()).to.include({
          name: 'Alice',
          age: '30',
        });
      });
    });
  });
});
