import { check, ofEnum } from '@vcsuite/check';
import { Feature } from 'ol';
import type { Geometry, LineString, Polygon } from 'ol/geom.js';
import { unByKey } from 'ol/Observable.js';
import VcsEvent from '../../vcsEvent.js';
import {
  setupPickingBehavior,
  EditorSession,
  GeometryToType,
  GeometryType,
  SessionType,
  setupInteractionChain,
  setupScratchLayer,
} from './editorSessionHelpers.js';
import CreateLineStringInteraction from './interactions/createLineStringInteraction.js';
import CreateCircleInteraction from './interactions/createCircleInteraction.js';
import CreateBBoxInteraction from './interactions/createBBoxInteraction.js';
import CreatePointInteraction from './interactions/createPointInteraction.js';
import CreatePolygonInteraction from './interactions/createPolygonInteraction.js';
import VcsApp from '../../vcsApp.js';
import VectorLayer from '../../layer/vectorLayer.js';
import { createSync } from '../../layer/vectorSymbols.js';
import geometryIsValid from './validateGeoemetry.js';
import ObliqueMap from '../../map/obliqueMap.js';
import { cursorMap } from './interactions/editGeometryMouseOverInteraction.js';
import { AltitudeModeType } from '../../layer/vectorProperties.js';
import CreationSnapping from './interactions/creationSnapping.js';
import { syncScratchLayerVectorProperties } from './editorHelpers.js';
import LayerSnapping from './interactions/layerSnapping.js';
import { SnapType, snapTypes } from './snappingHelpers.js';
import SegmentLengthInteraction from './interactions/segmentLengthInteraction.js';

export type CreateFeatureSession<T extends GeometryType> =
  EditorSession<SessionType.CREATE> & {
    geometryType: T;
    featureAltitudeMode: AltitudeModeType | undefined;
    featureCreated: VcsEvent<Feature<GeometryToType<T>>>;
    creationFinished: VcsEvent<Feature<GeometryToType<T>> | null>;
    snapToLayers: VectorLayer[];
    finish(): void;
  };

type InteractionOfGeometryType<T extends GeometryType> =
  T extends GeometryType.Point
    ? CreatePointInteraction
    : T extends GeometryType.Polygon
    ? CreatePolygonInteraction
    : T extends GeometryType.LineString
    ? CreateLineStringInteraction
    : T extends GeometryType.BBox
    ? CreateBBoxInteraction
    : T extends GeometryType.Circle
    ? CreateCircleInteraction
    : never;

function createInteractionForGeometryType<T extends GeometryType>(
  geometryType: T,
): InteractionOfGeometryType<T> {
  let currentInteraction;
  if (geometryType === GeometryType.Polygon) {
    currentInteraction = new CreatePolygonInteraction();
  } else if (geometryType === GeometryType.Point) {
    currentInteraction = new CreatePointInteraction();
  } else if (geometryType === GeometryType.LineString) {
    currentInteraction = new CreateLineStringInteraction();
  } else if (geometryType === GeometryType.BBox) {
    currentInteraction = new CreateBBoxInteraction();
  } else if (geometryType === GeometryType.Circle) {
    currentInteraction = new CreateCircleInteraction();
  } else {
    throw new Error(`Unexpected geometry tpye ${geometryType}`);
  }
  return currentInteraction as InteractionOfGeometryType<T>;
}

/**
 * This is a common interface for all geometry creation interactions.
 * The interaction shall be active on creation.
 * On click, the interaction shall create a geometry and raise the created event with said geoemtry
 * To deactivate (finish) an active interaction, call finish instead of setActive.
 * An interaction shall be finishable via a double click.
 * On finish, the finished event shall be called with the now finished geometry.
 * Said geometry may be invalid.
 * Geometries created may be in pixel coordinates. Appropriate symbols shall be set by the interaction.
 */
export interface CreateInteraction<T extends Geometry> {
  finish(): void;
  finished: VcsEvent<T | null>;
  created: VcsEvent<T>;
  destroy(): void;
}

export type CreateFeatureSessionOptions = {
  initialSnapToLayers?: VectorLayer[];
  snapTo?: SnapType[];
  hideSegmentLength?: boolean;
};

/**
 * Creates an editor session to create features of the given geometry type.
 * While the session is active: Do not change the geometry on the current feature (the last created one)
 * and do not change crucial olcs properties on the feature or the layer (olcs_altitudeMode)
 * @param  app
 * @param  layer
 * @param  geometryType
 * @param [initialAltitudeMode] - whether to use the layers altitude mode or set this on the feature
 * @param [options]
 * @group Editor
 */
