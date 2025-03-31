/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Scene } from '@vcmap-cesium/engine';
import {
  HeightReference,
  sampleTerrainMostDetailed,
} from '@vcmap-cesium/engine';
import { offset as offsetSphere } from 'ol/sphere.js';
import type { Coordinate } from 'ol/coordinate.js';
import { fromCircle } from 'ol/geom/Polygon.js';
import type { GeometryLayout } from 'ol/geom/Geometry.js';
import {
  Circle,
  type Geometry,
  GeometryCollection,
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon,
  SimpleGeometry,
} from 'ol/geom.js';
import type { Feature } from 'ol';
import Projection from './projection.js';
import { mercatorToCartographic } from './math.js';
import type VectorProperties from '../layer/vectorProperties.js';
import type {
  RelativeHeightReference,
  VectorHeightInfo,
} from './featureconverter/vectorHeightInfo.js';
import {
  getHeightInfo,
  isClampedHeightReference,
  isRelativeHeightReference,
} from './featureconverter/vectorHeightInfo.js';
import { getSingleGeometriesFromGeometry } from './featureconverter/convert.js';

export function getFlatCoordinatesFromSimpleGeometry(
  geometry: SimpleGeometry,
): Coordinate[] {
  const stride = geometry.getStride();
  const flatCoordinates = geometry.getFlatCoordinates();
  if (flatCoordinates.length > 0) {
    const numberOfCoordinates = Math.floor(flatCoordinates.length / stride);
    const coordinates: Coordinate[] = new Array(
      numberOfCoordinates,
    ) as Coordinate[];
    for (let i = 0; i < numberOfCoordinates; i++) {
      const flatIndex = i * stride;
      coordinates[i] = new Array(stride) as Coordinate;
      for (let j = 0; j < stride; j++) {
        coordinates[i][j] = flatCoordinates[flatIndex + j];
      }
    }
    return coordinates;
  }
  return [];
}

export function getFlatCoordinateReferences(
  geometry: Geometry,
  inputCoordinates?: any[],
): Coordinate[] {
  if (!inputCoordinates && geometry instanceof SimpleGeometry) {
    return getFlatCoordinatesFromSimpleGeometry(geometry);
  }
  const coordinates: any[] | undefined = inputCoordinates;
  let flattenCoordinates = null;
  if (geometry instanceof Point) {
    flattenCoordinates = [coordinates];
  } else if (geometry instanceof LineString) {
    flattenCoordinates = coordinates;
  } else if (geometry instanceof Polygon) {
    flattenCoordinates = coordinates!.reduce(
      (current: Coordinate[], next: Coordinate[]) => current.concat(next),
    ) as Coordinate[];
  } else if (geometry instanceof MultiPoint) {
    flattenCoordinates = coordinates;
  } else if (geometry instanceof MultiLineString) {
    flattenCoordinates = coordinates!.reduce(
      (current: Coordinate[], next: Coordinate[]) => current.concat(next),
    ) as Coordinate[];
  } else if (geometry instanceof MultiPolygon) {
    flattenCoordinates = (
      coordinates!.reduce((current: Coordinate[][], next: Coordinate[][]) =>
        current.concat(next),
      ) as Coordinate[][]
    ).reduce((current, next) => current.concat(next));
  } else if (geometry instanceof Circle) {
    flattenCoordinates = coordinates;
  } else if (geometry instanceof GeometryCollection) {
    flattenCoordinates = geometry
      .getGeometries()
      .map((g, i) => getFlatCoordinateReferences(g, coordinates?.[i] as any[]))
      .reduce((current, next) => current.concat(next));
  }
  return flattenCoordinates as Coordinate[];
}

export function circleFromCenterRadius(
  center: Coordinate,
  radius: number,
): Circle {
  const offsetWGS84 = offsetSphere(
    Projection.mercatorToWgs84(center),
    radius,
    Math.PI / 2,
  );
  const of = Projection.wgs84ToMercator(offsetWGS84);
  const dx = center[0] - of[0];
  const dy = center[1] - of[1];
  const dx2 = dx * dx;
  const dy2 = dy * dy;
  const radiusProjected = Math.sqrt(dx2 + dy2);
  return new Circle(center, radiusProjected);
}

