/* eslint no-underscore-dangle: ["error", { "allow": ["_listeners", "_scopes", "_toRemove"] }] */
/* eslint-disable no-continue */
import { boundingExtent, getBottomLeft, getBottomRight, getTopLeft, getTopRight } from 'ol/extent.js';
import { transform } from 'ol/proj.js';
import { Cartesian2 } from '@vcmap/cesium';
import { ObliqueViewDirection } from './obliqueViewDirection.js';
import { getHeightFromTerrainProvider } from '../layer/terrainHelpers.js';
import { cartesian2DDistance } from '../util/math.js';
import { mercatorProjection, wgs84Projection } from '../util/projection.js';

/**
 * @type {import("@vcmap/cesium").Cartesian2}
 */
let scratchCartesian2A = new Cartesian2();
/**
 * @type {import("@vcmap/cesium").Cartesian2}
 */
let scratchCartesian2B = new Cartesian2();

/**
 * @typedef {Object} PickTerrainReturn
 * @property {boolean} estimate
 * @property {import("ol/coordinate").Coordinate} coords
 */

/**
 * sorts the corner points of the json after [lower left, lower right, upper right, upper left]
 * 3----2   ^
 * |    |   |
 * 0----1 north
 * @param {Array<import("ol/coordinate").Coordinate>} inputCornerPoints
 * @param {(ObliqueViewDirection|boolean)=} [sortDirection=false]
 * @returns {Array<import("ol/coordinate").Coordinate>}
 */
export function sortRealWordEdgeCoordinates(inputCornerPoints, sortDirection = false) {
  const cornerPoints = inputCornerPoints.slice();
  const extent = boundingExtent(cornerPoints);
  const extentPoints = [
    getBottomLeft(extent),
    getBottomRight(extent),
    getTopRight(extent),
    getTopLeft(extent),
  ];

  let sorted = extentPoints.map((extentPoint) => {
    let closest = 0;
    let distance = Infinity;
    cornerPoints.forEach((cornerPoint, cornerIndex) => {
      const currentDistance = cartesian2DDistance(extentPoint, cornerPoint);
      if (currentDistance < distance) {
        distance = currentDistance;
        closest = cornerIndex;
      }
    });
    return cornerPoints.splice(closest, 1)[0];
  });
  if (sortDirection === ObliqueViewDirection.EAST) {
    sorted = [sorted[3], sorted[0], sorted[1], sorted[2]];
  } else if (sortDirection === ObliqueViewDirection.SOUTH) {
    sorted = [sorted[2], sorted[3], sorted[0], sorted[1]];
  } else if (sortDirection === ObliqueViewDirection.WEST) {
    sorted = [sorted[1], sorted[2], sorted[3], sorted[0]];
  }
  return sorted;
}

/**
 * @param {import("ol/coordinate").Coordinate} v1
 * @param {import("ol/coordinate").Coordinate} v2
 * @returns {number|null}
 */
function angleBetweenTwo2DVectors(v1, v2) {
  scratchCartesian2A = Cartesian2.fromElements(v1[0], v1[1], scratchCartesian2A);
  scratchCartesian2B = Cartesian2.fromElements(v2[0], v2[1], scratchCartesian2B);
  return Cartesian2.angleBetween(scratchCartesian2A, scratchCartesian2B);
}

/**
 * taken from http://jsfiddle.net/justin_c_rounds/Gd2S2/
 * @param {Array<import("ol/coordinate").Coordinate>} segment1
 * @param {Array<import("ol/coordinate").Coordinate>} segment2
 * @returns {{x: (number|null), y:(number|null), onLine1: boolean, onLine2: boolean}}
 * @export
 */
