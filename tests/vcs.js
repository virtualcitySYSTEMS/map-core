import '../src/ol/geom/circle.js';
import '../src/ol/geom/geometryCollection.js';
import '../src/ol/feature.js';
import '../src/cesium/wallpaperMaterial.js';
import '../src/cesium/cesium3DTilePointFeature.js';
import '../src/cesium/cesium3DTileFeature.js';
import '../src/cesium/cesiumVcsCameraPrimitive.js';

import { setLogLevel } from '@vcsuite/logger';
import { mercatorProjection, setDefaultProjectionOptions } from '../src/util/projection.js';
import { setupCesiumContextLimits } from './unit/helpers/cesiumHelpers.js';

setLogLevel(false);
const balloonContainer = document.createElement('div');
balloonContainer.id = 'balloonContainer';
const mapContainer = document.createElement('div');
mapContainer.id = 'mapContainer';
const overviewMapDiv = document.createElement('div');
overviewMapDiv.id = 'vcm_overviewmap_container';
const body = document.getElementsByTagName('body')[0];
body.appendChild(balloonContainer);
body.appendChild(mapContainer);
body.appendChild(overviewMapDiv);
setDefaultProjectionOptions(mercatorProjection.toJSON());
setupCesiumContextLimits();
