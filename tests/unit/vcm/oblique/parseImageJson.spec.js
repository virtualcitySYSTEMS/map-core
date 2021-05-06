import proj4 from 'proj4';
import { get as getProjection } from 'ol/proj.js';
import Cartesian3 from '@vcmap/cesium/Source/Core/Cartesian3.js';
import Matrix4 from '@vcmap/cesium/Source/Core/Matrix4.js';
import Matrix3 from '@vcmap/cesium/Source/Core/Matrix3.js';
import { parseImageData, parseImageMeta, parseLegacyImageData } from '../../../../src/vcs/vcm/oblique/parseImageJson.js';
import legacyImageJson from '../../../data/oblique/imageData/imagev34.json';
import imageJson from '../../../data/oblique/imageData/imagev35.json';
import imageJsonPerImageSize from '../../../data/oblique/imageData/imagev35PerImageSize.json';
import tiledImageData from '../../../data/oblique/tiledImageData/image.json';
import { ObliqueViewDirection } from '../../../../src/vcs/vcm/oblique/ObliqueViewDirection.js';

describe('parsers', () => {
  let sandbox;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('parseImageMeta', () => {
    describe('legacy config', () => {
      let imageMetas;

      before(() => {
        imageMetas = parseImageMeta(legacyImageJson, 'http://localhost', getProjection('EPSG:25833'));
      });

      it('should parse each cameras info', () => {
        expect(imageMetas).to.have.lengthOf(4);
      });

      it('should name image metas after the cameras they are based on', () => {
        const names = imageMetas.map(m => m.name);
        expect(names).to.have.members(Object.keys(legacyImageJson.generalImageInfo.cameraParameter));
      });

      it('should set size, tileSize, tileResolution from the json', () => {
        imageMetas.forEach((meta) => {
          expect(meta.size).to.have.ordered.members([11608, 8708]);
          expect(meta.tileSize).to.have.ordered.members([512, 512]);
          expect(meta.tileResolution).to.have.ordered.members(legacyImageJson.generalImageInfo['tile-resolution']);
        });
      });

      it('should set the cameras principalPoint, pixelSize, radialE2F, radialF2E', () => {
        Object.entries(legacyImageJson.generalImageInfo.cameraParameter).forEach(([cameraName, options]) => {
          const meta = imageMetas.find(m => m.name === cameraName);
          expect(meta.principalPoint).to.equal(options['principal-point']);
          expect(meta.pixelSize).to.equal(options['pixel-size']);
          expect(meta.radialE2F).to.equal(options['radial-distorsion-expected-2-found']);
          expect(meta.radialF2E).to.equal(options['radial-distorsion-found-2-expected']);
        });
      });
    });

    describe('regular config', () => {
      let imageMetas;

      before(() => {
        imageMetas = parseImageMeta(tiledImageData, getProjection('EPSG:25833'), 'http://localhost');
      });

      it('should parse each cameras info', () => {
        expect(imageMetas).to.have.lengthOf(4);
      });

      it('should name image metas after the cameras they are based on', () => {
        const names = imageMetas.map(m => m.name);
        expect(names).to.have.members(tiledImageData.generalImageInfo.cameraParameter.map(c => c.name));
      });

      it('should set size, tileSize, tileResolution from the json', () => {
        imageMetas.forEach((meta) => {
          expect(meta.size).to.have.ordered.members([11608, 8708]);
          expect(meta.tileSize).to.have.ordered.members([512, 512]);
          expect(meta.tileResolution).to.have.ordered.members(tiledImageData.generalImageInfo['tile-resolution']);
        });
      });

      it('should set the cameras principalPoint, pixelSize, radialE2F, radialF2E', () => {
        tiledImageData.generalImageInfo.cameraParameter.forEach((options) => {
          const meta = imageMetas.find(m => m.name === options.name);
          expect(meta.principalPoint).to.equal(options['principal-point']);
          expect(meta.pixelSize).to.equal(options['pixel-size']);
          expect(meta.radialE2F).to.equal(options['radial-distorsion-expected-2-found']);
          expect(meta.radialF2E).to.equal(options['radial-distorsion-found-2-expected']);
        });
      });
    });

    describe('CRS handling', () => {
      it('should add a the projection with a random identifier, if not passed a default projection', () => {
        const defs = sandbox.spy(proj4, 'defs');
        const imageMetas = parseImageMeta(tiledImageData, 'http://localhost');
        expect(defs).to.have.been.calledOnce;
        const [id] = defs.getCall(0).args;
        const projection = getProjection(id);
        imageMetas.forEach((meta) => {
          expect(meta.projection).to.equal(projection);
        });
        defs.restore();
      });

      it('should ignore the image json crs, if passed a projection', () => {
        const defs = sandbox.spy(proj4, 'defs');
        parseImageMeta(tiledImageData, 'http://localhost', getProjection('EPSG:25833'));
        expect(defs).to.not.have.been.called;
      });
    });

    describe('default meta', () => {
      let imageMetas;

      before(() => {
        const noCamera = {
          generalImageInfo: { ...tiledImageData.generalImageInfo },
          tileSize: 12,
          availableTiles: tiledImageData.availableTiles,
        };
        delete noCamera.generalImageInfo.cameraParameter;
        imageMetas = parseImageMeta(noCamera, getProjection('EPSG:25833'), 'http://localhost');
      });

      it('should create a default meta, if no cameras are present', () => {
        expect(imageMetas).to.have.lengthOf(1);
        expect(imageMetas[0].name).to.equal('default');
      });

      it('should set size, tileSize, tileResolution from the json', () => {
        imageMetas.forEach((meta) => {
          expect(meta.size).to.have.ordered.members([11608, 8708]);
          expect(meta.tileSize).to.have.ordered.members([512, 512]);
          expect(meta.tileResolution).to.have.ordered.members(tiledImageData.generalImageInfo['tile-resolution']);
        });
      });
    });
  });

  describe('parseImageData', () => {
    let imageMetas;
    let images;

    before(() => {
      imageMetas = parseImageMeta(imageJson, 'http://localhost', getProjection('EPSG:25833'));
      images = parseImageData(imageJson, imageMetas);
    });

    it('should parse all images', () => {
      expect(images).to.have.length(8);
    });

    it('should assign the image meta based on the cameraIndex', () => {
      expect(images[0].meta).to.equal(imageMetas[1]);
    });

    it('should assign the first meta, if there is no cameraName', () => {
      const noCameraName = {
        images: imageJson.images.map((i) => {
          const image = i.slice();
          image.splice(1, 1);
          return image;
        }),
      };
      const noCameraImages = parseImageData(noCameraName, imageMetas);
      noCameraImages.forEach((i) => {
        expect(i.meta).to.equal(imageMetas[0]);
      });
    });

    it('should assign name, viewDirection, viewDirectionAngle, groundCoordinates, centerPointOnGround', () => {
      const image = images[0];
      expect(image.viewDirection).to.equal(ObliqueViewDirection.NORTH);
      expect(image.name).to.equal(imageJson.images[1][0]);
      expect(image.viewDirectionAngle).to.equal(1.57237115711512);
      expect(image.groundCoordinates).to.equal(imageJson.images[1][4]);
      expect(image.centerPointOnGround).to.equal(imageJson.images[1][5]);
    });

    it('should create a Cartesian3 projectionCenter', () => {
      const image = images[0];
      expect(image.projectionCenter).to.be.an.instanceOf(Cartesian3);
      const packed = [];
      Cartesian3.pack(image.projectionCenter, packed);
      expect(packed).to.have.members(imageJson.images[1][6]);
    });

    it('should creat a Matrix3 for pToRealworld', () => {
      const image = images[0];
      expect(image.pToRealworld).to.be.an.instanceOf(Matrix3);
    });

    it('should create a Matrix4 for pToImage', () => {
      const image = images[0];
      expect(image.pToImage).to.be.an.instanceOf(Matrix4);
    });
  });

  describe('parseLegacyImageData', () => {
    let imageMetas;
    let images;

    before(() => {
      imageMetas = parseImageMeta(legacyImageJson, 'http://localhost', getProjection('EPSG:25833'));
      images = parseLegacyImageData(legacyImageJson, imageMetas);
    });

    it('should parse all images', () => {
      expect(images).to.have.length(3);
    });

    it('should assign the image meta based on the cameraName', () => {
      const meta = imageMetas.find(m => m.name === legacyImageJson.images[0]['camera-name']);
      expect(images[0].meta).to.equal(meta);
    });

    it('should assign the first meta, if there is no cameraName', () => {
      const noCameraName = {
        version: legacyImageJson.version,
        generalImageInfo: legacyImageJson.generalImageInfo,
        images: legacyImageJson.images.map((i) => {
          const image = { ...i };
          delete image['camera-name'];
          return image;
        }),
      };
      const noCameraImages = parseLegacyImageData(noCameraName, imageMetas);
      noCameraImages.forEach((i) => {
        expect(i.meta).to.equal(imageMetas[0]);
      });
    });

    it('should assign name, viewDirection, viewDirectionAngle, groundCoordinates, centerPointOnGround', () => {
      const image = images[0];
      expect(image.viewDirection).to.equal(ObliqueViewDirection.NORTH);
      expect(image.name).to.equal(legacyImageJson.images[0].name);
      expect(image.groundCoordinates).to.equal(legacyImageJson.images[0].groundCoordinates);
      expect(image.centerPointOnGround).to.equal(legacyImageJson.images[0].centerPointOnGround);
    });

    it('should create a Cartesian3 projectionCenter', () => {
      const image = images[0];
      expect(image.projectionCenter).to.be.an.instanceOf(Cartesian3);
      const packed = [];
      Cartesian3.pack(image.projectionCenter, packed);
      expect(packed).to.have.members(legacyImageJson.images[0]['projection-center']);
    });

    it('should creat a Matrix3 for pToRealworld', () => {
      const image = images[0];
      expect(image.pToRealworld).to.be.an.instanceOf(Matrix3);
    });

    it('should create a Matrix4 for pToImage', () => {
      const image = images[0];
      expect(image.pToImage).to.be.an.instanceOf(Matrix4);
    });

    it('should not assign viewDirectionAngle, if the version is below 3.4.18', () => {
      const oldVersion = {
        ...legacyImageJson,
        version: 'v3.4-16-ga9377e0_64bit',
      };
      const oldVersionImages = parseLegacyImageData(oldVersion, imageMetas);
      oldVersionImages.forEach((i) => {
        expect(i.viewDirectionAngle).to.be.undefined;
      });
    });
  });

  describe('parsing of per image size and tileResolution', () => {
    let imageMetas;
    let images;

    before(() => {
      imageMetas = parseImageMeta(imageJsonPerImageSize, 'http://localhost', getProjection('EPSG:25833'));
      images = parseImageData(imageJsonPerImageSize, imageMetas);
    });

    it('should parse all images', () => {
      expect(images).to.have.length(8);
    });

    it('should assign the image meta based on the cameraIndex', () => {
      expect(images[0].meta).to.equal(imageMetas[1]);
    });

    it('should extend the metas with the image size, if its missing', () => {
      expect(imageMetas[0].size).to.be.an('array').with.members([11608, 8708]);
    });

    it('should extend the metas tile resolution, if missing', () => {
      expect(imageMetas[0].tileResolution).to.be.an('array').with.members([32, 16, 8, 4, 2, 1]);
    });

    it('should not overwrite existing size', () => {
      expect(imageMetas[1].size).to.be.an('array').with.members([1000, 1000]);
    });

    it('should not overwrite existing tile resolution', () => {
      expect(imageMetas[1].tileResolution).to.be.an('array').with.members([16, 8, 4, 2, 1]);
    });
  });
});

