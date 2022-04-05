import { unByKey } from 'ol/Observable.js';
import Feature from 'ol/Feature.js';
import GeometryType from 'ol/geom/GeometryType.js';
import { HeightReference } from '@vcmap/cesium';
import { FeatureVisibilityAction } from './featureVisibility.js';
import Projection from '../util/projection.js';
import { getHeightInfo } from '../util/featureconverter/featureconverterHelper.js';
import { getFlatCoordinatesFromGeometry } from '../util/geometryHelpers.js';
import Extent3D from '../util/featureconverter/extent3D.js';

/**
 * Added to ol.source.Vector to determine, when the source has last had an update to its features visibility.
 * @type {symbol}
 */
export const fvLastUpdated = Symbol('FVlastUpdated');

/**
 * Added to ol.source.Vector to determine, when the source has last had an update to its features global visibility.
 * @type {symbol}
 */
export const globalHiderLastUpdated = Symbol('GlobalHiderLastUpdated');

/**
 * @param {import("@vcmap/core").FeatureVisibility} featureVisibility
 * @param {import("ol/source").Vector<import("ol/geom/Geometry").default>} source
 */
export function updateFeatureVisibility(featureVisibility, source) {
  Object.keys(featureVisibility.highlightedObjects)
    .forEach((id) => {
      const feat = source.getFeatureById(id);
      if (feat && !featureVisibility.hasHighlightFeature(id, feat)) {
        featureVisibility.addHighlightFeature(id, feat);
      }
    });

  Object.keys(featureVisibility.hiddenObjects)
    .forEach((id) => {
      const feat = source.getFeatureById(id);
      if (feat && !featureVisibility.hasHiddenFeature(id, feat)) {
        featureVisibility.addHiddenFeature(id, feat);
      }
    });
  source[fvLastUpdated] = Date.now();
}

/**
 * @param {import("@vcmap/core").GlobalHider} globalHider
 * @param {import("ol/source").Vector<import("ol/geom/Geometry").default>} source
 */
export function updateGlobalHider(globalHider, source) {
  Object.keys(globalHider.hiddenObjects)
    .forEach((id) => {
      const feat = source.getFeatureById(id);
      if (feat && !globalHider.hasFeature(id, feat)) {
        globalHider.addFeature(id, feat);
      }
    });
  source[globalHiderLastUpdated] = Date.now();
}

/**
 * @param {import("@vcmap/core").FeatureVisibility} featureVisibility
 * @param {import("ol/source").Vector<import("ol/geom/Geometry").default>} source
 * @param {import("@vcmap/core").GlobalHider} globalHider
 * @returns {Array<Function>}
 */
export function synchronizeFeatureVisibilityWithSource(featureVisibility, source, globalHider) {
  const sourceListener = source.on('addfeature', ({ feature }) => {
    const id = feature.getId();
    if (featureVisibility.highlightedObjects[id]) {
      featureVisibility.addHighlightFeature(id, feature);
    }

    if (featureVisibility.hiddenObjects[id]) {
      featureVisibility.addHiddenFeature(id, feature);
    }

    if (globalHider.hiddenObjects[id]) {
      globalHider.addFeature(id, feature);
    }
    const now = Date.now();
    source[fvLastUpdated] = now;
    source[globalHiderLastUpdated] = now;
  });

  if (!source[fvLastUpdated] || source[fvLastUpdated] < featureVisibility.lastUpdated) {
    updateFeatureVisibility(featureVisibility, source);
  }

  if (!source[globalHiderLastUpdated] || source[globalHiderLastUpdated] < featureVisibility.lastUpdated) {
    updateGlobalHider(globalHider, source);
  }

  return [
    featureVisibility.changed.addEventListener(({ action, ids }) => {
      if (action === FeatureVisibilityAction.HIGHLIGHT) {
        ids.forEach((id) => {
          const feat = source.getFeatureById(id);
          if (feat) {
            featureVisibility.addHighlightFeature(id, feat);
          }
        });
        source[fvLastUpdated] = Date.now();
      } else if (action === FeatureVisibilityAction.HIDE) {
        ids.forEach((id) => {
          const feat = source.getFeatureById(id);
          if (feat) {
            featureVisibility.addHiddenFeature(id, feat);
          }
        });
        source[fvLastUpdated] = Date.now();
      }
    }),
    globalHider.changed.addEventListener(({ action, ids }) => {
      if (action === FeatureVisibilityAction.HIDE) {
        ids.forEach((id) => {
          const feat = source.getFeatureById(id);
          if (feat) {
            globalHider.addFeature(id, feat);
          }
        });
        source[globalHiderLastUpdated] = Date.now();
      }
    }),
    () => { unByKey(sourceListener); },
  ];
}

