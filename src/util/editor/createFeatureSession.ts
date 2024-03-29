import { check, ofEnum } from '@vcsuite/check';
import { Feature } from 'ol';
import type { Geometry } from 'ol/geom.js';
import { unByKey } from 'ol/Observable.js';
import VcsEvent from '../../vcsEvent.js';
import {
  createPickingBehavior,
  EditorSession,
  GeometryToType,
  GeometryType,
  SessionType,
  setupInteractionChain,
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

export type CreateFeatureSession<T extends GeometryType> =
  EditorSession<SessionType.CREATE> & {
    geometryType: T;
    featureAltitudeMode: AltitudeModeType | undefined;
    featureCreated: VcsEvent<Feature<GeometryToType<T>>>;
    creationFinished: VcsEvent<Feature<GeometryToType<T>> | null>;
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

/**
 * Creates an editor session to create features of the given geometry type.
 * While the session is active: Do not change the geometry on the current feature (the last created one)
 * and do not change crucial olcs properties on the feature or the layer (olcs_altitudeMode)
 * @param  app
 * @param  layer
 * @param  geometryType
 * @param initialAltitudeMode - whether to use the layers altitude mode or set this on the feature
 * @group Editor
 */
function startCreateFeatureSession<T extends GeometryType>(
  app: VcsApp,
  layer: VectorLayer,
  geometryType: T,
  initialAltitudeMode?: AltitudeModeType,
): CreateFeatureSession<T> {
  check(app, VcsApp);
  check(layer, VectorLayer);
  check(geometryType, ofEnum(GeometryType));

  const {
    interactionChain,
    removed: interactionRemoved,
    destroy: destroyInteractionChain,
  } = setupInteractionChain(app.maps.eventHandler);

  const featureCreated = new VcsEvent<Feature<GeometryToType<T>>>();
  const creationFinished = new VcsEvent<Feature<GeometryToType<T>> | null>();
  const stopped = new VcsEvent<void>();
  let isStopped = false;

  let currentInteraction: InteractionOfGeometryType<T> | null = null;
  let currentFeature: Feature<GeometryToType<T>> | null = null;

  /**
   * Ture if the currently active map is an ObliqueMap. set in setupActiveMap
   */
  let isOblique = false;

  let featureAltitudeMode = initialAltitudeMode;
  const pickingBehavior = createPickingBehavior(app);

  const altitudeModeChanged = (): void => {
    const altitudeModeFeature =
      currentFeature ?? new Feature({ olcs_altitudeMode: featureAltitudeMode });
    const altitudeModeInUse =
      layer.vectorProperties.getAltitudeMode(altitudeModeFeature);

    pickingBehavior.setForAltitudeMode(altitudeModeInUse);
  };

  const vectorPropertiesListener =
    layer.vectorProperties.propertyChanged.addEventListener((properties) => {
      if (properties.includes('altitudeMode') && !featureAltitudeMode) {
        altitudeModeChanged();
      }
    });

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
    interactionListeners.forEach((cb) => {
      cb();
    });
    interactionListeners = [];
  };

  const createInteraction = (): void => {
    destroyCurrentInteraction();
    currentInteraction = createInteractionForGeometryType(geometryType);

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
      }),
      currentInteraction.finished.addEventListener((geometry) => {
        if (isOblique) {
          (app.maps.activeMap as ObliqueMap).switchEnabled = true;
        }
        if (currentFeature) {
          delete currentFeature[createSync];
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
    interactionChain.addInteraction(currentInteraction);
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
    pickingBehavior.reset();

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
