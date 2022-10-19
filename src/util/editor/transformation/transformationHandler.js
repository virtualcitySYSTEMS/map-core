import { HeightReference } from '@vcmap/cesium';
import {
  createEmpty as createEmptyExtent,
  extend as extendExtent,
  getCenter as getExtentCenter,
} from 'ol/extent.js';
import Extent3D from '../../featureconverter/extent3D.js';
import CesiumMap from '../../../map/cesiumMap.js';
import BaseOLMap from '../../../map/baseOLMap.js';
import create3DHandlers from './create3DHandlers.js';
import create2DHandlers from './create2DHandlers.js';
import { obliqueGeometry } from '../../../layer/vectorSymbols.js';

/**
 * @typedef {Object} FeatureCenterInfo
 * @property {import("ol/coordinate").Coordinate} center
 * @property {boolean} someClamped
 * @property {boolean} someNoTerrain
 * @private
 */

/**
 * @param {import("@vcmap/core").VectorLayer} layer
 * @param {Array<import("ol").Feature>} features
 * @returns {FeatureCenterInfo}
 */
function getCenterFromFeatures3D(layer, features) {
  const extent3D = new Extent3D();
  let someClamped = false;
  let someNoTerrain = false;
  const layerIsClamped = layer.vectorProperties.altitudeMode === HeightReference.CLAMP_TO_GROUND;

  features.forEach((f) => {
    const geometry = f.getGeometry();
    extent3D.extendWithGeometry(geometry);
    if (!someNoTerrain) {
      const firstCoordinates = /** @type {import("ol/geom").SimpleGeometry} */ (geometry).getFirstCoordinate();
      if (!firstCoordinates[2]) {
        someNoTerrain = true;
      }
    }

    if (!someClamped) {
      const altitudeMode = f.get('olcs_altitudeMode');
      someClamped = altitudeMode === 'clampToGround' || (!altitudeMode && layerIsClamped);
    }
  });
  const center = extent3D.getCenter();
  return {
    center,
    someClamped,
    someNoTerrain,
  };
}

/**
 * @param {Array<import("ol").Feature>} features
 * @returns {FeatureCenterInfo}
 */
function getCenterFromFeatures2D(features) {
  const extent = createEmptyExtent();

  features.forEach((f) => {
    const geometry = f[obliqueGeometry] ?? f.getGeometry();
    extendExtent(extent, geometry.getExtent());
  });

  return {
    center: [...getExtentCenter(extent), 0],
    someClamped: false,
    someNoTerrain: false,
  };
}

/**
 * The transformation handler is a set of handlers used for transformation interactions. these handlers are centered at the
 * origin of the currently selected features and are rendered depending on a) the current mode and b) the current selections
 * sets capabilities. if one or more selected features are clamp to ground, no Z manipulations will be available and
 * they will be greyed out. updates to the selection set are handled by the handler. updates to the features (for instance
 * setting the olcs_altitudeMode on a currently selected feature) is currently not handled.
 * transformation handlers are only valid for the currently active map (and oblique image).
 * it is up to the creator to re-create them as needed (map change, image change, external geometry or property change to a selected feature).
 * In most scenarios, this function must not be called directly and the startEditFeatureSession used instead.
 * @param {import("@vcmap/core").VcsMap} map
 * @param {import("@vcmap/core").VectorLayer} layer
 * @param {import("@vcmap/core").SelectMultiFeatureInteraction} selectMultiFeatureInteraction
 * @param {import("@vcmap/core").VectorLayer} scratchLayer
 * @param {import("@vcmap/core").TransformationMode} mode
 * @returns {TransformationHandler}
 */
export default function createTransformationHandler(
  map,
  layer,
  selectMultiFeatureInteraction,
  scratchLayer,
  mode,
) {
  /** @type {Handlers} */
  let handlerFeatures;
  /** @type {import("ol/coordinate").Coordinate} */
  let center = [0, 0, 0];

  /** @type {function(Array<import("ol").Feature>):FeatureCenterInfo} */
  let getCenterFromFeatures;
  /** @type {import("@vcmap/core").CesiumMap|null} */
  let cesiumMap = null;

  let cancelAsyncSetting = () => {};
  const handleFeaturesChanged = async () => {
    cancelAsyncSetting();
    const { selectedFeatures } = selectMultiFeatureInteraction;
    const show = selectedFeatures.length > 0;
    if (show) {
      const { center: newCenter, someClamped, someNoTerrain } = getCenterFromFeatures(selectedFeatures);
      center = newCenter;
      if (!cesiumMap || !someNoTerrain) { // only set center sync, if updating will not change it too drastically (to avoid jumps)
        handlerFeatures.show = true;
        handlerFeatures.setCenter(center);
      }
      handlerFeatures.greyOutZ = someClamped;
      if (cesiumMap && (someClamped || someNoTerrain)) {
        let cancel = false;
        cancelAsyncSetting = () => { cancel = true; };
        await cesiumMap.getHeightFromTerrain([center]);
        if (!cancel) {
          handlerFeatures.show = true;
          handlerFeatures.setCenter(center);
        }
      }
    } else {
      handlerFeatures.show = false;
    }
  };

  if (map instanceof CesiumMap) {
    handlerFeatures = create3DHandlers(map, mode);
    getCenterFromFeatures = getCenterFromFeatures3D.bind(null, layer);
    cesiumMap = map;
  } else if (map instanceof BaseOLMap) {
    handlerFeatures = create2DHandlers(map, scratchLayer, mode);
    getCenterFromFeatures = getCenterFromFeatures2D;
  }
  handleFeaturesChanged();
  const featuresChangedListener = selectMultiFeatureInteraction.featuresChanged.addEventListener(handleFeaturesChanged);

  return {
    get showing() { return handlerFeatures.show; },
    get center() { return center.slice(); },
    get showAxis() {
      return handlerFeatures.showAxis;
    },
    set showAxis(axis) {
      handlerFeatures.showAxis = axis;
    },
    translate(dx, dy, dz) {
      center[0] += dx;
      center[1] += dy;
      center[2] += dz;
      handlerFeatures.setCenter(center);
    },
    destroy() {
      cancelAsyncSetting();
      featuresChangedListener();
      handlerFeatures.destroy();
      scratchLayer.removeAllFeatures();
    },
  };
}
