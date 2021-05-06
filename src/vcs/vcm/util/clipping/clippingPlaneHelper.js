import Cartesian3 from '@vcmap/cesium/Source/Core/Cartesian3.js';
import Plane from '@vcmap/cesium/Source/Core/Plane.js';
import ClippingPlane from '@vcmap/cesium/Source/Scene/ClippingPlane.js';
import Matrix3 from '@vcmap/cesium/Source/Core/Matrix3.js';
import Matrix4 from '@vcmap/cesium/Source/Core/Matrix4.js';
import Feature from 'ol/Feature.js';
import ClippingPlaneCollection from '@vcmap/cesium/Source/Scene/ClippingPlaneCollection.js';
import Entity from '@vcmap/cesium/Source/DataSources/Entity.js';
import ConstantProperty from '@vcmap/cesium/Source/DataSources/ConstantProperty.js';
import JulianDate from '@vcmap/cesium/Source/Core/JulianDate.js';
import Cesium3DTileset from '@vcmap/cesium/Source/Scene/Cesium3DTileset.js';
import Globe from '@vcmap/cesium/Source/Scene/Globe.js';
import LineString from 'ol/geom/LineString.js';
import { offset } from 'ol/sphere.js';
import GeometryLayout from 'ol/geom/GeometryLayout.js';
import Polygon from 'ol/geom/Polygon.js';

import { check, checkMaybe } from '@vcsuite/check';
import Projection, { mercatorProjection, wgs84Projection } from '../projection.js';
import { createOrUpdateFromGeometry } from '../featureconverter/extent3d.js';
import { enforceEndingVertex, enforceRightHand, getFlatCoordinatesFromGeometry } from '../geometryHelpers.js';

/**
 * Creates a Plane on p1 with the normal in the direction of P2
 * @param {Cesium/Cartesian3} p1
 * @param {Cesium/Cartesian3} p2
 * @returns {Cesium/ClippingPlane}
 */
function createPlane(p1, p2) {
  const planeNormal = Cartesian3.subtract(p1, p2, new Cartesian3());
  Cartesian3.normalize(planeNormal, planeNormal);
  const plane = Plane.fromPointNormal(p1, planeNormal);
  return ClippingPlane.fromPlane(plane);
}

/**
 * @param {Array<ol/Coordinate>} coords
 * @returns {Array<Cesium/ClippingPlane>} clippingPlanes
 */
function createVerticalPlanes(coords) {
  const clippingPlanes = [];
  // @ts-ignore
  const cartesiansCoords = coords.map(c => Cartesian3.fromDegrees(...Projection.mercatorToWgs84(c)));
  for (let i = 0; i < cartesiansCoords.length - 1; i++) {
    const nextIndex = i + 1;
    const normal = new Cartesian3();
    Cartesian3.cross(cartesiansCoords[nextIndex], cartesiansCoords[i], normal);
    Cartesian3.normalize(normal, normal);
    const verticalPlane = new Plane(normal, 0.0);
    if (!Number.isNaN(verticalPlane.distance)) {
      clippingPlanes.push(ClippingPlane.fromPlane(verticalPlane));
    }
  }
  return clippingPlanes;
}

/**
 * @param {ol/Feature} feature
 * @param {Array<ol/Coordinate>} coords
 * @param {vcs.vcm.util.clipping.CreationOptions=} options
 * @returns {Array<Cesium/ClippingPlane>} clippingPlanes
 */
function createHorizontalPlanes(feature, coords, options) {
  const clippingPlanes = [];
  const extent = createOrUpdateFromGeometry(feature.getGeometry());
  let min = Number.isFinite(extent[2]) ? extent[2] : 0;
  let max = Number.isFinite(extent[5]) ? extent[5] : 0;
  const extruded = feature.get('olcs_extrudedHeight');
  if (extruded && feature.get('olcs_skirt')) {
    min -= feature.get('olcs_skirt');
  }

  if (min === max) {
    max += 1;
  }

  const [lon, lat] = Projection.mercatorToWgs84(coords[0]);
  const lowerPoint = Cartesian3.fromDegrees(lon, lat, min);
  const upperPoint = Cartesian3.fromDegrees(lon, lat, max);
  if (options.createBottomPlane) {
    clippingPlanes.push(createPlane(lowerPoint, upperPoint));
  }
  if (extruded && options.createTopPlane) {
    clippingPlanes.push(createPlane(upperPoint, lowerPoint));
  }
  return clippingPlanes;
}

