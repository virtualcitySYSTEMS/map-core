import ClassificationType from 'cesium/Source/Scene/ClassificationType.js';
import HeightReference from 'cesium/Source/Scene/HeightReference.js';
import Feature from 'ol/Feature.js';
import Polygon, { fromExtent } from 'ol/geom/Polygon.js';
import Point from 'ol/geom/Point.js';
import Vector from '../../../../src/vcs/vcm/layer/vector.js';
import Projection, { wgs84Projection } from '../../../../src/vcs/vcm/util/projection.js';
import DeclarativeStyleItem from '../../../../src/vcs/vcm/util/style/declarativeStyleItem.js';
import { referenceableStyleSymbol, StyleType } from '../../../../src/vcs/vcm/util/style/styleItem.js';
import { getFramework } from '../../helpers/framework.js';
import VectorStyleItem, { vectorStyleSymbol } from '../../../../src/vcs/vcm/util/style/vectorStyleItem.js';
import { vcsMetaVersion } from '../../../../src/vcs/vcm/layer/layer.js';
import { originalStyle } from '../../../../src/vcs/vcm/layer/featureVisibility.js';
import { AltitudeModeCesium, ClassificationTypeCesium } from '../../../../src/vcs/vcm/layer/vectorProperties.js';
import resetFramework from '../../helpers/resetFramework.js';
import { setOpenlayersMap } from '../../helpers/openlayers.js';
import Extent from '../../../../src/vcs/vcm/util/extent.js';
import { styleCollection } from '../../../../src/vcs/vcm/globalCollections.js';

