import type { Geometry, SimpleGeometry } from 'ol/geom.js';
import type { Coordinate } from 'ol/coordinate.js';
import { Cartesian3, HeightReference } from '@vcmap-cesium/engine';
import type { GeometryLayout } from 'ol/geom/Geometry.js';
import type { Feature } from 'ol';
import type VectorProperties from '../../layer/vectorProperties.js';
import { is2DLayout } from '../geometryHelpers.js';
import { getStoreyHeights, validateStoreys } from './storeyHelpers.js';
import Projection from '../projection.js';

export type ExtrusionHeightInfo = {
  /**
   *  if the object is extruded
   */
  extruded: boolean;
  /**
   * storey heights above ground, list has the same length as storeysAboveGround
   */
  storeyHeightsAboveGround: number[];
  /**
   * storey heights below ground, list has the same length as storeysBelowGround
   */
  storeyHeightsBelowGround: number[];
  /**
   * a negative height to <i>push</i> the geometry visually into the ground
   */
  skirt: number;
};
export type ClampedHeightReference =
  | HeightReference.CLAMP_TO_GROUND
  | HeightReference.CLAMP_TO_TERRAIN
  | HeightReference.CLAMP_TO_3D_TILE;
export type RelativeHeightReference =
  | HeightReference.RELATIVE_TO_GROUND
  | HeightReference.RELATIVE_TO_TERRAIN
  | HeightReference.RELATIVE_TO_3D_TILE;
export type VectorHeightInfo<
  T extends HeightReference = HeightReference,
  L extends GeometryLayout = GeometryLayout,
> = T extends ClampedHeightReference
  ? {
      heightReference: T;
      layout: L;
    }
  : T extends RelativeHeightReference
    ? {
        heightReference: T;
        layout: L;
        clampOrigin?: [number, number];
        heightAboveGround?: number;
        /**
         * the level above or below mean sea level
         */
        groundLevel?: number;
        /**
         * true if not all z values are identical, e.g no height above ground was provided and no or only one storey was provided
         */
        perPositionHeight: boolean;
      } & ExtrusionHeightInfo
    : T extends HeightReference.NONE
      ? {
          heightReference: T;
          layout: L;
          /**
           * the level above or below mean sea level (minZ value or ground_level or 0)
           */
          groundLevelOrMinHeight: number;
          /**
           * true if not all z values are identical, e.g no ground level was provided and no or only one storey was provided
           */
          perPositionHeight: boolean;
        } & ExtrusionHeightInfo
      : never;

export function isClampedHeightReference(
  heightReference: HeightReference,
): heightReference is ClampedHeightReference {
  return (
    heightReference === HeightReference.CLAMP_TO_GROUND ||
    heightReference === HeightReference.CLAMP_TO_TERRAIN ||
    heightReference === HeightReference.CLAMP_TO_3D_TILE
  );
}

export function isRelativeHeightReference(
  heightReference: HeightReference,
): heightReference is RelativeHeightReference {
  return (
    heightReference === HeightReference.RELATIVE_TO_GROUND ||
    heightReference === HeightReference.RELATIVE_TO_TERRAIN ||
    heightReference === HeightReference.RELATIVE_TO_3D_TILE
  );
}

export function isAbsoluteHeightReference(
  heightReference: HeightReference,
): heightReference is HeightReference.NONE {
  return heightReference === HeightReference.NONE;
}

export function getRelativeEquivalent(
  clampedHeightReference: ClampedHeightReference,
): RelativeHeightReference {
  if (clampedHeightReference === HeightReference.CLAMP_TO_GROUND) {
    return HeightReference.RELATIVE_TO_GROUND;
  }
  if (clampedHeightReference === HeightReference.CLAMP_TO_TERRAIN) {
    return HeightReference.RELATIVE_TO_TERRAIN;
  }
  return HeightReference.RELATIVE_TO_3D_TILE;
}

