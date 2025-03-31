import { ClassificationType, HeightReference } from '@vcmap-cesium/engine';
import Feature from 'ol/Feature.js';
import { fromExtent } from 'ol/geom/Polygon.js';
import Style from 'ol/style/Style.js';

import nock from 'nock';
import FeatureStoreLayer, {
  isTiledFeature,
} from '../../../src/layer/featureStoreLayer.js';
import VcsApp from '../../../src/vcsApp.js';
import VectorStyleItem, {
  vectorStyleSymbol,
  defaultVectorStyle,
} from '../../../src/style/vectorStyleItem.js';
import { featureStoreStateSymbol } from '../../../src/layer/featureStoreLayerState.js';
import DeclarativeStyleItem from '../../../src/style/declarativeStyleItem.js';
import '../../../src/layer/cesium/cesiumTilesetCesiumImpl.js';
import {
  createTilesetServer,
  getVcsEventSpy,
  setCesiumMap,
} from '../helpers/cesiumHelpers.js';
import { setOpenlayersMap } from '../helpers/openlayersHelpers.js';
import { vcsLayerName } from '../../../src/layer/layerSymbols.js';
import Extent from '../../../src/util/extent.js';
import { wgs84Projection } from '../../../src/util/projection.js';
import importJSON from '../helpers/importJSON.js';
import { vcsMetaVersion } from '../../../src/layer/vectorProperties.js';

const testGeoJSON = await importJSON('./tests/data/testGeoJSON.json');

