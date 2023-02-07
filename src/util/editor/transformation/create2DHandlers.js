import { Feature } from 'ol';
import { Circle, LineString, Point, Polygon } from 'ol/geom.js';
import { Fill, Icon, Stroke, Style } from 'ol/style.js';
import { Color } from '@vcmap-cesium/engine';
import { unByKey } from 'ol/Observable.js';
import { handlerSymbol } from '../editorSymbols.js';
import { AXIS_AND_PLANES, greyedOutColor, is1DAxis, is2DAxis, TransformationMode } from './transformationTypes.js';
import { mercatorProjection } from '../../projection.js';
import Vector from '../../../layer/vectorLayer.js';

/**
 * @param {import("ol/coordinate").Coordinate} center
 * @param {AXIS_AND_PLANES} axis
 * @param {import("ol/extent").Extent} extent
 * @returns {Array<import("ol/coordinate").Coordinate>}
 */
function createAxisPositions(center, axis, extent) {
  if (axis === AXIS_AND_PLANES.X) {
    return [
      [extent[0], center[1], center[2]],
      [center[0], center[1], center[2]],
      [extent[2], center[1], center[2]],
    ];
  }

  return [
    [center[0], extent[1], center[2]],
    [center[0], center[1], center[2]],
    [center[0], extent[3], center[2]],
  ];
}

/**
 * Creates a function to add axis to the scratch layer. To cleanup features created by this function, you can call
 * it with AXIS_AND_PLANES.NONE.
 * @param {import("@vcmap/core").VectorLayer} scratchLayer
 * @param {import("ol/extent").Extent} [projectionExtent]
 * @returns {function(AXIS_AND_PLANES, import("ol/coordinate").Coordinate):void}
 */
function createShowAxisFeatures(scratchLayer, projectionExtent) {
  let featureIds;
  const extent = projectionExtent ?? mercatorProjection.proj.getExtent();

  return (axis, center) => {
    if (featureIds) {
      scratchLayer.removeFeaturesById(featureIds);
      featureIds = null;
    }
    if (axis !== AXIS_AND_PLANES.NONE) {
      const features = [];
      if (axis === AXIS_AND_PLANES.X || axis === AXIS_AND_PLANES.XY) {
        const feature = new Feature({
          geometry: new LineString(createAxisPositions(center, AXIS_AND_PLANES.X, extent)),
        });
        feature.setStyle(new Style({
          stroke: new Stroke({ color: Color.RED.withAlpha(0.5).toCssColorString(), width: 1 }),
        }));
        features.push(feature);
      }
      if (axis === AXIS_AND_PLANES.Y || axis === AXIS_AND_PLANES.XY) {
        const feature = new Feature({
          geometry: new LineString(createAxisPositions(center, AXIS_AND_PLANES.Y, extent)),
        });
        feature.setStyle(new Style({
          stroke: new Stroke({ color: Color.GREEN.withAlpha(0.5).toCssColorString(), width: 1 }),
        }));
        features.push(feature);
      }
      features.forEach((f) => {
        const geometry = f.getGeometry();
        geometry[Vector.alreadyTransformedToImage] = true;
        geometry[Vector.doNotTransform] = true;
      });
      featureIds = scratchLayer.addFeatures(features);
    }
  };
}

/**
 * @param {AXIS_AND_PLANES} axis
 * @param {TransformationMode} mode
 * @param {string=} [colorOverride]
 * @returns {Array<import("ol").Feature>}
 */
function createLineAxisFeatures(axis, mode, colorOverride) {
  let color;
  let coordinates;
  let rotation = 0;

  if (axis === AXIS_AND_PLANES.X) {
    color = Color.RED.toCssColorString();
    coordinates = [[0, 0, 0], [1, 0, 0]];
    rotation = Math.PI / 2;
  } else {
    color = Color.GREEN.toCssColorString();
    coordinates = [[0, 0, 0], [0, 1, 0]];
  }
  color = colorOverride ?? color;
  let src;
  if (mode === TransformationMode.TRANSLATE) {
    src = '<svg height="13" width="13" xmlns="http://www.w3.org/2000/svg"><polygon points="0,13 13,13 6,0" style="fill:white;" /></svg>'; // an arrow svg
  } else {
    src = '<svg height="13" width="13" xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 13,0 13,13 0,13" style="fill:white" /></svg>'; // a cube svg
  }
  src = `data:image/svg+xml,${encodeURIComponent(src)}`;

  const features = [
    new Feature({
      geometry: new Point(coordinates[1].slice()),
      axis,
    }),
    new Feature({
      geometry: new LineString(coordinates),
      axis,
    }),
  ];
  features[0].setStyle(new Style({
    image: new Icon({
      src,
      anchor: [0.5, 1],
      color,
      rotation,
    }),
  }));
  features[1].setStyle(new Style({ stroke: new Stroke({ color, width: 4 }) }));

  return features;
}

/**
 * @param {string=} [colorOverride]
 * @returns {import("ol").Feature<Polygon>}
 */
function createPlaneFeature(colorOverride) {
  const feature = new Feature({
    geometry: new Polygon([[
      [0.2, 0.2, 0],
      [0.2, 0.4, 0],
      [0.4, 0.4, 0],
      [0.4, 0.2, 0],
      [0.2, 0.2, 0],
    ]]),
    axis: AXIS_AND_PLANES.XY,
  });
  const color = colorOverride ?? Color.BLUE.toCssColorString();
  feature.setStyle(new Style({ fill: new Fill({ color }) }));
  return feature;
}