export function getExtrusionHeightInfo(
  feature: Feature,
  vectorProperties: VectorProperties,
): ExtrusionHeightInfo {
  const extrudedHeight = vectorProperties.getExtrudedHeight(feature);

  let storeysAboveGround = vectorProperties.getStoreysAboveGround(feature);
  let storeysBelowGround = vectorProperties.getStoreysBelowGround(feature);
  let storeyHeightsAboveGround =
    vectorProperties.getStoreyHeightsAboveGround(feature);
  let storeyHeightsBelowGround =
    vectorProperties.getStoreyHeightsBelowGround(feature);
  if (extrudedHeight) {
    // current Case only extrudedHeight
    if (extrudedHeight > 0) {
      storeyHeightsAboveGround = getStoreyHeights(
        extrudedHeight,
        storeyHeightsAboveGround,
        storeysAboveGround,
      );
      storeysAboveGround = storeyHeightsAboveGround.length;
      storeyHeightsBelowGround = [];
      storeysBelowGround = 0;
    } else if (extrudedHeight < 0) {
      storeyHeightsBelowGround = getStoreyHeights(
        extrudedHeight,
        storeyHeightsBelowGround,
        storeysBelowGround,
      );
      storeysBelowGround = storeyHeightsBelowGround.length;
      storeyHeightsAboveGround = [];
      storeysAboveGround = 0;
    }
  }

  validateStoreys(storeysAboveGround, storeyHeightsAboveGround);
  validateStoreys(storeysBelowGround, storeyHeightsBelowGround);

  const skirt = vectorProperties.getSkirt(feature);
  const extruded = !!(
    storeyHeightsAboveGround.length ||
    storeyHeightsBelowGround.length ||
    skirt
  );

  return {
    extruded,
    storeyHeightsAboveGround,
    storeyHeightsBelowGround,
    skirt,
  };
}

/**
 * @param geometry - feature must return simple geometry
 * @retruns the center of mass
 */
export function getClampOrigin(geometry: SimpleGeometry): [number, number] {
  const stride = geometry.getStride();
  const coordinates = geometry.getFlatCoordinates();
  let x = 0;
  let y = 0;
  for (let i = 0; i < coordinates.length; i += stride) {
    // calculates center of mass, maybe add
    x += coordinates[i];
    y += coordinates[i + 1];
  }

  const numberOfPoints = coordinates.length / stride;

  return [x / numberOfPoints, y / numberOfPoints];
}

/**
 * the minimum height of a geometry with a 3D layout
 * @param geometry - with an XYZ layout
 * @returns the minimum height
 */
export function getMinHeight(geometry: Geometry): number {
  if (is2DLayout(geometry.getLayout())) {
    throw new Error('expected geometry to have an YXZ geometry layout');
  }

  const stride = geometry.getStride();
  const coordinates = geometry.getFlatCoordinates();

  let minZ = Infinity;
  for (let i = 0; i < coordinates.length; i += stride) {
    const Z = coordinates[i + 2];
    minZ = Z < minZ ? Z : minZ;
  }

  return minZ;
}

export function getHeightInfo(
  feature: Feature,
  geometry: SimpleGeometry,
  vectorProperties: VectorProperties,
): VectorHeightInfo {
  const extrusionHeightInfo = getExtrusionHeightInfo(feature, vectorProperties);

  let heightReference = vectorProperties.getAltitudeMode(feature);
  let heightAboveGround: number | undefined;

  const layout = geometry.getLayout();
  const groundLevel = vectorProperties.getGroundLevel(feature);

  // we cannot render a two D coordinate absolutely without having a Z value (ground level)
  // switch altitude mode to clamp
  if (
    is2DLayout(layout) &&
    isAbsoluteHeightReference(heightReference) &&
    groundLevel == null
  ) {
    heightReference = HeightReference.CLAMP_TO_GROUND;
  }

  if (isClampedHeightReference(heightReference)) {
    const geometryType = geometry.getType();
    let pointAsPrimitive = false;
    if (geometryType === 'Point' || geometryType === 'MultiPoint') {
      pointAsPrimitive = vectorProperties.renderAs(feature) !== 'geometry';
    }

    // clamped extrusions or primitives get rendered relative to ground with a height above ground of 0;
    if (extrusionHeightInfo.extruded || pointAsPrimitive) {
      heightReference = getRelativeEquivalent(heightReference);
      heightAboveGround = 0;
    } else {
      return {
        heightReference,
        layout,
      };
    }
  }

  if (isRelativeHeightReference(heightReference)) {
    heightAboveGround =
      vectorProperties.getHeightAboveGround(feature) ??
      heightAboveGround ??
      (is2DLayout(layout) ? 0 : undefined);

    // we only need a clamp origin, if we dont already have a ground level
    const clampOrigin =
      groundLevel != null ? undefined : getClampOrigin(geometry);

    // true if not all z values are identical. in case of relative geometries, we set Z to height above ground, not ground level
    const perPositionHeight =
      !is2DLayout(layout) &&
      heightAboveGround == null &&
      (!extrusionHeightInfo.extruded ||
        (extrusionHeightInfo.extruded &&
          extrusionHeightInfo.storeyHeightsAboveGround.length +
            extrusionHeightInfo.storeyHeightsBelowGround.length ===
            1));

    return {
      ...extrusionHeightInfo,
      heightReference,
      layout,
      heightAboveGround,
      clampOrigin,
      groundLevel,
      perPositionHeight,
    };
  }

  // true if not all z values are identical. if ground level is provided, all z values are equal to ground level.
  const perPositionHeight =
    !is2DLayout(layout) &&
    groundLevel == null &&
    (!extrusionHeightInfo.extruded ||
      (extrusionHeightInfo.extruded &&
        extrusionHeightInfo.storeyHeightsAboveGround.length +
          extrusionHeightInfo.storeyHeightsBelowGround.length ===
          1));

  return {
    ...extrusionHeightInfo,
    groundLevelOrMinHeight: groundLevel ?? getMinHeight(geometry),
    perPositionHeight,
    heightReference,
    layout,
  };
}

