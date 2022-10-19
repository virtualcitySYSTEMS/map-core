import { Color } from '@vcmap/cesium';
import Fill from 'ol/style/Fill.js';
import Style from 'ol/style/Style.js';
import OpenlayersText from 'ol/style/Text.js';
import Feature from 'ol/Feature.js';
import FeatureVisibility, {
  FeatureVisibilityAction,
  globalHidden, hidden,
  highlighted,
  originalStyle,
  synchronizeFeatureVisibility,
} from '../../../src/layer/featureVisibility.js';
import VectorStyleItem, { vectorStyleSymbol } from '../../../src/style/vectorStyleItem.js';
import { getVcsEventSpy, createDummyCesium3DTileFeature } from '../helpers/cesiumHelpers.js';

describe('FeatureVisibility', () => {
  /** @type {import("@vcmap/core").FeatureVisibility} */
  let featureVisibility;
  let highlightStyle;
  let sandbox;

  before(async () => {
    highlightStyle = new VectorStyleItem({ fill: { color: [0, 255, 0, 1] } });
    sandbox = sinon.createSandbox();
  });

  beforeEach(() => {
    featureVisibility = new FeatureVisibility();
  });

  afterEach(() => {
    featureVisibility.destroy();
    sandbox.restore();
  });

  describe('synchronizeFeatureVisibility', () => {
    /** @type {import("@vcmap/core").FeatureVisibility} */
    let source;
    /** @type {import("@vcmap/core").FeatureVisibility} */
    let destination;

    before(() => {
      source = new FeatureVisibility();
      source.hideObjects(['test1']);
      source.highlight({ test2: highlightStyle });
      destination = new FeatureVisibility();
      synchronizeFeatureVisibility(source, destination);
    });

    after(() => {
      source.destroy();
      destination.destroy();
    });

    it('should synchronize hidden objects', () => {
      expect(destination.hiddenObjects).to.have.property('test1');
    });

    it('should synchronize highlighted objects', () => {
      expect(destination.highlightedObjects).to.have.property('test2');
    });

    it('should listen to hiding of new ids', () => {
      source.hideObjects(['test3']);
      expect(destination.hiddenObjects).to.have.property('test3');
    });

    it('should listen to highlighting of new ids', () => {
      source.highlight({ test4: highlightStyle });
      expect(destination.highlightedObjects).to.have.property('test4');
    });

    it('should listen to showing of ids', () => {
      source.hideObjects(['test5']);
      source.showObjects(['test5']);
      expect(destination.hiddenObjects).to.not.have.property('test5');
    });

    it('should listen to unhighlighting of ids', () => {
      source.highlight({ test6: highlightStyle });
      source.unHighlight(['test6']);
      expect(destination.highlightedObjects).to.not.have.property('test6');
    });
  });

  describe('highlight', () => {
    it('should add a featureId to the highlightedObjects', () => {
      featureVisibility.highlight({ test: highlightStyle });
      expect(featureVisibility.highlightedObjects).to.have.property('test');
    });

    it('should set the style property on the highlighted object', () => {
      featureVisibility.highlight({ test: highlightStyle });
      expect(featureVisibility.highlightedObjects)
        .to.have.property('test')
        .and.to.have.property('style', highlightStyle);
    });

    it('should initialize the features set', () => {
      featureVisibility.highlight({ test: highlightStyle });
      expect(featureVisibility.highlightedObjects)
        .to.have.property('test')
        .and.to.have.property('features')
        .and.to.be.a('Set');
    });

    it('should convert a cesium color to a VectorStyleItem', () => {
      featureVisibility.highlight({ test: Color.fromBytes(255, 0, 255, 255) });
      expect(featureVisibility.highlightedObjects)
        .to.have.property('test')
        .and.to.have.property('style');
      expect(featureVisibility.highlightedObjects.test.style.fillColor).to.have.members([255, 0, 255, 1]);
    });

    it('should convert a ol.style.Style to a style object', () => {
      featureVisibility.highlight({ test: new Style({ fill: new Fill({ color: '#FF00FF' }) }) });
      expect(featureVisibility.highlightedObjects)
        .to.have.property('test')
        .and.to.have.property('style');
      expect(featureVisibility.highlightedObjects.test.style.fillColor).to.have.members([255, 0, 255, 1]);
    });

    it('should convert an ol.style.Style to a style object with text', () => {
      const style = new Style({
        fill: new Fill({ color: '#FF00FF' }),
        text: new OpenlayersText({
          text: 'test',
        }),
      });
      featureVisibility.highlight({ style });
      expect(featureVisibility.highlightedObjects)
        .to.have.property('style')
        .and.to.have.property('style')
        .and.to.have.property('label', 'test');
    });

    describe('updating a color', () => {
      beforeEach(() => {
        featureVisibility.highlight({ test: highlightStyle });
      });

      it('should update a color', () => {
        featureVisibility.highlight({ test: Color.fromBytes(255, 0, 255, 255) });
        expect(featureVisibility.highlightedObjects)
          .to.have.property('test')
          .and.to.have.property('style');

        expect(featureVisibility.highlightedObjects.test.style.fillColor).to.have.members([255, 0, 255, 1]);
      });

      it('should update the color on any features already highlighted', () => {
        const feature = createDummyCesium3DTileFeature();
        featureVisibility.addHighlightFeature('test', feature);
        const newColor = Color.fromBytes(255, 0, 255, 255);
        featureVisibility.highlight({ test: newColor });
        expect(feature.color.equals(newColor)).to.be.true;
      });
    });

    describe('lastUpdated & event handling', () => {
      let clock;
      let now;

      before(() => {
        now = Date.now();
      });

      beforeEach(() => {
        clock = sandbox.useFakeTimers(now);
      });

      it('should set last update, if id was not found', () => {
        featureVisibility.highlight({ test: highlightStyle });
        expect(featureVisibility).to.have.property('lastUpdated', now);
      });

      it('should not set last updated, if id is highlighted again', () => {
        featureVisibility.highlight({ test: highlightStyle });
        clock.tick(1);
        featureVisibility.highlight({ test: Color.fromBytes(255, 0, 255, 255) });
        expect(featureVisibility).to.have.property('lastUpdated', now);
      });
    });

    describe('raising the changed event', () => {
      it('should not raise the changed if the id is already highlighted', () => {
        featureVisibility.highlight({ test: Color.fromBytes(255, 0, 255, 255) });
        const spy = getVcsEventSpy(featureVisibility.changed, sandbox);
        featureVisibility.highlight({ test: highlightStyle });
        expect(spy).to.not.have.been.called;
      });

      it('should raise the changed event', () => {
        const spy = getVcsEventSpy(featureVisibility.changed, sandbox);
        featureVisibility.highlight({ test: highlightStyle });
        expect(spy).to.have.been.calledWith({ action: FeatureVisibilityAction.HIGHLIGHT, ids: ['test'] });
      });

      it('should raise the changed only for new features', () => {
        featureVisibility.highlight({ test: Color.fromBytes(255, 0, 255, 255) });
        const spy = getVcsEventSpy(featureVisibility.changed, sandbox);
        featureVisibility.highlight({ test1: highlightStyle });
        expect(spy).to.have.been.calledWith({ action: FeatureVisibilityAction.HIGHLIGHT, ids: ['test1'] });
      });
    });
  });

  describe('unHighlight', () => {
    it('should delete the entry in the highlightedObjects map', () => {
      featureVisibility.highlightedObjects.test = {
        features: new Set(),
      };
      featureVisibility.unHighlight(['test']);
      expect(featureVisibility.highlightedObjects).to.not.have.property('test');
    });

    it('should set the originalCesiumColor color on features, if they still exist', () => {
      featureVisibility.highlight({ test: Color.BLUE });
      const features = [
        [createDummyCesium3DTileFeature(), Color.GREEN],
        [createDummyCesium3DTileFeature(), Color.BLUE],
      ];
      features.forEach(([feat, color]) => {
        feat.color = color;
        featureVisibility.addHighlightFeature('test', feat);
      });
      featureVisibility.unHighlight(['test']);
      features.forEach(([key, val]) => {
        expect(key).to.have.property('color');
        expect(key.color.equals(val)).to.be.true;
      });
    });

    it('should set the style to originalStyle for ol.Features', () => {
      featureVisibility.highlight({ test: Color.BLUE });
      const styles = [new Style(), new Style()];
      const features = [
        [new Feature(), styles[0]],
        [new Feature(), styles[1]],
      ];
      features.forEach(([feat, style]) => {
        feat.setStyle(style);
        featureVisibility.addHighlightFeature('test', feat, style);
      });
      featureVisibility.unHighlight(['test']);
      features.forEach(([feat, style]) => {
        expect(feat.getStyle()).to.equal(style);
      });
    });

    it('should not reset the style for hidden ol.Features', () => {
      featureVisibility.highlight({ test: Color.BLUE });
      featureVisibility.hideObjects(['test']);
      const feature = new Feature();
      const style = new Style();
      feature.setStyle(style);
      featureVisibility.addHighlightFeature('test', feature);
      featureVisibility.addHiddenFeature('test', feature);
      featureVisibility.unHighlight(['test']);
      expect(feature.getStyle()).to.not.equal(style);
    });

    it('should not reset the style for globaly hidden ol.Features', () => {
      featureVisibility.highlight({ test: Color.BLUE });
      const feature = new Feature();
      const style = new Style();
      feature.setStyle(style);
      feature[globalHidden] = true;
      featureVisibility.addHighlightFeature('test', feature);
      feature.setStyle(new Style({}));
      featureVisibility.unHighlight(['test']);
      expect(feature.getStyle()).to.not.equal(style);
    });

    describe('raising the changed event', () => {
      it('should not raise the changed if the id is not highlighted', () => {
        const spy = getVcsEventSpy(featureVisibility.changed, sandbox);
        featureVisibility.unHighlight(['test']);
        expect(spy).to.not.have.been.called;
      });

      it('should raise the changed event, if the id was highlighted', () => {
        featureVisibility.highlight({ test: Color.fromBytes(255, 0, 255, 255) });
        const spy = getVcsEventSpy(featureVisibility.changed, sandbox);
        featureVisibility.unHighlight(['test']);
        expect(spy).to.have.been.calledWith({ action: FeatureVisibilityAction.UNHIGHLIGHT, ids: ['test'] });
      });
    });
  });

  describe('clearHighlighting', () => {
    it('removes all features from highlightedObjects', () => {
      const unHighlight = sandbox.spy(featureVisibility, 'unHighlight');
      featureVisibility.highlight({ test: highlightStyle });
      featureVisibility.highlight({ test2: highlightStyle });
      featureVisibility.clearHighlighting();
      expect(featureVisibility.highlightedObjects).to.be.empty;
      expect(unHighlight).to.have.been.calledWith(['test', 'test2']);
    });
  });

  describe('highlighting of features', () => {
    describe('adding of ol.Features to highlighting', () => {
      let feature;
      beforeEach(() => {
        feature = new Feature({});
        featureVisibility.highlight({ test: highlightStyle });
      });

      it('should add the feature to the highlight features', () => {
        featureVisibility.addHighlightFeature('test', feature);
        expect(featureVisibility.hasHighlightFeature('test', feature)).to.be.true;
      });

      it('should set the highlight style on the feature', () => {
        featureVisibility.addHighlightFeature('test', feature);
        expect(feature.getStyle()).to.equal(highlightStyle.style);
      });

      it('should set the highlight symbol', () => {
        featureVisibility.addHighlightFeature('test', feature);
        expect(feature).to.have.property(highlighted, highlightStyle);
      });

      it('should set the originalStyle symbol', () => {
        const style = new Style({});
        feature.setStyle(style);
        featureVisibility.addHighlightFeature('test', feature);
        expect(feature).to.have.property(originalStyle, style);
      });

      it('should not reset the originalStyle symbol', () => {
        const style = new Style({});
        feature.setStyle(style);
        feature[originalStyle] = null;
        featureVisibility.addHighlightFeature('test', feature);
        expect(feature).to.have.property(originalStyle).and.to.be.null;
      });
    });

    describe('adding of CesiumTilesetFeature to highlighting', () => {
      let feature;
      beforeEach(() => {
        feature = createDummyCesium3DTileFeature();
        featureVisibility.highlight({ test: highlightStyle });
        featureVisibility.addHighlightFeature('test', feature);
      });

      it('should add the feature to the highlight features', () => {
        expect(featureVisibility.hasHighlightFeature('test', feature)).to.be.true;
      });

      it('should set the highlight color on the feature', () => {
        expect(feature.color).to.equal(highlightStyle.cesiumFillColor);
      });

      it('should set the highlight symbol', () => {
        expect(feature).to.have.property(highlighted, highlightStyle);
      });

      it('should set the originalStyle symbol', () => {
        expect(feature).to.have.property(originalStyle)
          .and.to.be.an.instanceOf(Color);
      });

      it('should not reset the originalStyle symbol', () => {
        const color = Color.RED.clone();
        feature[originalStyle] = color;
        featureVisibility.addHighlightFeature('test', feature);
        expect(feature).to.have.property(originalStyle, color);
      });
    });
  });

  describe('hideObjects', () => {
    let clock;
    let now;

    before(() => {
      now = Date.now();
    });

    beforeEach(() => {
      clock = sandbox.useFakeTimers(now);
    });

    it('adds the given ids to the hiddenObjects', () => {
      featureVisibility.hideObjects(['test', 'test1']);
      expect(featureVisibility.hiddenObjects).to.have.property('test');
      expect(featureVisibility.hiddenObjects).to.have.property('test1');
    });

    it('should initialize a set for each id', () => {
      featureVisibility.hideObjects(['test']);
      expect(featureVisibility.hiddenObjects)
        .to.have.property('test')
        .and.to.be.a('Set');
    });

    describe('lastUpdated', () => {
      it('should set lastUpdated, if a feature was added', () => {
        featureVisibility.hideObjects(['test']);
        expect(featureVisibility).to.have.property('lastUpdated', now);
      });

      it('should not set lastUpdated, if the feature is already hidden', () => {
        featureVisibility.hideObjects(['test']);
        clock.tick(1);
        featureVisibility.hideObjects(['test']);
        expect(featureVisibility).to.have.property('lastUpdated', now);
      });
    });

    describe('raising of hideIdRequested', () => {
      it('should raise change, if a feature was added', () => {
        const spy = getVcsEventSpy(featureVisibility.changed, sandbox);
        featureVisibility.hideObjects(['test']);
        expect(spy).to.have.been.calledWith({ action: FeatureVisibilityAction.HIDE, ids: ['test'] });
      });

      it('should not raise hideIdRequested, if the feature is already hidden', () => {
        featureVisibility.hideObjects(['test']);
        const spy = getVcsEventSpy(featureVisibility.changed, sandbox);
        featureVisibility.hideObjects(['test']);
        expect(spy).to.not.have.been.called;
      });

      it('should raise the hideIdRequested only for new features', () => {
        featureVisibility.hideObjects(['test']);
        const spy = getVcsEventSpy(featureVisibility.changed, sandbox);
        featureVisibility.hideObjects(['test', 'test1']);
        expect(spy).to.have.been.calledWith({ action: FeatureVisibilityAction.HIDE, ids: ['test1'] });
      });
    });
  });

  describe('showObjects', () => {
    beforeEach(() => {
      featureVisibility.hideObjects(['test']);
    });

    it('should delete the entry for the given id from the hiddenObjects', () => {
      featureVisibility.showObjects(['test']);
      expect(featureVisibility.hiddenObjects).to.not.have.property('test');
    });

    it('should set the Cesium3DTileFeature features show to true, if it exists', () => {
      const features = [createDummyCesium3DTileFeature(), createDummyCesium3DTileFeature()];
      features.forEach((f) => { featureVisibility.addHiddenFeature('test', f); });
      featureVisibility.showObjects(['test']);
      features.forEach((f) => {
        expect(f).to.have.property('show', true);
      });
    });

    it('should set the style to null for ol.Features without a vector style', () => {
      const features = [new Feature(), new Feature()];
      features.forEach((f) => { featureVisibility.addHiddenFeature('test', f); });
      featureVisibility.showObjects(['test']);
      features.forEach((feat) => {
        expect(feat.getStyle()).to.be.null;
      });
    });

    it('should set the style to the vector style for ol.Features with a vector style', () => {
      const features = [new Feature(), new Feature()];
      const style = new VectorStyleItem({});
      features.forEach((f) => {
        f[vectorStyleSymbol] = style;
        f.setStyle(style.style);
        featureVisibility.addHiddenFeature('test', f);
      });
      featureVisibility.showObjects(['test']);
      features.forEach((f) => {
        expect(f.getStyle()).to.equal(style.style);
      });
    });

    it('should not reset the style for globaly hidden ol.Features', () => {
      const feature = new Feature();
      const style = new Style();
      feature.setStyle(style);
      feature[globalHidden] = true;
      featureVisibility.addHiddenFeature('test', feature);
      featureVisibility.showObjects(['test']);
      expect(feature.getStyle()).to.not.equal(style);
    });

    describe('raising the changed event', () => {
      it('should not raise the changed if the id is not hidden', () => {
        const spy = getVcsEventSpy(featureVisibility.changed, sandbox);
        featureVisibility.showObjects(['test1']);
        expect(spy).to.not.have.been.called;
      });

      it('should raise the changed event, if the id was hidden', () => {
        const spy = getVcsEventSpy(featureVisibility.changed, sandbox);
        featureVisibility.showObjects(['test']);
        expect(spy).to.have.been.calledWith({ action: FeatureVisibilityAction.SHOW, ids: ['test'] });
      });
    });

    describe('show highlighted ol.Features', () => {
      let style;
      let feature;

      beforeEach(() => {
        style = new VectorStyleItem({});
        feature = new Feature();
        featureVisibility.addHiddenFeature('test', feature);
        featureVisibility.highlight({ test: style });
        featureVisibility.addHighlightFeature('test', feature);
      });

      it('should set the style to the highlighted style for highlighted features', () => {
        featureVisibility.showObjects(['test']);
        expect(feature.getStyle()).to.equal(style.style);
      });
    });
  });

  describe('clearHiddenObjects', () => {
    it('should remove all entries from the hiddenObjects map', () => {
      const showObject = sandbox.spy(featureVisibility, 'showObjects');
      featureVisibility.hideObjects(['test', 'test1']);
      featureVisibility.clearHiddenObjects();
      expect(featureVisibility.hiddenObjects).to.be.empty;
      expect(showObject).to.have.been.calledWith(['test', 'test1']);
    });
  });

  describe('hiding of features', () => {
    describe('adding of ol.Features to hiding', () => {
      let feature;
      beforeEach(() => {
        feature = new Feature({});
        featureVisibility.hideObjects(['test']);
        featureVisibility.addHiddenFeature('test', feature);
      });

      it('should add the feature to the highlight features', () => {
        expect(featureVisibility.hasHiddenFeature('test', feature)).to.be.true;
      });

      it('should set an empty style clone on the feature', () => {
        const empty = feature.getStyle();
        expect(empty.getFill()).to.be.null;
        expect(empty.getText()).to.be.null;
        expect(empty.getImage()).to.be.null;
        expect(empty.getStroke()).to.be.null;
      });

      it('should set the hidden symbol', () => {
        expect(feature).to.have.property(hidden, true);
      });

      it('should set the originalStyle symbol', () => {
        expect(feature).to.have.property(originalStyle, null);
      });

      it('should not set the originalStyle symbol', () => {
        const style = new Style({});
        feature.setStyle(style);
        featureVisibility.addHighlightFeature('test', feature);
        expect(feature).to.have.property(originalStyle).and.to.not.equal(style);
      });
    });

    describe('adding of CesiumTilesetFeature to highlighting', () => {
      let feature;
      beforeEach(() => {
        feature = createDummyCesium3DTileFeature();
        featureVisibility.hideObjects(['test']);
        featureVisibility.addHiddenFeature('test', feature);
      });

      it('should add the feature to the highlight features', () => {
        expect(featureVisibility.hasHiddenFeature('test', feature)).to.be.true;
      });

      it('should set the show to false on the feature', () => {
        expect(feature.show).to.be.false;
      });

      it('should set the hidden symbol', () => {
        expect(feature).to.have.property(hidden, true);
      });

      it('should set the originalStyle symbol', () => {
        expect(feature).to.have.property(originalStyle).and.to.be.an.instanceOf(Color);
      });

      it('should not reset the originalStyle symbol', () => {
        const color = Color.RED.clone();
        feature[originalStyle] = color;
        feature.color = highlightStyle.cesiumFillColor;
        featureVisibility.addHiddenFeature('test', feature);
        expect(feature).to.have.property(originalStyle, color);
      });
    });
  });
});
