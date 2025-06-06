import { expect } from 'chai';
import {
  Cartesian3,
  HeadingPitchRoll,
  Math as CesiumMath,
  Matrix4,
} from '@vcmap-cesium/engine';
import type { GeoTIFF } from 'geotiff';
import { fromFile } from 'geotiff';
import type { PanoramaImage } from '../../../src/panorama/panoramaImage.js';
import { createPanoramaImage } from '../../../src/panorama/panoramaImage.js';
import { getPanoramaImage } from '../helpers/panoramaHelpers.js';
import { imageSphericalToCartesian } from '../../../src/panorama/sphericalCoordinates.js';

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

  describe('depth handling', () => {
    let panoramaImage: PanoramaImage;
    let destroy: () => void;

    before(async () => {
      ({ panoramaImage, destroy } = await getPanoramaImage({ depth: true }));
    });

    after(() => {
      destroy();
    });

    it('should calculate the position of an image position', async () => {
      const imageCoordinate: [number, number] = [
        CesiumMath.PI,
        CesiumMath.PI_OVER_TWO,
      ];

      const position =
        await panoramaImage.getPositionAtImageCoordinate(imageCoordinate);

      const expectedPosition = imageSphericalToCartesian(imageCoordinate);
      Cartesian3.normalize(expectedPosition, expectedPosition);
      Cartesian3.multiplyByScalar(
        expectedPosition,
        0.5235370397567749,
        expectedPosition,
      );
      Matrix4.multiplyByPoint(
        panoramaImage.modelMatrix,
        expectedPosition,
        expectedPosition,
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

    it('should calculate the position of an image position using most detailed depth data', async () => {
      const imageCoordinate: [number, number] = [
        CesiumMath.PI,
        CesiumMath.PI_OVER_TWO,
      ];

      const position =
        await panoramaImage.getPositionAtImageCoordinateMostDetailed(
          imageCoordinate,
        );

      const expectedPosition = imageSphericalToCartesian(imageCoordinate);
      Cartesian3.normalize(expectedPosition, expectedPosition);
      Cartesian3.multiplyByScalar(
        expectedPosition,
        129 / 255,
        expectedPosition,
      );
      Matrix4.multiplyByPoint(
        panoramaImage.modelMatrix,
        expectedPosition,
        expectedPosition,
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
      const position = await panoramaImage.getPositionAtImageCoordinate([
        CesiumMath.PI_OVER_FOUR,
        CesiumMath.toRadians(-5),
      ]);

      await panoramaImage.getPositionAtImageCoordinate([
        CesiumMath.PI_OVER_FOUR,
        CesiumMath.toRadians(1),
      ]);
      expect(position).to.be.undefined;
    });

    it('should handle requesting pixels on the border of the image', async () => {
      const imageCoordinate: [number, number] = [
        CesiumMath.TWO_PI,
        CesiumMath.PI_OVER_TWO,
      ];
      const position =
        await panoramaImage.getPositionAtImageCoordinate(imageCoordinate);

      const expectedPosition = imageSphericalToCartesian(imageCoordinate);
      Cartesian3.normalize(expectedPosition, expectedPosition);
      Cartesian3.multiplyByScalar(
        expectedPosition,
        0.4921644926071167,
        expectedPosition,
      );
      Matrix4.multiplyByPoint(
        panoramaImage.modelMatrix,
        expectedPosition,
        expectedPosition,
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
      expect(panoramaImage.maxDepth).to.equal(1);
    });

    it('should read in a file with wrong metadata version', async () => {
      const newImage = await fromFile('tests/data/panorama/noVersionDepth.tif');
      const badMetadataPanoramaDepth = await createPanoramaImage(
        panoramaImage.image,
        {
          depthImage: newImage,
        },
      );

      expect(badMetadataPanoramaDepth.maxDepth).to.equal(50);
      badMetadataPanoramaDepth.destroy();
      newImage.close();
    });
  });
});
