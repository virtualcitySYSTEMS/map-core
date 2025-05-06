import { expect } from 'chai';
import { Cartesian3, HeadingPitchRoll } from '@vcmap-cesium/engine';
import type { GeoTIFF } from 'geotiff';
import { fromFile } from 'geotiff';
import type { PanoramaImage } from '../../../src/panorama/panoramaImage.js';
import { createPanoramaImage } from '../../../src/panorama/panoramaImage.js';

describe('PanoramaImage', () => {
  describe('metadata handling', () => {
    let image: GeoTIFF | undefined;
    let panoramaImage: PanoramaImage | undefined;
    let expectedOrientation: HeadingPitchRoll;
    let expectedPosition: Cartesian3;

    before(() => {
      expectedPosition = Cartesian3.fromDegrees(9.7357942, 52.3679325, 56.12);
      expectedOrientation = new HeadingPitchRoll(
        3.3942763612387012,
        6.2671176315528,
        6.271835954652643,
      );
    });

    afterEach(() => {
      if (image) {
        image.close();
      }

      if (panoramaImage) {
        panoramaImage.destroy();
      }
    });

    it('should use the default metadata if the version is missing', async () => {
      image = await fromFile('tests/data/panorama/noVersionRgb.tif');
      panoramaImage = await createPanoramaImage(image);
      expect(panoramaImage.position).to.eql(Cartesian3.fromDegrees(0, 0, 0));
      expect(panoramaImage.orientation).to.eql(
        HeadingPitchRoll.fromDegrees(0, 0, 0),
      );
      expect(panoramaImage.hasDepth).to.be.false;
      expect(panoramaImage.hasIntensity).to.be.false;
    });

    it('should handle malformed position', async () => {
      image = await fromFile('tests/data/panorama/badPosition.tif');
      panoramaImage = await createPanoramaImage(image);
      expect(panoramaImage.position).to.eql(Cartesian3.fromDegrees(0, 0, 0));
      expect(panoramaImage.orientation).to.eql(expectedOrientation);
      expect(panoramaImage.hasDepth).to.be.true;
      expect(panoramaImage.hasIntensity).to.be.true;
    });

    it('should handle malformed orientation', async () => {
      image = await fromFile('tests/data/panorama/badOrientation.tif');
      panoramaImage = await createPanoramaImage(image);
      expect(panoramaImage.position).to.eql(expectedPosition);
      expect(panoramaImage.orientation).to.eql(
        HeadingPitchRoll.fromDegrees(0, 0, 0),
      );
      expect(panoramaImage.hasDepth).to.be.true;
      expect(panoramaImage.hasIntensity).to.be.true;
    });

    it('should handle smaller levels then expected', async () => {
      image = await fromFile('tests/data/panorama/lowOverview.tif');
      panoramaImage = await createPanoramaImage(image);
      expect(panoramaImage.position).to.eql(expectedPosition);
      expect(panoramaImage.orientation).to.eql(expectedOrientation);
      expect(panoramaImage.hasDepth).to.be.true;
      expect(panoramaImage.hasIntensity).to.be.true;
      expect(panoramaImage.minLevel).to.equal(0);
      expect(panoramaImage.maxLevel).to.equal(0);
    });
  });
});
