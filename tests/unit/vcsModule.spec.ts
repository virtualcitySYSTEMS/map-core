import { expect } from 'chai';
import VcsModule, { VcsModuleConfig } from '../../src/vcsModule.js';
import VcsApp from '../../src/vcsApp.js';
import VectorLayer from '../../src/layer/vectorLayer.js';
import Viewpoint from '../../src/util/viewpoint.js';
import OpenlayersMap from '../../src/map/openlayersMap.js';
import CesiumMap from '../../src/map/cesiumMap.js';

type TestVcsModuleConfig = VcsModuleConfig & {
  thirdpartyEntry: string;
};

describe('Module', () => {
  let app: VcsApp;
  let module: VcsModule;
  let startingVp: Viewpoint;

  beforeEach(async () => {
    app = new VcsApp();
    startingVp = new Viewpoint({
      name: 'foo',
      groundPosition: [13, 52],
      distance: 200,
    });

    module = new VcsModule({
      name: 'module',
      description: 'description',
      thirdpartyEntry: 'test',
      layers: [
        new VectorLayer({ name: 'foo' }).toJSON(),
        new VectorLayer({ name: 'bar', activeOnStartup: true }).toJSON(),
      ],
      viewpoints: [new Viewpoint({}).toJSON(), startingVp.toJSON()],
      maps: [new OpenlayersMap({ name: 'foo' }).toJSON()],
      startingViewpointName: 'foo',
      startingMapName: 'foo',
      projection: {
        epsg: 4326,
      },
    } as TestVcsModuleConfig);
    await app.addModule(module);
  });

  afterEach(() => {
    app.destroy();
  });

  describe('getting a config', () => {
    let config: VcsModuleConfig;

    beforeEach(() => {
      config = module.toJSON();
    });

    it('should add the name', () => {
      expect(config).to.have.property('name', 'module');
    });
    it('should add the description', () => {
      expect(config).to.have.property('description', 'description');
    });
    it('should add the startingViewpointName', () => {
      expect(config).to.have.property('startingViewpointName', 'foo');
    });
    it('should add the startingMapName', () => {
      expect(config).to.have.property('startingMapName', 'foo');
    });
    it('should add the projection', () => {
      expect(config).to.have.property('projection');
      expect(config.projection).to.have.property('epsg', 'EPSG:4326');
    });
  });

  describe('setting a config', () => {
    it('should serialize the current runtime objects for the dynamic module', () => {
      app.setDynamicModule(module);
      app.layers.remove(app.layers.getByKey('foo')!);
      app.layers.add(new VectorLayer({ name: 'fooBar' }));
      app.viewpoints.remove(startingVp);
      app.maps.add(new CesiumMap({ name: 'cesium' }));
      module.setConfigFromApp(app);
      const { config } = module;
      expect(config.layers).to.have.lengthOf(2);
      expect(!!config.layers?.find((l) => l.name === 'fooBar')).to.be.true;
      expect(config.viewpoints).to.have.lengthOf(1);
      expect(config.maps).to.have.lengthOf(2);
      app.resetDynamicModule();
    });

    it('should allow unsetting values by null', () => {
      app.setDynamicModule(module);
      module.description = null;
      module.startingViewpointName = null;
      module.startingMapName = null;
      module.projection = null;
      module.setConfigFromApp(app);
      const { config } = module;
      expect(config.description).to.be.null;
      expect(config.startingViewpointName).to.be.null;
      expect(config.startingMapName).to.be.null;
      expect(config.projection).to.be.null;
      app.resetDynamicModule();
    });

    it('should not loose keys in the config not defined by the app', () => {
      module.setConfigFromApp(app);
      const { config } = module;
      expect((config as TestVcsModuleConfig).thirdpartyEntry).to.be.equal(
        'test',
      );
    });
  });
});