export function convertGeometryToPolygon(geometry: Geometry): Geometry {
  if (geometry instanceof Circle) {
    return fromCircle(geometry);
  } else if (geometry instanceof Polygon) {
    geometry.unset('_vcsGeomType');
  }
  return geometry;
}

export function enforceEndingVertex(linearRing: Coordinate[]): void {
  const [lastX, lastY] = linearRing[linearRing.length - 1];
  if (!(linearRing[0][0] === lastX && linearRing[0][1] === lastY)) {
    linearRing.push(linearRing[0].slice());
  }
}

export function removeEndingVertex(linearRing: Coordinate[]): void {
  const [lastX, lastY] = linearRing[linearRing.length - 1];
  if (linearRing[0][0] === lastX && linearRing[0][1] === lastY) {
    linearRing.pop();
  }
}

export function removeEndingVertexFromGeometry(geometry: Geometry): void {
  if (geometry instanceof Polygon) {
    const coordinates = geometry.getCoordinates();
    coordinates.forEach((ring) => {
      removeEndingVertex(ring);
    });
    geometry.setCoordinates(coordinates);
  } else if (geometry instanceof MultiPolygon) {
    const coordinates = geometry.getCoordinates();
    coordinates.forEach((poly) => {
      poly.forEach((ring) => {
        removeEndingVertex(ring);
      });
    });
    geometry.setCoordinates(coordinates);
  }
}

/**
 * from @mapbox/geojson-area
 * @param ring
 */
function ringArea(ring: Coordinate[]): number {
  let area = 0;
  const positions = ring.length;

  for (let i = 0; i <= positions - 2; i++) {
    const p1 = ring[i];
    const p2 = ring[i + 1];
    area += p1[0] * p2[1] - p1[1] * p2[0];
  }

  area /= 2;
  return area;
}

/**
 * enforce a ring to be counter-clockwise
 * @param  ring
 */
export function enforceRightHand(ring: Coordinate[]): Coordinate[] {
  const area = ringArea(ring);
  if (area < 0) {
    ring.reverse();
  }

  return ring;
}

/**
 * determines if a layout has only 2D coordinate values (XY or XYM)
 * @param layout
 */
export function is2DLayout(layout: GeometryLayout): boolean {
  return layout === 'XY' || layout === 'XYM';
}

/**
 * Will convert a 3D layout (XYZ or XYZM) to XY (or XYM). This changes the geometry in place. will not apply any changes,
 * if the layout is already a 2D layout
 * @param geometry
 */
export function from3Dto2DLayout(geometry: Geometry): void {
  const layout = geometry.getLayout();
  if (is2DLayout(layout)) {
    return;
  }
  const coordinates = geometry.getCoordinates() as any[];
  const flatCoordinates = getFlatCoordinateReferences(geometry, coordinates);
  flatCoordinates.forEach((coordinate) => {
    if (layout === 'XYZM') {
      coordinate[2] = coordinate.pop()!;
    } else {
      coordinate.pop();
    }
  });
  geometry.setCoordinates(coordinates, layout === 'XYZM' ? 'XYM' : 'XY');
}

/**
 * Places a geometry on to the ground (or terrain). The geometry is changed in place. This function
 * will set the layout to a respective 3D layout.
 * @param geometry
 * @param scene
 * @param heightReference - clamp to ground will use `scene.getHeightMostDetailed`, terrain will use `sampleTerrainMostDetailed` using the scenes terrain provider
 */