/**
 * Returns the geometry height (as used in the cesium geometry options) depending on the height info. 0 for clamped, groundLevelOrMinHeight for absolute & heightAboveGround + groundLevel (if present) for relative
 */
export function getGeometryHeight(
  geometry: SimpleGeometry,
  heightInfo: VectorHeightInfo,
): number {
  let height = 0;
  if (heightInfo.heightReference === HeightReference.NONE) {
    height = heightInfo.groundLevelOrMinHeight;
  } else if (isRelativeHeightReference(heightInfo.heightReference)) {
    const relativeHeightInfo =
      heightInfo as VectorHeightInfo<RelativeHeightReference>;
    if (relativeHeightInfo.heightAboveGround != null) {
      height = relativeHeightInfo.heightAboveGround;
    } else {
      // height info ensures this can only be a 3D layout
      height = getMinHeight(geometry);
    }

    if (relativeHeightInfo.groundLevel) {
      height += relativeHeightInfo.groundLevel;
    }
  }

  return height;
}

/**
 * @param {VectorHeightInfo} heightInfo
 * @returns a callback function accepting a mercator coordinate. it will return a wgs84coordinate with its Z value adjusted according to the height info
 */
export function mercatorToWgs84TransformerForHeightInfo(
  heightInfo: VectorHeightInfo,
): (coord: Coordinate) => Coordinate {
  if (isClampedHeightReference(heightInfo.heightReference)) {
    const layoutIs2D = is2DLayout(heightInfo.layout);
    return (coord: Coordinate) => {
      const wgs84Coords = Projection.mercatorToWgs84(coord);
      wgs84Coords[2] = layoutIs2D ? 0 : wgs84Coords[2];
      return wgs84Coords;
    };
  } else if (isRelativeHeightReference(heightInfo.heightReference)) {
    const { heightAboveGround, groundLevel } =
      heightInfo as VectorHeightInfo<RelativeHeightReference>;

    return (coord: Coordinate) => {
      // disregard layout, since height info guarantees either height above ground OR 3D layout
      const wgs84Coords = Projection.mercatorToWgs84(coord);
      if (heightAboveGround != null) {
        wgs84Coords[2] = heightAboveGround;
      }
      if (groundLevel) {
        wgs84Coords[2] += groundLevel;
      }

      return wgs84Coords;
    };
  }

  const { groundLevelOrMinHeight, perPositionHeight } =
    heightInfo as VectorHeightInfo<HeightReference.NONE>;

  return (coord: Coordinate) => {
    // disregard layout, since height info guarantees ground level OR 3D layout
    const wgs84Coords = Projection.mercatorToWgs84(coord);
    if (!perPositionHeight && groundLevelOrMinHeight) {
      wgs84Coords[2] = groundLevelOrMinHeight;
    }

    return wgs84Coords;
  };
}

/**
 * @param {VectorHeightInfo} heightInfo
 * @returns a callback function accepting a mercator coordinate. it will return a Cartesian3 with its Z value adjusted according to the height info
 */
export function mercatorToCartesianTransformerForHeightInfo(
  heightInfo: VectorHeightInfo,
): (coord: Coordinate) => Cartesian3 {
  const toWgs84 = mercatorToWgs84TransformerForHeightInfo(heightInfo);

  return (coord) => {
    const wgs84Coords = toWgs84(coord);
    return Cartesian3.fromDegrees(
      wgs84Coords[0],
      wgs84Coords[1],
      wgs84Coords[2],
    );
  };
}
