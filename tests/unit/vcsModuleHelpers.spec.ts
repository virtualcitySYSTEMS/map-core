import { expect } from 'chai';
import {
  type AbstractAttributeProviderOptions,
  CompositeFeatureProvider,
  CsvAttributeProvider,
  type CsvAttributeProviderOptions,
  deserializeLayer,
  type Layer,
  StaticGeoJSONTileProvider,
  type StaticGeoJSONTileProviderOptions,
  VcsApp,
  VectorLayer,
  VectorStyleItem,
  VectorTileLayer,
  WMSFeatureProvider,
  type WMSFeatureProviderOptions,
} from '../../index.js';
import TestAttributeProvider from './featureProvider/testAttributeProvider.js';

describe('vcsModuleHelpers', () => {
  describe('deserialize layer', () => {
    let app: VcsApp;
    let layer: Layer | undefined | null;

    before(() => {
      app = new VcsApp();
      app.featureProviderClassRegistry.registerClass(
        app.dynamicModuleId,
        TestAttributeProvider.className,
        TestAttributeProvider,
      );
    });

    afterEach(() => {
      layer?.destroy();
    });

    after(() => {
      app.destroy();
    });

    it('should deserialize a layer', () => {
      layer = deserializeLayer(app, { type: VectorLayer.className });
      expect(layer).to.be.instanceOf(VectorLayer);
    });

    it('should deserialize a layer with style reference', () => {
      const style = new VectorStyleItem({});
      app.styles.add(style);
      layer = deserializeLayer(app, {
        type: VectorLayer.className,
        style: style.name,
      });
      expect(layer).to.be.instanceOf(VectorLayer);
      expect((layer as VectorLayer).style).to.equal(style);
    });

    it('should deserialize a highlight style reference', () => {
      const highlightStyle = new VectorStyleItem({});
      app.styles.add(highlightStyle);
      layer = deserializeLayer(app, {
        type: VectorLayer.className,
        highlightStyle: highlightStyle.name,
      });
      expect(layer).to.be.instanceOf(VectorLayer);
      expect((layer as VectorLayer).highlightStyle).to.equal(highlightStyle);
    });

    it('should deserialize a tile provider', () => {
      const tileProvider: StaticGeoJSONTileProviderOptions = {
        type: StaticGeoJSONTileProvider.className,
        url: '',
      };

      layer = deserializeLayer(app, {
        type: VectorTileLayer.className,
        tileProvider,
      });

      expect(layer).to.be.instanceOf(VectorTileLayer);
      expect((layer as VectorTileLayer).tileProvider).to.be.instanceOf(
        StaticGeoJSONTileProvider,
      );
    });

    it('should deserialize a feature provider', () => {
      const featureProvider: WMSFeatureProviderOptions = {
        parameters: {},
        type: WMSFeatureProvider.className,
        url: 'https://example.com/wms',
      };

      layer = deserializeLayer(app, {
        type: VectorLayer.className,
        featureProvider,
      });

      expect(layer).to.be.instanceOf(VectorLayer);
      expect((layer as VectorLayer).featureProvider).to.be.instanceOf(
        WMSFeatureProvider,
      );
    });

    it('should deserialize an attribute provider', () => {
      const attributeProvider: CsvAttributeProviderOptions = {
        type: CsvAttributeProvider.className,
        data: '/attributes.csv',
      };
      layer = deserializeLayer(app, {
        type: VectorTileLayer.className,
        attributeProvider,
      });

      expect(layer).to.be.instanceOf(VectorTileLayer);
      expect((layer as VectorTileLayer).attributeProvider).to.be.instanceOf(
        CsvAttributeProvider,
      );
    });

    it('should deserialize a composite feature provider', () => {
      const attributeProvider: CsvAttributeProviderOptions = {
        name: 'CSV Attributes',
        type: CsvAttributeProvider.className,
        data: '/attributes.csv',
      };
      const featureProvider = {
        name: 'WMS Features',
        type: WMSFeatureProvider.className,
        parameters: {},
        url: 'https://example.com/wms',
      };

      const compositeFeatureProvider = {
        name: 'Composite Provider',
        type: 'CompositeFeatureProvider',
        featureProviders: [featureProvider],
        attributeProviders: [attributeProvider],
      };

      layer = deserializeLayer(app, {
        type: VectorTileLayer.className,
        featureProvider: compositeFeatureProvider,
      });

      expect(layer).to.be.instanceOf(VectorTileLayer);
      expect((layer as VectorTileLayer).featureProvider).to.be.instanceOf(
        CompositeFeatureProvider,
      );
      const json = layer?.featureProvider?.toJSON();
      expect(json).to.deep.equal(compositeFeatureProvider);
    });

    it('should deserialize a custom attribute provider', () => {
      const attributeProvider: AbstractAttributeProviderOptions = {
        type: TestAttributeProvider.className,
      };

      layer = deserializeLayer(app, {
        type: VectorTileLayer.className,
        attributeProvider,
      });

      expect(layer).to.be.instanceOf(VectorTileLayer);
      expect((layer as VectorTileLayer).attributeProvider).to.be.instanceOf(
        TestAttributeProvider,
      );
    });
  });
});
