import { getCenter } from 'ol/extent.js';
import Projection from '../projection.js';
import { createOrUpdateFromGeometry } from '../featureconverter/extent3d.js';

/**
 * @param {VectorClickedObject} feature
 * @param {import("@vcmap/core").Layer} layer
 * @returns {?GenericFeature}
 */
// eslint-disable-next-line import/prefer-default-export
export function getGenericFeatureFromProvidedFeature(feature, layer) {
  const attributes = feature.getProperties();
  delete attributes[feature.getGeometryName()];

  let { clickedPosition } = feature;
  const geometry = feature.getGeometry();
  const isModel = feature.get('olcs_modelUrl');
  if (
    geometry &&
    (
      (geometry.getType() === 'Point' && !isModel) ||
      (clickedPosition && !clickedPosition.exactPosition) ||
      (!clickedPosition && geometry)
    )
  ) {
    const center = getCenter(geometry.getExtent());
    if (center) {
      Projection.mercatorToWgs84(center, true);
      clickedPosition = { longitude: center[0], latitude: center[1] };
    }
  }

  let heightOffset = clickedPosition.height;
  if (!isModel) {
    const extent = createOrUpdateFromGeometry(geometry);
    const max = Number.isFinite(extent[5]) ? extent[5] : 0;
    heightOffset = max;
  }
  const relativeToGround = !isModel && feature.get('olcs_altitudeMode') === 'relativeToGround';

  delete attributes.clickedPosition;
  return {
    layerName: layer.name,
    layerClass: layer.className,
    attributes,
    longitude: clickedPosition.longitude,
    latitude: clickedPosition.latitude,
    height: heightOffset,
    relativeToGround,
  };
}
