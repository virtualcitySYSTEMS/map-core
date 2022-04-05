import { Matrix3, Cartesian3, Matrix4 } from '@vcmap/cesium';
import ObliqueImage from './obliqueImage.js';
import { obliqueViewDirectionNames } from './obliqueViewDirection.js';
import ImageMeta from './obliqueImageMeta.js';
import Projection from '../util/projection.js';

let customObliqueProjectionId = 0;

/**
 * @returns {number}
 */
function getNextObliqueProjectionId() {
  customObliqueProjectionId += 1;
  return customObliqueProjectionId;
}

/**
 * @param {Object} json
 * @returns {ObliqueVersion} version
 */
export function getVersionFromImageJson(json) {
  const version = {
    version: null,
    buildNumber: null,
  };

  if (json.version) {
    const number = json.version.match(/\d+\.\d+/);
    if (number) {
      version.version = Number(number[0]);
    }
    const buildNumber = json.version.match(/-\d+-/);
    if (buildNumber) {
      version.buildNumber = Number(buildNumber[0].match(/\d+/)[0]);
    }
  }
  return version;
}

/**
 * @param {ObliqueImageJson} json
 * @param {string} url
 * @param {import("@vcmap/core").Projection=} projection
 * @param {import("@vcmap/cesium").CesiumTerrainProvider=} terrainProvider
 * @returns {Array<import("@vcmap/core").ObliqueImageMeta>}
 */
export function parseImageMeta(json, url, projection, terrainProvider) {
  let size;
  if (json.generalImageInfo.width && json.generalImageInfo.height) {
    size = /** @type {import("ol/size").Size} */ ([json.generalImageInfo.width, json.generalImageInfo.height]);
  }
  const tileResolution = json.generalImageInfo['tile-resolution'];
  const tileSize = /** @type {import("ol/size").Size} */ ([json.generalImageInfo['tile-width'], json.generalImageInfo['tile-height']]);
  let imageProjection = projection;
  const imageMetas = [];
  if (!imageProjection && json.generalImageInfo.crs) {
    imageProjection = new Projection({
      epsg: getNextObliqueProjectionId(),
      prefix: 'OBLIQUE:',
      proj4: json.generalImageInfo.crs,
    });
  }

  const defaultOptions = {
    size,
    tileResolution,
    tileSize,
    projection: imageProjection,
    url,
    terrainProvider,
  };

  if (json.generalImageInfo.cameraParameter) {
    if (Array.isArray(json.generalImageInfo.cameraParameter)) {
      json.generalImageInfo.cameraParameter.forEach((cameraOption) => {
        imageMetas.push(new ImageMeta({ ...defaultOptions, ...cameraOption }));
      });
    } else if (typeof json.generalImageInfo.cameraParameter === 'object') {
      Object.entries(json.generalImageInfo.cameraParameter).forEach(([name, cameraOption]) => {
        imageMetas.push(new ImageMeta({ name, ...defaultOptions, ...cameraOption }));
      });
    }
  }

  if (imageMetas.length === 0) {
    imageMetas.push(new ImageMeta({ name: 'default', ...defaultOptions }));
  }
  return imageMetas;
}

/**
 * @param {ObliqueImageJson} json
 * @param {Array<import("@vcmap/core").ObliqueImageMeta>} imageMetas
 * @returns {Array<ObliqueImage>}
 */
export function parseImageData(json, imageMetas) {
  const imagesHeader = json.images[0];
  const indices = {
    name: imagesHeader.indexOf('name'),
    width: imagesHeader.indexOf('width'),
    height: imagesHeader.indexOf('height'),
    tileResolution: imagesHeader.indexOf('tile-resolution'),
    viewDirection: imagesHeader.indexOf('view-direction'),
    viewDirectionAngle: imagesHeader.indexOf('view-direction-angle'),
    groundCoordinates: imagesHeader.indexOf('groundCoordinates'),
    centerPointOnGround: imagesHeader.indexOf('centerPointOnGround'),
    cameraIndex: imagesHeader.indexOf('camera-index'),
    projectionCenter: imagesHeader.indexOf('projection-center'),
    pToRealworld: imagesHeader.indexOf('p-to-realworld'),
    pToImage: imagesHeader.indexOf('p-to-image'),
  };

  const images = new Array(json.images.length - 1);
  json.images.forEach((img, index) => {
    if (index === 0) { // skip header image
      return;
    }
    const coordsArrayPToRealworld = [];
    if (img[indices.pToRealworld]) {
      img[indices.pToRealworld].forEach((value) => {
        coordsArrayPToRealworld.push(...value);
      });
    }
    const pToRealworld = img[indices.pToRealworld] ? new Matrix3(...coordsArrayPToRealworld) : null;

    const coordsArrayPToImage = [];
    if (img[indices.pToImage]) {
      img[indices.pToImage].forEach((value) => {
        coordsArrayPToImage.push(...value);
      });
      coordsArrayPToImage.push(0, 0, 0, 1);
    }
    const projectionCenter = img[indices.projectionCenter] ?
      Cartesian3.fromArray(img[indices.projectionCenter]) :
      null;
    const pToImage = img[indices.pToImage] ? new Matrix4(...coordsArrayPToImage) : null;

    const meta = imageMetas[img[indices.cameraIndex] || 0];
    if (!meta.size) {
      if (img[indices.height] && img[indices.width]) {
        meta.size = [img[indices.width], img[indices.height]];
      } else {
        // eslint-disable-next-line no-console
        console.error('missing image meta size');
      }
    }

    if (!meta.tileResolution) {
      if (img[indices.tileResolution]) {
        meta.tileResolution = img[indices.tileResolution];
      } else {
        // eslint-disable-next-line no-console
        console.error('missing image meta tileResolution');
      }
    }

    images[index - 1] = new ObliqueImage({
      name: img[indices.name],
      viewDirection: img[indices.viewDirection],
      viewDirectionAngle: img[indices.viewDirectionAngle],
      groundCoordinates: img[indices.groundCoordinates],
      centerPointOnGround: img[indices.centerPointOnGround],
      meta,
      projectionCenter,
      pToRealworld,
      pToImage,
    });
  });

  return images;
}

