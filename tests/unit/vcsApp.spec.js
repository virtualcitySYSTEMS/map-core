import VectorLayer from '../../src/layer/vectorLayer.js';
import Viewpoint from '../../src/util/viewpoint.js';
import Context from '../../src/context.js';
import OpenlayersMap from '../../src/map/openlayersMap.js';
import VcsApp from '../../src/vcsApp.js';

describe('vcsApp', () => {
  describe('adding of a context', () => {
    describe('normal', () => {
      let context;
      /** @type {VcsApp} */
      let app;
      /** @type {Viewpoint} */
      let startingVp;
      let added;

      before(async () => {
        startingVp = new Viewpoint({ name: 'foo', groundPosition: [13, 52], distance: 200 });
        context = new Context({
          layers: [
            new VectorLayer({ name: 'foo' }).toJSON(),
            new VectorLayer({ name: 'bar', activeOnStartup: true }).toJSON(),
          ],
          viewpoints: [
            new Viewpoint({}).toJSON(),
            startingVp.toJSON(),
          ],
          maps: [
            new OpenlayersMap({ name: 'foo' }).toJSON(),
          ],
          startingViewpointName: 'foo',
          startingMapName: 'foo',
        });
        app = new VcsApp();
        added = sinon.spy();
        app.contextAdded.addEventListener(added);
        await app.addContext(context);
      });

      after(() => {
        app.destroy();
      });

      it('should add the context', () => {
        expect(app.getContextById(context.id)).to.equal(context);
      });

      it('should raise the contextAdded event', () => {
        expect(added).to.have.been.called;
      });

      it('should add the contexts resources', () => {
        expect(app.layers.hasKey('foo')).to.be.true;
        expect(app.layers.hasKey('bar')).to.be.true;
        expect(app.maps.hasKey('foo')).to.be.true;
        expect(app.viewpoints.hasKey('foo')).to.be.true;
      });

      it('should load layers which are active on startup', () => {
        const layer = app.layers.getByKey('bar');
        expect(layer).to.be.an.instanceOf(VectorLayer);
        expect(layer.active || layer.loading).to.be.true; // we do not wait for layers. so all good _as long as its not inactive_
      });

      it('should activate the starting map', () => {
        expect(app.maps.activeMap).to.have.property('name', 'foo');
      });

      it('should activate the starting view point', () => {
        const vp = app.maps.activeMap.getViewpointSync();
        expect(vp.equals(startingVp, 10e-8)).to.be.true;
      });
    });

    describe('adding of a second context', () => {
      let context;
      /** @type {VcsApp} */
      let app;
      /** @type {Viewpoint} */
      let startingVp;
      let added;

      before(async () => {
        startingVp = new Viewpoint({ name: 'foo', groundPosition: [13, 52], distance: 200 });
        const initialContext = new Context({
          layers: [
            new VectorLayer({ name: 'foo' }).toJSON(),
            new VectorLayer({ name: 'bar', activeOnStartup: true }).toJSON(),
          ],
          viewpoints: [
            new Viewpoint({}).toJSON(),
            startingVp.toJSON(),
          ],
          maps: [
            new OpenlayersMap({ name: 'foo' }).toJSON(),
          ],
          startingViewpointName: 'foo',
          startingMapName: 'foo',
        });
        context = new Context({
          layers: [
            new VectorLayer({ name: 'foo', activeOnStartup: true }).toJSON(),
            new VectorLayer({ name: 'baz', activeOnStartup: false }).toJSON(),
          ],
        });

        app = new VcsApp();
        added = sinon.spy();
        app.contextAdded.addEventListener(added);
        await app.addContext(initialContext);
        app.layers.getByKey('bar').deactivate();
        await app.addContext(context);
      });

      after(() => {
        app.destroy();
      });

      it('should add the context', () => {
        expect(app.getContextById(context.id)).to.equal(context);
      });

      it('should raise the contextAdded event', () => {
        expect(added).to.have.been.calledTwice;
      });

      it('should add the contexts resources', () => {
        expect(app.layers.hasKey('foo')).to.be.true;
        expect(app.layers.hasKey('baz')).to.be.true;
      });

      it('should load layers which are active on startup', () => {
        const layer = app.layers.getByKey('foo');
        expect(layer).to.be.an.instanceOf(VectorLayer);
        expect(layer.active || layer.loading).to.be.true; // we do not wait for layers. so all good _as long as its not inactive_
      });

      it('should not load layers which are active on startup and not in the current context', () => {
        const layer = app.layers.getByKey('bar');
        expect(layer).to.be.an.instanceOf(VectorLayer);
        expect(layer.active || layer.loading).to.be.false; // we do not wait for layers. so all good _as long as its not inactive_
      });
    });

    describe('without an active map name', () => {
      let context;
      /** @type {VcsApp} */
      let app;
      /** @type {Viewpoint} */
      let startingVp;

      before(async () => {
        startingVp = new Viewpoint({ name: 'foo', groundPosition: [13, 52], distance: 200 });
        context = new Context({
          layers: [
            new VectorLayer({ name: 'foo' }).toJSON(),
            new VectorLayer({ name: 'bar', activeOnStartup: true }).toJSON(),
          ],
          viewpoints: [
            new Viewpoint({}).toJSON(),
            startingVp.toJSON(),
          ],
          maps: [
            new OpenlayersMap({ name: 'foo' }).toJSON(),
            new OpenlayersMap({ name: 'bar' }).toJSON(),
          ],
          startingViewpointName: 'foo',
          startingMapName: 'foo',
        });
        app = new VcsApp();
        await app.addContext(context);
      });

      after(() => {
        app.destroy();
      });

      it('should activate the first map', () => {
        expect(app.maps.activeMap).to.have.property('name', 'foo');
      });
    });

    describe('if activating the same context twice', () => {
      let context;
      /** @type {VcsApp} */
      let app;
      /** @type {Viewpoint} */
      let startingVp;
      let added;

      before(async () => {
        startingVp = new Viewpoint({ name: 'foo', groundPosition: [13, 52], distance: 200 });
        context = new Context({
          layers: [
            new VectorLayer({ name: 'foo' }).toJSON(),
            new VectorLayer({ name: 'bar', activeOnStartup: true }).toJSON(),
          ],
          viewpoints: [
            new Viewpoint({}).toJSON(),
            startingVp.toJSON(),
          ],
          maps: [
            new OpenlayersMap({ name: 'foo' }).toJSON(),
          ],
          startingViewpointName: 'foo',
          startingMapName: 'foo',
        });
        app = new VcsApp();
        added = sinon.spy();
        app.contextAdded.addEventListener(added);
        app.addContext(context);
        await app.addContext(context);
      });

      after(() => {
        app.destroy();
      });

      it('should add the context once', () => {
        expect(app.getContextById(context.id)).to.equal(context);
      });

      it('should raise the contextAdded event once', () => {
        expect(added).to.have.been.calledOnce;
      });

      it('should add the contexts resources', () => {
        expect(app.layers.hasKey('foo')).to.be.true;
        expect(app.layers.hasKey('bar')).to.be.true;
        expect(app.maps.hasKey('foo')).to.be.true;
        expect(app.viewpoints.hasKey('foo')).to.be.true;
      });

      it('should load layers which are active on startup', () => {
        const layer = app.layers.getByKey('bar');
        expect(layer).to.be.an.instanceOf(VectorLayer);
        expect(layer.active || layer.loading).to.be.true; // we do not wait for layers. so all good _as long as its not inactive_
      });

      it('should activate the starting map', () => {
        expect(app.maps.activeMap).to.have.property('name', 'foo');
      });

      it('should activate the starting view point', () => {
        const vp = app.maps.activeMap.getViewpointSync();
        expect(vp.equals(startingVp, 10e-8)).to.be.true;
      });
    });
  });

  describe('removing a context', () => {
    describe('normal', () => {
      let context;
      /** @type {VcsApp} */
      let app;
      /** @type {Viewpoint} */
      let startingVp;
      let removed;

      before(async () => {
        startingVp = new Viewpoint({ name: 'foo', groundPosition: [13, 52], distance: 200 });
        context = new Context({
          layers: [
            new VectorLayer({ name: 'foo' }).toJSON(),
            new VectorLayer({ name: 'bar', activeOnStartup: true }).toJSON(),
          ],
          viewpoints: [
            new Viewpoint({}).toJSON(),
            startingVp.toJSON(),
          ],
          maps: [
            new OpenlayersMap({ name: 'foo' }).toJSON(),
          ],
          startingViewpointName: 'foo',
          startingMapName: 'foo',
        });
        app = new VcsApp();
        removed = sinon.spy();
        app.contextRemoved.addEventListener(removed);
        await app.addContext(context);
        await app.removeContext(context.id);
      });

      after(() => {
        app.destroy();
      });

      it('should remove the context', () => {
        expect(app.getContextById(context.id)).to.be.undefined;
      });

      it('should raise the contextRemoved event', () => {
        expect(removed).to.have.been.called;
      });

      it('should remove the contexts resources', () => {
        expect([...app.layers]).to.be.empty;
        expect([...app.maps]).to.be.empty;
        expect([...app.viewpoints]).to.be.empty;
      });
    });

    describe('if removing the same context twice', () => {
      let context;
      /** @type {VcsApp} */
      let app;
      /** @type {Viewpoint} */
      let startingVp;
      let removed;

      before(async () => {
        startingVp = new Viewpoint({ name: 'foo', groundPosition: [13, 52], distance: 200 });
        context = new Context({
          layers: [
            new VectorLayer({ name: 'foo' }).toJSON(),
            new VectorLayer({ name: 'bar', activeOnStartup: true }).toJSON(),
          ],
          viewpoints: [
            new Viewpoint({}).toJSON(),
            startingVp.toJSON(),
          ],
          maps: [
            new OpenlayersMap({ name: 'foo' }).toJSON(),
          ],
          startingViewpointName: 'foo',
          startingMapName: 'foo',
        });
        app = new VcsApp();
        removed = sinon.spy();
        app.contextRemoved.addEventListener(removed);
        await app.addContext(context);
        await app.removeContext(context.id);
      });

      after(() => {
        app.destroy();
      });

      it('should remove the context', () => {
        expect(app.getContextById(context.id)).to.be.undefined;
      });

      it('should raise the contextRemoved event once', () => {
        expect(removed).to.have.been.calledOnce;
      });

      it('should remove the contexts resources', () => {
        expect([...app.layers]).to.be.empty;
        expect([...app.maps]).to.be.empty;
        expect([...app.viewpoints]).to.be.empty;
      });
    });
  });

  describe('locale', () => {
    /** @type {VcsApp} */
    let app;

    before(() => {
      app = new VcsApp();
    });

    after(() => {
      app.destroy();
    });

    it('should synchronize the app.locale with the layerCollection locale', () => {
      expect(app.locale).to.be.equal(app.layers.locale);
    });

    it('should synchronize changes to the app.locale with the layerCollection', () => {
      app.locale = 'fr';
      expect(app.layers.locale).to.be.equal('fr');
    });

    it('should not change the locale if the locale is not valid', () => {
      app.locale = 'test';
      expect(app.locale).to.not.be.equal('test');
    });
  });
});
