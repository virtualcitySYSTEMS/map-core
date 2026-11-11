import { expect } from 'chai';
import { Feature } from 'ol';
import { intersects } from 'ol/extent.js';
import Point from 'ol/geom/Point.js';
import sinon from 'sinon';
import { Color, type Cesium3DTileset } from '@vcmap-cesium/engine';
import {
  getPanoramaImage,
  getPanoramaMap,
} from '../helpers/panoramaHelpers.js';
import type { PanoramaMapOptions } from '../../../src/map/panoramaMap.js';
import PanoramaMap from '../../../src/map/panoramaMap.js';
import PanoramaDataset from '../../../src/layer/panoramaDatasetLayer.js';
import type { PanoramaImage } from '../../../src/panorama/panoramaImage.js';
import { Projection, Viewpoint, Extent, VcsEvent } from '../../../index.js';
import type TilesetDepthPass from '../../../src/cursor/TilesetDepthPass.js';
import { getVcsEventSpy } from '../helpers/cesiumHelpers.js';

async function createStubbedDataset(
  name: string,
  features: Feature[],
): Promise<{
  dataset: PanoramaDataset;
  destroy: () => void;
}> {
  const dataset = new PanoramaDataset({
    name,
    url: 'http://localhost/foo.fgb',
  });
  const images = new Map<
    string,
    { panoramaImage: PanoramaImage; destroy: () => void }
  >();
  sinon
    .stub(dataset.tileProvider, 'getFeaturesForExtent')
    .callsFake((extent: Extent) => {
      const featuresInExtent = features.filter((feature) => {
        const featureExtent = feature.getGeometry()!.getExtent();
        return intersects(extent.extent, featureExtent);
      });
      return Promise.resolve(featuresInExtent);
    });
  sinon
    .stub(dataset.tileProvider, 'getLevelExtent')
    .callsFake((): Promise<Extent> => Promise.resolve(new Extent()));
  sinon
    .stub(dataset, 'createPanoramaImage')
    .callsFake(async (imageName: string) => {
      if (!images.has(imageName)) {
        images.set(
          imageName,
          await getPanoramaImage({ dataset, name: imageName }),
        );
      }
      return images.get(imageName)!.panoramaImage;
    });
  await dataset.activate();

  return {
    dataset,
    destroy(): void {
      images.forEach((image) => {
        image.destroy();
      });
      dataset.destroy();
    },
  };
}

