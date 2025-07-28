import { expect } from 'chai';
import type { SinonSandbox, SinonStub } from 'sinon';
import sinon from 'sinon';
import { Feature } from 'ol';
import Point from 'ol/geom/Point.js';
import RBush from 'rbush';
import PanoramaDataset, {
  type PanoramaDatasetOptions,
} from '../../../src/layer/panoramaDatasetLayer.js';
import type { TileProviderRTreeEntry } from '../../../src/layer/tileProvider/tileProvider.js';
import { panoramaFeature } from '../../../src/layer/vectorSymbols.js';

describe('PanoramaDatasetLayer', () => {
  describe('finding the closest image', () => {
    let sandbox: SinonSandbox;
    let dataset: PanoramaDataset;
    let getFeaturesForExtent: SinonStub;

    before(() => {
      sandbox = sinon.createSandbox();
      dataset = new PanoramaDataset({
        url: '',
      });
      getFeaturesForExtent = sandbox.stub(
        dataset.tileProvider,
        'getFeaturesForExtent',
      );
    });

    afterEach(() => {
      sandbox.restore();
    });

    after(() => {
      dataset.destroy();
    });

    it('should find the closest image and return the distance sqrd', async () => {
      getFeaturesForExtent.resolves([
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

      const result = await dataset.getClosestImage([0, 1]);
      expect(result).to.have.property('imageName', 'test');
      expect(result).to.have.property('distanceSqrd', 1);
    });

    it('should return undefined, if no features are returned in said extent', async () => {
      getFeaturesForExtent.resolves([]);
      const result = await dataset.getClosestImage([0, 1]);
      expect(result).to.be.undefined;
    });
  });

  describe('loading features', () => {
    let dataset: PanoramaDataset;

    beforeEach(() => {
      dataset = new PanoramaDataset({
        url: '',
      });
    });

    afterEach(() => {
      dataset.destroy();
    });

    it('should add the panorama feature symbol to every loaded feature', () => {
      const features = [
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
      ];
      const rtree = new RBush<TileProviderRTreeEntry>();
      rtree.load(
        features.map((feature) => {
          const geometry = feature.getGeometry()!;
          const extent = geometry.getExtent();
          return {
            minX: extent[0],
            minY: extent[1],
            maxX: extent[2],
            maxY: extent[3],
            value: feature,
          };
        }),
      );

      dataset.tileProvider.tileLoadedEvent.raiseEvent({
        tileId: 'foo',
        rtree,
      });

      features.forEach((feature) => {
        expect(feature)
          .to.have.property(panoramaFeature)
          .and.to.eql({
            name: feature.get('name') as string,
            time: feature.get('time') as number,
            dataset,
          });
      });
    });
  });

  describe('config', () => {
    describe('of an unconfigured dataset', () => {
      it('should only return required keys', () => {
        const config = new PanoramaDataset({ url: '' }).toJSON();
        expect(config).to.have.keys(['type', 'url', 'name']);
      });
    });

    describe('of a configured dataset', () => {
      let input: PanoramaDatasetOptions;
      let output: PanoramaDatasetOptions;

      before(() => {
        input = {
          url: 'foo',
          baseLevel: 18,
          cameraOffset: 100,
        };

        output = new PanoramaDataset(input).toJSON();
      });

      it('should configure the url', () => {
        expect(output).to.have.property('url', input.url);
      });

      it('should configure the base level', () => {
        expect(output).to.have.property('baseLevel', input.baseLevel);
      });

      it('should configure the camera offset', () => {
        expect(output).to.have.property('cameraOffset', input.cameraOffset);
      });
    });
  });
});
