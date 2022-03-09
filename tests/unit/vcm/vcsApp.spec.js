import { ViewPoint, Context, Vector, Openlayers, VcsApp } from '../../../index.js';

describe('vcsApp', () => {
  describe('adding of a context', () => {
    describe('normal', () => {
      let context;
      /** @type {VcsApp} */
      let app;
      /** @type {ViewPoint} */
      let startingVp;
      let added;

      before(async () => {
        startingVp = new ViewPoint({ name: 'foo', groundPosition: [13, 52], distance: 200 });
        context = new Context({
          layers: [
            new Vector({ name: 'foo' }).toJSON(),
            new Vector({ name: 'bar', activeOnStartup: true }).toJSON(),
          ],
          viewpoints: [
            new ViewPoint({}).toJSON(),
            startingVp.toJSON(),
          ],
          maps: [
            new Openlayers({ name: 'foo' }).toJSON(),
          ],
          startingViewPointName: 'foo',
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
        expect(app.viewPoints.hasKey('foo')).to.be.true;
      });

      it('should load layers which are active on startup', () => {
        const layer = app.layers.getByKey('bar');
        expect(layer).to.be.an.instanceOf(Vector);
        expect(layer.active || layer.loading).to.be.true; // we do not wait for layers. so all good _as long as its not inactive_
      });

      it('should activate the starting map', () => {
        expect(app.maps.activeMap).to.have.property('name', 'foo');
      });

      it('should activate the starting view point', () => {
        const vp = app.maps.activeMap.getViewPointSync();
        expect(vp.equals(startingVp, 10e-8)).to.be.true;
      });
    });

    describe('adding of a second context', () => {
      let context;
      /** @type {VcsApp} */
      let app;
      /** @type {ViewPoint} */
      let startingVp;
      let added;

      before(async () => {
        startingVp = new ViewPoint({ name: 'foo', groundPosition: [13, 52], distance: 200 });
        const initialContext = new Context({
          layers: [
            new Vector({ name: 'foo' }).toJSON(),
            new Vector({ name: 'bar', activeOnStartup: true }).toJSON(),
          ],
          viewpoints: [
            new ViewPoint({}).toJSON(),
            startingVp.toJSON(),
          ],
          maps: [
            new Openlayers({ name: 'foo' }).toJSON(),
          ],
          startingViewPointName: 'foo',
          startingMapName: 'foo',
        });
        context = new Context({
          layers: [
            new Vector({ name: 'foo', activeOnStartup: true }).toJSON(),
            new Vector({ name: 'baz', activeOnStartup: false }).toJSON(),
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
        expect(layer).to.be.an.instanceOf(Vector);
        expect(layer.active || layer.loading).to.be.true; // we do not wait for layers. so all good _as long as its not inactive_
      });

      it('should not load layers which are active on startup and not in the current context', () => {
        const layer = app.layers.getByKey('bar');
        expect(layer).to.be.an.instanceOf(Vector);
        expect(layer.active || layer.loading).to.be.false; // we do not wait for layers. so all good _as long as its not inactive_
      });
    });

    describe('without an active map name', () => {
      let context;
      /** @type {VcsApp} */
      let app;
      /** @type {ViewPoint} */
      let startingVp;

      before(async () => {
        startingVp = new ViewPoint({ name: 'foo', groundPosition: [13, 52], distance: 200 });
        context = new Context({
          layers: [
            new Vector({ name: 'foo' }).toJSON(),
            new Vector({ name: 'bar', activeOnStartup: true }).toJSON(),
          ],
          viewpoints: [
            new ViewPoint({}).toJSON(),
            startingVp.toJSON(),
          ],
          maps: [
            new Openlayers({ name: 'foo' }).toJSON(),
            new Openlayers({ name: 'bar' }).toJSON(),
          ],
          startingViewPointName: 'foo',
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
      /** @type {ViewPoint} */
      let startingVp;
      let added;

      before(async () => {
        startingVp = new ViewPoint({ name: 'foo', groundPosition: [13, 52], distance: 200 });
        context = new Context({
          layers: [
            new Vector({ name: 'foo' }).toJSON(),
            new Vector({ name: 'bar', activeOnStartup: true }).toJSON(),
          ],
          viewpoints: [
            new ViewPoint({}).toJSON(),
            startingVp.toJSON(),
          ],
          maps: [
            new Openlayers({ name: 'foo' }).toJSON(),
          ],
          startingViewPointName: 'foo',
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
        expect(app.viewPoints.hasKey('foo')).to.be.true;
      });

      it('should load layers which are active on startup', () => {
        const layer = app.layers.getByKey('bar');
        expect(layer).to.be.an.instanceOf(Vector);
        expect(layer.active || layer.loading).to.be.true; // we do not wait for layers. so all good _as long as its not inactive_
      });

      it('should activate the starting map', () => {
        expect(app.maps.activeMap).to.have.property('name', 'foo');
      });

      it('should activate the starting view point', () => {
        const vp = app.maps.activeMap.getViewPointSync();
        expect(vp.equals(startingVp, 10e-8)).to.be.true;
      });
    });
  });

  describe('removing a context', () => {
    describe('normal', () => {
      let context;
      /** @type {VcsApp} */
      let app;
      /** @type {ViewPoint} */
      let startingVp;
      let removed;

      before(async () => {
        startingVp = new ViewPoint({ name: 'foo', groundPosition: [13, 52], distance: 200 });
        context = new Context({
          layers: [
            new Vector({ name: 'foo' }).toJSON(),
            new Vector({ name: 'bar', activeOnStartup: true }).toJSON(),
          ],
          viewpoints: [
            new ViewPoint({}).toJSON(),
            startingVp.toJSON(),
          ],
          maps: [
            new Openlayers({ name: 'foo' }).toJSON(),
          ],
          startingViewPointName: 'foo',
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

      it('should add the contexts resources', () => {
        expect([...app.layers]).to.be.empty;
        expect([...app.maps]).to.be.empty;
        expect([...app.viewPoints]).to.be.empty;
      });
    });

    describe('if removing the same context twice', () => {
      let context;
      /** @type {VcsApp} */
      let app;
      /** @type {ViewPoint} */
      let startingVp;
      let removed;

      before(async () => {
        startingVp = new ViewPoint({ name: 'foo', groundPosition: [13, 52], distance: 200 });
        context = new Context({
          layers: [
            new Vector({ name: 'foo' }).toJSON(),
            new Vector({ name: 'bar', activeOnStartup: true }).toJSON(),
          ],
          viewpoints: [
            new ViewPoint({}).toJSON(),
            startingVp.toJSON(),
          ],
          maps: [
            new Openlayers({ name: 'foo' }).toJSON(),
          ],
          startingViewPointName: 'foo',
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

      it('should add the contexts resources', () => {
        expect([...app.layers]).to.be.empty;
        expect([...app.maps]).to.be.empty;
        expect([...app.viewPoints]).to.be.empty;
      });
    });
  });
});
