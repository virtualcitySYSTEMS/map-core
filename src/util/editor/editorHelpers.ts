import Point from 'ol/geom/Point.js';
import Feature from 'ol/Feature.js';
import type { Coordinate } from 'ol/coordinate.js';
import type { Geometry } from 'ol/geom.js';

import {
  Cartesian2,
  Cartesian3,
  Math as CesiumMath,
  Plane,
  Ray,
  IntersectionTests,
  Cartographic,
  HeightReference,
  Cesium3DTileFeature,
  type Scene,
  type Camera,
} from '@vcmap-cesium/engine';

import { mercatorToCartesian } from '../math.js';
import { getFlatCoordinatesFromGeometry } from '../geometryHelpers.js';
import CesiumMap from '../../map/cesiumMap.js';
import { vertexSymbol } from './editorSymbols.js';
import {
  alreadyTransformedToImage,
  createSync,
  doNotTransform,
} from '../../layer/vectorSymbols.js';
import type VectorLayer from '../../layer/vectorLayer.js';
import type VcsMap from '../../map/vcsMap.js';

export type Vertex = Feature<Point>;

export type SelectableFeatureType = Feature | Cesium3DTileFeature;
export interface SelectFeatureInteraction {
  readonly selected: Array<Feature>;
  setSelected(
    features: SelectableFeatureType[] | SelectableFeatureType,
  ): Promise<void>;
  hasFeatureId(id: string): boolean;
}

/**
 * @param  coordinate
 */
export function createVertex(coordinate: Coordinate): Vertex {
  const geometry = new Point(coordinate);
  geometry[alreadyTransformedToImage] = true;
  const vertex = new Feature({
    geometry,
  });
  vertex[vertexSymbol] = true;
  vertex[doNotTransform] = true;
  vertex[createSync] = true;
  return vertex;
}

let scratchCartesian21 = new Cartesian2();
let scratchCartesian22 = new Cartesian2();
let scratchCartesian23 = new Cartesian2();
let scratchCartesian31 = new Cartesian3();
let scratchCartesian32 = new Cartesian3();
let scratchCartesian33 = new Cartesian3();

/**
 * Returns the closest point on a 2D line. the Z index is taken from the point.
 * @param  start - line segment start
 * @param  end - line segment end
 * @param  point - point to project
 */
export function getClosestPointOn2DLine(
  start: Coordinate,
  end: Coordinate,
  point: Coordinate,
): Coordinate {
  scratchCartesian21 = Cartesian2.fromElements(
    end[0] - start[0],
    end[1] - start[1],
    scratchCartesian21,
  );
  if (scratchCartesian21.equals(Cartesian2.ZERO)) {
    scratchCartesian21 = Cartesian2.fromElements(1, 1, scratchCartesian21);
  }
  scratchCartesian21 = Cartesian2.normalize(
    scratchCartesian21,
    scratchCartesian21,
  );
  scratchCartesian22 = Cartesian2.fromElements(
    point[0] - start[0],
    point[1] - start[1],
    scratchCartesian22,
  );
  const lambda = Cartesian2.dot(scratchCartesian21, scratchCartesian22);
  scratchCartesian21 = Cartesian2.multiplyByScalar(
    scratchCartesian21,
    lambda,
    scratchCartesian21,
  );
  return [
    scratchCartesian21.x + start[0],
    scratchCartesian21.y + start[1],
    point[2],
  ];
}

export function pointOnLine3D(
  start: Coordinate,
  end: Coordinate,
  point: Coordinate,
  epsilon?: number,
): boolean {
  scratchCartesian31 = Cartesian3.fromElements(
    end[0] - start[0],
    end[1] - start[1],
    end[2] - start[2],
    scratchCartesian31,
  );
  scratchCartesian32 = Cartesian3.fromElements(
    point[0] - start[0],
    point[1] - start[1],
    point[2] - start[2],
    scratchCartesian32,
  );
  scratchCartesian33 = Cartesian3.fromElements(
    point[0] - end[0],
    point[1] - end[1],
    point[2] - point[2],
    scratchCartesian33,
  );
  const mag1 = Cartesian3.magnitude(scratchCartesian31);
  if (
    mag1 < Cartesian3.magnitude(scratchCartesian32) ||
    mag1 < Cartesian3.magnitude(scratchCartesian33)
  ) {
    return false;
  }

  scratchCartesian31 = Cartesian3.normalize(
    scratchCartesian31,
    scratchCartesian31,
  );
  scratchCartesian32 = Cartesian3.normalize(
    scratchCartesian32,
    scratchCartesian32,
  );
  return scratchCartesian31.equalsEpsilon(
    scratchCartesian32,
    epsilon || CesiumMath.EPSILON5,
  );
}