export function checkLineIntersection(segment1, segment2) {
  // if the lines intersect, the result contains the x and y of the intersection (treating the lines as infinite) and booleans for whether line segment 1 or line segment 2 contain the point
  const [[line1StartX, line1StartY], [line1EndX, line1EndY]] = segment1;
  const [[line2StartX, line2StartY], [line2EndX, line2EndY]] = segment2;
  let a;
  let b;

  const result = {
    x: null,
    y: null,
    onLine1: false,
    onLine2: false,
  };

  const denominator =
    ((line2EndY - line2StartY) * (line1EndX - line1StartX)) -
    ((line2EndX - line2StartX) * (line1EndY - line1StartY));

  if (denominator === 0) {
    return result;
  }
  a = line1StartY - line2StartY;
  b = line1StartX - line2StartX;
  const numerator1 = ((line2EndX - line2StartX) * a) - ((line2EndY - line2StartY) * b);
  const numerator2 = ((line1EndX - line1StartX) * a) - ((line1EndY - line1StartY) * b);
  a = numerator1 / denominator;
  b = numerator2 / denominator;

  // if we cast these lines infinitely in both directions, they intersect here:
  result.x = line1StartX + (a * (line1EndX - line1StartX));
  result.y = line1StartY + (a * (line1EndY - line1StartY));
  /*
   // it is worth noting that this should be the same as:
   x = line2StartX + (b * (line2EndX - line2StartX));
   y = line2StartX + (b * (line2EndY - line2StartY));
   */
  // if line1 is a segment and line2 is infinite, they intersect if:
  if (a > 0 && a < 1) {
    result.onLine1 = true;
  }
  // if line2 is a segment and line1 is infinite, they intersect if:
  if (b > 0 && b < 1) {
    result.onLine2 = true;
  }
  // if line1 and line2 are segments, they intersect if both of the above are true
  return result;
}

/**
 * transforms coordinate with intersection from corner
 * @param {Array<import("ol/coordinate").Coordinate>} inputOrigin
 * @param {Array<import("ol/coordinate").Coordinate>} inputTarget
 * @param {boolean} originIsImage
 * @param {import("ol/coordinate").Coordinate} coordinate2Transform
 * @param {ObliqueViewDirection} viewDirection
 * @returns {{x: (number|null), y:(number|null), onLine1: boolean, onLine2: boolean}|null}
 */