describe('FeatureStoreLayer', () => {
  /** @type {import("@vcmap/core").FeatureStoreLayer} */
  let FS;
  let app;
  let cesiumMap;
  let openlayer;
  let sandbox;
  let featureStyle;

  function setupStaticTwoDim() {
    const features = [new Feature()];

    const withStyle = new Feature();
    withStyle[vectorStyleSymbol] = featureStyle;
    features.push(withStyle);

    FS._twoDimStaticSource.addFeatures(features);
    FS._twoDimLoaded = Promise.resolve();
    FS.staticRepresentation.twoDim = 'foo';
    return features;
  }

  before(async () => {
    sandbox = sinon.createSandbox();
    app = new VcsApp();
    cesiumMap = await setCesiumMap(app);
    cesiumMap.setTarget('mapContainer');
    openlayer = await setOpenlayersMap(app);
    featureStyle = new VectorStyleItem({});
  });

  beforeEach(() => {
    FS = new FeatureStoreLayer({});
  });

  afterEach(() => {
    FS.destroy();
    sandbox.restore();
  });

  after(() => {
    featureStyle.destroy();
    app.destroy();
  });

  describe('constructor', () => {
    it('should add dynamic features if present', () => {
      FS = new FeatureStoreLayer(testGeoJSON.featureCollection);
      expect(FS.getFeatures()).to.have.length(
        testGeoJSON.featureCollection.features.length,
      );
    });

    it('should set the vcsMeta options', () => {
      FS = new FeatureStoreLayer({
        vcsMeta: {
          skirt: 5,
          classificationType: 'both',
          altitudeMode: 'absolute',
        },
      });
      expect(FS.vectorProperties).to.have.property('skirt', 5);
      expect(FS.vectorProperties).to.have.property(
        'classificationType',
        ClassificationType.BOTH,
      );
      expect(FS.vectorProperties).to.have.property(
        'altitudeMode',
        HeightReference.NONE,
      );
    });

    it('should set the defaultStyle based on vcsMeta', () => {
      const styledFC = {
        features: testGeoJSON.featureCollection.features,
        vcsMeta: {
          style: { fill: { color: [255, 0, 255, 1] } },
        },
      };
      const setStyle = sandbox.spy(FeatureStoreLayer.prototype, 'setStyle');
      FS = new FeatureStoreLayer(styledFC);
      expect(setStyle).to.have.been.called;
      const styleItem = setStyle.getCall(0).args[0];
      expect(styleItem.fillColor).to.have.members([255, 0, 255, 1]);
      expect(FS).to.have.property('defaultStyle', styleItem);
    });
  });

  describe('initialize', () => {
    it('should set the initialized property to true', async () => {
      await FS.initialize();
      expect(FS.initialized).to.be.true;
    });

    it('should only hide dynamic features, if the layer has not bee initialized before', async () => {
      const hideObjects = sandbox.spy(
        FS._staticFeatureVisibility,
        'hideObjects',
      );
      await FS.initialize();
      await FS.initialize();
      expect(hideObjects).to.have.been.calledOnce;
    });

    it('should hide all static hiddenStaticFeatures', async () => {
      const ids = [1, 2, 3, 4];
      FS.hiddenStaticFeatureIds = new Set(ids);
      await FS.initialize();
      expect(FS._staticFeatureVisibility.hiddenObjects).to.have.keys(ids);
    });
  });

  describe('activate', () => {
    before(async () => {
      await app.maps.setActiveMap(cesiumMap.name);
    });

    after(async () => {
      await app.maps.setActiveMap(openlayer.name);
    });

    it('should call setEditing, if an editing symbol has been cached for the cesium impl', () => {
      FS._setEditing = { symbol: 'test', featureType: 'test' };
      const setEditing = sandbox.spy(FS, 'setEditing');
      return FS.activate().then(() => {
        expect(setEditing).to.have.been.calledWith('test', 'test');
      });
    });

    describe('layer cancelled', () => {
      let promise;
      let resolve;

      beforeEach(() => {
        promise = new Promise((res) => {
          resolve = res;
        });
        sandbox.stub(FS, 'initialize').returns(promise);
      });

      it('should not set editing', () => {
        FS._setEditing = { symbol: 'test', featureType: 'test' };
        const setEditing = sandbox.spy(FS, 'setEditing');
        FS.activate();
        FS.deactivate();
        resolve();
        return promise.then(() => {
          expect(setEditing).to.not.have.been.called;
        });
      });
    });
  });

  describe('setStyle', () => {
    it('should pause and unpause changeTracker', () => {
      FS.changeTracker.track();
      const pauseTracking = sandbox.spy(FS.changeTracker, 'pauseTracking');
      FS.setStyle(new VectorStyleItem({}));
      expect(pauseTracking).to.have.been.calledWith('changefeature');
      expect(FS.changeTracker._changesListeners.changefeature).to.not.be.null;
    });

    it('should set the changes to true', () => {
      FS.changeTracker.track();
      const spy = getVcsEventSpy(FS.changeTracker.changed, sandbox);
      FS.setStyle(new VectorStyleItem({}));
      expect(spy).to.have.been.calledOnce;
    });

    it('should set the features style, if the style on the feature is not the features style', () => {
      const features = setupStaticTwoDim();
      FS.setStyle(new VectorStyleItem({}));
      expect(features[1].getStyle()).to.be.an.instanceof(Style);
      expect(features[1].getStyle()).to.equal(
        features[1][vectorStyleSymbol].style,
      );
    });

    it('should track style changes on two dim features', (done) => {
      const features = setupStaticTwoDim();
      const style = new VectorStyleItem({});
      FS.setStyle(style);

      features[0].once('change', () => {
        done();
      });
      style.fillColor = '#FF00FF';
    });
  });

  describe('getZoomToExtent', () => {
    let extent;
    let feature;

    before(() => {
      extent = [0, 0, 1, 1];
      feature = new Feature({
        geometry: fromExtent(extent),
      });
    });

    beforeEach(() => {
      FS.addFeatures([feature]);
    });

    it('should return the extent of all the dynamic features', () => {
      const vcsExtent = FS.getZoomToExtent();
      expect(vcsExtent.extent).to.have.members(extent);
    });

    it('should extend the extent with the extent of the static layer', async () => {
      createTilesetServer(sandbox);
      FS.staticRepresentation.threeDim = 'http://test.com/tileset.json';
      const [, impl] = FS.getImplementationsForMap(cesiumMap);
      await impl.initialize();
      const vcsExtent = FS.getZoomToExtent();
      expect(vcsExtent.extent).to.have.members([
        0, 0, 1490216.2986333761, 6893720.808671028,
      ]);
    });

    it('should return the configured extent', () => {
      FS.extent = new Extent({
        projection: wgs84Projection.toJSON(),
        coordinates: [2, 2, 5, 5],
      });
      const vcsExtent = FS.getZoomToExtent();
      expect(vcsExtent.extent).to.have.ordered.members([2, 2, 5, 5]);
    });
  });

  describe('setEditing', () => {
    let impl;

    beforeEach(() => {
      createTilesetServer(sandbox);
      FS.staticRepresentation.threeDim = 'http://test.com/tileset.json';
      [, impl] = FS.getImplementationsForMap(cesiumMap);
    });

    it('should set the editing symbol and featureType on the static impl', async () => {
      await impl.initialize();
      FS.setEditing('test', 'test');
      expect(impl.cesium3DTileset).to.have.property('test', 'test');
    });

    it('should delete a previously set symbol, if featureType is empty', async () => {
      await impl.initialize();
      impl.cesium3DTileset.test = true;
      FS.setEditing('test');
      expect(impl.cesium3DTileset).to.not.have.property('test');
    });

    it('should cache both symbol and featureType, if the impl is not ready', () => {
      FS.setEditing('test', 'test');
      expect(FS._setEditing).to.have.property('symbol', 'test');
      expect(FS._setEditing).to.have.property('featureType', 'test');
    });

    describe('twoDim', () => {
      it('should set the symbol', async () => {
        const features = setupStaticTwoDim();
        FS.setEditing('test', 'test');
        await FS._twoDimLoaded;
        features.forEach((f) => {
          expect(f).to.have.property('test', 'test');
        });
      });

      it('should cache both symbol and featureType, if not yet loaded', () => {
        FS.staticRepresentation.twoDim = 'foo';
        FS.setEditing('test', 'test');
        expect(FS._setEditing).to.have.property('symbol', 'test');
        expect(FS._setEditing).to.have.property('featureType', 'test');
      });

      it('should wait for the layer to be loaded', async () => {
        const features = setupStaticTwoDim();
        let resolve;
        const promise = new Promise((r) => {
          resolve = r;
        });
        FS._twoDimLoaded = promise;
        FS.setEditing('test', 'test');
        features.forEach((f) => {
          expect(f).to.not.have.property('test');
        });
        resolve();
        await promise;
        features.forEach((f) => {
          expect(f).to.have.property('test', 'test');
        });
      });
    });
  });

  describe('hideObjects', () => {
    it('should hide objects on both the dynamic and static features', () => {
      FS.featureVisibility.hideObjects(['test', 'test2']);
      function testFV(FV) {
        expect(FV.hiddenObjects).to.have.property('test');
        expect(FV.hiddenObjects).to.have.property('test2');
      }
      testFV(FS.featureVisibility);
      testFV(FS._staticFeatureVisibility);
    });
  });

  describe('showingObjects', () => {
    beforeEach(() => {
      FS.featureVisibility.hideObjects(['test', 'test2']);
    });

    describe('showObjects', () => {
      it('should show features both dynamic and static', () => {
        FS.featureVisibility.showObjects(['test2']);
        function testFV(FV) {
          expect(FV.hiddenObjects).to.have.property('test');
          expect(FV.hiddenObjects).to.not.have.property('test2');
        }
        testFV(FS.featureVisibility);
        testFV(FS._staticFeatureVisibility);
      });

      it('should not show hiddenStaticFeatures on the static layer', () => {
        FS.hiddenStaticFeatureIds.add('test2');
        FS.featureVisibility.showObjects(['test2']);

        expect(FS.featureVisibility.hiddenObjects).to.not.have.property(
          'test2',
        );
        expect(FS._staticFeatureVisibility.hiddenObjects).to.have.property(
          'test2',
        );
      });
    });

    describe('clearHiddenObjects', () => {
      it('should show all features on both layers', () => {
        FS.featureVisibility.clearHiddenObjects();
        expect(FS.featureVisibility.hiddenObjects).to.be.empty;
        expect(FS._staticFeatureVisibility.hiddenObjects).to.be.empty;
      });

      it('should not show hiddenStaticFeatures', () => {
        FS.hiddenStaticFeatureIds.add('test2');
        FS.featureVisibility.clearHiddenObjects();
        expect(FS.featureVisibility.hiddenObjects).to.be.empty;
        expect(FS._staticFeatureVisibility.hiddenObjects).to.have.property(
          'test2',
        );
      });
    });
  });

  describe('switchStaticFeatureToDynamic', () => {
    let feature;

    beforeEach(() => {
      feature = {
        state: 'static',
        geometry: { type: 'Point', coordinates: [0, 0, 1] },
        properties: {},
        id: 'test',
        type: 'Feature',
      };
      FS.injectedFetchDynamicFeatureFunc = () => Promise.resolve(feature);
    });

    it('should return the parsed feature', () =>
      FS.switchStaticFeatureToDynamic('test').then((f) => {
        expect(f).to.be.an.instanceOf(Feature);
        expect(f.getId()).to.equal('test');
      }));

    it('should add the feature to the source', () =>
      FS.switchStaticFeatureToDynamic('test').then((f) => {
        expect(FS.getFeatureById('test')).to.equal(f);
      }));

    it('should extend a feature style with the layer defaultStyle', () => {
      feature.vcsMeta = { style: { stroke: { width: 5, fill: '#FF00FF' } } };
      FS.defaultStyle.fillColor = '#00FF00';
      return FS.switchStaticFeatureToDynamic('test').then((f) => {
        expect(f).to.have.property(vectorStyleSymbol);
        expect(f[vectorStyleSymbol])
          .to.have.property('fillColor')
          .and.to.have.members(FS.defaultStyle.fillColor);
      });
    });

    it('should extend the feature style with the default style, if the defaultLayer style is no a VectorStyleItem', () => {
      feature.vcsMeta = { style: { stroke: { width: 5, fill: '#FF00FF' } } };
      FS._defaultStyle = new DeclarativeStyleItem({});
      return FS.switchStaticFeatureToDynamic('test').then((f) => {
        expect(f).to.have.property(vectorStyleSymbol);
        expect(f[vectorStyleSymbol])
          .to.have.property('fillColor')
          .and.to.have.members(defaultVectorStyle.fillColor);
      });
    });

    it('should not add a style symbol by default', () =>
      FS.switchStaticFeatureToDynamic('test').then((f) => {
        expect(f).to.not.have.property(vectorStyleSymbol);
      }));

    it('should add the features id to the hiddenStaticFeatures and hide it on the static layer', () =>
      FS.switchStaticFeatureToDynamic('test').then(() => {
        expect(FS.hiddenStaticFeatureIds.has('test')).to.be.true;
        expect(FS._staticFeatureVisibility.hiddenObjects).to.have.property(
          'test',
        );
      }));

    it('should return an already hiddenStaticFeature from source', () => {
      const existingFeature = new Feature();
      existingFeature.setId('test');
      FS.addFeatures([existingFeature]);
      FS.hiddenStaticFeatureIds.add('test');
      const getById = sandbox.spy(FS, 'injectedFetchDynamicFeatureFunc');
      return FS.switchStaticFeatureToDynamic('test').then((f) => {
        expect(f).to.equal(existingFeature);
        expect(getById).to.not.have.been.called;
      });
    });
  });

  describe('removeStaticFeature', () => {
    it('should hide the static feature and add the id to the hiddenStaticFeatures', () => {
      FS.removeStaticFeature('test');
      expect(FS.hiddenStaticFeatureIds.has('test')).to.be.true;
      expect(FS._staticFeatureVisibility.hiddenObjects).to.have.property(
        'test',
      );
    });

    it('should add a feature to the changeTracker as removed', () => {
      FS.removeStaticFeature('test');
      expect(FS.changeTracker._removedFeatures.size).to.equal(1);
    });

    it('should set the removed features id and state symbol with static state', () => {
      FS.removeStaticFeature('test');
      const feature = FS.changeTracker._removedFeatures.values().next().value;
      expect(feature).to.be.an.instanceOf(Feature);
      expect(feature.getId()).to.equal('test');
      expect(feature).to.have.property(featureStoreStateSymbol, 'static');
    });
  });

  describe('resetting a static feature', () => {
    beforeEach(() => {
      FS.removeStaticFeature('test');
    });

    it('should remove the feature from the hiddenStaticFeatures set', () => {
      FS.resetStaticFeature('test');
      expect(FS.hiddenStaticFeatureIds.has('test')).to.be.false;
    });

    it('should show the static feature', () => {
      FS.resetStaticFeature('test');
      expect(FS._staticFeatureVisibility.hiddenObjects).to.not.have.property(
        'test',
      );
    });

    it('should not show the static feature, if it is hidden by the layers featureVisibility', () => {
      FS.featureVisibility.hideObjects(['test']);
      FS.resetStaticFeature('test');
      expect(FS._staticFeatureVisibility.hiddenObjects).to.have.property(
        'test',
      );
    });

    it('should remove an associated feature', () => {
      const feature = new Feature();
      feature.setId('test');
      FS.addFeatures([feature]);
      FS.resetStaticFeature('test');
      expect(FS.getFeatureById('test')).to.be.null;
    });

    it('should not remove feature with the id, if they are not statically hidden', () => {
      const feature = new Feature();
      feature.setId('test1');
      FS.addFeatures([feature]);
      FS.resetStaticFeature('test1');
      expect(FS.getFeatureById('test1')).to.equal(feature);
    });
  });

  describe('getting a config', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const config = FS.toJSON();
        expect(config).to.have.all.keys('name', 'type');
      });
    });

    describe('of a configured layer', () => {
      let inputConfig;
      let outputConfig;
      let configuredLayer;

      before(() => {
        inputConfig = {
          vcsMeta: {
            skirt: 3,
            screenSpaceError: 3,
            version: vcsMetaVersion,
          },
          staticRepresentation: {
            threeDim: 'localhost',
          },
          hiddenStaticFeatureIds: ['one', 'two'],
        };
        configuredLayer = new FeatureStoreLayer(inputConfig);
        outputConfig = configuredLayer.toJSON();
      });

      after(() => {
        configuredLayer.destroy();
      });

      it('should configure vcsMeta', () => {
        expect(outputConfig)
          .to.have.property('vcsMeta')
          .and.to.eql(inputConfig.vcsMeta);
      });

      it('should configure staticRepresentation', () => {
        expect(outputConfig)
          .to.have.property('staticRepresentation')
          .and.to.eql(inputConfig.staticRepresentation);
      });

      it('should configure hiddenStaticFeatureIds', () => {
        expect(outputConfig)
          .to.have.property('hiddenStaticFeatureIds')
          .and.to.eql(inputConfig.hiddenStaticFeatureIds);
      });
    });
  });

  describe('loading of 2D static data', () => {
    let featureStore;
    let scope;

    before(async () => {
      scope = nock('http://myFeatureProvider')
        .get('/static.json')
        .reply(200, JSON.stringify(testGeoJSON.featureCollection));

      featureStore = new FeatureStoreLayer({
        staticRepresentation: {
          twoDim: 'http://myFeatureProvider/static.json',
        },
      });
      await featureStore._loadTwoDim();
    });

    after(() => {
      featureStore.destroy();
      nock.cleanAll();
    });

    afterEach(() => scope.done());

    it('should load all features into the static feature source', () => {
      expect(featureStore._twoDimStaticSource.getFeatures()).to.have.lengthOf(
        2,
      );
    });

    it('should set the vcsLayerName on all features', () => {
      featureStore._twoDimStaticSource.getFeatures().forEach((f) => {
        expect(f).to.have.property(vcsLayerName, featureStore.name);
      });
    });

    it('should set the `isTiled` symbol', () => {
      featureStore._twoDimStaticSource.getFeatures().forEach((f) => {
        expect(f).to.have.property(isTiledFeature, true);
      });
    });
  });

  describe('destroy', () => {
    it('should clear all features', () => {
      FS.addFeatures([new Feature(), new Feature()]);
      FS.destroy();
      expect(FS.getFeatures()).to.be.empty;
    });

    it('should destroy the _staticFeatureVisibility', () => {
      const destroy = sandbox.spy(FS._staticFeatureVisibility, 'destroy');
      FS.destroy();
      expect(destroy).to.have.been.called;
    });
  });
});
