import { expect } from 'chai';
import sinon, { type SinonSandbox, SinonSpy } from 'sinon';
import DisplayQuality, {
  DisplayQualityLevel,
  DisplayQualityOptions,
} from '../../../../src/util/displayQuality/displayQuality.js';
import VcsApp from '../../../../src/vcsApp.js';
import {
  createInitializedTilesetLayer,
  getVcsEventSpy,
  setCesiumMap,
} from '../../helpers/cesiumHelpers.js';
import { CesiumMap, CesiumTilesetLayer } from '../../../../index.js';

describe('util.displayQuality.DisplayQuality', () => {
  let sandbox: SinonSandbox;
  let app: VcsApp;
  let cesiumMap: CesiumMap;
  let DC: DisplayQuality;
  let tilesetLayer: CesiumTilesetLayer;

  before(async () => {
    sandbox = sinon.createSandbox();
    app = new VcsApp();
    DC = new DisplayQuality(app);
    cesiumMap = await setCesiumMap(app);
    tilesetLayer = await createInitializedTilesetLayer(sandbox, cesiumMap);
  });

  after(() => {
    app.destroy();
    sandbox.restore();
  });

  it('should apply the starting quality level after map activated', () => {
    expect(DC.startingQualityLevel).to.equal(DC.currentQualityLevel);
  });

  describe('handleLayerActivated', () => {
    let oldValue: number;

    before(async () => {
      oldValue =
        tilesetLayer.getImplementations()[0].cesium3DTileset!
          .maximumScreenSpaceError!;
      await tilesetLayer.activate();
    });

    it('should update the layer display quality', () => {
      const newValue =
        tilesetLayer.getImplementations()[0].cesium3DTileset
          ?.maximumScreenSpaceError;
      expect(oldValue).to.not.equal(newValue);
    });
  });

  describe('updateOptions', () => {
    let newOptions: DisplayQualityOptions;

    before(() => {
      newOptions = {
        startingQualityLevel: DisplayQualityLevel.LOW,
        low: {
          sse: 4,
          layerSSEFactor: 2,
          msaa: 2,
        },
        medium: {
          // @ts-expect-error check invalid value handling
          msaa: 'test',
        },
      };
      DC.updateOptions(newOptions);
    });

    it('should update the settings and apply the starting quality level', () => {
      expect(DC.startingQualityLevel).to.equal(newOptions.startingQualityLevel);
    });

    it('should filter invalid msaa Options', () => {
      DC.setLevel(DisplayQualityLevel.MEDIUM);
      expect(cesiumMap.getCesiumWidget()!.scene.msaaSamples).to.equal(
        DisplayQuality.getDefaultOptions().medium!.msaa,
      );
    });
  });

  describe('setLevel', () => {
    let spy: SinonSpy;
    let oldGlobeSse: number;
    let oldLayerSee: number;
    let oldMsaa: number | undefined;

    before(() => {
      oldGlobeSse =
        cesiumMap.getCesiumWidget()!.scene.globe.maximumScreenSpaceError;
      oldLayerSee =
        tilesetLayer.getImplementations()[0].cesium3DTileset!
          .maximumScreenSpaceError!;
      oldMsaa = cesiumMap.getScene()?.msaaSamples;
      spy = getVcsEventSpy(DC.qualityLevelChanged, sandbox);
      DC.setLevel(DisplayQualityLevel.HIGH);
    });

    it('should trigger the qualityLevelChanged event', () => {
      expect(spy).to.have.been.called;
    });

    it('should update the map display quality', () => {
      const newGlobeSse =
        cesiumMap.getCesiumWidget()!.scene.globe.maximumScreenSpaceError;
      expect(newGlobeSse).to.equal(
        DisplayQuality.getDefaultOptions().high!.sse,
      );
      expect(oldGlobeSse).to.not.equal(newGlobeSse);
    });

    it('should set msaa', () => {
      expect(oldMsaa).to.not.equal(cesiumMap.getScene()?.msaaSamples);
    });

    it('should update the layer display quality', () => {
      const newLayerSee =
        tilesetLayer.getImplementations()[0].cesium3DTileset!
          .maximumScreenSpaceError;
      expect(newLayerSee).to.equal(
        DisplayQuality.getDefaultOptions().high!.layerSSEFactor! *
          tilesetLayer.screenSpaceError,
      );
      expect(oldLayerSee).to.not.equal(newLayerSee);
    });

    it('should update the startingQualityLevel, if the cesium map has not be activated yet', () => {
      const test = new DisplayQuality(new VcsApp());
      test.setLevel(DisplayQualityLevel.HIGH);
      expect(test.startingQualityLevel).to.equal(DisplayQualityLevel.HIGH);
    });
  });
});