export async function placeGeometryOnSurface(
  geometry: Geometry,
  scene: Scene,
  heightReference:
    | HeightReference.CLAMP_TO_GROUND
    | HeightReference.CLAMP_TO_TERRAIN,
): Promise<void> {
  const layout = geometry.getLayout();
  const coordinates = geometry.getCoordinates() as any[];
  const flatCoordinates = getFlatCoordinateReferences(geometry, coordinates);
  const drapedCartographics = flatCoordinates.map((c) =>
    mercatorToCartographic(c),
  );
  if (heightReference === HeightReference.CLAMP_TO_GROUND) {
    await scene.sampleHeightMostDetailed(drapedCartographics);
  } else if (scene.terrainProvider.availability) {
    await sampleTerrainMostDetailed(scene.terrainProvider, drapedCartographics);
  } else {
    drapedCartographics.forEach((c) => {
      c.height = 0;
    });
  }
  if (layout === 'XY' || layout === 'XYM') {
    const height = Math.max(...drapedCartographics.map((c) => c.height));
    flatCoordinates.forEach((c, index) => {
      if (layout === 'XYM') {
        flatCoordinates[index][3] = c[2];
      }
      flatCoordinates[index][2] = height;
    });
  } else {
    const maxDiff = flatCoordinates.reduce((acc, coord, index) => {
      const current = drapedCartographics[index].height - coord[2];
      return Math.max(current, acc);
    }, -Infinity);
    if (Number.isFinite(maxDiff) && maxDiff !== 0) {
      flatCoordinates.forEach((_c, index) => {
        flatCoordinates[index][2] += maxDiff;
      });
    }
  }

  geometry.setCoordinates(
    coordinates,
    layout === 'XYM' || layout === 'XYZM' ? 'XYZM' : 'XYZ',
  );
}

/**
 * Drape a geometry on to the ground (or terrain). The geometry is changed in place. This function
 * will set the layout to a respective 3D layout.
 * @param geometry
 * @param scene
 * @param heightReference - clamp to ground will use `scene.getHeightMostDetailed`, terrain will use `sampleTerrainMostDetailed` using the scenes terrain provider
 */
export async function drapeGeometryOnSurface(
  geometry: Geometry,
  scene: Scene,
  heightReference:
    | HeightReference.CLAMP_TO_GROUND
    | HeightReference.CLAMP_TO_TERRAIN,
): Promise<void> {
  const layout = geometry.getLayout();
  const coordinates = geometry.getCoordinates() as any[];
  const flatCoordinates = getFlatCoordinateReferences(geometry, coordinates);
  const cartographics = flatCoordinates.map((c) => mercatorToCartographic(c));
  if (heightReference === HeightReference.CLAMP_TO_GROUND) {
    await scene.sampleHeightMostDetailed(cartographics);
  } else if (scene.terrainProvider.availability) {
    await sampleTerrainMostDetailed(scene.terrainProvider, cartographics);
  } else {
    cartographics.forEach((c) => {
      c.height = 0;
    });
  }

  cartographics.forEach((c, index) => {
    if (layout === 'XYM') {
      flatCoordinates[index][3] = flatCoordinates[index][2];
      flatCoordinates[index][2] = c.height;
    } else {
      flatCoordinates[index][2] = c.height;
    }
  });

  geometry.setCoordinates(
    coordinates,
    layout === 'XYM' || layout === 'XYZM' ? 'XYZM' : 'XYZ',
  );
}

/**
 * Wil transform a 2D geometry (layout XY XYM) in place to 3D (XYZ XYZM) using the provided scene & height reference.
 * will no apply anything, if the layout is already 3D
 * @param geometry
 * @param scene
 * @param heightReference
 */
export async function from2Dto3DLayout(
  geometry: Geometry,
  scene: Scene,
  heightReference:
    | HeightReference.CLAMP_TO_GROUND
    | HeightReference.CLAMP_TO_TERRAIN,
): Promise<void> {
  if (is2DLayout(geometry.getLayout())) {
    await drapeGeometryOnSurface(geometry, scene, heightReference);
  }
}

function setZCoordinate(geometry: Geometry, z: number): void {
  const layout = geometry.getLayout();
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
