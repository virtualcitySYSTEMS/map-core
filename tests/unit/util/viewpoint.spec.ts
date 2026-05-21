import type { GeoTIFF } from 'geotiff';
import { Cartesian3, HeadingPitchRoll, Matrix4 } from '@vcmap-cesium/engine';
import { expect } from 'chai';
import Viewpoint, {
  getViewpointForPanoramaImage,
} from '../../../src/util/viewpoint.js';
import type { PanoramaImage } from '../../../src/panorama/panoramaImage.js';
import type { PanoramaTileProvider } from '../../../src/panorama/panoramaTileProvider.js';
import { arrayCloseTo } from '../helpers/helpers.js';

describe('Viewpoint', () => {
  describe('isValid', () => {
    it('should be invalid if missing camera or ground position', () => {
      const vp = new Viewpoint({
        name: 'hauptbhnhf',
        distance: 2480.9491308407964,
        groundPosition: [13.43080593131163],
        heading: 337.52854532052663,
        pitch: -41.10601490149314,
        roll: 359.8987925198945,
        animate: false,
      });
      expect(vp.isValid()).to.be.false;
    });

    it('should be invalid if coordinates are out of bounds', () => {
      expect(
        new Viewpoint({
          name: 'hauptbhnhf',
          distance: 2480.9491308407964,
          groundPosition: [190, 30, 3],
          heading: 337.52854532052663,
          pitch: -41.10601490149314,
          roll: 359.8987925198945,
          animate: false,
        }).isValid(),
      ).to.be.false;
      expect(
        new Viewpoint({
          name: 'hauptbhnhf',
          distance: 2480.9491308407964,
          cameraPosition: [80, 100, 3],
          heading: 337.52854532052663,
          pitch: -41.10601490149314,
          roll: 359.8987925198945,
          animate: false,
        }).isValid(),
      ).to.be.false;
    });

    it('should be invalid on non-numeric axis parameters', () => {
      const vp = new Viewpoint({
        name: 'hauptbhnhf',
        distance: 2480.9491308407964,
        cameraPosition: [
          13.441330102798556, 52.49571151602689, 1666.0679354733245,
        ],
        groundPosition: [
          13.43080593131163, 52.51123474050636, 35.229622864799836,
        ],
        heading: 337.52854532052663,
        pitch: -41.10601490149314,
        roll: 359.8987925198945,
        animate: false,
      });
      expect(vp.isValid()).to.be.true;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      vp.roll = '123';
      expect(vp.isValid()).to.be.false;
    });

    it('should be valid if no distance is given when only setting ground position', () => {
      const vp = new Viewpoint({
        name: 'hauptbhnhf',
        distance: NaN,
        groundPosition: [
          13.43080593131163, 52.51123474050636, 35.229622864799836,
        ],
        heading: 337.52854532052663,
        pitch: -41.10601490149314,
        roll: 359.8987925198945,
        animate: false,
      });
      expect(vp).to.have.property('distance', 1000);
      expect(vp.isValid()).to.be.true;
    });
  });

  describe('comparing viewpoints', () => {
    let vp1: Viewpoint;
    let vp2: Viewpoint;

    beforeEach(() => {
      vp1 = new Viewpoint({
        name: 'hauptbhnhf',
        distance: 2480.9491308407964,
        cameraPosition: [
          13.441330102798556, 52.49571151602689, 1666.0679354733245,
        ],
        groundPosition: [
          13.43080593131163, 52.51123474050636, 35.229622864799836,
        ],
        heading: 337.52854532052663,
        pitch: -41.10601490149314,
        roll: 359.8987925198945,
        animate: false,
      });

      vp2 = new Viewpoint({
        name: 'hauptbhnhf',
        distance: 2480.9491308407964,
        cameraPosition: [
          13.441330102798556, 52.49571151602689, 1666.0679354733245,
        ],
        groundPosition: [
          13.43080593131163, 52.51123474050636, 35.229622864799836,
        ],
        heading: 337.52854532052663,
        pitch: -41.10601490149314,
        roll: 359.8987925198945,
        animate: false,
      });
    });

    it('should return true, if the viewpoints are equal', () => {
      expect(vp1.equals(vp1)).to.be.true;
    });

    it('should return true, if the viewpoints values are equal', () => {
      expect(vp1.equals(vp2)).to.be.true;
    });

    it('should return true, if the viewpoints values are equal within epsilon', () => {
      vp2.distance! += 0.01;
      vp2.heading += 0.01;
      vp2.pitch -= 0.01;
      vp2.roll -= 0.01;
      vp2.groundPosition![0] += 0.01;
      vp2.cameraPosition![0] += 0.01;
      expect(vp1.equals(vp2, 0.1)).to.be.true;
      expect(vp1.equals(vp2, 0.05)).to.be.true;
    });

    it('should return true, if the viewpoints angles are equal within zeroToTwoPi Range', () => {
      vp1.heading = 0;
      vp1.pitch = -90;
      vp2.heading = 360;
      vp2.pitch = 270;
      expect(vp1.equals(vp2)).to.be.true;
      expect(vp1.equals(vp2, 0.05)).to.be.true;
    });

    it('should return false, if other viewpoint is null', () => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      expect(vp1.equals(null)).to.be.false;
    });

    it('should return false, if the viewpoints values are NOT equal', () => {
      vp2.distance! += 0.01;
      vp2.heading += 0.01;
      vp2.pitch -= 0.01;
      vp2.roll -= 0.01;
      vp2.groundPosition![0] += 0.01;
      vp2.cameraPosition![0] += 0.01;
      expect(vp1.equals(vp2)).to.be.false;
    });

    it('should return false, if the viewpoints values are NOT equal within epsilon', () => {
      vp2.distance! += 0.01;
      vp2.heading += 0.01;
      vp2.pitch -= 0.01;
      vp2.roll -= 0.01;
      vp2.groundPosition![0] += 0.01;
      vp2.cameraPosition![0] += 0.01;
      expect(vp1.equals(vp2, 0.01)).to.be.false;
      expect(vp1.equals(vp2, 0.001)).to.be.false;
    });
  });

  describe('getting the viewpoint for a panorama image', () => {
    let panoramaImage: PanoramaImage;
    let position: Cartesian3;
    let orientation: HeadingPitchRoll;

    beforeEach(() => {
      position = Cartesian3.fromDegrees(0, 0, 0);
      orientation = HeadingPitchRoll.fromDegrees(0, 0, 0);

      panoramaImage = {
        hasDepth: false,
        hasIntensity: false,
        image: {} as unknown as GeoTIFF,
        invModelMatrix: Matrix4.IDENTITY,
        maxDepth: 0,
        maxLevel: 0,
        minLevel: 0,
        modelMatrix: Matrix4.IDENTITY,
        name: '',
        orientation,
        position,
        tileProvider: {} as unknown as PanoramaTileProvider,
        tileSize: [512, 512],
        up: Cartesian3.UNIT_Z,
        destroy(): void {},
        equals(): boolean {
          return false;
        },
        getPositionAtImageCoordinate(): Promise<Cartesian3 | undefined> {
          return Promise.resolve(undefined);
        },
        getPositionAtImageCoordinateMostDetailed(): Promise<
          Cartesian3 | undefined
        > {
          return Promise.resolve(undefined);
        },
      };
    });

    it('should get the viewpoint from the image', () => {
      const vp = getViewpointForPanoramaImage(panoramaImage);
      expect(vp)
        .to.have.property('cameraPosition')
        .which.is.an('array')
        .and.has.members([0, 0, 0]);

      expect(vp).to.have.property('heading', 0);
      expect(vp).to.have.property('pitch', 0);
      expect(vp).to.have.property('roll', 0);
    });

    it('should ensure the correct position is used for the camera', () => {
      Cartesian3.fromDegrees(10, 20, 25, undefined, position);
      const vp = getViewpointForPanoramaImage(panoramaImage);
      expect(vp).to.have.property('cameraPosition').which.is.an('array');
      arrayCloseTo(vp.cameraPosition!, [10, 20, 25], 0.0001);
    });

    it('should ensure the correct orientation is used for the camera', () => {
      HeadingPitchRoll.fromDegrees(10, 20, 25, orientation);
      const vp = getViewpointForPanoramaImage(panoramaImage);
      expect(vp).to.have.property('heading', 10);
      expect(vp).to.have.property('pitch', 20);
      expect(vp).to.have.property('roll', 25);
    });

    it('should handle pitch > 180', () => {
      HeadingPitchRoll.fromDegrees(10, 200, 25, orientation);
      const vp = getViewpointForPanoramaImage(panoramaImage);
      expect(vp).to.have.property('heading', 10);
      expect(vp).to.have.property('pitch', -160);
      expect(vp).to.have.property('roll', 25);
    });

    it('should handle pitch < -180', () => {
      HeadingPitchRoll.fromDegrees(10, -200, 25, orientation);
      const vp = getViewpointForPanoramaImage(panoramaImage);
      expect(vp).to.have.property('heading', 10);
      expect(vp).to.have.property('pitch', 160);
      expect(vp).to.have.property('roll', 25);
    });

    it('should handle roll > 180', () => {
      HeadingPitchRoll.fromDegrees(10, 20, 200, orientation);
      const vp = getViewpointForPanoramaImage(panoramaImage);
      expect(vp).to.have.property('heading', 10);
      expect(vp).to.have.property('pitch', 20);
      expect(vp).to.have.property('roll', -160);
    });

    it('should handle roll < -180', () => {
      HeadingPitchRoll.fromDegrees(10, 20, -200, orientation);
      const vp = getViewpointForPanoramaImage(panoramaImage);
      expect(vp).to.have.property('heading', 10);
      expect(vp).to.have.property('pitch', 20);
      expect(vp).to.have.property('roll', 160);
    });
  });
});
