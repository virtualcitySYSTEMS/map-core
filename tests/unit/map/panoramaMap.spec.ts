import { expect } from 'chai';
import { Feature } from 'ol';
import { intersects } from 'ol/extent.js';
import Point from 'ol/geom/Point.js';
import sinon from 'sinon';
import { PrimitiveCollection } from '@vcmap-cesium/engine';
import {
  getPanoramaImage,
  getPanoramaMap,
} from '../helpers/panoramaHelpers.js';
import type { PanoramaMapOptions } from '../../../src/map/panoramaMap.js';
import PanoramaMap from '../../../src/map/panoramaMap.js';
import Layer from '../../../src/layer/layer.js';
import { vcsLayerName } from '../../../src/layer/layerSymbols.js';
import LayerCollection from '../../../src/util/layerCollection.js';
import PanoramaDataset from '../../../src/layer/panoramaDatasetLayer.js';
import type { PanoramaImage } from '../../../src/panorama/panoramaImage.js';
import { Projection, Viewpoint, Extent } from '../../../index.js';
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
  describe('handling primitive collection / tileset visualizations', () => {
    let layer1: Layer;
    let layer2: Layer;
    let primitiveCollection1: PrimitiveCollection;
    let primitiveCollection2: PrimitiveCollection;

    before(() => {
      layer1 = new Layer({});
      layer2 = new Layer({});
    });

    beforeEach(() => {
      // destroyed on map destroy or removal
      primitiveCollection1 = new PrimitiveCollection();
      primitiveCollection1[vcsLayerName] = layer1.name;
      primitiveCollection2 = new PrimitiveCollection();
      primitiveCollection2[vcsLayerName] = layer2.name;
    });

    after(() => {
      layer1.destroy();
      layer2.destroy();
    });

    describe('adding primitive collection', () => {
      let map: PanoramaMap;
      let layerCollection: LayerCollection;
      let numberOfDefaultPrimitives: number;

      before(() => {
        layerCollection = LayerCollection.from([layer1, layer2]);
      });

      beforeEach(() => {
        map = getPanoramaMap({ layerCollection });
        numberOfDefaultPrimitives =
          map.getCesiumWidget().scene.primitives.length;
      });

      afterEach(() => {
        map.destroy();
      });

      after(() => {
        layerCollection.destroy();
      });

      it('should add a primitive collection to the scene', () => {
        map.addPrimitiveCollection(primitiveCollection1);
        expect(
          map.getCesiumWidget().scene.primitives.contains(primitiveCollection1),
        ).to.be.true;
      });

      it('should not add a visualization twice', () => {
        map.addPrimitiveCollection(primitiveCollection1);
        map.addPrimitiveCollection(primitiveCollection1);
        expect(map.getCesiumWidget().scene.primitives.length).to.equal(
          numberOfDefaultPrimitives + 1,
        );
      });

      it('should add a visualization at the correct index based on the index in the layer collection', () => {
        map.addPrimitiveCollection(primitiveCollection2);
        map.addPrimitiveCollection(primitiveCollection1);
        const { primitives } = map.getCesiumWidget().scene;
        expect(primitives.length).to.equal(numberOfDefaultPrimitives + 2);
        expect(primitives.get(numberOfDefaultPrimitives)).to.equal(
          primitiveCollection1,
        );
        expect(primitives.get(numberOfDefaultPrimitives + 1)).to.equal(
          primitiveCollection2,
        );
      });

      it('should not add a primitive collection without a vcsLayerName symbol', () => {
        const collection = new PrimitiveCollection();
        map.addPrimitiveCollection(collection);
        expect(map.getCesiumWidget().scene.primitives.length).to.equal(1);
        collection.destroy();
      });

      it('should not add an primitive collection with a vcsLayerName not corresponding to a layer in the layerCollection', () => {
        const collection = new PrimitiveCollection();
        collection[vcsLayerName] = 'test';
        map.addPrimitiveCollection(collection);
        expect(map.getCesiumWidget().scene.primitives.length).to.equal(
          numberOfDefaultPrimitives,
        );
        collection.destroy();
      });
    });

    describe('moving of layers within the layer collection', () => {
      let map: PanoramaMap;
      let layerCollection: LayerCollection;
      let numberOfDefaultPrimitives: number;

      before(() => {
        layerCollection = LayerCollection.from([layer1, layer2]);
      });

      beforeEach(() => {
        map = getPanoramaMap({ layerCollection });
        numberOfDefaultPrimitives =
          map.getCesiumWidget().scene.primitives.length;
      });

      afterEach(() => {
        map.destroy();
      });

      after(() => {
        layerCollection.destroy();
      });

      it('should rearrange the primitive collections to place them at the right index', () => {
        map.addPrimitiveCollection(primitiveCollection1);
        map.addPrimitiveCollection(primitiveCollection2);
        layerCollection.raise(layer1);
        const { primitives } = map.getCesiumWidget().scene;
        expect(primitives.get(numberOfDefaultPrimitives)).to.equal(
          primitiveCollection2,
        );
        expect(primitives.get(numberOfDefaultPrimitives + 1)).to.equal(
          primitiveCollection1,
        );
      });
    });

    describe('removing of layers', () => {
      let map: PanoramaMap;
      let layerCollection: LayerCollection;

      before(() => {
        layerCollection = LayerCollection.from([layer1, layer2]);
      });

      beforeEach(() => {
        map = getPanoramaMap({ layerCollection });
        map.addPrimitiveCollection(primitiveCollection1);
        map.addPrimitiveCollection(primitiveCollection2);
      });

      afterEach(() => {
        map.destroy();
      });

      after(() => {
        layerCollection.destroy();
      });

      it('should remove the primitive collection from the map', () => {
        map.removePrimitiveCollection(primitiveCollection1);
        expect(
          map.getCesiumWidget().scene.primitives.contains(primitiveCollection1),
        ).to.be.false;
      });

      it('should no longer place the primitive collection at an index, if it has been removed after the removal of its visualization', () => {
        map.removePrimitiveCollection(primitiveCollection1);
        layerCollection.raise(layer1);
        expect(
          map.getCesiumWidget().scene.primitives.contains(primitiveCollection1),
        ).to.be.false;
      });
    });
  });

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
