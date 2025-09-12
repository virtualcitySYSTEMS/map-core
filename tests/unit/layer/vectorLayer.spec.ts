import { ClassificationType, HeightReference } from '@vcmap-cesium/engine';
import type { SinonSandbox } from 'sinon';
import sinon from 'sinon';
import { expect } from 'chai';
import Feature from 'ol/Feature.js';
import { fromExtent } from 'ol/geom/Polygon.js';
import Point from 'ol/geom/Point.js';
import type { VectorOptions } from '../../../src/layer/vectorLayer.js';
import VectorLayer from '../../../src/layer/vectorLayer.js';
import { wgs84Projection } from '../../../src/util/projection.js';
import DeclarativeStyleItem from '../../../src/style/declarativeStyleItem.js';
import VcsApp from '../../../src/vcsApp.js';
import VectorStyleItem, {
  vectorStyleSymbol,
} from '../../../src/style/vectorStyleItem.js';
import { originalStyle } from '../../../src/layer/featureVisibility.js';
import {
  AltitudeModeCesium,
  ClassificationTypeCesium,
  vcsMetaVersion,
} from '../../../src/layer/vectorProperties.js';
import { setOpenlayersMap } from '../helpers/openlayersHelpers.js';
import Extent from '../../../src/util/extent.js';
import type { OpenlayersMap } from '../../../index.js';