/**
 * creates a plane for each point in the opposite direction of the other point.
 * only works for two coordinates
 * @param {Array<ol/Coordinate>} coords
 * @returns {Array<Cesium/ClippingPlane>} clippingPlanes
 */
function createEndingPlanes(coords) {
  const clippingPlanes = [];
  // @ts-ignore
  const cartesiansCoords = coords.map(c => Cartesian3.fromDegrees(...Projection.mercatorToWgs84(c)));
  const normal = new Cartesian3();
  Cartesian3.cross(cartesiansCoords[0], cartesiansCoords[1], normal);
  Cartesian3.normalize(normal, normal);

  function createOuter(cartesian) {
    const moved = Cartesian3.add(cartesian, normal, new Cartesian3());
    const planeNormal = new Cartesian3();
    Cartesian3.cross(cartesian, moved, planeNormal);
    Cartesian3.normalize(planeNormal, planeNormal);
    const verticalPlane = new Plane(planeNormal, 0.0);
    clippingPlanes.push(ClippingPlane.fromPlane(verticalPlane));
  }

  createOuter(cartesiansCoords[0]);
  Cartesian3.negate(normal, normal);
  createOuter(cartesiansCoords[1]);
  return clippingPlanes;
}

/**
 * create a Cesium ClippingPlaneCollection based on a given feature having a multi-curve, polygon, or extruded solid geometry
 * @param {ol/Feature} feature - base for calculating the clipping planes.
 * @param {vcs.vcm.util.clipping.CreationOptions=} options
 * @param {Cesium/Matrix4=} transformMatrix - 4x4 matrix specifying the transform of clipping planes from Earth's fixed frame to another one
 * @returns {Cesium/ClippingPlaneCollection|null}
 * @api stable
 * @memberOf vcs.vcm.util.clipping
 * @export
 */
export function createClippingPlaneCollection(feature, options = {}, transformMatrix) {
  check(feature, Feature);
  check(options, Object);
  checkMaybe(transformMatrix, Matrix4);

  const clippingPlanes = [];
  const geometry = feature.getGeometry();
  const geometryType = geometry.getType();

  if (geometryType === 'Point') {
    clippingPlanes.push(...createHorizontalPlanes(feature, [geometry.getCoordinates()], options));
  } else {
    const coords = getFlatCoordinatesFromGeometry(geometry);
    if (coords.length < 2 || (coords[0][0] === coords[1][0] && coords[0][1] === coords[1][1])) {
      return null;
    }

    if (geometryType === 'Polygon') {
      enforceEndingVertex(coords);
      enforceRightHand(coords);
    } else if (geometryType === 'LineString' && coords.length === 2 && options.createEndingPlanes) {
      clippingPlanes.push(...createEndingPlanes(coords));
    }

    if (options.createVerticalPlanes) {
      clippingPlanes.push(...createVerticalPlanes(coords));
    }

    if (feature.get('olcs_altitudeMode') === 'absolute' && (options.createBottomPlane || options.createTopPlane)) {
      clippingPlanes.push(...createHorizontalPlanes(feature, coords, options));
    }
  }

  if (transformMatrix) {
    clippingPlanes.forEach((/** @type {Cesium/ClippingPlane} */ plane) => {
      const result = Plane.transform(plane, transformMatrix);
      plane.normal = result.normal;
      plane.distance = result.distance;
    });
  }

  if (options.reverse) {
    clippingPlanes.forEach((/** @type {Cesium/ClippingPlane} */ plane) => {
      Cartesian3.negate(plane.normal, plane.normal);
      plane.distance *= -1;
    });
  }

  return new ClippingPlaneCollection({
    planes: clippingPlanes,
    unionClippingRegions: options.reverse,
  });
}

