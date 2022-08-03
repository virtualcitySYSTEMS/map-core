import VectorLayer from '../../layer/vectorLayer.js';
import { mercatorProjection } from '../projection.js';
import InteractionChain from '../../interaction/interactionChain.js';
import VcsEvent from '../../vcsEvent.js';
import { EventType } from '../../interaction/interactionType.js';
import { maxZIndex } from '../layerCollection.js';
import { markVolatile } from '../../context.js';

/**
 * An editor session is a currently set of interactions to create or edit geometries & features.
 * All editor sessions can be stopped and will be stopped, if their interactions get removed from the
 * event handler.
 * A stopped session will be destroyed and can no longer be used.
 * @typedef {Object} EditorSession
 * @property {SessionType} type
 * @property {function():void} stop
 * @property {VcsEvent<void>} stopped
 */

/**
 * @enum {string}
 */
export const SessionType = {
  CREATE: 'create',
  EDIT_GEOMETRY: 'editGeometry',
  EDIT_FEATURES: 'editFeatures',
};

/**
 * Sets up an editor session scratch layer & activates it. Does not wait for the activation promise to resolve.
 * Note: scratch layers are volatile.
 * @param {import("@vcmap/core").LayerCollection} layerCollection
 * @returns {VectorLayer}
 */
export function setupScratchLayer(layerCollection) { // IDEA pass in stopped and cleanup ourselves?
  const layer = new VectorLayer({
    projection: mercatorProjection.toJSON(),
    vectorProperties: {
      altitudeMode: 'clampToGround',
      eyeOffset: [0, 0, -1],
    },
    isDynamic: true,
    zIndex: maxZIndex,
    style: {
      image: {
        radius: 5,
        fill: {
          color: 'rgba(255,255,255,0.47)',
        },
        stroke: {
          width: 1,
          color: '#000000',
        },
      },
    },
  });
  markVolatile(layer);
  layerCollection.add(layer);
  layer.activate();
  return layer;
}

/**
 * Sets up the default interaction chain for the editors. This will set the provided event handlers
 * feature interaction to be active on CLICKMOVE & DRAGSTART. Destroying the setup will reset the interaction
 * to its previous active state.
 * @param {import("@vcmap/core").EventHandler} eventHandler
 * @returns {{ interactionChain: InteractionChain, removed: VcsEvent<void>, destroy: function():void }}
 * @private
 */
export function setupInteractionChain(eventHandler) {
  const interactionChain = new InteractionChain();
  /**
   * @type {VcsEvent<void>}
   */
  const removed = new VcsEvent();
  const listener = eventHandler.addExclusiveInteraction(interactionChain, () => { removed.raiseEvent(); });
  const currentFeatureInteractionEvent = eventHandler.featureInteraction.active;
  eventHandler.featureInteraction.setActive(EventType.CLICKMOVE | EventType.DRAGSTART);

  return {
    interactionChain,
    destroy: () => {
      listener();
      removed.destroy();
      interactionChain.destroy();
      eventHandler.featureInteraction.setActive(currentFeatureInteractionEvent);
    },
    removed,
  };
}

/**
 * @enum {string}
 * @property {string} Point
 * @property {string} Circle
 * @property {string} LineString
 * @property {string} Polygon
 * @property {string} BBox
 * @property {string} Rectangle
 */
export const GeometryType = {
  Point: 'Point',
  Circle: 'Circle',
  LineString: 'LineString',
  Polygon: 'Polygon',
  BBox: 'BBox',
};