/**
 * @param {ObliqueImageJson} json
 * @param {Array<import("@vcmap/core").ObliqueImageMeta>} imageMetas
 * @returns {Array<ObliqueImage>}
 */
export function parseLegacyImageData(json, imageMetas) {
  const { cameraParameter } = json.generalImageInfo;
  const { version, buildNumber } = getVersionFromImageJson(json);
  return /** @type {Array<*>} */ (json.images).map((img) => {
    const viewDirection = obliqueViewDirectionNames[img['view-direction']];
    const viewDirectionAngle = version >= 3.4 && buildNumber >= 18 ?
      img['view-directionAngle'] :
      undefined;
    const projectionCenter = img['projection-center'];
    const { name, groundCoordinates, centerPointOnGround } = img;

    const cameraName = img['camera-name'];
    const imageMeta = imageMetas.find(value => value.name === cameraName);
    const meta = imageMeta || imageMetas[0];
    if (!meta.size) {
      if (img.height && img.width) {
        meta.size = [img.width, img.height];
      } else {
        // eslint-disable-next-line no-console
        console.error('missing image meta size');
      }
    }

    if (!meta.tileResolution) {
      if (img.tileResolution) {
        meta.tileResolution = img.tileResolution;
      } else {
        // eslint-disable-next-line no-console
        console.error('missing image meta tileResolution');
      }
    }

    const imageOptions = {
      name,
      meta,
      viewDirection,
      viewDirectionAngle,
      groundCoordinates,
      centerPointOnGround,
    };

    if (imageMeta && cameraName) {
      const cameraOptions = cameraParameter[cameraName];
      const cameraMatrix = Matrix3.fromRowMajorArray([].concat(...cameraOptions['camera-matrix']));
      const cameraMatrixInverse = Matrix3.inverse(cameraMatrix, new Matrix3());
      const rotationMatrix = Matrix3.fromRowMajorArray([].concat(...img['rotation-matrix']));
      const rotationMatrixTransposed = Matrix3.transpose(rotationMatrix, new Matrix3());
      const focalLength = cameraOptions['focal-length'] * (-1);
      Matrix3.multiplyByScalar(cameraMatrixInverse, focalLength, cameraMatrixInverse);
      const pToRealworld = Matrix3.multiply(rotationMatrixTransposed, cameraMatrixInverse, new Matrix3());

      const cameraMatrix4 = Matrix4.fromRotationTranslation(
        cameraMatrix,
        Cartesian3.ZERO,
        new Matrix4(),
      );
      const projectionCenterCartesian = Cartesian3.fromArray(projectionCenter);
      const e = Matrix4.fromTranslation(
        Cartesian3.multiplyByScalar(projectionCenterCartesian, -1, new Cartesian3()),
        new Matrix4(),
      );
      const rotationMatrix4 = Matrix4.fromRotationTranslation(
        rotationMatrix,
        Cartesian3.ZERO,
        new Matrix4(),
      );
      const pToImage = Matrix4.multiply(
        cameraMatrix4,
        Matrix4.multiply(rotationMatrix4, e, new Matrix4()),
        new Matrix4(),
      );
      imageOptions.projectionCenter = projectionCenterCartesian;
      imageOptions.pToRealworld = pToRealworld;
      imageOptions.pToImage = pToImage;
    }
    return new ObliqueImage(imageOptions);
  });
}

