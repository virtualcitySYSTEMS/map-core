import { check } from '@vcsuite/check';
import { Feature } from 'ol';
import VcsEvent from '../../vcsEvent.js';
import { GeometryType, SessionType, setupInteractionChain } from './editorSessionHelpers.js';
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

/**
 * @typedef {EditorSession} CreateFeatureSession
 * @property {import("@vcmap/core").GeometryType} geometryType
 * @property {VcsEvent<import("ol").Feature<import("ol/geom").Geometry>>} featureCreated - raised when a feature is created and added to the layer
 * @property {VcsEvent<import("ol").Feature<import("ol/geom").Geometry>|null>} creationFinished - raised when the feature creation was finished. is passed the feature or null if the feature is invalid. invalid feature will be removed from the layer.
 * @property {function():void} finish - finished the current creation. if a current interaction is active, the creationFinished event will be raised.
 */

/**
 * Creates an editor session to create features of the given geometry type.
 * While the session is active: Do not change the geometry on the current feature (the last created one)
 * and do not change crucial olcs properties on the feature or the layer (olcs_altitudeMode)
 * @param {import("@vcmap/core").VcsApp} app
 * @param {import("@vcmap/core").VectorLayer} layer
 * @param {GeometryType} geometryType
 * @returns {CreateFeatureSession}
 */
export default function startCreateFeatureSession(app, layer, geometryType) {
  check(app, VcsApp);
  check(layer, VectorLayer);
  check(geometryType, Object.values(GeometryType));

  const {
    interactionChain,
    removed: interactionRemoved,
    destroy: destroyInteractionChain,
  } = setupInteractionChain(app.maps.eventHandler);

  /**
   * @type {VcsEvent<import("ol").Feature<import("ol/geom").Geometry>>}
   */
  const featureCreated = new VcsEvent();
  /**
   * @type {VcsEvent<import("ol").Feature<import("ol/geom").Geometry>|null>}
   */
  const creationFinished = new VcsEvent();
  /**
   * @type {VcsEvent<void>}
   */
  const stopped = new VcsEvent();
  let isStopped = false;

  /**
   * @type {CreateLineStringInteraction|CreateCircleInteraction|CreateBBoxInteraction|CreatePointInteraction|CreatePolygonInteraction|null}
   */
  let currentInteraction = null;
  let currentFeature = null;

  /**
   * Ture if the currently active map is an ObliqueMap. set in setupActiveMap
   * @type {boolean}
   */
  let isOblique = false;

  let interactionListeners = [];
  const destroyCurrentInteraction = () => {
    if (currentInteraction) {
      interactionChain.removeInteraction(currentInteraction);
      currentInteraction.destroy();
      currentInteraction = null;
    }
    interactionListeners.forEach((cb) => { cb(); });
    interactionListeners = [];
  };

  const createInteraction = () => {
    destroyCurrentInteraction();
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
    }

    interactionListeners = [
      currentInteraction.created.addEventListener((geometry) => {
        if (isOblique) {
          /** @type {ObliqueMap} */ (app.maps.activeMap).switchEnabled = false;
        }
        currentFeature = new Feature({ geometry });
        currentFeature[createSync] = true;
        layer.addFeatures([currentFeature]);
        featureCreated.raiseEvent(currentFeature);
      }),
      currentInteraction.finished.addEventListener((geometry) => {
        if (isOblique) {
          /** @type {ObliqueMap} */ (app.maps.activeMap).switchEnabled = true;
        }
        if (currentFeature) {
          delete currentFeature[createSync];
          if (!geometry || currentFeature.getGeometry() !== geometry || !geometryIsValid(geometry)) {
            layer.removeFeaturesById([currentFeature.getId()]);
            currentFeature = null;
          }
        }

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

  const resetCurrentInteraction = () => {
    if (currentInteraction) {
      currentInteraction.finish();
    }
    createInteraction();
  };

  let obliqueImageChangedListener = () => {};
  const setupActiveMap = () => {
    obliqueImageChangedListener();
    const { activeMap } = app.maps;
    isOblique = activeMap instanceof ObliqueMap;
    if (isOblique) {
      obliqueImageChangedListener = /** @type {ObliqueMap} */ (activeMap).imageChanged
        .addEventListener(resetCurrentInteraction);
    } else {
      obliqueImageChangedListener = () => {};
    }
  };

  const mapChangedListener = app.maps.mapActivated.addEventListener(() => {
    setupActiveMap();
    resetCurrentInteraction();
  });
  setupActiveMap();

  const stop = () => {
    isStopped = true; // setting stopped true immediately, to prevent the recreation of the interaction chain on finished
    mapChangedListener();
    obliqueImageChangedListener();
    if (currentInteraction) {
      currentInteraction.finish();
    }
    destroyCurrentInteraction();
    destroyInteractionChain();
    stopped.raiseEvent();
    stopped.destroy();
    featureCreated.destroy();
  };
  interactionRemoved.addEventListener(stop);

  return {
    type: SessionType.CREATE,
    geometryType,
    featureCreated,
    creationFinished,
    stopped,
    finish: () => {
      if (currentInteraction) {
        currentInteraction.finish();
      }
    },
    stop,
  };
}
