import Point from 'ol/geom/Point.js';
import Feature from 'ol/Feature.js';
import type { Coordinate } from 'ol/coordinate.js';
import type { Geometry } from 'ol/geom.js';
import { GeometryLayout } from 'ol/geom/Geometry.js';

import {
  Cartesian2,
  Cartesian3,
  Math as CesiumMath,
  Plane,
  Ray,
  IntersectionTests,
  Cartographic,
  Cesium3DTileFeature,
  type Scene,
  type Camera,
} from '@vcmap-cesium/engine';

import { mercatorToCartesian } from '../math.js';
import { getFlatCoordinateReferences } from '../geometryHelpers.js';
import CesiumMap from '../../map/cesiumMap.js';
import { vertexIndexSymbol, vertexSymbol } from './editorSymbols.js';
import {
  alreadyTransformedToImage,
  createSync,
  doNotTransform,
} from '../../layer/vectorSymbols.js';
import type VcsMap from '../../map/vcsMap.js';
import VectorProperties, {
  PropertyChangedKey,
} from '../../layer/vectorProperties.js';
import VectorLayer from '../../layer/vectorLayer.js';

export type Vertex = Feature<Point> & { [vertexIndexSymbol]: number };

export type SelectableFeatureType = Feature | Cesium3DTileFeature;
export interface SelectFeatureInteraction {
  readonly selected: Array<Feature>;
  setSelected(
    features: SelectableFeatureType[] | SelectableFeatureType,
  ): Promise<void>;
  hasFeatureId(id: string): boolean;
}

export const geometryChangeKeys = [
  'olcs_altitudeMode',
  'olcs_groundLevel',
  'olcs_heightAboveGround',
];

export const vectorPropertyChangeKeys: PropertyChangedKey[] = [
  'altitudeMode',
  'groundLevel',
  'heightAboveGround',
];

function assignVectorProperty<
  K extends PropertyChangedKey,
  V extends VectorProperties[K],
>(props: VectorProperties, key: K, value: V): void {
  props[key] = value;
}

export function syncScratchLayerVectorProperties(
  scratchLayer: VectorLayer,
  layer: VectorLayer,
  altitudeModeChanged?: () => void,
): () => void {
  vectorPropertyChangeKeys.forEach((key) => {
    assignVectorProperty(
      scratchLayer.vectorProperties,
      key,
      layer.vectorProperties[key],
    );
  });

  return layer.vectorProperties.propertyChanged.addEventListener((props) => {
    vectorPropertyChangeKeys.forEach((key) => {
      if (props.includes(key)) {
        assignVectorProperty(
          scratchLayer.vectorProperties,
          key,
          layer.vectorProperties[key],
        );
        if (key === 'altitudeMode') {
          altitudeModeChanged?.();
        }
      }
    });
  });
}

export function getOlcsPropsFromFeature(
  feature: Feature,
): Record<string, number | string> {
  const props: Record<string, number> = {};
  geometryChangeKeys.forEach((key) => {
    const value = feature.get(key) as number | undefined;
    if (value != null) {
      props[key] = value;
    }
  });

  return props;
}

export function createVertex(
  coordinate: Coordinate,
  olcsProps: Record<string, number | string>,
  index: number,
): Vertex {
  const geometry = new Point(coordinate);
  geometry[alreadyTransformedToImage] = true;
  const vertex = new Feature({
    geometry,
    ...olcsProps,
  }) as Vertex;
  vertex[vertexSymbol] = true;
  vertex[vertexIndexSymbol] = index;
  vertex[doNotTransform] = true;
  vertex[createSync] = true;
  return vertex;
}

export function getCoordinatesAndLayoutFromVertices(vertices: Vertex[]): {
  coordinates: Coordinate[];
  layout: GeometryLayout;
} {
  let is2D = false;
  const flatCoordinates = new Array<number>(vertices.length * 3);
  vertices.forEach((v, i) => {
    const vertexCoordinates = v.getGeometry()!.getCoordinates();
    is2D = is2D || vertexCoordinates.length === 2;
    flatCoordinates[i * 3] = vertexCoordinates[0];
    flatCoordinates[i * 3 + 1] = vertexCoordinates[1];
    flatCoordinates[i * 3 + 2] = vertexCoordinates[2];
  });

  const coordinates = new Array<Coordinate>(vertices.length);
  for (let i = 0; i < vertices.length; i++) {
    const coordinate = [flatCoordinates[i * 3], flatCoordinates[i * 3 + 1]];
    if (!is2D) {
      coordinate[2] = flatCoordinates[i * 3 + 2];
    }
    coordinates[i] = coordinate;
  }

  return {
    coordinates,
    layout: is2D ? 'XY' : 'XYZ',
  };
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
    const flats = getFlatCoordinateReferences(geometry, coordinates);
    await map.getHeightFromTerrain(flats);
    geometry.setCoordinates(coordinates, 'XYZ');
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
    const flats = getFlatCoordinateReferences(geometry, coordinates);
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
    geometry.setCoordinates(coordinates, 'XYZ');
  }
}