export function transformCWIFC(inputOrigin, inputTarget, originIsImage, coordinate2Transform, viewDirection) {
  const origin = sortRealWordEdgeCoordinates(inputOrigin, originIsImage ? false : viewDirection);
  const target = sortRealWordEdgeCoordinates(inputTarget, originIsImage ? viewDirection : false);

  // test intersections from all corner points over coordinate to all non neighbouring borders
  // and non side borders too - so actually remains only upper and lower border
  // and store:
  // - from which corner point,
  // - intersection,
  // - angle of intersection
  // - as well as edge (ccw) and
  // - distance ratio while negative means negative direction
  // to be able to recreate the situation in the target system
  const intersections = [];
  for (let cp = 0; cp < origin.length; ++cp) { // TODO write into a proper map and function
    const intrCurrCP = [];

    for (let sp = 0; sp < origin.length; ++sp) {
      const ep = sp === origin.length - 1 ? 0 : sp + 1; // end point of edge

      // skip if cp is sp or ep - neighbouring edge
      if (cp === sp || cp === ep) { continue; }

      // skip also if sp is 3 and ep is 0 and also skip sp is 1 and ep is 2 since does only work over the upper and lower boundary
      if ((sp === 3 && ep === 0) || (sp === 1 && ep === 2)) { continue; }

      // get intersection from cp over coordinate2Transform to current border edge
      const currIntr = checkLineIntersection([origin[cp], coordinate2Transform], [origin[sp], origin[ep]]);
      if (currIntr.x == null || currIntr.y == null) { continue; }

      // get vector from current cp to coordinate2Transform to be able to determine if the intersection is in same direction
      // might be in different direction when point is outside - then we dont need this data
      const vectorCP2Coordinate = [coordinate2Transform[0] - origin[cp][0], coordinate2Transform[1] - origin[cp][1]];
      const vectorCP2Intr = [currIntr.x - origin[cp][0], currIntr.y - origin[cp][1]];
      const angleDirectionCheck = angleBetweenTwo2DVectors(vectorCP2Coordinate, vectorCP2Intr);
      if (angleDirectionCheck == null) { continue; }

      if (angleDirectionCheck / (Math.PI * 180.0) > 5) { continue; }

      const sp2ep = [origin[sp][0] - origin[ep][0], origin[sp][1] - origin[ep][1]];
      const ep2sp = [origin[ep][0] - origin[sp][0], origin[ep][1] - origin[sp][1]];
      // regarding the angle find the smallest
      const angleStart2End = angleBetweenTwo2DVectors(vectorCP2Coordinate, sp2ep);
      if (angleStart2End == null) { continue; }

      const angleEnd2Start = angleBetweenTwo2DVectors(vectorCP2Coordinate, ep2sp);
      if (angleEnd2Start == null) { continue; }

      // regarding ratioStart2End get ratio and then direction
      const distStartEnd = cartesian2DDistance(origin[sp], origin[ep]);
      if (distStartEnd === 0) { continue; }
      const tempRatioStartEnd = cartesian2DDistance(origin[sp], [currIntr.x, currIntr.y]) / distStartEnd;
      let angleEdge2Intr = 0;
      if (tempRatioStartEnd !== 0) {
        angleEdge2Intr = angleBetweenTwo2DVectors(ep2sp, [currIntr.x - origin[sp][0], currIntr.y - origin[sp][1]]);
        if (angleEdge2Intr == null) { continue; }
      }

      intrCurrCP.push({
        cornerPoint: cp,
        intrX: currIntr.x,
        intrY: currIntr.y,
        angle: angleStart2End <= angleEnd2Start ? angleStart2End : angleEnd2Start,
        edgeStart: sp,
        edgeEnd: ep,
        ratioStart2End: (angleEdge2Intr / Math.PI) * 180.0 > 5 ? tempRatioStartEnd * (-1) : tempRatioStartEnd,
      });
    }

    // after getting the data find the intersection with largest of smallest angles
    let largestAngle = -1;
    let indLargestAngle = -1;
    for (let i = 0; i < intrCurrCP.length; ++i) {
      if (intrCurrCP[i].angle > largestAngle) {
        largestAngle = intrCurrCP[i].angle;
        indLargestAngle = i;
      }
    }
    if (indLargestAngle !== -1) { intersections.push(intrCurrCP[indLargestAngle]); }
  }

  // if we don not have enough data to recreate the situation in target system stop
  if (intersections.length < 2) { return null; }

  // make list with intersection combinations and sort after strength (add angles together)
  const intrCombis = []; // will contain [addedAngle, intersectionsIndex_i, intersectionsIndex_j]
  for (let i = 0; i < intersections.length; ++i) {
    for (let j = i + 1; j < intersections.length; ++j) {
      intrCombis.push([intersections[i].angle + intersections[j].angle, i, j]);
    }
  }

  let intrCross = null;
  intrCombis
    .sort()
    .reverse()
    .find((intersection) => {
      const intersectionsSorted = [intersections[intersection[1]], intersections[intersection[2]]];

      const targetEdgeEnd0 = target[intersectionsSorted[0].edgeEnd];
      const targetEdgeStart0 = target[intersectionsSorted[0].edgeStart];
      // test angle of lines with that the intersection will be calculated - if two small skip
      const targetEdgeVectorFor0 = [
        targetEdgeEnd0[0] - targetEdgeStart0[0],
        targetEdgeEnd0[1] - targetEdgeStart0[1],
      ];

      const intrFor0InTarget = [
        targetEdgeStart0[0] + (targetEdgeVectorFor0[0] * intersectionsSorted[0].ratioStart2End),
        targetEdgeStart0[1] + (targetEdgeVectorFor0[1] * intersectionsSorted[0].ratioStart2End),
      ];

      const targetEdgeEnd1 = target[intersectionsSorted[1].edgeEnd];
      const targetEdgeStart1 = target[intersectionsSorted[1].edgeStart];

      const targetEdgeVectorFor1 = [targetEdgeEnd1[0] - targetEdgeStart1[0], targetEdgeEnd1[1] - targetEdgeStart1[1]];
      const intrFor1InTarget = [
        targetEdgeStart1[0] + (targetEdgeVectorFor1[0] * intersectionsSorted[1].ratioStart2End),
        targetEdgeStart1[1] + (targetEdgeVectorFor1[1] * intersectionsSorted[1].ratioStart2End),
      ];

      const vecCP0ToIntr0 = [
        intrFor0InTarget[0] - target[intersectionsSorted[0].cornerPoint][0],
        intrFor0InTarget[1] - target[intersectionsSorted[0].cornerPoint][1],
      ];
      const vecCP1ToIntr1 = [
        intrFor1InTarget[0] - target[intersectionsSorted[1].cornerPoint][0],
        intrFor1InTarget[1] - target[intersectionsSorted[1].cornerPoint][1],
      ];

      const angleCross = angleBetweenTwo2DVectors(vecCP0ToIntr0, vecCP1ToIntr1);
      if (angleCross == null) { return false; }
      /* var thresholdInDegree = 3;
       if (angleCross/Math.PI*180.0 < thresholdInDegree || angleCross/Math.PI*180.0 > 180-thresholdInDegree)
       continue; */

      // get point in target
      intrCross = checkLineIntersection(
        [target[intersectionsSorted[0].cornerPoint], intrFor0InTarget],
        [target[intersectionsSorted[1].cornerPoint], intrFor1InTarget],
      );
      if (intrCross.x == null || intrCross.y == null) {
        return false;
      }

      return true;
    });

  return intrCross;
}