/**
 * Creates a function to add a shadow (greyed out clone of a handler) to the scratch layer. To cleanup features created by this function, you can call
 * it with AXIS_AND_PLANES.NONE.
 * @param {import("@vcmap/core").VectorLayer} scratchLayer
 * @returns {function(AXIS_AND_PLANES, TransformationMode, import("ol/coordinate").Coordinate, number):void}
 */
function createShowShadowFeatures(scratchLayer) {
  let featureIds;
  const color = greyedOutColor.toCssColorString();

  return (axis, mode, center, scale) => {
    if (featureIds) {
      scratchLayer.removeFeaturesById(featureIds);
      featureIds = null;
    }
    if (axis !== AXIS_AND_PLANES.NONE) {
      let features = [];
      if (is1DAxis(axis)) {
        features = createLineAxisFeatures(axis, mode, color);
      } else if (is2DAxis(axis)) {
        features = [createPlaneFeature(color)];
      }
      features.forEach((f) => {
        f.getGeometry().applyTransform((input, output) => {
          const inputLength = input.length;
          for (let i = 0; i < inputLength; i += 3) {
            output[i] = (input[i] * scale) + center[0];
            output[i + 1] = (input[i + 1] * scale) + center[1];
            output[i + 2] = 0;
          }
          return output;
        });
      });
      featureIds = scratchLayer.addFeatures(features);
    }
  };
}

/**
 * The function will create 2D handlers for the {@see OpenlayerMap} and the {@see ObliqueMap} depending on the provided mode.
 * In most scenarios, handlers must not be created using this function, but using the startEditFeaturesSession or for lower
 * level access the createTransformationHandler instead.
 * @param {import("@vcmap/core").BaseOLMap} map
 * @param {import("@vcmap/core").VectorLayer} scratchLayer
 * @param {TransformationMode} mode
 * @returns {Handlers}
 */
export default function create2DHandlers(map, scratchLayer, mode) {
  let center = [0, 0, 0];
  let scale = 1;
  let features = [];
  if (mode === TransformationMode.TRANSLATE || mode === TransformationMode.SCALE) {
    features = [
      ...createLineAxisFeatures(AXIS_AND_PLANES.X, mode),
      ...createLineAxisFeatures(AXIS_AND_PLANES.Y, mode),
      createPlaneFeature(),
    ];
  } else if (mode === TransformationMode.ROTATE) {
    features = [
      new Feature({
        geometry: new Circle([0, 0, 0], 0.5),
        axis: AXIS_AND_PLANES.Z,
      }),
    ];
    features[0].setStyle(new Style({ stroke: new Stroke({ color: Color.BLUE.toCssColorString(), width: 2 }) }));
  }

  features.forEach((f) => {
    const geometry = f.getGeometry();
    geometry[Vector.alreadyTransformedToImage] = true;
    geometry[Vector.doNotTransform] = true;
    f[handlerSymbol] = f.get('axis');
  });

  const postRenderListenerKey = map.olMap.on('postrender', () => {
    if (!(center[0] === 0 && center[1] === 0 && center[2] === 0)) {
      const res = map.getCurrentResolution(center) * 60;
      const factor = res / scale;
      if (factor !== 1) {
        features.forEach((f) => {
          f.getGeometry().applyTransform((input, output) => {
            const inputLength = input.length;
            for (let i = 0; i < inputLength; i += 3) {
              output[i] = ((input[i] - center[0]) * factor) + center[0];
              output[i + 1] = ((input[i + 1] - center[1]) * factor) + center[1];
              output[i + 2] = 0;
            }
            return output;
          });
        });
      }

      scale = res;
    }
  });

  let showAxis = AXIS_AND_PLANES.NONE;
  const showAxisFeatures = createShowAxisFeatures(scratchLayer);
  const showShadowFeatures = createShowShadowFeatures(scratchLayer);

  let showing = false;

  return {
    get show() { return showing; },
    set show(show) {
      if (show !== showing) {
        showing = show;
        if (!show) {
          scratchLayer.removeFeaturesById(features.map(f => f.getId()));
        } else {
          scratchLayer.addFeatures(features);
        }
      }
    },
    get showAxis() { return showAxis; },
    set showAxis(axis) {
      showAxis = axis;
      showAxisFeatures(axis, center);
      showShadowFeatures(axis, mode, center, scale);
    },
    greyOutZ: false,
    setCenter(newCenter) {
      const dx = newCenter[0] - center[0];
      const dy = newCenter[1] - center[1];
      features.forEach((f) => {
        f.getGeometry().applyTransform((input, output) => {
          const inputLength = input.length;
          for (let i = 0; i < inputLength; i += 3) {
            output[i] = input[i] + dx;
            output[i + 1] = input[i + 1] + dy;
            output[i + 2] = input[i + 2];
          }
          return output;
        });
      });
      center = newCenter.slice();
    },
    destroy() {
      unByKey(postRenderListenerKey);
      showAxisFeatures(AXIS_AND_PLANES.NONE, center);
      showShadowFeatures(AXIS_AND_PLANES.NONE, mode, center, scale);
      scratchLayer.removeFeaturesById(features.map(f => f.getId()).filter(id => id));
    },
  };
}
