import type { GeoTIFF } from 'geotiff';
import { fromFile } from 'geotiff';
import { expect } from 'chai';
import {
  Cartesian3,
  Math as CesiumMath,
  Transforms,
} from '@vcmap-cesium/engine';
import type { PanoramaDepth } from '../../../src/panorama/panoramaDepth.js';
import { createPanoramaDepth } from '../../../src/panorama/panoramaDepth.js';

/**
 * Gets the pixel value in depth for the provided test dataset, given the pixels height (all rows contain the same data)
 * @param pixelHeight
 */
function getPixelValue(pixelHeight: number): number {
  const value = pixelHeight / 255 / (1 / (2 ** 16 - 1));
  return (value - 1) / (2 ** 16 - 1 - 1);
}

describe('PanoramaDepth', () => {
  let image: GeoTIFF;
  let panoramaDepth: PanoramaDepth;

  before(async () => {
    image = await fromFile('tests/data/panorama/testDepthGeotiff.tif');
    const matrix = Transforms.eastNorthUpToFixedFrame(
      Cartesian3.fromDegrees(0, 0),
    );
    panoramaDepth = await createPanoramaDepth(image, matrix, {
      decode(
        _fileDirectory: unknown,
        buffer: ArrayBuffer,
      ): Promise<ArrayBuffer> {
        return Promise.resolve(buffer);
      },
    });
  });

  after(() => {
    panoramaDepth.destroy();
    image.close();
  });

  it('should create calculate the position of an image position', async () => {
    const position = await panoramaDepth.getPositionAtImageCoordinate([
      CesiumMath.PI,
      CesiumMath.PI_OVER_TWO,
    ]);
    const expectedPosition = Cartesian3.subtract(
      Cartesian3.fromDegrees(0, 0),
      new Cartesian3(0, getPixelValue(128), 0),
      new Cartesian3(),
    );

    expect(position).to.be.instanceOf(Cartesian3);
    expect(
      Cartesian3.equalsEpsilon(
        position,
        expectedPosition,
        CesiumMath.EPSILON10,
      ),
    ).to.be.true;
  });

  it('should return undefined, if no depth value could be determined', async () => {
    const position = await panoramaDepth.getPositionAtImageCoordinate(
      [CesiumMath.PI_OVER_FOUR, CesiumMath.toRadians(-5)],
      1,
    );

    await panoramaDepth.getPositionAtImageCoordinate(
      [CesiumMath.PI_OVER_FOUR, CesiumMath.toRadians(1)],
      1, // the top strip is made up of 0s
    );
    expect(position).to.be.undefined;
  });

  it('should handle requesting pixels on the border of the image', async () => {
    const position = await panoramaDepth.getPositionAtImageCoordinate(
      [CesiumMath.TWO_PI, CesiumMath.PI_OVER_TWO],
      1,
    );

    const expectedPosition = Cartesian3.add(
      Cartesian3.fromDegrees(0, 0),
      new Cartesian3(0, getPixelValue(128), 0),
      new Cartesian3(),
    );

    expect(position).to.be.instanceOf(Cartesian3);
    expect(
      Cartesian3.equalsEpsilon(
        position,
        expectedPosition,
        CesiumMath.EPSILON10,
      ),
    ).to.be.true;
  });

  it('should parse metadata', () => {
    expect(panoramaDepth.maxDepth).to.equal(1);
  });

  it('should read in a file with wrong metadata version', async () => {
    const newImage = await fromFile('tests/data/panorama/noVersionDepth.tif');
    const matrix = Transforms.eastNorthUpToFixedFrame(
      Cartesian3.fromDegrees(0, 0),
    );
    const badMetadataPanoramaDepth = await createPanoramaDepth(
      newImage,
      matrix,
      {
        decode(
          _fileDirectory: unknown,
          buffer: ArrayBuffer,
        ): Promise<ArrayBuffer> {
          return Promise.resolve(buffer);
        },
      },
    );

    expect(badMetadataPanoramaDepth.maxDepth).to.equal(50);
    badMetadataPanoramaDepth.destroy();
    newImage.close();
  });
});