/**
 * @typedef {Object} ImageTransformationOptions
 * @property {boolean|undefined} [dontUseTerrain]
 * @property {import("@vcmap/core").Projection|undefined} [dataProjection] - the projection of the input/output coordinates, assumes image source projection
 * @property {number|undefined} [terrainErrorThreshold=1] - the transformToWorld process iterativly calculates a new Height Value from the terrainProvider until the difference to the new height value is smaller
 * @property {number|undefined} [terrainErrorCountThreshold=3] - how often the  transformToWorld process iterativly calculates a new Height Value from the terrainProvider
 * @api
 */

/**
 * Always returns a Promise. When the input coordinates contain a height, it will use this height to compute the image coordinates
 * When not, it will try to get the terrainHeight in case a terrain is defined and use the height from there, to compute the image coordinates
 * @param {import("@vcmap/core").ObliqueImage} image
 * @param {import("ol/coordinate").Coordinate} worldCoordinate if not in web mercatpr, specify data-projection in options
 * @param {ImageTransformationOptions=} options
 * @returns {Promise<{coords: import("ol/coordinate").Coordinate, height: number, estimate: (boolean|undefined)}>}
 * @export
 */
export function transformToImage(image, worldCoordinate, options = {}) {
  let gpInternalCoordinates;
  if (options.dataProjection && options.dataProjection === image.meta.projection) {
    gpInternalCoordinates = worldCoordinate;
  } else {
    gpInternalCoordinates = options.dataProjection ?
      transform(worldCoordinate, options.dataProjection.proj, image.meta.projection.proj) :
      transform(worldCoordinate, mercatorProjection.proj, image.meta.projection.proj);
  }

  function useAverageHeight() {
    const coords = image.transformRealWorld2Image(gpInternalCoordinates);
    return { coords, height: image.averageHeight, estimate: true };
  }

  if (worldCoordinate[2]) {
    const coords = image.transformRealWorld2Image(gpInternalCoordinates, worldCoordinate[2]);
    return Promise.resolve({ coords, height: worldCoordinate[2], estimate: false });
  }

  if (!options.dontUseTerrain && image.meta.terrainProvider) {
    return getHeightFromTerrainProvider(image.meta.terrainProvider, [gpInternalCoordinates], image.meta.projection)
      .then(([gpWithHeight]) => {
        if (gpWithHeight[2]) {
          const imageCoordinates = image.transformRealWorld2Image(gpInternalCoordinates, gpWithHeight[2]);
          return { coords: imageCoordinates, height: gpInternalCoordinates[2], estimate: false };
        }
        // eslint-disable-next-line no-console
        console.warn('The configured terrain on the oblique layer could not be queried, position might be inaccurate');
        return useAverageHeight();
      })
      .catch(() => useAverageHeight());
  }
  return Promise.resolve(useAverageHeight());
}