/**
 * @param {VectorClickedObject} object
 * @param {import("@vcmap/core").VectorLayer|import("@vcmap/core").VectorTileLayer} layer
 * @returns {?GenericFeature}
 */
export function getGenericFeatureFromClickedObject(object, layer) {
  if (!(object instanceof Feature)) {
    return null;
  }
  const attributes = object.getProperties();
  delete attributes[object.getGeometryName()];

  const { clickedPosition } = object;
  if (!clickedPosition) {
    return null;
  }
  let { latitude, longitude } = clickedPosition;
  const geometry = object.getGeometry();
  let heightOffset = clickedPosition.height;
  let calculateHeight = !heightOffset;
  if (!geometry) {
    calculateHeight = false; // we cannot calculate the height without geometry;
  }

  let relativeToGround = !heightOffset;
  // Edge Case ClickedPosition is next to the feature and Feature got detected in clickToleranz.
  // if the clicked Position does not intersect the feature the closestPoint will be used.
  // also if the clickedPosition is not on the Feature we do not trust the Height Value;
  const mercatorPoint =
    Projection.wgs84ToMercator([clickedPosition.longitude, clickedPosition.latitude, clickedPosition.height]);
  if (geometry && !geometry.intersectsCoordinate(mercatorPoint)) {
    const closestPoint = geometry.getClosestPoint(mercatorPoint);
    [longitude, latitude] = Projection.mercatorToWgs84(closestPoint);
    calculateHeight = true;
  }

  // edge case oblique in this case we do get a height value but not of the feature but the underlying terrain.
  // this is necessary to calculate the correct position of the balloon

  // if we do not have a height value from the clickedPosition we calculate the height based in the feature;
  if (calculateHeight) {
    const coordinates = getFlatCoordinatesFromGeometry(geometry);
    const heightInfo = getHeightInfo(object, layer.vectorProperties, coordinates);
    if (heightInfo.perPositionHeight || heightInfo.extruded) {
      const extent = Extent3D.fromGeometry(geometry);
      extent.extendWithHeightInfo(heightInfo);
      heightOffset = extent.maxZ;
    }
    // edge case points are rendered depending on the terrain, so we set relativeToGround to true.
    // In this case the heightAboveGroundAdjustment is also just an Offset.
    if (
      !heightInfo.extruded &&
      (geometry.getType() === GeometryType.POINT || geometry.getType() === GeometryType.MULTI_POINT) &&
      (
        heightInfo.heightReference === HeightReference.RELATIVE_TO_GROUND ||
        heightInfo.heightReference === HeightReference.CLAMP_TO_GROUND)
    ) {
      heightOffset = heightInfo.heightAboveGroundAdjustment;
      relativeToGround = true;
    } else {
      heightOffset += heightInfo.heightAboveGroundAdjustment;
    }

    // if we have to calculate the height we have to take heightAboveGround into account
  }

  delete attributes.clickedPosition;
  heightOffset = Number.isFinite(heightOffset) ? heightOffset : 0;
  return {
    layerName: layer.name,
    layerClass: layer.className,
    attributes: { ...layer.genericFeatureProperties, ...attributes },
    longitude,
    latitude,
    height: heightOffset + layer.balloonHeightOffset,
    relativeToGround,
  };
}
