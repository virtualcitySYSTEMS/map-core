import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import axios from 'axios';
import FeatureStore from '../../../../src/vcs/vcm/layer/featureStore.js';
import { featureStoreState, featureStoreStateSymbol } from '../../../../src/vcs/vcm/layer/featureStoreState.js';

function createDummyOlFeature(index) {
  return [...new Array(index).keys()].map((k) => {
    const f = new Feature({
      geometry: new Point([1, 1, 1]),
    });
    f.setId(`id${k}`);
    return f;
  });
}

describe('vcs.vcm.layer.FeatureStore.FeatureStoreChanges', () => {
  let sandbox;
  /** @type {vcs.vcm.layer.FeatureStore} */
  let FSL;
  /** @type {vcs.vcm.layer.FeatureStore.FeatureStoreChanges} */
  let FSC;
  let feature;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  beforeEach(() => {
    FSL = new FeatureStore({});
    FSC = FSL.changeTracker;
    FSC.track();
    feature = new Feature();
    feature.setId('test');
    FSL.injectedFetchDynamicFeatureFunc = () => Promise.resolve({
      state: 'static',
      geometry: { type: 'Point', coordinates: [0, 0, 1] },
      properties: {},
      id: 'test',
      type: 'Feature',
    });
  });

  afterEach(() => {
    FSC.unTrack();
    sandbox.restore();
  });

  describe('track', () => {
    beforeEach(() => {
      FSC.unTrack();
    });

    it(('adds 3 listeners to the layers source'), () => {
      const on = sandbox.spy(FSL.source, 'on');
      FSC.track();
      expect(on).to.have.been.calledThrice;
    });

    it('should not add the listeners twice', () => {
      FSC.track();
      const on = sandbox.spy(FSL.source, 'on');
      FSC.track();
      expect(on).to.not.have.been.called;
    });

    it('should reactivate a paused listener', () => {
      FSC.track();
      FSC._changesListeners.addfeature = null;
      const on = sandbox.spy(FSL.source, 'on');
      FSC.track();
      expect(on).to.have.been.calledOnce;
      expect(FSC._changesListeners.addfeature).to.not.be.null;
    });

    it('should be active after calling track', () => {
      FSC.track();
      expect(FSC.active).to.be.true;
    });
  });

  describe('unTrack', () => {
    it('should remove all listeners', () => {
      FSC.unTrack();
      FSL.addFeatures([new Feature()]);
      expect(FSC.getChanges().add).to.be.empty;
    });

    it('should set the _changesListeners object to null', () => {
      FSC.unTrack();
      expect(Object.values(FSC._changesListeners)).to.have.members([null, null, null]);
    });

    it('should reset the values', () => {
      const _resetValues = sandbox.spy(FSC, '_resetValues');
      FSC.unTrack();
      expect(_resetValues).to.have.been.called;
    });

    it('should not be active after calling unTrack', () => {
      FSC.unTrack();
      expect(FSC.active).to.be.false;
    });
  });

  describe('pauseTracking', () => {
    beforeEach(() => {
      FSC.track();
    });

    it('should unbind the listener for the event', () => {
      const feature1 = new Feature();
      feature1[featureStoreStateSymbol] = featureStoreState.DYNAMIC;
      FSC.pauseTracking('addfeature');
      FSL.addFeatures([feature1]);
      feature1.changed();
      const { add, edit } = FSC.getChanges();
      expect(add).to.be.empty;
      expect(edit).to.have.lengthOf(1);
    });

    it('should set the paused listener to null', () => {
      FSC.pauseTracking('addfeature');
      expect(FSC._changesListeners.addfeature).to.be.null;
    });

    it('should still be active after calling pauseTracking', () => {
      FSC.pauseTracking('addfeature');
      expect(FSC.active).to.be.true;
    });
  });

  describe('adding features', () => {
    it('should add a new feature to the addedFeaturesSet', () => {
      FSL.addFeatures([feature]);
      expect(FSC._addedFeatures.has(feature)).to.be.true;
    });

    it('should set the values.changed to true', () => {
      FSL.addFeatures([feature]);
      expect(FSC.values.changed).to.be.true;
    });

    it('should not add an existing server feature', () => {
      return FSL.switchStaticFeatureToDynamic('test')
        .then((f) => {
          expect(FSC._addedFeatures.has(f)).to.be.false;
        });
    });

    it('should place existing server features into the converted set', () => {
      return FSL.switchStaticFeatureToDynamic('test')
        .then((f) => {
          expect(FSC._convertedFeatures.has(f)).to.be.true;
        });
    });
  });

  describe('editing features', () => {
    it('should not track editing new features', () => {
      FSL.addFeatures([feature]);
      feature.set('test', true);
      expect(FSC._editedFeatures.has(feature)).to.be.false;
    });

    it('should track changes to switched features', () => {
      return FSL.switchStaticFeatureToDynamic('test')
        .then((f) => {
          f.set('test', true);
          expect(FSC._editedFeatures.has(f)).to.be.true;
        });
    });

    it('should remove a previously converted feature from the converted set', () => {
      return FSL.switchStaticFeatureToDynamic('test')
        .then((f) => {
          expect(FSC._convertedFeatures.has(f)).to.be.true;
          f.set('test', true);
          expect(FSC._editedFeatures.has(f)).to.be.true;
          expect(FSC._convertedFeatures.has(f)).to.be.false;
        });
    });
  });

  describe('removing features', () => {
    it('should not track removing new features', () => {
      FSL.addFeatures([feature]);
      FSL.removeFeaturesById(['test']);
      expect(FSC._removedFeatures.has(feature)).to.be.false;
    });

    it('should remove features from _addedFeatures on remove', () => {
      FSL.addFeatures([feature]);
      FSL.removeFeaturesById(['test']);
      expect(FSC._addedFeatures.has(feature)).to.be.false;
    });

    it('should add removed static features to the _removedFeatures Set', () => {
      return FSL.switchStaticFeatureToDynamic('test')
        .then((f) => {
          FSL.removeFeaturesById([f.getId()]);
          expect(FSC._removedFeatures.has(f)).to.be.true;
        });
    });

    it('should remove the feature from the converted features set', () => FSL.switchStaticFeatureToDynamic('test')
      .then((f) => {
        expect(FSC._convertedFeatures.has(f)).to.be.true;
        FSL.removeFeaturesById([f.getId()]);
        expect(FSC._convertedFeatures.has(f)).to.be.false;
      }));

    it('should remove a static feature from the edited set', () => {
      return FSL.switchStaticFeatureToDynamic('test')
        .then((f) => {
          FSL.removeFeaturesById([f.getId()]);
          expect(FSC._editedFeatures.has(f)).to.be.false;
        });
    });
  });

  describe('removeStaticFeature', () => {
    it('should add a proxy feature to the _removedSet _if_ the feature is hiddenStatically', () => {
      return FSL.switchStaticFeatureToDynamic('test')
        .then((f) => {
          FSL.removeStaticFeature(f.getId());
          expect(FSC._removedFeatures.has(f)).to.be.false;
          expect(FSC._removedFeatures.size).to.equal(1);
          const proxy = FSC._removedFeatures.values().next().value;
          expect(proxy).to.be.an.instanceOf(Feature);
          expect(proxy.getId()).to.equal('test');
        });
    });

    it('should not remove a _random_ generated feature', () => {
      FSC.removeFeature(feature);
      expect(FSC._removedFeatures).to.be.empty;
    });
  });

  describe('commitChanges', () => {
    let post;
    let features;
    let changes;

    beforeEach(() => {
      post = sandbox.stub(axios, 'post')
        .resolves({
          data: {
            insertedIds: [],
            failedActions: [],
          },
        });
    });

    afterEach(() => { // it should always clear the values;
      changes = FSC.getChanges();
      Object.values(changes).forEach((array) => {
        expect(array).to.be.empty;
      });
      expect(FSC.values.changed).to.be.false;
    });

    it('should reset converted features', () => {
      features = createDummyOlFeature(1);
      FSC._convertedFeatures.add(features[0]);
      const resetFeature = sandbox.spy(FSC, '_resetFeature');
      return FSC.commitChanges('test')
        .then(() => {
          expect(resetFeature).to.have.been.calledWith(features[0]);
          expect(FSC._convertedFeatures).to.be.empty;
        });
    });

    it('should not call post, if there are no actions', () => {
      return FSC.commitChanges('test')
        .then(() => {
          expect(post).to.not.have.been.called;
        });
    });

    describe('add', () => {
      beforeEach(() => {
        features = createDummyOlFeature(2);
        FSC._addedFeatures.add(features[0]);
        FSC._addedFeatures.add(features[1]);
        post.resolves({
          data: {
            insertedIds: [{ _id: 0 }, { _id: 1 }],
            failedActions: [],
          },
        });
      });

      it('should add an add action for each _addedFeature', () => FSC.commitChanges('test')
        .then(() => {
          expect(post).to.have.been.called;
          const actions = post.getCall(0).args[1];
          expect(actions).to.have.length(2);
          actions.forEach((action) => {
            expect(action).to.have.property('action', 'add');
            expect(action).to.have.property('feature').and.to.be.an('object');
          });
        }));

      it('should set the ID based on the returned insertedIds', () => FSC.commitChanges('test')
        .then(() => {
          features.forEach((f, index) => {
            expect(f.getId()).to.equal(index);
          });
        }));

      it('should set the features type to dynamic', () => FSC.commitChanges('test')
        .then(() => {
          features.forEach((f) => {
            expect(f).to.have.property(featureStoreStateSymbol, featureStoreState.DYNAMIC);
          });
        }));
    });

    describe('edit', () => {
      beforeEach(() => {
        features = createDummyOlFeature(2);
        FSC._editedFeatures.add(features[0]);
        FSC._editedFeatures.add(features[1]);
      });

      it('should set the state symbol for static features to edited', () => {
        features[0][featureStoreStateSymbol] = featureStoreState.STATIC;
        return FSC.commitChanges('test')
          .then(() => {
            expect(features[0]).to.have.property(featureStoreStateSymbol, featureStoreState.EDITED);
          });
      });

      it('should append the feature id as _id', () => FSC.commitChanges('test')
        .then(() => {
          expect(post).to.have.been.called;
          const actions = post.getCall(0).args[1];
          expect(actions).to.have.length(2);
          actions.forEach((action, index) => {
            expect(action).to.have.property('action', 'edit');
            expect(action).to.have.property('feature').and.to.be.an('object').and.to.have.property('_id', `id${index}`);
          });
        }));
    });

    describe('remove', () => {
      it('should send the features ids', () => {
        features = createDummyOlFeature(2);
        FSC._removedFeatures.add(features[0]);
        FSC._removedFeatures.add(features[1]);
        return FSC.commitChanges('test')
          .then(() => {
            expect(post).to.have.been.called;
            const actions = post.getCall(0).args[1];
            expect(actions).to.have.length(2);
            actions.forEach((action, index) => {
              expect(action).to.have.property('action', 'remove');
              expect(action).to.have.property('feature').and.to.be.an('object').and.to.have.property('_id', `id${index}`);
            });
          });
      });
    });

    describe('error handling', () => {
      beforeEach(() => {
        features = createDummyOlFeature(6);
        features[2][featureStoreStateSymbol] = featureStoreState.STATIC;
        features[3][featureStoreStateSymbol] = featureStoreState.STATIC;
        FSC._addedFeatures.add(features[0]);
        FSC._addedFeatures.add(features[1]);
        FSC._editedFeatures.add(features[2]);
        FSC._editedFeatures.add(features[3]);
        FSC._removedFeatures.add(features[4]);
        FSC._removedFeatures.add(features[5]);
        post.resolves({
          data: {
            insertedIds: [{ _id: 'test1' }],
            failedActions: [{ index: 0, error: 'error' }, { index: 2, error: 'error' }, { index: 4, error: 'error' }],
          },
        });
      });

      it('should only succeed non-failed features', () => FSC.commitChanges('test')
        .then(() => {
          expect(features[0].getId()).to.equal('id0');
          expect(features[1].getId()).to.equal('test1');
          expect(features[2]).to.have.property(featureStoreStateSymbol, featureStoreState.STATIC);
          expect(features[3]).to.have.property(featureStoreStateSymbol, featureStoreState.EDITED);
        }));

      it('should reset failed features', () => {
        const resetFeatures = sandbox.spy(FSC, '_resetFeature');
        return FSC.commitChanges('test')
          .then(() => {
            expect(resetFeatures).to.have.been.calledThrice;
            [0, 2, 4].forEach((fIndex, index) => {
              const call = resetFeatures.getCall(index);
              expect(call).to.have.been.calledWith(features[fIndex]);
            });
          });
      });
    });
  });

  describe('reset', () => {
    let features;
    beforeEach(() => {
      features = createDummyOlFeature(4);
      FSC._addedFeatures.add(features[0]);
      FSC._editedFeatures.add(features[1]);
      FSC._removedFeatures.add(features[2]);
      FSC._convertedFeatures.add(features[3]);
    });

    it('should reset every changes features', () => {
      const resetFeature = sandbox.spy(FSC, '_resetFeature');
      return FSC.reset()
        .then(() => {
          expect(resetFeature.getCalls()).to.have.length(4);
          features.forEach((f) => {
            expect(resetFeature).to.have.been.calledWith(f);
          });
        });
    });

    it('should reset the values', () => {
      FSC.values.changed = true;
      return FSC.reset()
        .then(() => {
          const changes = FSC.getChanges();
          Object.values(changes).forEach((array) => { expect(array).to.be.empty; });
          expect(FSC.values.changed).to.be.false;
        });
    });
  });

  describe('_resetFeature', () => {
    beforeEach(() => {
      FSC.layer.addFeatures([feature]);
    });

    describe('feature without state symbol - aka freshly added', () => {
      it('should remove the feature from the layer', () => FSC._resetFeature(feature)
        .then(() => {
          expect(FSC.layer.getFeatures()).to.be.empty;
        }));
    });

    describe('static features - aka freshly edited', () => {
      beforeEach(() => {
        feature[featureStoreStateSymbol] = featureStoreState.STATIC;
        FSC.layer.hiddenStaticFeatureIds.add(feature.getId());
      });

      it('should remove the feature from the layer', () => FSC._resetFeature(feature)
        .then(() => {
          expect(FSC.layer.getFeatures()).to.be.empty;
        }));

      it('should call resetFeature with the id', async () => {
        const resetStaticFeature = sandbox.spy(FSC.layer, 'resetStaticFeature');
        await FSC._resetFeature(feature);
        expect(resetStaticFeature).to.have.been.calledOnce;
      });
    });

    describe('edited features', () => {
      beforeEach(() => {
        feature[featureStoreStateSymbol] = featureStoreState.EDITED;
      });

      it('should reset the feature on the layer', () => FSC._resetFeature(feature)
        .then(() => {
          const returned = FSC.layer.getFeatureById(feature.getId());
          expect(returned).to.be.an.instanceof(Feature);
          expect(returned).to.not.equal(feature);
        }));
    });
  });
});
