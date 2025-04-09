import type { Geometry } from 'ol/geom.js';
import {
  GeometryCollection,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
} from 'ol/geom.js';
import type { Feature } from 'ol';
import type { Coordinate } from 'ol/coordinate.js';
import type { Scene } from '@vcmap-cesium/engine';
import {
  HeightReference,
  sampleTerrainMostDetailed,
} from '@vcmap-cesium/engine';
import type VectorProperties from '../layer/vectorProperties.js';
import {
  getHeightInfo,
  isClampedHeightReference,
  isRelativeHeightReference,
  type RelativeHeightReference,
  type VectorHeightInfo,
} from './featureconverter/vectorHeightInfo.js';
import { getSingleGeometriesFromGeometry } from './featureconverter/convert.js';
import { mercatorToCartographic } from './math.js';
import {
  drapeGeometryOnSurface,
  from2Dto3DLayout,
  getFlatCoordinateReferences,
  is2DLayout,
} from './geometryHelpers.js';

function setZCoordinate(geometry: Geometry, z: number): void {
  const layout = geometry.getLayout();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const coordinates = geometry.getCoordinates() as any[];
  const flatCoordinates = getFlatCoordinateReferences(geometry, coordinates);

  flatCoordinates.forEach((c) => {
    if (layout === 'XYM') {
      c[3] = c[2];
      c[2] = z;
    } else {
      c[2] = z;
    }
  });

  geometry.setCoordinates(
    coordinates,
    layout === 'XYM' || layout === 'XYZM' ? 'XYZM' : 'XYZ',
  );
}

export async function createAbsoluteFeature(
  feature: Feature,
  vectorProperties: VectorProperties,
  scene: Scene,
): Promise<Feature | null> {
  const clone = feature.clone();
  const geometry = clone.getGeometry();
  if (!geometry) {
    return null;
  }

  const altitudeMode = vectorProperties.getAltitudeMode(clone);
  let groundLevel = vectorProperties.getGroundLevel(clone);

  if (altitudeMode === HeightReference.NONE) {
    if (groundLevel != null) {
      setZCoordinate(geometry, groundLevel);
    } else if (is2DLayout(geometry.getLayout())) {
      await from2Dto3DLayout(geometry, scene, HeightReference.CLAMP_TO_GROUND);
    }
  } else if (isClampedHeightReference(altitudeMode)) {
    if (groundLevel != null) {
      setZCoordinate(geometry, groundLevel);
    } else {
      await drapeGeometryOnSurface(
        geometry,
        scene,
        altitudeMode !== HeightReference.CLAMP_TO_TERRAIN
          ? HeightReference.CLAMP_TO_GROUND
          : HeightReference.CLAMP_TO_TERRAIN,
      );
    }
  } else if (isRelativeHeightReference(altitudeMode)) {
    const singleGeometries = getSingleGeometriesFromGeometry(geometry);
    await Promise.all(
      singleGeometries.map(async (singleGeometry) => {
        const heightInfo = getHeightInfo(
          clone,
          singleGeometry,
          vectorProperties,
        ) as VectorHeightInfo<RelativeHeightReference>;

        ({ groundLevel } = heightInfo);
        if (heightInfo.clampOrigin) {
          const cartographics = [
            mercatorToCartographic(heightInfo.clampOrigin),
          ];
          if (
            heightInfo.heightReference === HeightReference.RELATIVE_TO_TERRAIN
          ) {
            await sampleTerrainMostDetailed(
              scene.terrainProvider,
              cartographics,
            );
          } else {
            await scene.sampleHeightMostDetailed(cartographics);
          }
          groundLevel = cartographics[0].height;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const coordinates = singleGeometry.getCoordinates() as any[];
        const flatCoordinates = getFlatCoordinateReferences(
          singleGeometry,
          coordinates,
        );
        const { heightAboveGround } = heightInfo;
        const setCoordinate =
          heightAboveGround == null
            ? (c: Coordinate): void => {
                c[2] += groundLevel as number;
              }
            : (c: Coordinate): void => {
                c[2] = (groundLevel as number) + heightAboveGround;
              };
        flatCoordinates.forEach(setCoordinate);
        singleGeometry.setCoordinates(coordinates, 'XYZ');
      }),
    );

    if (geometry instanceof MultiPoint) {
      geometry.setCoordinates(
        singleGeometries.map((g) => g.getCoordinates() as Coordinate),
      );
    } else if (geometry instanceof MultiPolygon) {
      geometry.setCoordinates(
        singleGeometries.map((g) => g.getCoordinates() as Coordinate[][]),
      );
    } else if (geometry instanceof MultiLineString) {
      geometry.setCoordinates(
        singleGeometries.map((g) => g.getCoordinates() as Coordinate[]),
      );
    } else if (geometry instanceof GeometryCollection) {
      geometry.setGeometries(singleGeometries);
    }
  }

  clone.set('olcs_altitudeMode', 'absolute');
  clone.unset('olcs_groundLevel');
  clone.unset('olcs_heightAboveGround');

  return clone;
}