describe('VectorLayer', () => {
  let VL: VectorLayer;
  let sandbox: SinonSandbox;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  beforeEach(() => {
    VL = new VectorLayer({});
  });

  afterEach(() => {
    VL.destroy();
    sandbox.restore();
  });

  describe('getZoomToExtent', () => {
    it('should return the extent of the source', () => {
      const polygonExtent = [0, 0, 1, 1];
      VL.source.addFeature(
        new Feature({ geometry: fromExtent(polygonExtent) }),
      );
      const extent = VL.getZoomToExtent();
      expect(extent?.extent).to.have.ordered.members(polygonExtent);
    });

    it('should return null, if the source is empty', () => {
      const extent = VL.getZoomToExtent();
      expect(extent).to.be.null;
    });

    it('should return the configured extent', () => {
      const polygonExtent = [0, 0, 1, 1];
      VL.source.addFeature(
        new Feature({ geometry: fromExtent(polygonExtent) }),
      );
      VL.extent = new Extent({
        projection: wgs84Projection.toJSON(),
        coordinates: [2, 2, 5, 5],
      });
      const extent = VL.getZoomToExtent();
      expect(extent?.extent).to.have.ordered.members([2, 2, 5, 5]);
    });
  });

  describe('setStyle', () => {
    it('should add a styleChanged event listener', () => {
      const style = new DeclarativeStyleItem({});
      const feature = new Feature({ geometry: new Point([0, 0]) });
      const changed = sandbox.spy(feature, 'changed');
      VL.setStyle(style);
      VL.addFeatures([feature]);
      style.color = 'rgb(1, 1, 1)';
      expect(changed).to.have.been.called;
      expect(VL)
        .to.have.property('_onStyleChangeRemover')
        .and.to.be.a('function');
    });

    it('should always remove the previous styleChanged handler', () => {
      const onStyleChangeRemover = sandbox.spy();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      VL._onStyleChangeRemover = onStyleChangeRemover;
      VL.setStyle(VL.defaultStyle);
      expect(onStyleChangeRemover).to.have.been.called;
    });

    describe('onStyleChanged', () => {
      let features: [Feature, Feature];

      beforeEach(() => {
        features = [new Feature(), new Feature()];
        features[0][vectorStyleSymbol] = new VectorStyleItem({});
        VL.addFeatures(features);
      });

      it('should call changed for all features, if the style is declarative', () => {
        const style = new DeclarativeStyleItem({});
        VL.setStyle(style);
        const dedicatedChanged = sandbox.spy(features[0], 'changed');
        const nonDedicatedChanged = sandbox.spy(features[1], 'changed');
        style.styleChanged.raiseEvent();
        expect(dedicatedChanged).to.have.been.called;
        expect(nonDedicatedChanged).to.have.been.called;
      });

      it('should only call changed for layer style features, if the style is vector', () => {
        const style = new VectorStyleItem({});
        VL.setStyle(style);
        const dedicatedChanged = sandbox.spy(features[0], 'changed');
        const nonDedicatedChanged = sandbox.spy(features[1], 'changed');
        style.styleChanged.raiseEvent();
        expect(dedicatedChanged).to.not.have.been.called;
        expect(nonDedicatedChanged).to.have.been.called;
      });
    });

    describe('Setting Declarative Style', () => {
      let dedicatedFeature: Feature;

      beforeEach(() => {
        dedicatedFeature = new Feature();
        VL.addFeatures([dedicatedFeature]);
        dedicatedFeature[vectorStyleSymbol] = new VectorStyleItem({});
      });

      it('should set the style to be undefined, if the style is declarative, and a feature has a dedicated style', () => {
        const setStyle = sandbox.spy(dedicatedFeature, 'setStyle');
        VL.setStyle(new DeclarativeStyleItem({}));
        expect(setStyle).to.have.been.calledWith(undefined);
      });

      it('should set the features dedicated style, if the layer style is not declarative and the feature has no set style', () => {
        VL.setStyle(new VectorStyleItem({}));
        expect(dedicatedFeature.getStyle()).to.equal(
          dedicatedFeature[vectorStyleSymbol]?.style,
        );
      });

      it('should update the originalStyle of the feature to undefined, it the layer style is dedicated', () => {
        dedicatedFeature[originalStyle] =
          dedicatedFeature[vectorStyleSymbol]?.style;
        VL.setStyle(new DeclarativeStyleItem({}));
        expect(dedicatedFeature[originalStyle]).to.be.undefined;
      });

      it('should set the original style of the feature to the features style, it the layer style is vector', () => {
        dedicatedFeature[originalStyle] = undefined;
        VL.setStyle(new VectorStyleItem({}));
        expect(dedicatedFeature[originalStyle]).to.equal(
          dedicatedFeature[vectorStyleSymbol]?.style,
        );
      });
    });
  });

  describe('getVcsMeta', () => {
    it('should set the version to the current version', () => {
      const meta = VL.getVcsMeta();
      expect(meta.version).to.equal(vcsMetaVersion);
    });

    it('should not add properties for defaults', () => {
      const meta = VL.getVcsMeta();
      expect(meta).to.have.all.keys(['version']);
    });

    it('should return the skirts, classificationType, altitudeMode and storeyHeight', () => {
      VL.vectorProperties.skirt = 5;
      VL.vectorProperties.storeyHeightsAboveGround = [3];
      VL.vectorProperties.classificationType = ClassificationType.BOTH;
      VL.vectorProperties.altitudeMode = HeightReference.NONE;

      const meta = VL.getVcsMeta();
      expect(meta).to.have.property('skirt', 5);
      expect(meta)
        .to.have.property('storeyHeightsAboveGround')
        .and.to.have.members([3]);
      expect(meta).to.have.property('classificationType', 'both');
      expect(meta).to.have.property('altitudeMode', 'absolute');
    });

    it('should not write the default style', () => {
      const meta = VL.getVcsMeta({ writeStyle: true });
      expect(meta).to.not.have.property('style');
    });

    it('should write the style, if the default style has changed', () => {
      VL.setStyle(VL.defaultStyle);
      (VL.style as VectorStyleItem).fillColor = '#FF00FF';
      const meta = VL.getVcsMeta({ writeStyle: true });
      expect(meta).to.have.property('style');
      expect(meta.style)
        .to.have.property('fill')
        .and.to.have.property('color')
        .and.to.have.ordered.members([255, 0, 255, 1]);
    });
  });

  describe('setVcsMeta', () => {
    it('should set/remove the skirts', () => {
      VL.setVcsMeta({ skirt: 5, version: vcsMetaVersion });
      expect(VL.vectorProperties).to.have.property('skirt', 5);
      VL.setVcsMeta({ version: vcsMetaVersion });
      expect(VL.vectorProperties).to.have.property('skirt').and.to.equal(0);
    });

    it('should set/remove the classificationType', () => {
      VL.setVcsMeta({ classificationType: 'both', version: vcsMetaVersion });
      expect(VL.vectorProperties).to.have.property(
        'classificationType',
        ClassificationTypeCesium.both,
      );
      VL.setVcsMeta({ version: vcsMetaVersion });
      expect(VL.vectorProperties).to.have.property('classificationType').and.to
        .be.undefined;
    });

    it('should set but not remove the altitudeMode', () => {
      VL.setVcsMeta({ altitudeMode: 'absolute', version: vcsMetaVersion });
      expect(VL.vectorProperties).to.have.property(
        'altitudeMode',
        AltitudeModeCesium.absolute,
      );
      VL.setVcsMeta({ version: vcsMetaVersion });
      expect(VL.vectorProperties).to.have.property(
        'altitudeMode',
        AltitudeModeCesium.absolute,
      );
    });
  });

  describe('addFeatures', () => {
    it('should set layer.hasFeatureUUID, if the features have an ID', () => {
      const geometry = new Point([1, 1, 0]);
      VL.addFeatures([new Feature({ geometry })]);
      expect(VL).to.have.property('hasFeatureUUID', false);
      const withId = new Feature({ geometry });
      withId.setId('test');
      VL.addFeatures([withId]);
      expect(VL).to.have.property('hasFeatureUUID', true);
    });

    it('should only return ids for features actually added', () => {
      const geometry = new Point([1, 1, 0]);
      const feature = new Feature({ geometry });
      feature.setId('foo');
      const ids = VL.addFeatures([feature]);
      expect(ids).to.have.lengthOf(1);

      const clone = feature.clone();
      clone.setId('foo');
      const cloneIds = VL.addFeatures([clone]);
      expect(cloneIds).to.be.empty;
    });
  });

  describe('destroy', () => {
    it('should clear all features from the source', () => {
      const polygonExtent = [0, 0, 1, 1];
      VL.source.addFeature(
        new Feature({ geometry: fromExtent(polygonExtent) }),
      );
      const { source } = VL;
      expect(source.isEmpty()).to.be.false;
      VL.destroy();
      expect(source.isEmpty()).to.be.true;
    });
  });

  describe('layer visibility', () => {
    let app: VcsApp;
    let map: OpenlayersMap;

    before(async () => {
      app = new VcsApp();
      map = await setOpenlayersMap(app);
    });

    after(() => {
      app.destroy();
    });

    it('should force a redraw, if the visibility changes', () => {
      const [impl] = VL.getImplementationsForMap(map);
      VL.visibility = false;
      expect(VL.getImplementations()).to.not.include(impl);
    });

    it('should not create any implementations, if not visible', () => {
      VL.visibility = false;
      const impls = VL.getImplementationsForMap(map);
      expect(impls).to.be.empty;
    });

    it('should create implementations for active maps, if visiblity is turned back on', async () => {
      await VL.activate();
      const [impl] = VL.getImplementationsForMap(map);
      VL.visibility = false;
      VL.visibility = true;
      const impls = VL.getImplementations();
      expect(impls).to.not.include(impl);
      expect(impls).to.have.lengthOf(1);
    });
  });

  describe('getting config objects', () => {
    describe('of a default object', () => {
      let layer: VectorLayer;

      before(() => {
        layer = new VectorLayer({});
      });

      after(() => {
        layer.destroy();
      });

      it('should return an object with type and name for default layers', () => {
        const config = layer.toJSON();
        expect(config).to.have.all.keys('name', 'type');
      });
    });

    describe('of a configured layer', () => {
      let inputConfig: VectorOptions;
      let outputConfig: VectorOptions;
      let configuredLayer: VectorLayer;

      before(() => {
        inputConfig = {
          extent: new Extent({
            projection: wgs84Projection.toJSON(),
            coordinates: [0, 0, 1, 1],
          }).toJSON(),
          vectorProperties: {
            skirt: 5,
            classificationType: 'cesium3DTile',
            altitudeMode: 'absolute',
            storeyHeightsAboveGround: [3, 6],
          },
          maxResolution: 5,
          minResolution: 1,
          zIndex: 10,
          isDynamic: true,
          properties: { test: 'test' },
          ignoreMapLayerTypes: false,
          vectorClusterGroup: 'foo',
        };
        configuredLayer = new VectorLayer(inputConfig);
        outputConfig = configuredLayer.toJSON();
      });

      it('should configure the extent', () => {
        expect(outputConfig).to.have.property('extent');
        expect(outputConfig.extent).to.eql(inputConfig.extent);
      });

      it('should configure the vectorProperties', () => {
        expect(outputConfig).to.have.property('vectorProperties');
        expect(outputConfig.vectorProperties).to.eql(
          inputConfig.vectorProperties,
        );
      });

      it('should configure the maxResolution', () => {
        expect(outputConfig).to.have.property(
          'maxResolution',
          inputConfig.maxResolution,
        );
      });

      it('should configure the minResolution', () => {
        expect(outputConfig).to.have.property(
          'minResolution',
          inputConfig.minResolution,
        );
      });

      it('should configure the zIndex', () => {
        expect(outputConfig).to.have.property('zIndex', inputConfig.zIndex);
      });

      it('should configure the isDynamic', () => {
        expect(outputConfig).to.have.property(
          'isDynamic',
          inputConfig.isDynamic,
        );
      });

      it('should configure the properties', () => {
        expect(outputConfig).to.have.property('properties');
        expect(outputConfig.properties).to.eql(inputConfig.properties);
      });

      it('should configure the ignoreMapLayerTypes', () => {
        expect(outputConfig).to.have.property(
          'ignoreMapLayerTypes',
          inputConfig.ignoreMapLayerTypes,
        );
      });
    });
  });
});
