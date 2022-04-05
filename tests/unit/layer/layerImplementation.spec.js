import { setOpenlayersMap } from '../helpers/openlayersHelpers.js';
import VcsApp from '../../../src/vcsApp.js';
import Layer from '../../../src/layer/layer.js';
import LayerImplementation from '../../../src/layer/layerImplementation.js';

describe('LayerImplementation', () => {
  let app;
  let map;
  /** @type {import("@vcmap/core").Layer} */
  let layer;
  /** @type {import("@vcmap/core").LayerImplementation} */
  let implementation;

  before(async () => {
    app = new VcsApp();
    map = await setOpenlayersMap(app);
    layer = new Layer({});
  });

  beforeEach(() => {
    implementation = new LayerImplementation(map, layer.getImplementationOptions());
  });

  afterEach(() => {
    implementation.destroy();
  });

  after(() => {
    layer.destroy();
    app.destroy();
  });

  describe('activating a layer implementation', () => {
    describe('with an inactive map', () => {
      before(() => {
        map.deactivate();
      });

      beforeEach(async () => {
        await implementation.activate();
      });

      after(async () => {
        await map.activate();
      });

      it('should not initialize the implementation', () => {
        expect(implementation.initialized).to.be.false;
      });

      it('should not set the implementation active', () => {
        expect(implementation.active).to.be.false;
      });
    });

    describe('with an active map', () => {
      it('should initialize the implementation', async () => {
        await implementation.activate();
        expect(implementation.initialized).to.be.true;
      });

      it('should set the implementation active', async () => {
        await implementation.activate();
        expect(implementation.active).to.be.true;
      });

      it('should set the implementation loading while initializing', async () => {
        const promise = implementation.activate();
        expect(implementation.loading).to.be.true;
        await promise;
        expect(implementation.loading).to.be.false;
      });

      it('should not re-load an active implementation', async () => {
        await implementation.activate();
        const promise = implementation.activate();
        expect(implementation.loading).to.be.false;
        expect(implementation.active).to.be.true;
        await promise;
      });
    });
  });

  describe('deactivating a layer implementation', () => {
    describe('while its active', () => {
      it('should set active to false', async () => {
        await implementation.activate();
        implementation.deactivate();
        expect(implementation.active).to.be.false;
      });
    });

    describe('while its loading', () => {
      it('should not set the implementation active after resolving the initialization', async () => {
        const promise = implementation.activate();
        expect(implementation.loading).to.be.true;
        implementation.deactivate();
        await promise;
        expect(implementation.active).to.be.false;
      });
    });
  });
});