describe('vcs.vcm.layer.Vector', () => {
  /** @type {vcs.vcm.layer.Vector} */
  let VL;
  let sandbox;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  beforeEach(() => {
    VL = new Vector({});
  });

  afterEach(() => {
    VL.destroy();
    sandbox.restore();
  });

  after(() => {
    resetFramework();
  });

  describe('getZoomToExtent', () => {
    it('should return the extent of the source', () => {
      const polygonExtent = [0, 0, 1, 1];
      VL.source.addFeature(new Feature({ geometry: fromExtent(polygonExtent) }));
      const extent = VL.getZoomToExtent();
      expect(extent.extent).to.have.ordered.members(polygonExtent);
    });

    it('should return null, if the source is empty', () => {
      const extent = VL.getZoomToExtent();
      expect(extent).to.be.null;
    });

    it('should return the configured extent', () => {
      const polygonExtent = [0, 0, 1, 1];
      VL.source.addFeature(new Feature({ geometry: fromExtent(polygonExtent) }));
      VL.extent = new Extent({
        ...wgs84Projection.getConfigObject(),
        coordinates: [2, 2, 5, 5],
      });
      const extent = VL.getZoomToExtent();
      expect(extent.extent).to.have.ordered.members([2, 2, 5, 5]);
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
      expect(VL).to.have.property('_onStyleChangeRemover').and.to.be.a('function');
    });

    it('should always remove the previous styleChanged handler', () => {
      const onStyleChangeRemover = sandbox.spy();
      VL._onStyleChangeRemover = onStyleChangeRemover;
      VL.setStyle(VL.defaultStyle);
      expect(onStyleChangeRemover).to.have.been.called;
    });

    describe('onStyleChanged', () => {
      let features = null;
      beforeEach(() => {
        features = [new Feature(), new Feature()];
        features[0][vectorStyleSymbol] = true;
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
      let dedicatedFeature;
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
        expect(dedicatedFeature.getStyle()).to.equal(dedicatedFeature[vectorStyleSymbol].style);
      });

      it('should update the originalStyle of the feature to undefined, it the layer style is dedicated', () => {
        dedicatedFeature[originalStyle] = dedicatedFeature[vectorStyleSymbol].style;
        VL.setStyle(new DeclarativeStyleItem({}));
        expect(dedicatedFeature[originalStyle]).to.be.undefined;
      });

      it('should set the original style of the feature to the features style, it the layer style is vector', () => {
        dedicatedFeature[originalStyle] = undefined;
        VL.setStyle(new VectorStyleItem({}));
        expect(dedicatedFeature[originalStyle]).to.equal(dedicatedFeature[vectorStyleSymbol].style);
      });
    });
  });

  describe('getGenericFeatureFromClickedObject', () => {
    let wgs84Center;
    let feature;

    before(() => {
      wgs84Center = Projection.mercatorToWgs84([0.5, 0.5]);
    });

    beforeEach(() => {
      feature = new Feature({
        geometry: new Polygon([[[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]]]),
      });
      feature.clickedPosition = {
        longitude: wgs84Center[0] + 1,
        latitude: wgs84Center[1] + 1,
        height: 5,
        exactPosition: true,
      };
    });

    it('should return the properties of a feature, without the geometry', () => {
      feature.setProperties({ test: true });
      const generic = VL.getGenericFeatureFromClickedObject(feature);
      expect(generic).to.have.property('attributes').and.to.have.property('test', true);
    });

    it('should add the genericFeatureProperties to the attributes', () => {
      feature.setProperties({ test: true });
      VL.assignGenericFeatureProperties({ otherTest: false });
      const generic = VL.getGenericFeatureFromClickedObject(feature);
      expect(generic).to.have.property('attributes').and.to.have.property('test', true);
      expect(generic).to.have.property('attributes').and.to.have.property('otherTest', false);
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
      expect(meta).to.have.property('storeyHeightsAboveGround').and.to.have.members([3]);
      expect(meta).to.have.property('classificationType', 'both');
      expect(meta).to.have.property('altitudeMode', 'absolute');
    });

    it('should return a referenced style', () => {
      const styleItem = new DeclarativeStyleItem({
        name: 'test',
        type: StyleType.DECLARATIVE,
        declarativeStyle: { show: true },
      });
      styleItem[referenceableStyleSymbol] = true;
      styleCollection.add(styleItem);
      VL.setStyle('test');
      const meta = VL.getVcsMeta({ writeStyle: true });
      expect(meta).to.have.property('style');
      expect(meta.style).to.have.property('type', StyleType.REFERENCE);
      expect(meta.style).to.have.property('name', 'test');
    });

    it('should not write the default style', () => {
      const meta = VL.getVcsMeta({ writeStyle: true });
      expect(meta).to.not.have.property('style');
    });

    it('should write the style, if the default style has changed', () => {
      VL.setStyle(VL.defaultStyle);
      VL.style.fillColor = '#FF00FF';
      const meta = VL.getVcsMeta({ writeStyle: true });
      expect(meta).to.have.property('style');
      expect(meta.style).to.have.property('fill')
        .and.to.have.property('color')
        .and.to.have.ordered.members([255, 0, 255, 1]);
    });
  });

  describe('setVcsMeta', () => {
    it('should set/remove the skirts', () => {
      VL.setVcsMeta({ skirt: 5 });
      expect(VL.vectorProperties).to.have.property('skirt', 5);
      VL.setVcsMeta({});
      expect(VL.vectorProperties).to.have.property('skirt').and.to.equal(0);
    });

    it('should set/remove the storeyHeight property', () => {
      VL.setVcsMeta({ storeyHeight: 5 });
      expect(VL.vectorProperties).to.have.property('storeyHeight', 5);
      VL.setVcsMeta({});
      expect(VL.vectorProperties).to.have.property('storeyHeight').and.be.undefined;
    });

    it('should set/remove the classificationType', () => {
      VL.setVcsMeta({ classificationType: 'both' });
      expect(VL.vectorProperties).to.have.property('classificationType', ClassificationTypeCesium.both);
      VL.setVcsMeta({});
      expect(VL.vectorProperties).to.have.property('classificationType').and.to.be.undefined;
    });

    it('should set but not remove the altitudeMode', () => {
      VL.setVcsMeta({ altitudeMode: 'absolute' });
      expect(VL.vectorProperties).to.have.property('altitudeMode', AltitudeModeCesium.absolute);
      VL.setVcsMeta({});
      expect(VL.vectorProperties).to.have.property('altitudeMode', AltitudeModeCesium.absolute);
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
  });

  describe('destroy', () => {
    it('should clear all features from the source', () => {
      const polygonExtent = [0, 0, 1, 1];
      VL.source.addFeature(new Feature({ geometry: fromExtent(polygonExtent) }));
      const { source } = VL;
      expect(source.isEmpty()).to.be.false;
      VL.destroy();
      expect(source.isEmpty()).to.be.true;
    });
  });

  describe('layer visibility', () => {
    let map;
    before(async () => {
      map = await setOpenlayersMap(getFramework());
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
});