/**
 * copies the clippingplanes and the properties from source to result
 * @param {Cesium/ClippingPlaneCollection} source
 * @param {Cesium/ClippingPlaneCollection} result
 * @param {Cesium/Matrix4=} transformMatrix - 4x4 matrix specifying the transform of clipping planes from Earth's fixed frame to another one
 * @param {Cesium/Cartesian3=} originPoint - the origin point of the transformation target, so the plane distance can be set correctly
 * @returns {Cesium/ClippingPlaneCollection}
 * @api stable
 * @memberOf vcs.vcm.util.clipping
 * @export
 */
export function copyClippingPlanesToCollection(source, result, transformMatrix, originPoint) {
  check(source, ClippingPlaneCollection);
  check(result, ClippingPlaneCollection);

  if (result.length > 0) {
    result.removeAll();
  }
  for (let i = 0; i < source.length; i++) {
    const plane = source.get(i);
    if (transformMatrix && originPoint) {
      const distance = Plane.getPointDistance(plane, originPoint);
      const transformedPlane = Plane.transform(plane, transformMatrix);
      transformedPlane.distance = distance;
      result.add(ClippingPlane.fromPlane(transformedPlane));
    } else {
      result.add(ClippingPlane.clone(plane));
    }
  }
  result.modelMatrix = source.modelMatrix.clone();
  result.unionClippingRegions = source.unionClippingRegions;
  result.edgeColor = source.edgeColor.clone();
  result.edgeWidth = source.edgeWidth;
  return result;
}

/**
 * @param {Cesium/Globe|Cesium/Cesium3DTileset|Cesium/Entity} target
 */
export function clearClippingPlanes(target) {
  if (target instanceof Entity) {
    if (target.model) {
      if (target.model.clippingPlanes) {
        const entityClippingPlanes = (/** @type {Cesium/ConstantProperty} */ (target.model.clippingPlanes)).getValue();
        entityClippingPlanes.removeAll();
      } else {
        target.model.clippingPlanes = new ConstantProperty(new ClippingPlaneCollection());
      }
    }
  } else if (target.clippingPlanes) {
    target.clippingPlanes.removeAll();
  } else {
    target.clippingPlanes = new ClippingPlaneCollection();
  }
}

/**
 * @param {Cesium/Cesium3DTileset} cesium3DTileset
 * @param {Cesium/ClippingPlaneCollection} clippingPlaneCollection
 * @param {boolean=} local
 */
function setTilesetClippingPlane(cesium3DTileset, clippingPlaneCollection, local) {
  clearClippingPlanes(cesium3DTileset);
  if (!local) {
    const rotation = Matrix4.getMatrix3(
      Matrix4.inverse(cesium3DTileset.clippingPlanesOriginMatrix, new Matrix4()),
      new Matrix3(),
    );
    const transformationMatrix = Matrix4.fromRotationTranslation(rotation, new Cartesian3());
    copyClippingPlanesToCollection(
      clippingPlaneCollection,
      cesium3DTileset.clippingPlanes,
      transformationMatrix,
      cesium3DTileset.boundingSphere.center,
    );
  } else {
    copyClippingPlanesToCollection(clippingPlaneCollection, cesium3DTileset.clippingPlanes);
  }
}

/**
 * @param {Cesium/Globe} globe
 * @param {Cesium/ClippingPlaneCollection} clippingPlaneCollection
 */
function setGlobeClippingPlanes(globe, clippingPlaneCollection) {
  clearClippingPlanes(globe);
  copyClippingPlanesToCollection(clippingPlaneCollection, globe.clippingPlanes);
}

/**
 * apply a clippingPlaneCollection to an entity
 * @param {Cesium/Entity} entity
 * @param {Cesium/ClippingPlaneCollection} clippingPlaneCollection
 * @param {boolean=} local
 */
