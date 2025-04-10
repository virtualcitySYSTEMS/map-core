import type { Size } from 'ol/size.js';
import type { Coordinate } from 'ol/coordinate.js';
import {
  Matrix3,
  Cartesian3,
  Matrix4,
  type CesiumTerrainProvider,
} from '@vcmap-cesium/engine';
import type { ObliqueImageOptions } from './obliqueImage.js';
import ObliqueImage from './obliqueImage.js';
import type { ObliqueViewDirection } from './obliqueViewDirection.js';
import { obliqueViewDirectionNames } from './obliqueViewDirection.js';
import type { ObliqueImageMetaOptions } from './obliqueImageMeta.js';
import ImageMeta from './obliqueImageMeta.js';
import Projection from '../util/projection.js';
import type {
  ObliqueCameraOptions,
  ObliqueImageJson,
  ObliqueVersion,
} from './obliqueCollection.js';

let customObliqueProjectionId = 0;

function getNextObliqueProjectionId(): number {
  customObliqueProjectionId += 1;
  return customObliqueProjectionId;
}

export function getVersionFromImageJson(json: {
  version?: string;
}): ObliqueVersion {
  const version: Partial<ObliqueVersion> = {};

  if (json.version) {
    const number = json.version.match(/\d+\.\d+/);
    if (number) {
      version.version = Number(number[0]);
    }
    const buildNumber = json.version.match(/-\d+-/);
    if (buildNumber) {
      version.buildNumber = Number(
        buildNumber?.[0]?.match?.(/\d+/)?.[0] as string,
      );
    }
  }
  return version as ObliqueVersion;
}

/**
 * @param json
 * @param url
 * @param projection
 * @param terrainProvider
 * @param headers
 */
export function parseImageMeta(
  json: ObliqueImageJson,
  url: string,
  projection?: Projection,
  terrainProvider?: CesiumTerrainProvider,
  headers?: Record<string, string>,
): ImageMeta[] {
  let size: Size = [0, 0];
  if (json.generalImageInfo.width && json.generalImageInfo.height) {
    size = [json.generalImageInfo.width, json.generalImageInfo.height];
  }
  const tileResolution = json.generalImageInfo['tile-resolution'];
  const tileSize = [
    json.generalImageInfo['tile-width'],
    json.generalImageInfo['tile-height'],
  ];
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
    projection: imageProjection!,
    url,
    terrainProvider,
    headers,
  };

  if (json.generalImageInfo.cameraParameter) {
    if (Array.isArray(json.generalImageInfo.cameraParameter)) {
      json.generalImageInfo.cameraParameter.forEach((cameraOption) => {
        imageMetas.push(
          new ImageMeta({
            ...defaultOptions,
            ...cameraOption,
          } satisfies ObliqueImageMetaOptions),
        );
      });
    } else if (typeof json.generalImageInfo.cameraParameter === 'object') {
      Object.entries(json.generalImageInfo.cameraParameter).forEach(
        ([name, cameraOption]) => {
          imageMetas.push(
            new ImageMeta({
              name,
              ...defaultOptions,
              ...cameraOption,
            } satisfies ObliqueImageMetaOptions),
          );
        },
      );
    }
  }

  if (imageMetas.length === 0) {
    imageMetas.push(
      new ImageMeta({
        name: 'default',
        ...defaultOptions,
      } satisfies ObliqueImageMetaOptions),
    );
  }
  return imageMetas;
}