describe('PanoramaMap', () => {
  describe('activating a panorama map', () => {
    let map: PanoramaMap;

    beforeEach(() => {
      map = getPanoramaMap();
    });

    afterEach(() => {
      map.destroy();
    });

    it('should set the cesium widgets use of the default rendering loop to true', async () => {
      await map.activate();
      expect(map.getCesiumWidget()).to.have.property(
        'useDefaultRenderLoop',
        true,
      );
    });

    it('should force a resize of the cesium widget', async () => {
      const resize = sinon.spy(map.getCesiumWidget(), 'resize');
      await map.activate();
      expect(resize).to.have.been.called;
    });
  });

  describe('deactivating a panorama map', () => {
    let map: PanoramaMap;

    beforeEach(async () => {
      map = getPanoramaMap();
      await map.activate();
    });

    afterEach(() => {
      map.destroy();
    });

    it('should set the cesium widgets use of the default rendering loop to false', () => {
      map.deactivate();
      expect(map.getCesiumWidget()).to.have.property(
        'useDefaultRenderLoop',
        false,
      );
    });
  });

  describe('getting the closest image to a position', () => {
    let map: PanoramaMap;
    let destroyDatasets: () => void;

    before(async () => {
      map = getPanoramaMap();
      const dataset1 = await createStubbedDataset('dataset1', [
        new Feature({
          name: 'test',
          time: 1,
          geometry: new Point([0, 0]),
        }),
        new Feature({
          name: 'not.close',
          time: 2,
          geometry: new Point([10, 10]),
        }),
      ]);

      const dataset2 = await createStubbedDataset('dataset2', [
        new Feature({
          name: 'test2',
          time: 1,
          geometry: new Point([1200, 1200]),
        }),
        new Feature({
          name: 'not.close2',
          time: 2,
          geometry: new Point([1210, 1210]),
        }),
      ]);

      map.layerCollection.add(dataset1.dataset);
      map.layerCollection.add(dataset2.dataset);
      destroyDatasets = (): void => {
        dataset1.destroy();
        dataset2.destroy();
      };
    });

    beforeEach(async () => {
      await Promise.all(
        [...map.layerCollection].map((dataset) => dataset.activate()),
      );
    });

    after(() => {
      destroyDatasets();
      map.destroy();
    });

    it('should find the closest image and return the distance sqrd', async () => {
      const result1 = await map.getClosestImage([0, 1]);
      expect(result1).to.exist.and.to.have.property('name', 'test');
      const result2 = await map.getClosestImage([1200, 1201]);
      expect(result2).to.exist.and.to.have.property('name', 'test2');
    });

    it('should return undefined, if the closest image is too far away', async () => {
      const result = await map.getClosestImage([500, 500]);
      expect(result).to.be.undefined;
    });

    it('should return undefined, if the dataset isnt active', async () => {
      const dataset = map.layerCollection.getByKey('dataset1')!;
      dataset.deactivate();
      const result = await map.getClosestImage([0, 1]);
      expect(result).to.be.undefined;
    });
  });

  describe('setting a viewpoint', () => {
    let map: PanoramaMap;
    let destroyDatasets: () => void;

    before(async () => {
      map = getPanoramaMap();
      const dataset1 = await createStubbedDataset('dataset1', [
        new Feature({
          name: 'test',
          time: 1,
          geometry: new Point([0, 0]),
        }),
        new Feature({
          name: 'not.close',
          time: 2,
          geometry: new Point([10, 10]),
        }),
      ]);

      const dataset2 = await createStubbedDataset('dataset2', [
        new Feature({
          name: 'test2',
          time: 1,
          geometry: new Point([1200, 1200]),
        }),
        new Feature({
          name: 'not.close2',
          time: 2,
          geometry: new Point([1210, 1210]),
        }),
      ]);

      map.layerCollection.add(dataset1.dataset);
      map.layerCollection.add(dataset2.dataset);
      destroyDatasets = (): void => {
        dataset1.destroy();
        dataset2.destroy();
      };
    });

    beforeEach(() => {
      map.setCurrentImage(undefined);
    });

    after(() => {
      map.destroy();
      destroyDatasets();
    });

    it('should set the closest image, if one could be found', async () => {
      await map.gotoViewpoint(
        new Viewpoint({
          groundPosition: Projection.mercatorToWgs84([0, 1, 0]),
        }),
      );
      expect(map.currentPanoramaImage).to.have.property('name', 'test');
    });

    it('should not set an image, if the distance is too far', async () => {
      await map.gotoViewpoint(
        new Viewpoint({
          groundPosition: Projection.mercatorToWgs84([500, 500, 0]),
        }),
      );
      expect(map.currentPanoramaImage).to.be.undefined;
    });
  });

  describe('depth cursor', () => {
    let map: PanoramaMap;

    function setupCursor(version?: string): void {
      if (version) {
        sinon.stub(map, 'currentPanoramaImage').get(
          () =>
            ({
              version,
              tileProvider: {
                loading: false,
                loadingStateChanged: new VcsEvent(),
              },
            }) as unknown as PanoramaImage,
        );
      }
      (
        map as unknown as {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          _setupCursor(): void;
        }
      )._setupCursor();
    }

    beforeEach(() => {
      map = getPanoramaMap();
    });

    afterEach(() => {
      sinon.restore();
      map.destroy();
    });

    function addTilesetToDepthPass(): () => void {
      return map.addToDepthPass({
        preloadWhenHidden: false,
        isDestroyed: () => false,
      } as unknown as Cesium3DTileset);
    }

    it('should disable the cursor for version 2 images without a depth pass', () => {
      setupCursor('2.0');
      expect(map.cursor!.enabled).to.be.false;
    });

    it('should enable the cursor for version 2 images, once a depth pass exists', () => {
      setupCursor('2.0');
      addTilesetToDepthPass();
      expect(map.cursor!.enabled).to.be.true;
    });

    it('should disable the cursor, once the depth pass is removed', () => {
      setupCursor('2.0');
      const remove = addTilesetToDepthPass();
      remove();
      expect(map.depthPass).to.be.undefined;
      expect(map.cursor!.enabled).to.be.false;
    });

    it('should use and follow the cursor color of the tile primitive collection', () => {
      const { tilePrimitiveCollection } = map.panoramaView;
      tilePrimitiveCollection.cursorColor = Color.RED;
      setupCursor('2.0');
      expect(map.cursor!.color).to.equal(Color.RED);
      const hidden = Color.RED.withAlpha(0);
      tilePrimitiveCollection.cursorColor = hidden;
      expect(map.cursor!.color).to.equal(hidden);
    });
  });

  describe('coupling the depth pass to the image loading', () => {
    type FakeImage = {
      version: string;
      tileProvider: {
        loading: boolean;
        loadingStateChanged: VcsEvent<boolean>;
      };
    };
    let fakeMap: {
      currentPanoramaImage: FakeImage | undefined;
      currentImageChanged: VcsEvent<FakeImage | undefined>;
      cursor: { enabled: boolean };
    };
    let release: sinon.SinonSpy;
    let suspend: sinon.SinonSpy;
    let depthPass: { suspend: sinon.SinonSpy; enabled: boolean };
    let removeSetup: () => void;

    function createImage(loading: boolean, version = '2.0'): FakeImage {
      return {
        version,
        tileProvider: { loading, loadingStateChanged: new VcsEvent() },
      };
    }

    function setupDepthPass(image?: FakeImage): void {
      fakeMap = {
        currentPanoramaImage: image,
        currentImageChanged: new VcsEvent(),
        cursor: { enabled: false },
      };
      release = sinon.spy();
      suspend = sinon.spy(() => release);
      depthPass = { suspend, enabled: true };
      removeSetup = (
        PanoramaMap.prototype as unknown as {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          _setupDepthPass(depthPass: TilesetDepthPass): () => void;
        }
      )._setupDepthPass.call(fakeMap, depthPass as unknown as TilesetDepthPass);
    }

    it('should disable the depth pass without an image', () => {
      setupDepthPass();
      expect(depthPass.enabled).to.be.false;
    });

    it('should switch the depth pass and the cursor with the version of a new image', () => {
      setupDepthPass(createImage(false, '1.0'));
      fakeMap.currentImageChanged.raiseEvent(createImage(false, '2.0'));
      expect(depthPass.enabled).to.be.true;
      expect(fakeMap.cursor.enabled).to.be.true;
      fakeMap.currentImageChanged.raiseEvent(createImage(false, '1.0'));
      expect(depthPass.enabled).to.be.false;
      expect(fakeMap.cursor.enabled).to.be.false;
    });

    it('should disable the cursor, when removing the setup', () => {
      setupDepthPass(createImage(false, '2.0'));
      removeSetup();
      expect(fakeMap.cursor.enabled).to.be.false;
    });

    it('should suspend the depth pass, while the current image is loading', () => {
      const image = createImage(true);
      setupDepthPass(image);
      expect(suspend).to.have.been.calledOnce;
      image.tileProvider.loadingStateChanged.raiseEvent(false);
      expect(release).to.have.been.calledOnce;
    });

    it('should suspend only once, while the image keeps loading', () => {
      const image = createImage(false);
      setupDepthPass(image);
      image.tileProvider.loadingStateChanged.raiseEvent(true);
      image.tileProvider.loadingStateChanged.raiseEvent(true);
      expect(suspend).to.have.been.calledOnce;
    });

    it('should follow the loading of a new image', () => {
      const oldImage = createImage(true);
      setupDepthPass(oldImage);
      fakeMap.currentImageChanged.raiseEvent(createImage(false));
      expect(release).to.have.been.calledOnce;
      oldImage.tileProvider.loadingStateChanged.raiseEvent(true);
      expect(suspend).to.have.been.calledOnce;
    });

    it('should release the suspension and stop listening, when removing the setup', () => {
      const image = createImage(true);
      setupDepthPass(image);
      removeSetup();
      expect(release).to.have.been.calledOnce;
      image.tileProvider.loadingStateChanged.raiseEvent(true);
      fakeMap.currentImageChanged.raiseEvent(createImage(true));
      expect(suspend).to.have.been.calledOnce;
    });
  });

  describe('depth information', () => {
    let map: PanoramaMap;
    let destroyImages: (() => void)[];

    /**
     * testRgbGeotiff has a depth image, noVersionRgb has none (version 1)
     */
    async function setImage(options: {
      depth?: boolean;
      version?: string;
    }): Promise<void> {
      const { panoramaImage, destroy } = await getPanoramaImage({
        fileName: options.depth ? 'testRgbGeotiff.tif' : 'noVersionRgb.tif',
        depth: options.depth,
      });
      destroyImages.push(destroy);
      if (options.version) {
        sinon.stub(panoramaImage, 'version').get(() => options.version);
      }
      map.setCurrentImage(panoramaImage);
    }

    function addTilesetToDepthPass(): () => void {
      return map.addToDepthPass({
        preloadWhenHidden: false,
        isDestroyed: () => false,
      } as unknown as Cesium3DTileset);
    }

    function spyOnDepthInformationChanged(): sinon.SinonSpy {
      const spy = sinon.spy();
      map.depthInformationChanged.addEventListener(spy);
      return spy;
    }

    beforeEach(() => {
      map = getPanoramaMap();
      destroyImages = [];
    });

    afterEach(() => {
      map.setCurrentImage(undefined);
      destroyImages.forEach((destroy) => {
        destroy();
      });
      sinon.restore();
      map.destroy();
    });

    it('should not have depth information without an image', () => {
      expect(map.hasDepthInformation).to.be.false;
    });

    it('should use the depth image of version 1 images', async () => {
      const spy = spyOnDepthInformationChanged();
      await setImage({ depth: true });
      expect(map.hasDepthInformation).to.be.true;
      expect(spy).to.have.been.calledOnceWith(true);
      await setImage({ depth: false });
      expect(map.hasDepthInformation).to.be.false;
    });

    it('should use the depth pass of version 2 images', async () => {
      await setImage({ version: '2.0' });
      expect(map.hasDepthInformation).to.be.false;
      const spy = spyOnDepthInformationChanged();
      const remove = addTilesetToDepthPass();
      expect(map.hasDepthInformation).to.be.true;
      remove();
      expect(map.hasDepthInformation).to.be.false;
      expect(spy.args).to.eql([[true], [false]]);
    });

    it('should only raise the event, if the value changes', async () => {
      await setImage({ version: '2.0' });
      addTilesetToDepthPass();
      const spy = spyOnDepthInformationChanged();
      addTilesetToDepthPass();
      expect(spy).to.not.have.been.called;
    });

    it('should update, once the image changes from version 1 with depth to version 2 without a depth pass', async () => {
      await setImage({ depth: true });
      const spy = spyOnDepthInformationChanged();
      await setImage({ version: '2.0' });
      expect(map.hasDepthInformation).to.be.false;
      expect(spy).to.have.been.calledOnceWith(false);
    });
  });

  describe('setting a new panorama image', () => {
    let map: PanoramaMap;
    let image: PanoramaImage;
    let destroyImage: () => void;

    before(() => {
      map = getPanoramaMap();
    });

    beforeEach(async () => {
      map.setCurrentImage(undefined);
      ({ panoramaImage: image, destroy: destroyImage } =
        await getPanoramaImage());
    });

    afterEach(() => {
      destroyImage();
    });

    after(() => {
      map.destroy();
    });

    it('should set the image', () => {
      map.setCurrentImage(image);
      expect(map.currentPanoramaImage).to.equal(image);
    });

    it('should raise the image changed event', () => {
      const spy = getVcsEventSpy(map.currentImageChanged, sinon);
      map.setCurrentImage(image);
      expect(spy).to.have.been.calledWith(image);
    });

    it('should not raise the image changed event, if the image doesnt change', () => {
      const spy = getVcsEventSpy(map.currentImageChanged, sinon);
      map.setCurrentImage(image);
      map.setCurrentImage(image);
      expect(spy).to.have.been.calledOnce;
    });

    it('should destroy the previous image, if one was set', () => {
      const destroySpy = sinon.spy(image, 'destroy');
      map.setCurrentImage(image);
      map.setCurrentImage(undefined);
      expect(destroySpy).to.have.been.calledOnce;
    });
  });

  describe('serialization', () => {
    describe('of a default object', () => {
      let map: PanoramaMap;

      before(() => {
        map = new PanoramaMap({});
      });

      after(() => {
        map.destroy();
      });

      it('should return an object with type and name for default layers', () => {
        expect(map.toJSON()).to.have.all.keys('name', 'type');
      });
    });

    describe('of a configured map', () => {
      let inputConfig: PanoramaMapOptions;
      let outputConfig: PanoramaMapOptions;
      let map: PanoramaMap;

      before(() => {
        inputConfig = {
          cursorColor: '#ff0000',
          overlayNaNColor: '#00ff00',
        };
        map = new PanoramaMap(inputConfig);
        outputConfig = map.toJSON();
      });

      after(() => {
        map.destroy();
      });

      it('should configure cursorColor', () => {
        expect(outputConfig).to.have.property(
          'cursorColor',
          inputConfig.cursorColor,
        );
      });

      it('should configure overlayNaNColor', () => {
        expect(outputConfig).to.have.property(
          'overlayNaNColor',
          inputConfig.overlayNaNColor,
        );
      });
    });

    describe('when changing the color on the primitive collection', () => {
      let inputConfig: PanoramaMapOptions;
      let outputConfig: PanoramaMapOptions;
      let map: PanoramaMap;

      before(() => {
        inputConfig = {
          cursorColor: '#ff0000',
          overlayNaNColor: '#00ff00',
        };
        map = new PanoramaMap(inputConfig);
        outputConfig = map.toJSON();
      });

      after(() => {
        map.destroy();
      });

      it('should configure cursorColor', () => {
        expect(outputConfig).to.have.property(
          'cursorColor',
          inputConfig.cursorColor,
        );
      });

      it('should configure overlayNaNColor', () => {
        expect(outputConfig).to.have.property(
          'overlayNaNColor',
          inputConfig.overlayNaNColor,
        );
      });
    });
  });
});
