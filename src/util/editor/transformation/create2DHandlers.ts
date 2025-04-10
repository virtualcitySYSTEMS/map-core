import type { Coordinate } from 'ol/coordinate.js';
import type { Extent } from 'ol/extent.js';
import type { Geometry } from 'ol/geom.js';
import { Feature } from 'ol';
import { Circle, LineString, Point, Polygon } from 'ol/geom.js';
import { Fill, Icon, Stroke, Style } from 'ol/style.js';
import { Color } from '@vcmap-cesium/engine';
import { unByKey } from 'ol/Observable.js';
import { handlerSymbol } from '../editorSymbols.js';
import type { Handlers } from './transformationTypes.js';
import {
  AxisAndPlanes,
  greyedOutColor,
  is1DAxis,
  is2DAxis,
  TransformationMode,
} from './transformationTypes.js';
import { mercatorProjection } from '../../projection.js';
import type VectorLayer from '../../../layer/vectorLayer.js';
import {
  alreadyTransformedToImage,
  doNotTransform,
} from '../../../layer/vectorSymbols.js';
import type BaseOLMap from '../../../map/baseOLMap.js';

function createAxisPositions(
  center: Coordinate,
  axis: AxisAndPlanes,
  extent: Extent,
): Coordinate[] {
  if (axis === AxisAndPlanes.X) {
    return [
      [extent[0], center[1]],
      [center[0], center[1]],
      [extent[2], center[1]],
    ];
  }

  return [
    [center[0], extent[1]],
    [center[0], center[1]],
    [center[0], extent[3]],
  ];
}

/**
 * Creates a function to add axis to the scratch layer. To cleanup features created by this function, you can call
 * it with AXIS_AND_PLANES.NONE.
 * @param  scratchLayer
 * @param  [projectionExtent]
 */
function createShowAxisFeatures(
  scratchLayer: VectorLayer,
  projectionExtent?: Extent,
): (ap: AxisAndPlanes, coord: Coordinate) => void {
  let featureIds: (string | number)[] | undefined;
  const extent = projectionExtent ?? mercatorProjection.proj.getExtent();

  return (axis, center) => {
    if (featureIds) {
      scratchLayer.removeFeaturesById(featureIds);
      featureIds = undefined;
    }
    if (axis !== AxisAndPlanes.NONE) {
      const features = [];
      if (axis === AxisAndPlanes.X || axis === AxisAndPlanes.XY) {
        const feature = new Feature({
          geometry: new LineString(
            createAxisPositions(center, AxisAndPlanes.X, extent),
          ),
        });
        feature.setStyle(
          new Style({
            stroke: new Stroke({
              color: Color.RED.withAlpha(0.5).toCssColorString(),
              width: 1,
            }),
          }),
        );
        features.push(feature);
      }
      if (axis === AxisAndPlanes.Y || axis === AxisAndPlanes.XY) {
        const feature = new Feature({
          geometry: new LineString(
            createAxisPositions(center, AxisAndPlanes.Y, extent),
          ),
        });
        feature.setStyle(
          new Style({
            stroke: new Stroke({
              color: Color.GREEN.withAlpha(0.5).toCssColorString(),
              width: 1,
            }),
          }),
        );
        features.push(feature);
      }
      features.forEach((f) => {
        const geometry = f.getGeometry() as Geometry;
        geometry[alreadyTransformedToImage] = true;
        f[doNotTransform] = true;
      });
      featureIds = scratchLayer.addFeatures(features);
    }
  };
}

/**
 * @param  axis
 * @param  mode
 * @param  [colorOverride]
 */
