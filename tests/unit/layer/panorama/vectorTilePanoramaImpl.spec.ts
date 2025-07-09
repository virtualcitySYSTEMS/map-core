import { expect } from 'chai';
import sinon from 'sinon';
import { Feature } from 'ol';
import { Point } from 'ol/geom.js';
import { type PrimitiveCollection } from '@vcmap-cesium/engine';
import type PanoramaMap from '../../../../src/map/panoramaMap.js';
import {
  getPanoramaMap,
  getPanoramaImage,
} from '../../helpers/panoramaHelpers.js';
import { VectorTileLayer } from '../../../../index.js';
import type VectorTilePanoramaImpl from '../../../../src/layer/panorama/vectorTilePanoramaImpl.js';
import { type PanoramaImage } from '../../../../src/panorama/panoramaImage.js';
import { timeout } from '../../helpers/helpers.js';

function getPointFeatures(): Feature[] {
  return [1, 2, 3, 4].map(
    (i) =>
      new Feature({
        geometry: new Point([i, i, 1]),
      }),
  );
}

describe('VectorTilePanoramaImpl', () => {
  let map: PanoramaMap;
  let layer: VectorTileLayer;
  let getFeaturesForExtent: sinon.SinonStub;
  let vectorTilePanoramaImpl: VectorTilePanoramaImpl;
  let image: PanoramaImage;
  let features: Feature[];
  let destroyImage: () => void;

  before(async () => {
    map = getPanoramaMap();
    await map.activate();
    const { panoramaImage, destroy } = await getPanoramaImage();
    image = panoramaImage;
    map.setCurrentImage(image);
    destroyImage = destroy;
    layer = new VectorTileLayer({});
    // @ts-expect-error: doing some hacking here
    layer._supportedMaps.push(map.className);
    features = getPointFeatures();
  });

  beforeEach(() => {
    [vectorTilePanoramaImpl] = layer.getImplementationsForMap(
      map,
    ) as VectorTilePanoramaImpl[];
    getFeaturesForExtent = sinon
      .stub(layer.tileProvider, 'getFeaturesForExtent')
      .resolves(features);
  });

  afterEach(() => {
    layer.removedFromMap(map);
    getFeaturesForExtent.restore();
  });

  after(() => {
    layer.destroy();
    map.destroy();
    destroyImage();
  });

  describe('initialization', () => {
    it('should add the primitive collection to the map on initialization', async () => {
      await vectorTilePanoramaImpl.initialize();
      expect(map.getCesiumWidget().scene.primitives.length).to.equal(1);
    });
  });

  describe('activating the implementation', () => {
    describe('without an image set', () => {
      before(() => {
        map.setCurrentImage();
      });

      after(() => {
        map.setCurrentImage(image);
      });

      it('should show the primitive collection', async () => {
        await vectorTilePanoramaImpl.activate();
        expect(
          (map.getCesiumWidget().scene.primitives.get(0) as PrimitiveCollection)
            .show,
        ).to.be.true;
      });
    });

    describe('with an image set', () => {
      it('should show the primitive collection', async () => {
        await vectorTilePanoramaImpl.activate();
        expect(
          (map.getCesiumWidget().scene.primitives.get(0) as PrimitiveCollection)
            .show,
        ).to.be.true;
      });

      it('should load the features for the current image extent', async () => {
        await vectorTilePanoramaImpl.activate();
        await timeout(0);
        expect(vectorTilePanoramaImpl.source.getFeatures()).to.have.members(
          features,
        );
      });
    });
  });

  describe('changing the active image', () => {
    beforeEach(async () => {
      await vectorTilePanoramaImpl.activate();
      await timeout(0);
    });

    describe('without an image set', () => {
      before(() => {
        map.setCurrentImage();
      });

      after(() => {
        map.setCurrentImage(image);
      });

      it('should load the features in the image extent', async () => {
        expect(vectorTilePanoramaImpl.source.getFeatures()).to.be.empty;
        map.setCurrentImage(image);
        await timeout(0);
        expect(vectorTilePanoramaImpl.source.getFeatures()).to.have.members(
          features,
        );
      });
    });

    describe('with an image set', () => {
      after(() => {
        map.setCurrentImage(image);
      });

      it('should clear the source', async () => {
        map.setCurrentImage();
        await timeout(0);
        expect(vectorTilePanoramaImpl.source.getFeatures()).to.be.empty;
      });
    });

    describe('if inactive', () => {
      beforeEach(() => {
        vectorTilePanoramaImpl.deactivate();
      });

      after(() => {
        map.setCurrentImage(image);
      });

      it('should do nothing', async () => {
        const featuresBefore = vectorTilePanoramaImpl.source.getFeatures();
        map.setCurrentImage();
        await timeout(0);
        expect(vectorTilePanoramaImpl.source.getFeatures()).to.have.members(
          featuresBefore,
        );
      });
    });
  });
});