export function pointOnLine2D(
  start: Coordinate,
  end: Coordinate,
  point: Coordinate,
  epsilon?: number,
): boolean {
  scratchCartesian21 = Cartesian2.fromElements(
    end[0] - start[0],
    end[1] - start[1],
    scratchCartesian21,
  );
  scratchCartesian22 = Cartesian2.fromElements(
    point[0] - start[0],
    point[1] - start[1],
    scratchCartesian22,
  );
  scratchCartesian23 = Cartesian2.fromElements(
    point[0] - end[0],
    point[1] - end[1],
    scratchCartesian23,
  );
  const mag1 = Cartesian2.magnitude(scratchCartesian21);
  if (
    mag1 < Cartesian2.magnitude(scratchCartesian22) ||
    mag1 < Cartesian2.magnitude(scratchCartesian23)
  ) {
    return false;
  }

  scratchCartesian21 = Cartesian2.normalize(
    scratchCartesian21,
    scratchCartesian21,
  );
  scratchCartesian22 = Cartesian2.normalize(
    scratchCartesian22,
    scratchCartesian22,
  );

  return scratchCartesian21.equalsEpsilon(
    scratchCartesian22,
    epsilon || CesiumMath.EPSILON5,
  );
}

export function createCameraVerticalPlane(
  originCoordinates: Coordinate,
  scene: Scene,
): Plane {
  scratchCartesian31 = mercatorToCartesian(
    originCoordinates,
    scratchCartesian31,
  );
  scratchCartesian32 = scene.globe.ellipsoid.geodeticSurfaceNormal(
    scratchCartesian31,
    scratchCartesian32,
  );
  scratchCartesian32 = Cartesian3.cross(
    scene.camera.rightWC,
    scratchCartesian32,
    scratchCartesian32,
  );
  scratchCartesian32 = Cartesian3.normalize(
    scratchCartesian32,
    scratchCartesian32,
  );

  return Plane.fromPointNormal(scratchCartesian31, scratchCartesian32);
}

/**
 * @param  originCoordinates
 * @param  scene
 */
export function createHorizontalPlane(
  originCoordinates: Coordinate,
  scene: Scene,
): Plane {
  scratchCartesian31 = mercatorToCartesian(
    originCoordinates,
    scratchCartesian31,
  );
  scratchCartesian32 = scene.globe.ellipsoid.geodeticSurfaceNormal(
    scratchCartesian31,
    scratchCartesian32,
  );

  return Plane.fromPointNormal(scratchCartesian31, scratchCartesian32);
}

/**
 * @param  plane
 * @param  camera
 * @param  windowPosition
 */
export function getCartographicFromPlane(
  plane: Plane,
  camera: Camera,
  windowPosition: Cartesian2,
): Cartographic {
  const ray = camera.getPickRay(windowPosition, new Ray());
  const intersection = IntersectionTests.rayPlane(ray!, plane);
  if (intersection) {
    return Cartographic.fromCartesian(intersection);
  }
  return Cartographic.ZERO;
}

/**
 * Drapes a geometry onto the terrain by placing each coordinate at its height.
 * @param  geometry
 * @param  map
 */
export async function drapeGeometryOnTerrain(
  geometry: Geometry,
  map: VcsMap,
): Promise<void> {
  if (map instanceof CesiumMap) {
    const coordinates = geometry.getCoordinates() as any[];
    const flats = getFlatCoordinatesFromGeometry(geometry, coordinates);
    await map.getHeightFromTerrain(flats);
    geometry.setCoordinates(coordinates);
  }
}

/**
 * Places a geometry onto the terrain at its lowest point.
 * @param  geometry
 * @param  map
 */
export async function placeGeometryOnTerrain(
  geometry: Geometry,
  map: VcsMap,
): Promise<void> {
  if (map instanceof CesiumMap) {
    const coordinates = geometry.getCoordinates() as any[];
    const flats = getFlatCoordinatesFromGeometry(geometry, coordinates);
    await map.getHeightFromTerrain(flats);
    let minHeight = Infinity;
    flats.forEach((coord) => {
      if (minHeight > coord[2]) {
        minHeight = coord[2];
      }
    });
    flats.forEach((coord) => {
      coord[2] = minHeight;
    });
    geometry.setCoordinates(coordinates);
  }
}

export async function ensureFeatureAbsolute(
  feature: Feature,
  layer: VectorLayer,
  cesiumMap: CesiumMap,
): Promise<void> {
  // XXX this does not ensure 3D coordinates
  const layerIsClamped =
    layer.vectorProperties.altitudeMode === HeightReference.CLAMP_TO_GROUND;
  const altitudeMode = feature.get('olcs_altitudeMode') as string;
  if (altitudeMode === 'clampToGround' || (!altitudeMode && layerIsClamped)) {
    feature.set('olcs_altitudeMode', 'absolute', true);
    const geometry = feature.getGeometry();
    if (geometry) {
      await placeGeometryOnTerrain(geometry, cesiumMap);
    }
  }
}

export function clampFeature(feature: import('ol').Feature): void {
  feature.set('olcs_altitudeMode', 'clampToGround');
}