function startCreateFeatureSession<T extends GeometryType>(
  app: VcsApp,
  layer: VectorLayer,
  geometryType: T,
  initialAltitudeMode?: AltitudeModeType,
  options?: CreateFeatureSessionOptions,
): CreateFeatureSession<T> {
  check(app, VcsApp);
  check(layer, VectorLayer);
  check(geometryType, ofEnum(GeometryType));

  const snapTo = options?.snapTo ?? [...snapTypes];
  const showSegmentLength = !options?.hideSegmentLength;

  const {
    interactionChain,
    removed: interactionRemoved,
    destroy: destroyInteractionChain,
  } = setupInteractionChain(app.maps.eventHandler);
  const scratchLayer = setupScratchLayer(app.layers);

  const featureCreated = new VcsEvent<Feature<GeometryToType<T>>>();
  const creationFinished = new VcsEvent<Feature<GeometryToType<T>> | null>();
  const stopped = new VcsEvent<void>();
  let isStopped = false;

  let currentInteraction: InteractionOfGeometryType<T> | null = null;
  let currentFeature: Feature<GeometryToType<T>> | null = null;
  let snappingInteraction: CreationSnapping | null = null;
  let layerSnappingInteraction: LayerSnapping | null = null;
  let segmentLengthInteraction: SegmentLengthInteraction | null = null;
  let snapToLayers: VectorLayer[] = options?.initialSnapToLayers?.slice() ?? [
    layer,
  ];

  /**
   * Ture if the currently active map is an ObliqueMap. set in setupActiveMap
   */
  let isOblique = false;

  let featureAltitudeMode = initialAltitudeMode;
  const resetPickingBehavior = setupPickingBehavior(app);

  const altitudeModeChanged = (): void => {
    const altitudeModeFeature =
      currentFeature ?? new Feature({ olcs_altitudeMode: featureAltitudeMode });

    scratchLayer.vectorProperties.altitudeMode =
      layer.vectorProperties.getAltitudeMode(altitudeModeFeature);
  };

  const vectorPropertiesListener = syncScratchLayerVectorProperties(
    scratchLayer,
    layer,
    () => {
      if (!featureAltitudeMode) {
        altitudeModeChanged();
      }
    },
  );
  altitudeModeChanged();

  let currentFeatureListener = (): void => {};
  let interactionListeners: (() => void)[] = [];
  const destroyCurrentInteraction = (): void => {
    currentFeatureListener();
    if (currentInteraction) {
      interactionChain.removeInteraction(currentInteraction);
      currentInteraction.destroy();
      currentInteraction = null;
    }
    if (snappingInteraction) {
      interactionChain.removeInteraction(snappingInteraction);
      snappingInteraction.destroy();
      snappingInteraction = null;
    }
    if (layerSnappingInteraction) {
      interactionChain.removeInteraction(layerSnappingInteraction);
      layerSnappingInteraction.destroy();
      layerSnappingInteraction = null;
    }
    if (segmentLengthInteraction) {
      interactionChain.removeInteraction(segmentLengthInteraction);
      segmentLengthInteraction.destroy();
      segmentLengthInteraction = null;
    }
    interactionListeners.forEach((cb) => {
      cb();
    });
    interactionListeners = [];
  };

  const createInteraction = (): void => {
    destroyCurrentInteraction();
    currentInteraction = createInteractionForGeometryType(geometryType);
    layerSnappingInteraction = new LayerSnapping(
      snapToLayers,
      scratchLayer,
      (f) => currentFeature !== f,
      snapTo,
    );
    if (
      geometryType === GeometryType.Polygon ||
      geometryType === GeometryType.LineString
    ) {
      snappingInteraction = new CreationSnapping(scratchLayer, snapTo);
    }

    if (
      showSegmentLength &&
      (geometryType === GeometryType.Polygon ||
        geometryType === GeometryType.LineString ||
        geometryType === GeometryType.BBox ||
        geometryType === GeometryType.Circle)
    ) {
      segmentLengthInteraction = new SegmentLengthInteraction(
        scratchLayer,
        true,
      );
    }

    interactionListeners = [
      currentInteraction.created.addEventListener((geometry) => {
        if (isOblique) {
          (app.maps.activeMap as ObliqueMap).switchEnabled = false;
        }
        currentFeature = new Feature({ geometry }) as Feature<
          GeometryToType<T>
        >;
        currentFeature[createSync] = true;
        if (featureAltitudeMode) {
          currentFeature.set('olcs_altitudeMode', featureAltitudeMode);
        }
        currentFeature.set('olcs_allowPicking', false);
        const propChangeListener = currentFeature.on(
          'propertychange',
          (event) => {
            if (event.key === 'olcs_altitudeMode') {
              altitudeModeChanged();
            }
          },
        );
        currentFeatureListener = (): void => {
          unByKey(propChangeListener);
        };
        layer.addFeatures([currentFeature]);
        featureCreated.raiseEvent(currentFeature);
        if (snappingInteraction) {
          snappingInteraction.setGeometry(geometry as LineString | Polygon);
        }
        if (segmentLengthInteraction) {
          segmentLengthInteraction.setGeometry(
            geometry as LineString | Polygon,
          );
        }
      }),
      currentInteraction.finished.addEventListener((geometry) => {
        if (isOblique) {
          (app.maps.activeMap as ObliqueMap).switchEnabled = true;
        }
        if (currentFeature) {
          delete currentFeature[createSync];
          currentFeature.set('olcs_allowPicking', true);
          if (
            !geometry ||
            currentFeature.getGeometry() !== geometry ||
            !geometryIsValid(geometry)
          ) {
            layer.removeFeaturesById([
              currentFeature.getId() as string | number,
            ]);
            currentFeature = null;
          }
          currentFeatureListener();
        }
        altitudeModeChanged();
        creationFinished.raiseEvent(currentFeature);
        currentFeature = null;
        if (!isStopped) {
          createInteraction();
        }
      }),
    ];

    interactionChain.addInteraction(layerSnappingInteraction);
    if (snappingInteraction) {
      interactionChain.addInteraction(snappingInteraction);
    }
    interactionChain.addInteraction(currentInteraction);
    if (segmentLengthInteraction) {
      interactionChain.addInteraction(segmentLengthInteraction);
    }
  };
  createInteraction();

  const resetCurrentInteraction = (): void => {
    if (currentInteraction) {
      currentInteraction.finish();
    }
    createInteraction();
  };

  let obliqueImageChangedListener = (): void => {};
  const setupActiveMap = (): void => {
    obliqueImageChangedListener();
    const { activeMap } = app.maps;
    isOblique = activeMap instanceof ObliqueMap;
    if (isOblique) {
      obliqueImageChangedListener =
        (activeMap as ObliqueMap).imageChanged?.addEventListener(
          resetCurrentInteraction,
        ) ?? ((): void => {});
    } else {
      obliqueImageChangedListener = (): void => {};
    }
  };

  const mapChangedListener = app.maps.mapActivated.addEventListener(() => {
    setupActiveMap();
    resetCurrentInteraction();
  });
  setupActiveMap();

  if (app.maps.target) {
    app.maps.target.style.cursor = cursorMap.edit;
  }

  const stop = (): void => {
    isStopped = true; // setting stopped true immediately, to prevent the recreation of the interaction chain on finished
    app.layers.remove(scratchLayer);
    scratchLayer.destroy();

    if (app.maps.target) {
      app.maps.target.style.cursor = cursorMap.auto;
    }
    mapChangedListener();
    obliqueImageChangedListener();
    if (currentInteraction) {
      currentInteraction.finish();
    }
    destroyCurrentInteraction();
    destroyInteractionChain();
    currentFeatureListener();
    vectorPropertiesListener();
    resetPickingBehavior();

    stopped.raiseEvent();
    stopped.destroy();
    featureCreated.destroy();
  };
  interactionRemoved.addEventListener(stop);

  return {
    type: SessionType.CREATE,
    geometryType,
    get featureAltitudeMode(): AltitudeModeType | undefined {
      return featureAltitudeMode;
    },
    set featureAltitudeMode(value) {
      if (featureAltitudeMode !== value) {
        featureAltitudeMode = value;
        if (currentFeature) {
          if (featureAltitudeMode) {
            currentFeature.set('olcs_altitudeMode', featureAltitudeMode);
          } else {
            currentFeature.unset('olcs_altitudeMode');
          }
        } else {
          altitudeModeChanged();
        }
      }
    },
    get snapToLayers(): VectorLayer[] {
      return snapToLayers.slice();
    },
    set snapToLayers(layers: VectorLayer[]) {
      snapToLayers = layers.slice();
      if (layerSnappingInteraction) {
        layerSnappingInteraction.layers = snapToLayers;
      }
    },
    featureCreated,
    creationFinished,
    stopped,
    finish: (): void => {
      if (currentInteraction) {
        currentInteraction.finish();
      }
    },
    stop,
  };
}

export default startCreateFeatureSession;