function setEntityClippingPlanes(entity, clippingPlaneCollection, local) {
  if (entity.model) {
    clearClippingPlanes(entity);
    const entityClippingPlanes = (/** @type {Cesium/ConstantProperty} */ (entity.model.clippingPlanes)).getValue();
    copyClippingPlanesToCollection(clippingPlaneCollection, entityClippingPlanes);
    if (!local) {
      const localToFixedFrame = entity.computeModelMatrix(JulianDate.now());
      Matrix4.inverseTransformation(localToFixedFrame, entityClippingPlanes.modelMatrix);
      if (!clippingPlaneCollection.modelMatrix.equals(Matrix4.IDENTITY)) {
        Matrix4.multiply(
          entityClippingPlanes.modelMatrix,
          clippingPlaneCollection.modelMatrix,
          entityClippingPlanes.modelMatrix,
        );
      }
    }
  }
}

/**
 * @param {Cesium/Globe|Cesium/Cesium3DTileset|Cesium/Entity} target
 * @param {Cesium/ClippingPlaneCollection} clippingPlaneCollection
 * @param {boolean=} local
 */
export function setClippingPlanes(target, clippingPlaneCollection, local) {
  if (target instanceof Cesium3DTileset) {
    setTilesetClippingPlane(target, clippingPlaneCollection, local);
  } else if (target instanceof Globe) {
    setGlobeClippingPlanes(target, clippingPlaneCollection);
  } else {
    setEntityClippingPlanes(target, clippingPlaneCollection, local);
  }
}

/**
 * Creates a new feature at the given coordinate, which can be set on a {@link vcs.vcm.util.clipping.ClippingObjectEditor}.
 * @param {ol/Coordinate} coordinate - in WGS84
 * @param {Cesium/Camera} camera
 * @param {boolean} [vertical=false]
 * @param {number} [offsetDistance=25] - the offset from the coordinate to use for the size of the geometry
 * @returns {ol/Feature} - the features geometry is in web mercator
 * @api
 * @memberOf vcs.vcm.util.clipping
 * @export
 */
export function createClippingFeature(coordinate, camera, vertical = false, offsetDistance = 25) {
  check(coordinate, [Number]);
  check(vertical, Boolean);
  check(offsetDistance, Number);

  let geometry;
  if (vertical) {
    const p1 = offset(coordinate, -offsetDistance, camera.heading);
    const p2 = offset(coordinate, offsetDistance, camera.heading);
    geometry = new LineString([
      [p1[0], p1[1], coordinate[2]],
      [p2[0], p2[1], coordinate[2]],
      // @ts-ignore
    ], GeometryLayout.XYZ);
  } else {
    geometry = new Polygon([[]], GeometryLayout.XYZ);
    let bearing = (2 * Math.PI) - (Math.PI / 4); // Bearing NW
    const coordinates = [...new Array(4)].map(() => {
      const newPoint = offset(coordinate, offsetDistance, bearing);
      bearing -= (Math.PI / 2);
      return [newPoint[0], newPoint[1], coordinate[2]];
    });
    geometry.setCoordinates([coordinates]);
  }
  const feature = new Feature({ geometry });
  feature.set('olcs_altitudeMode', 'absolute');
  if (vertical) {
    feature.set('olcs_extrudedHeight', offsetDistance * 2);
  }

  geometry.transform(wgs84Projection.proj, mercatorProjection.proj);
  return feature;
}

/**
 * Gets the clipping options for the current feature to be infinite or not for the given feature created by
 * {@link vcs.vcm.util.clipping.createClippingFeature}.
 * @param {ol/Feature=} feature - the feature created by {@link vcs.vcm.util.clipping.createClippingFeature}
 * @param {boolean=} [infinite=false]
 * @returns {vcs.vcm.util.clipping.CreationOptions}
 * @api
 * @export
 * @memberOf vcs.vcm.util.clipping
 */
export function getClippingOptions(feature, infinite = false) {
  checkMaybe(feature, Feature);
  check(infinite, Boolean);

  const vertical = feature ?
    feature.getGeometry().getType() === 'LineString' :
    false;

  return vertical ?
    {
      createBottomPlane: !infinite,
      createTopPlane: !infinite,
      createEndingPlanes: !infinite,
      createVerticalPlanes: true,
    } :
    {
      createVerticalPlanes: !infinite,
      createBottomPlane: true,
    };
}