function createLineAxisFeatures(
  axis: AxisAndPlanes,
  mode: TransformationMode,
  colorOverride?: string,
): Feature[] {
  let color;
  let coordinates;
  let rotation = 0;

  if (axis === AxisAndPlanes.X) {
    color = Color.RED.toCssColorString();
    coordinates = [
      [0, 0],
      [1, 0],
    ];
    rotation = Math.PI / 2;
  } else {
    color = Color.GREEN.toCssColorString();
    coordinates = [
      [0, 0],
      [0, 1],
    ];
  }
  color = colorOverride ?? color;
  let src;
  if (mode === TransformationMode.TRANSLATE) {
    src =
      '<svg height="13" width="13" xmlns="http://www.w3.org/2000/svg"><polygon points="0,13 13,13 6,0" style="fill:white;" /></svg>'; // an arrow svg
  } else {
    src =
      '<svg height="13" width="13" xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 13,0 13,13 0,13" style="fill:white" /></svg>'; // a cube svg
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
  features[0].setStyle(
    new Style({
      image: new Icon({
        src,
        anchor: [0.5, 1],
        color,
        rotation,
      }),
    }),
  );
  features[1].setStyle(new Style({ stroke: new Stroke({ color, width: 4 }) }));

  return features;
}

/**
 * @param  [colorOverride]
 */
function createPlaneFeature(colorOverride?: string): Feature<Polygon> {
  const feature = new Feature({
    geometry: new Polygon([
      [
        [0.2, 0.2],
        [0.2, 0.4],
        [0.4, 0.4],
        [0.4, 0.2],
        [0.2, 0.2],
      ],
    ]),
    axis: AxisAndPlanes.XY,
  });
  const color = colorOverride ?? Color.BLUE.toCssColorString();
  feature.setStyle(new Style({ fill: new Fill({ color }) }));
  return feature;
}

/**
 * Creates a function to add a shadow (greyed out clone of a handler) to the scratch layer. To cleanup features created by this function, you can call
 * it with AXIS_AND_PLANES.NONE.
 * @param  scratchLayer
 */
function createShowShadowFeatures(
  scratchLayer: VectorLayer,
): (
  axis: AxisAndPlanes,
  mode: TransformationMode,
  center: Coordinate,
  scale: number,
) => void {
  let featureIds: (string | number)[] | undefined;
  const color = greyedOutColor.toCssColorString();

  return (axis, mode, center, scale) => {
    if (featureIds) {
      scratchLayer.removeFeaturesById(featureIds);
      featureIds = undefined;
    }
    if (axis !== AxisAndPlanes.NONE) {
      let features: Feature[] = [];
      if (is1DAxis(axis)) {
        features = createLineAxisFeatures(axis, mode, color);
      } else if (is2DAxis(axis)) {
        features = [createPlaneFeature(color)];
      }
      features.forEach((f) => {
        f.getGeometry()!.applyTransform(
          (
            input: number[],
            output: number[] | undefined,
            stride = 2,
          ): number[] => {
            const inputLength = input.length;
            for (let i = 0; i < inputLength; i += stride) {
              output![i] = input[i] * scale + center[0];
              output![i + 1] = input[i + 1] * scale + center[1];
            }
            return output as number[];
          },
        );
      });
      featureIds = scratchLayer.addFeatures(features);
    }
  };
}

/**
 * The function will create 2D handlers for the  and the  depending on the provided mode.
 * In most scenarios, handlers must not be created using this function, but using the startEditFeaturesSession or for lower
 * level access the createTransformationHandler instead.
 * @param  map
 * @param  scratchLayer
 * @param  mode
 */
export default function create2DHandlers(
  map: BaseOLMap,
  scratchLayer: VectorLayer,
  mode: TransformationMode,
): Handlers {
  let center = [0, 0];
  let scale = 1;
  let features: Feature[] = [];
  if (
    mode === TransformationMode.TRANSLATE ||
    mode === TransformationMode.SCALE
  ) {
    features = [
      ...createLineAxisFeatures(AxisAndPlanes.X, mode),
      ...createLineAxisFeatures(AxisAndPlanes.Y, mode),
      createPlaneFeature(),
    ];
  } else if (mode === TransformationMode.ROTATE) {
    features = [
      new Feature({
        geometry: new Circle([0, 0, 0], 0.5),
        axis: AxisAndPlanes.Z,
      }),
    ];
    features[0].setStyle(
      new Style({
        stroke: new Stroke({ color: Color.BLUE.toCssColorString(), width: 2 }),
      }),
    );
  }

  features.forEach((f) => {
    const geometry = f.getGeometry() as Geometry;
    geometry[alreadyTransformedToImage] = true;
    f[doNotTransform] = true;
    f[handlerSymbol] = f.get('axis') as AxisAndPlanes;
  });

  const postRenderListenerKey = map.olMap!.on('postrender', () => {
    if (!(center[0] === 0 && center[1] === 0)) {
      const res = map.getCurrentResolution(center) * 60;
      const factor = res / scale;
      if (factor !== 1) {
        features.forEach((f) => {
          f.getGeometry()!.applyTransform(
            (
              input: number[],
              output: number[] | undefined,
              stride = 2,
            ): number[] => {
              const inputLength = input.length;
              for (let i = 0; i < inputLength; i += stride) {
                output![i] = (input[i] - center[0]) * factor + center[0];
                output![i + 1] =
                  (input[i + 1] - center[1]) * factor + center[1];
              }
              return output as number[];
            },
          );
        });
      }

      scale = res;
    }
  });

  let showAxis = AxisAndPlanes.NONE;
  const showAxisFeatures = createShowAxisFeatures(scratchLayer);
  const showShadowFeatures = createShowShadowFeatures(scratchLayer);

  let showing = false;

  return {
    get show(): boolean {
      return showing;
    },
    set show(show) {
      if (show !== showing) {
        showing = show;
        if (!show) {
          scratchLayer.removeFeaturesById(
            features.map((f) => f.getId() as string | number),
          );
        } else {
          scratchLayer.addFeatures(features);
        }
      }
    },
    get showAxis(): AxisAndPlanes {
      return showAxis;
    },
    set showAxis(axis) {
      showAxis = axis;
      showAxisFeatures(axis, center);
      showShadowFeatures(axis, mode, center, scale);
    },
    greyOutZ: false,
    setCenter(newCenter: Coordinate): void {
      const dx = newCenter[0] - center[0];
      const dy = newCenter[1] - center[1];
      features.forEach((f) => {
        f.getGeometry()!.applyTransform(
          (
            input: number[],
            output: number[] | undefined,
            stride = 2,
          ): number[] => {
            const inputLength = input.length;
            for (let i = 0; i < inputLength; i += stride) {
              output![i] = input[i] + dx;
              output![i + 1] = input[i + 1] + dy;
              if (stride > 2) {
                output![i + 2] = input[i + 2];
              }
            }
            return output as number[];
          },
        );
      });
      center = newCenter.slice();
    },
    destroy(): void {
      unByKey(postRenderListenerKey);
      showAxisFeatures(AxisAndPlanes.NONE, center);
      showShadowFeatures(AxisAndPlanes.NONE, mode, center, scale);
      scratchLayer.removeFeaturesById(
        features.map((f) => f.getId()).filter((id) => id) as string[],
      );
    },
  };
}