export function parseImageData(
  json: ObliqueImageJson,
  imageMetas: ImageMeta[],
): ObliqueImage[] {
  const imagesHeader = json.images![0];
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

  const images = new Array(json.images!.length - 1);
  json.images!.forEach((img, index) => {
    if (index === 0) {
      // skip header image
      return;
    }
    const coordsArrayPToRealworld: number[] = [];
    if (img[indices.pToRealworld]) {
      (img[indices.pToRealworld] as number[][]).forEach((value) => {
        coordsArrayPToRealworld.push(...value);
      });
    }
    const pToRealworld = img[indices.pToRealworld]
      ? new Matrix3(...coordsArrayPToRealworld)
      : undefined;

    const coordsArrayPToImage: number[] = [];
    if (img[indices.pToImage]) {
      (img[indices.pToImage] as number[][]).forEach((value) => {
        coordsArrayPToImage.push(...value);
      });
      coordsArrayPToImage.push(0, 0, 0, 1);
    }
    const projectionCenter = img[indices.projectionCenter]
      ? Cartesian3.fromArray(img[indices.projectionCenter] as number[])
      : undefined;
    const pToImage = img[indices.pToImage]
      ? new Matrix4(...coordsArrayPToImage)
      : undefined;

    const meta = imageMetas[(img[indices.cameraIndex] as number) || 0];
    if (!meta.size || (meta.size[0] === 0 && meta.size[1] === 0)) {
      if (img[indices.height] && img[indices.width]) {
        meta.size = [
          img[indices.width] as number,
          img[indices.height] as number,
        ];
      } else {
        // eslint-disable-next-line no-console
        console.error('missing image meta size');
      }
    }

    if (!meta.tileResolution) {
      if (img[indices.tileResolution]) {
        meta.tileResolution = img[indices.tileResolution] as Size;
      } else {
        // eslint-disable-next-line no-console
        console.error('missing image meta tileResolution');
      }
    }

    images[index - 1] = new ObliqueImage({
      name: img[indices.name] as string,
      viewDirection: img[indices.viewDirection] as ObliqueViewDirection,
      viewDirectionAngle: img[indices.viewDirectionAngle] as number,
      groundCoordinates: img[indices.groundCoordinates] as Coordinate[],
      centerPointOnGround: img[indices.centerPointOnGround] as Coordinate,
      meta,
      projectionCenter,
      pToRealworld,
      pToImage,
    });
  });

  return images as ObliqueImage[];
}

type LegacyImageJson = {
  'view-direction': keyof typeof obliqueViewDirectionNames;
  'view-directionAngle'?: number;
  'projection-center': Coordinate;
  name: string;
  groundCoordinates: Coordinate[];
  centerPointOnGround: Coordinate;
  'camera-name': string;
  height?: number;
  width?: number;
  tileResolution?: Size;
  'rotation-matrix': number[][];
};

export function parseLegacyImageData(
  json: ObliqueImageJson,
  imageMetas: ImageMeta[],
): ObliqueImage[] {
  const { cameraParameter } = json.generalImageInfo;
  const { version, buildNumber } = getVersionFromImageJson(json);
  // @ts-expect-error: legacy images not properly typed
  return (json.images as LegacyImageJson[]).map((img) => {
    const viewDirection = obliqueViewDirectionNames[img['view-direction']];
    const viewDirectionAngle =
      version >= 3.4 && buildNumber >= 18
        ? img['view-directionAngle']
        : undefined;
    const projectionCenter = img['projection-center'];
    const { name, groundCoordinates, centerPointOnGround } = img;

    const cameraName = img['camera-name'];
    const imageMeta = imageMetas.find((value) => value.name === cameraName);
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

    const imageOptions: ObliqueImageOptions = {
      name,
      meta,
      viewDirection,
      viewDirectionAngle,
      groundCoordinates,
      centerPointOnGround,
    };

    if (imageMeta && cameraName) {
      const cameraOptions = (
        cameraParameter as Record<
          string,
          ObliqueCameraOptions & {
            'camera-matrix': number[][];
            'focal-length': number;
          }
        >
      )[cameraName];
      const cameraMatrix = Matrix3.fromRowMajorArray(
        ([] as number[]).concat(...cameraOptions['camera-matrix']),
      );
      const cameraMatrixInverse = Matrix3.inverse(cameraMatrix, new Matrix3());
      const rotationMatrix = Matrix3.fromRowMajorArray(
        ([] as number[]).concat(...img['rotation-matrix']),
      );
      const rotationMatrixTransposed = Matrix3.transpose(
        rotationMatrix,
        new Matrix3(),
      );
      const focalLength = cameraOptions['focal-length'] * -1;
      Matrix3.multiplyByScalar(
        cameraMatrixInverse,
        focalLength,
        cameraMatrixInverse,
      );
      const pToRealworld = Matrix3.multiply(
        rotationMatrixTransposed,
        cameraMatrixInverse,
        new Matrix3(),
      );

      const cameraMatrix4 = Matrix4.fromRotationTranslation(
        cameraMatrix,
        Cartesian3.ZERO,
        new Matrix4(),
      );
      const projectionCenterCartesian = Cartesian3.fromArray(projectionCenter);
      const e = Matrix4.fromTranslation(
        Cartesian3.multiplyByScalar(
          projectionCenterCartesian,
          -1,
          new Cartesian3(),
        ),
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
