import type { Feature } from 'ol/index.js';
import type { SimpleGeometry } from 'ol/geom.js';
import type { Coordinate } from 'ol/coordinate.js';
import { HeightReference } from '@vcmap-cesium/engine';
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
import type VectorLayer from '../../../layer/vectorLayer.js';
import {
  AxisAndPlanes,
  Handlers,
  TransformationHandler,
  TransformationMode,
} from './transformationTypes.js';
import type VcsMap from '../../../map/vcsMap.js';

type FeatureCenterInfo = {
  center: import('ol/coordinate.js').Coordinate;
  someClamped: boolean;
  someNoTerrain: boolean;
};

function getCenterFromFeatures3D(
  layer: VectorLayer,
  features: Feature[],
): FeatureCenterInfo {
  const extent3D = new Extent3D();
  let someClamped = false;
  let someNoTerrain = false;
  const layerIsClamped =
    layer.vectorProperties.altitudeMode === HeightReference.CLAMP_TO_GROUND;

  features.forEach((f) => {
    const geometry = f.getGeometry() as SimpleGeometry;
    extent3D.extendWithGeometry(geometry);
    if (!someNoTerrain) {
      const firstCoordinates = geometry.getFirstCoordinate();
      if (!firstCoordinates[2]) {
        someNoTerrain = true;
      }
    }

    if (!someClamped) {
      const altitudeMode = f.get('olcs_altitudeMode') as string;
      someClamped =
        altitudeMode === 'clampToGround' || (!altitudeMode && layerIsClamped);
    }
  });
  const center = extent3D.getCenter();
  return {
    center,
    someClamped,
    someNoTerrain,
  };
}

function getCenterFromFeatures2D(features: Feature[]): FeatureCenterInfo {
  const extent = createEmptyExtent();

  features.forEach((f) => {
    const geometry = f[obliqueGeometry] ?? f.getGeometry();
    extendExtent(extent, geometry!.getExtent());
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
 * @param  map
 * @param  layer
 * @param  scratchLayer
 * @param  mode
 */
export default function createTransformationHandler(
  map: VcsMap,
  layer: VectorLayer,
  scratchLayer: VectorLayer,
  mode: TransformationMode,
): TransformationHandler {
  let handlerFeatures: Handlers;
  let center: Coordinate = [0, 0, 0];
  let getCenterFromFeatures: (features: Feature[]) => FeatureCenterInfo;
  let cesiumMap: CesiumMap | null = null;

  let cancelAsyncSetting = (): void => {};
  const setFeatures = async (features: Feature[]): Promise<void> => {
    cancelAsyncSetting();
    const show = features.length > 0;
    if (show) {
      const {
        center: newCenter,
        someClamped,
        someNoTerrain,
      } = getCenterFromFeatures(features);
      center = newCenter;
      if (!cesiumMap || !someNoTerrain) {
        // only set center sync, if updating will not change it too drastically (to avoid jumps)
        handlerFeatures.show = true;
        handlerFeatures.setCenter(center);
      }
      handlerFeatures.greyOutZ = someClamped;
      if (cesiumMap && (someClamped || someNoTerrain)) {
        let cancel = false;
        cancelAsyncSetting = (): void => {
          cancel = true;
        };
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

  return {
    get showing(): boolean {
      return handlerFeatures.show;
    },
    get center(): Coordinate {
      return center.slice();
    },
    get showAxis(): AxisAndPlanes {
      return handlerFeatures.showAxis;
    },
    set showAxis(axis) {
      handlerFeatures.showAxis = axis;
    },
    translate(dx, dy, dz): void {
      center[0] += dx;
      center[1] += dy;
      center[2] += dz;
      handlerFeatures.setCenter(center);
    },
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setFeatures,
    destroy(): void {
      cancelAsyncSetting();
      handlerFeatures.destroy();
      scratchLayer.removeAllFeatures();
    },
  };
}