/**
 * @typedef {Object} PickTerrainOptions
 * @property {import("@vcmap/core").ObliqueImage} image
 * @property {import("ol/coordinate").Coordinate} worldCoordinate
 * @property {import("ol/coordinate").Coordinate} imageCoordinate
 * @property {number} height
 * @property {number} terrainErrorThreshold
 * @property {number} terrainErrorCountThreshold
 * @property {number} count
 */

/**
 * @param {PickTerrainOptions} pickTerrainOptions
 * @returns {Promise<PickTerrainReturn>}
 */
function pickTerrain(pickTerrainOptions) {
  pickTerrainOptions.count += 1;
  const {
    image,
    worldCoordinate,
    imageCoordinate,
    terrainErrorThreshold,
    terrainErrorCountThreshold,
    count,
    height,
  } = pickTerrainOptions;

  return getHeightFromTerrainProvider(image.meta.terrainProvider, [worldCoordinate])
    .then(([worldCoordinateWithHeights]) => {
      if (worldCoordinateWithHeights[2] != null) {
        const newWorldCoords = transform(
          image.transformImage2RealWorld(imageCoordinate, worldCoordinateWithHeights[2]),
          image.meta.projection.proj,
          wgs84Projection.proj,
        );
        newWorldCoords[2] = worldCoordinateWithHeights[2];
        if (
          Math.abs(height - worldCoordinateWithHeights[2]) < terrainErrorThreshold ||
          (count > terrainErrorCountThreshold)
        ) {
          return { coords: newWorldCoords, estimate: false };
        }
        pickTerrainOptions.height = newWorldCoords[2];
        pickTerrainOptions.worldCoordinate = worldCoordinateWithHeights;
        return pickTerrain(pickTerrainOptions);
      }
      // eslint-disable-next-line no-console
      console.log('The configured terrain on the oblique layer could not be queried, position might be inaccurate');
      return { coords: worldCoordinateWithHeights, estimate: true };
    })
    .catch(() => ({ coords: worldCoordinate, estimate: true }));
}

/**
 * Always returns a deferred.
 * it will try to get the terrainHeight in case a terrain is defined.
 * @param {import("@vcmap/core").ObliqueImage} image
 * @param {import("ol/coordinate").Coordinate} imageCoordinate
 * @param {ImageTransformationOptions=} options
 * @returns {Promise<PickTerrainReturn>} return coordinates are in mercator if not specified in options
 * @export
 */
export async function transformFromImage(image, imageCoordinate, options = {}) {
  const initialWorldCoords = transform(
    image.transformImage2RealWorld(imageCoordinate, image.averageHeight),
    image.meta.projection.proj,
    wgs84Projection.proj,
  );

  const terrainErrorThreshold = options.terrainErrorThreshold || 1;
  const terrainErrorCountThreshold = options.terrainErrorCountThreshold || 3;

  let coordsObj = { coords: initialWorldCoords, estimate: true };
  if (!options.dontUseTerrain && image.meta.terrainProvider) {
    coordsObj = await pickTerrain({
      worldCoordinate: initialWorldCoords,
      imageCoordinate,
      image,
      count: 0,
      height: image.averageHeight,
      terrainErrorThreshold,
      terrainErrorCountThreshold,
    });
  }

  coordsObj.coords = options.dataProjection ?
    transform(coordsObj.coords, wgs84Projection.proj, options.dataProjection.proj) :
    transform(coordsObj.coords, wgs84Projection.proj, mercatorProjection.proj);
  return coordsObj;
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function hasSameOrigin(url) {
  // relative Url, return true;
  if (!/^[a-z][a-z0-9+.-]*:/.test(url)) {
    return true;
  }
  // data uri, return true
  if (/^data:/.test(url)) {
    return true;
  }

  const currentUri = new URL(window.location.href);
  const uri = new URL(url);
  return currentUri.host.toLowerCase() === uri.host.toLocaleLowerCase();
}
