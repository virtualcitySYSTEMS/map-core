import Layer from '../../../src/layer/layer.js';
import VcsApp from '../../../src/vcsApp.js';
import LayerState from '../../../src/layer/layerState.js';
import LayerImplementation from '../../../src/layer/layerImplementation.js';
import { getVcsEventSpy } from '../helpers/cesiumHelpers.js';
import { getOpenlayersMap, setOpenlayersMap } from '../helpers/openlayersHelpers.js';
import Extent from '../../../src/util/extent.js';
import GlobalHider from '../../../src/layer/globalHider.js';

describe('Layer', () => {
  let sandbox;
  let app;
  /** @type {import("@vcmap/core").Layer} */
  let AL;
  let map;

  before(async () => {
    sandbox = sinon.createSandbox();
    app = new VcsApp();
    map = await setOpenlayersMap(app);
  });

  beforeEach(() => {
    AL = new Layer({});
    AL.setGlobalHider(new GlobalHider());
    AL._supportedMaps = [map.className];
    sandbox.stub(AL, 'createImplementationsForMap')
      .callsFake(() => [new LayerImplementation(map, AL.getImplementationOptions())]);
  });

  afterEach(() => {
    AL.destroy();
    sandbox.restore();
  });

  after(() => {
    app.destroy();
  });

  describe('exclusiveGroups', () => {
    it('should return the exclusive group', () => {
      AL.exclusiveGroups = ['test'];
      expect(AL.exclusiveGroups).to.have.members(['test']);
    });

    it('should set the layer exclusive', () => {
      expect(AL.exclusive).to.be.false;
      AL.exclusiveGroups = ['test'];
      expect(AL.exclusive).to.be.true;
    });

    it('should set exclusive false, if the exclusiveGroups are empty', () => {
      AL.exclusiveGroups = ['test'];
      AL.exclusiveGroups = [];
      expect(AL.exclusive).to.be.false;
    });

    it('should raise the exclusiveGroupsChanged event', () => {
      const spy = getVcsEventSpy(AL.exclusiveGroupsChanged, sandbox);
      const groups = ['test'];
      AL.exclusiveGroups = groups;
      expect(spy).to.have.been.calledWith(groups);
    });

    it('should not raise the exclusiveGroupsChanged event, if the groups are the same', () => {
      const groups = ['test'];
      AL.exclusiveGroups = groups;
      const spy = getVcsEventSpy(AL.exclusiveGroupsChanged, sandbox);
      AL.exclusiveGroups = groups;
      expect(spy).to.not.have.been.called;
    });
  });

  describe('activate', () => {
    it('should return the same promise, if called twice', () => {
      const p1 = AL.activate();
      const p2 = AL.activate();
      expect(p1).to.equal(p2);
      return p1
        .then(() => {
          expect(AL.active).to.be.true;
        });
    });

    it('should activate if deactivated in between', async () => {
      AL.activate();
      AL.deactivate();
      await AL.activate();
      expect(AL.active).to.be.true;
    });

    describe('layer inactive', () => {
      it('should initialize the layer', async () => {
        await AL.activate();
        expect(AL.initialized).to.be.true;
      });

      it('should set the state to active', async () => {
        await AL.activate();
        expect(AL.active).to.be.true;
      });

      it('should activate all implementations for active maps', async () => {
        await AL.mapActivated(map);
        const [impl] = AL.getImplementationsForMap(map);
        await AL.activate();
        expect(impl.active).to.be.true;
      });

      it('should not activate implementations for inactive maps', async () => {
        const [impl] = AL.getImplementationsForMap(map);
        await AL.activate();
        expect(impl.active).to.be.false;
      });

      it('should hide objects on the global hider', async () => {
        const hideObjects = sandbox.spy(AL.globalHider, 'hideObjects');
        await AL.activate();
        expect(hideObjects).to.have.been.calledWithExactly(AL.hiddenObjectIds);
      });

      it('should publish the state changed event when loading and when active', async () => {
        const spy = sandbox.spy();
        const listener = AL.stateChanged.addEventListener(spy);
        await AL.activate();
        expect(spy).to.have.been.calledTwice;
        expect(spy.getCall(0).args).to.have.members([LayerState.LOADING]);
        expect(spy.getCall(1).args).to.have.members([LayerState.ACTIVE]);
        listener();
      });
    });

    describe('activation cancelled', () => {
      it('should set the state to inactive', async () => {
        const promise = AL.activate();
        AL.deactivate();
        await promise;
        expect(AL.active).to.be.false;
        expect(AL.loading).to.be.false;
      });
    });
  });

  describe('deactivate', () => {
    it('should not raise state changed on an inactive layer', () => {
      const spy = getVcsEventSpy(AL.stateChanged, sandbox);
      AL.deactivate();
      expect(spy).to.not.have.been.called;
    });

    describe('active layer', () => {
      beforeEach(async () => {
        await AL.activate();
      });

      it('should set the layer inactive', () => {
        AL.deactivate();
        expect(AL.active).to.be.false;
      });

      it('should deactivate all implementations', async () => {
        const [impl] = AL.getImplementationsForMap(map);
        await impl.activate();
        AL.deactivate();
        expect(impl.active).to.be.false;
      });

      it('should raise stateChanged with INACTIVE', () => {
        const spy = getVcsEventSpy(AL.stateChanged, sandbox);
        AL.deactivate();
        expect(spy).to.have.been.calledWith(LayerState.INACTIVE);
      });

      it('should show hiddenObjectIds', () => {
        const showObjects = sandbox.spy(AL.globalHider, 'showObjects');
        AL.deactivate();
        expect(showObjects).to.have.been.calledWithExactly(AL.hiddenObjectIds);
      });
    });
  });

  describe('mapActivated', () => {
    let impl;

    beforeEach(() => {
      [impl] = AL.getImplementationsForMap(map);
    });

    it('should activate all implementations for the map, if active', async () => {
      await AL.activate();
      await AL.mapActivated(map);
      expect(impl.active).to.be.true;
    });

    it('should activate all implementations for the map, if loading', async () => {
      const promise = AL.activate();
      await AL.mapActivated(map);
      expect(impl.active).to.be.true;
      await promise;
    });

    it('should not activate the impl, if inactive', async () => {
      await AL.mapActivated(map);
      expect(impl.active).to.be.false;
    });

    it('should not activate implementation from other maps', async () => {
      const map2 = await getOpenlayersMap();
      const [impl2] = AL.getImplementationsForMap(map2);
      await AL.mapActivated(map);
      expect(impl2.active).to.be.false;
      map2.destroy();
    });
  });

  describe('mapDeactivated', () => {
    let impl;

    beforeEach(async () => {
      [impl] = AL.getImplementationsForMap(map);
      await impl.activate();
    });

    it('should deactivate all implementations for the map, if active', async () => {
      await AL.activate();
      await AL.mapDeactivated(map);
      expect(impl.active).to.be.false;
    });

    it('should deactivate all implementations for the map, if loading', async () => {
      const promise = AL.activate();
      await AL.mapDeactivated(map);
      expect(impl.active).to.be.false;
      await promise;
    });

    it('should not deactivate the impl, if inactive', async () => {
      await AL.mapActivated(map);
      expect(impl.active).to.be.true;
    });

    it('should not deactivate implementation from other maps', async () => {
      const map2 = await getOpenlayersMap();
      const [impl2] = AL.getImplementationsForMap(map2);
      await impl2.activate();
      await AL.mapActivated(map);
      expect(impl2.active).to.be.true;
      map2.destroy();
    });
  });

  describe('removedFromMap', () => {
    let impl;

    beforeEach(() => {
      [impl] = AL.getImplementationsForMap(map);
    });

    it('should remove the implementations', () => {
      AL.removedFromMap(map);
      expect(AL.getImplementations()).to.be.empty;
    });

    it('should destroy the implementations', () => {
      const destroy = sandbox.spy(impl, 'destroy');
      AL.removedFromMap(map);
      expect(destroy).to.have.been.calledOnce;
    });
  });

  describe('getting the implementations of a map', () => {
    it('should create the implementation for a map, if they are missing', () => {
      const impls = AL.getImplementationsForMap(map);
      expect(impls).to.have.lengthOf(1);
      expect(impls[0]).to.be.an.instanceOf(LayerImplementation);
    });

    it('should return a previously created implementation for a map', () => {
      const impls1 = AL.getImplementationsForMap(map);
      const impls2 = AL.getImplementationsForMap(map);
      expect(impls1).to.equal(impls2);
    });

    it('should set an empty array, if the layer is not supported', () => {
      AL.mapNames = ['notTheCurrentMap'];
      const impls = AL.getImplementationsForMap(map);
      expect(impls).to.be.empty;
    });
  });

  describe('url', () => {
    it('should return the set URL', () => {
      const url = 'http://test.com';
      AL.url = url;
      expect(AL.url).to.equal(url);
    });

    it('should return an empty string, if the url is not defined', () => {
      expect(AL.url).to.be.a('string');
      expect(AL.url).to.be.empty;
    });

    it('should translate an Object', () => {
      AL.url = { en: 'Test' };
      AL.locale = 'en';
      expect(AL.url).to.equal('Test');
    });

    describe('setting a new URL', () => {
      beforeEach(() => {
        AL.url = 'before';
      });

      describe('without any implementations', () => {
        it('should do nothing, if there are no implementations', async () => {
          await AL.initialize();
          AL.url = 'after';
          expect(AL.getImplementations()).to.be.empty;
        });
      });

      describe('with implementations', () => {
        let impl;

        beforeEach(() => {
          [impl] = AL.getImplementationsForMap(map);
        });

        it('should do nothing, if the url does not change', async () => {
          AL.url = 'before';
          expect(AL.getImplementations()).to.have.members([impl]);
        });

        it('should force a redraw if active', async () => {
          const spy = sandbox.spy(AL, 'forceRedraw');
          AL.url = 'after';
          expect(spy).to.have.been.called;
        });
      });
    });
  });

  describe('getting a config', () => {
    describe('of a default object', () => {
      it('should return an object with type and name for default layers', () => {
        const config = AL.toJSON();
        expect(config).to.have.all.keys('name', 'type');
      });
    });

    describe('of a configured layer', () => {
      let inputConfig;
      let outputConfig;
      let configuredLayer;

      before(() => {
        inputConfig = {
          activeOnStartup: true,
          allowPicking: false,
          mapNames: ['name'],
          hiddenObjectIds: ['hidden'],
          url: 'http://localhost',
          exclusiveGroups: ['myGroup'],
          extent: new Extent({
            coordinates: [0, 0, 1, 1],
            projection: {
              epsg: 'EPSG:25833',
              proj4: '+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs',
            },
          }).toJSON(),
          copyright: {
            provider: 'test',
          },
        };
        configuredLayer = new Layer(inputConfig);
        outputConfig = configuredLayer.toJSON();
      });

      after(() => {
        configuredLayer.destroy();
      });

      it('should configure activeOnStartup', () => {
        expect(outputConfig).to.have.property('activeOnStartup', inputConfig.activeOnStartup);
      });

      it('should configure allowPicking', () => {
        expect(outputConfig).to.have.property('allowPicking', inputConfig.allowPicking);
      });

      it('should configure url', () => {
        expect(outputConfig).to.have.property('url', inputConfig.url);
      });

      it('should configure exclusiveGroups', () => {
        expect(outputConfig).to.have.property('exclusiveGroups')
          .and.to.have.members(['myGroup']);
      });

      it('should set hiddenObjectIds', () => {
        expect(outputConfig).to.have.property('hiddenObjectIds')
          .and.to.have.members(inputConfig.hiddenObjectIds);
      });

      it('should set mapNames', () => {
        expect(outputConfig).to.have.property('mapNames')
          .and.to.have.members(inputConfig.mapNames);
      });

      it('should set extent', () => {
        expect(outputConfig).to.have.property('extent')
          .and.to.eql(inputConfig.extent);
      });

      it('should set copyright', () => {
        expect(outputConfig).to.have.property('copyright')
          .and.to.eql(inputConfig.copyright);
      });
    });
  });

  describe('reacting to localeChanged', () => {
    beforeEach(() => {
      AL.locale = 'de';
      AL.url = { de: 'tst', en: 'test' };
    });

    describe('without any implementations', () => {
      it('should do nothing, if there are no implementations', async () => {
        await AL.initialize();
        AL.locale = 'en';
        expect(AL.getImplementations()).to.be.empty;
      });
    });

    describe('with implementations', () => {
      let impl;

      beforeEach(() => {
        [impl] = AL.getImplementationsForMap(map);
      });

      it('should do nothing, if the language is not part of URL', async () => {
        await AL.initialize();
        AL.locale = 'cz';
        expect(AL.getImplementations()).to.have.members([impl]);
      });

      it('should do nothing, if the url is a string', async () => {
        AL.url = 'test';
        [impl] = AL.getImplementationsForMap(map);
        await AL.activate();
        AL.locale = 'en';
        expect(AL.getImplementations()).to.have.members([impl]);
      });

      it('should force a redraw if initialized', async () => {
        const spy = sandbox.spy(AL, 'forceRedraw');
        await AL.initialize();
        AL.locale = 'en';
        expect(spy).to.have.been.called;
      });
    });
  });

  describe('forcing implementation recreation', () => {
    it('should destroy the impl, if initialized', async () => {
      map.deactivate();
      AL.forceRedraw();
      expect(AL.getImplementations()).to.be.empty;
      await map.activate();
    });

    it('should not recreate impls for maps which are active, if the layer is inactive', () => {
      AL.forceRedraw();
      expect(AL.getImplementations()).to.be.empty;
    });

    it('should activate newly created impls, if the layer is active', async () => {
      await AL.activate();
      await AL.mapActivated(map);
      AL.forceRedraw();
      expect(AL.getImplementations()[0].loading).to.be.true;
    });
  });
});
