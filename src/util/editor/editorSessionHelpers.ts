import type { Point, Polygon, Circle, LineString } from 'ol/geom.js';
import VectorLayer from '../../layer/vectorLayer.js';
import { mercatorProjection } from '../projection.js';
import InteractionChain from '../../interaction/interactionChain.js';
import VcsEvent from '../../vcsEvent.js';
import { EventType } from '../../interaction/interactionType.js';
import LayerCollection, { maxZIndex } from '../layerCollection.js';
import { markVolatile } from '../../vcsModule.js';
import { PrimitiveOptionsType } from '../../layer/vectorProperties.js';
import EventHandler from '../../interaction/eventHandler.js';

export enum SessionType {
  CREATE = 'create',
  EDIT_GEOMETRY = 'editGeometry',
  EDIT_FEATURES = 'editFeatures',
  SELECT = 'selectFeatures',
}

/**
 * An editor session is a currently set of interactions to create or edit geometries & features.
 * All editor sessions can be stopped and will be stopped, if their interactions get removed from the
 * event handler.
 * A stopped session will be destroyed and can no longer be used.
 */
export type EditorSession = {
  type: SessionType;
  stop(): void;
  stopped: VcsEvent<void>;
};

/**
 * Sets up an editor session scratch layer & activates it. Does not wait for the activation promise to resolve.
 * Note: scratch layers are volatile.
 */
export function setupScratchLayer(
  layerCollection: LayerCollection,
): VectorLayer {
  // IDEA pass in stopped and cleanup ourselves?
  const layer = new VectorLayer({
    projection: mercatorProjection.toJSON(),
    vectorProperties: {
      altitudeMode: 'clampToGround',
      eyeOffset: [0, 0, -1],
      primitiveOptions: {
        type: PrimitiveOptionsType.SPHERE,
        geometryOptions: {
          radius: 4,
        },
        depthFailColor: 'rgba(255,255,255,0.47)',
      },
      modelAutoScale: true,
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
  // eslint-disable-next-line no-void
  void layer.activate();
  return layer;
}

/**
 * Sets up the default interaction chain for the editors. This will set the provided event handlers
 * feature interaction to be active on CLICKMOVE & DRAGSTART. Destroying the setup will reset the interaction
 * to its previous active state.
 * @param  eventHandler
 * @param  [interactionId]
 * @private
 */
export function setupInteractionChain(
  eventHandler: EventHandler,
  interactionId?: string,
): {
  interactionChain: InteractionChain;
  removed: VcsEvent<void>;
  destroy(this: void): void;
} {
  const interactionChain = new InteractionChain();
  const removed = new VcsEvent<void>();
  const listener = eventHandler.addExclusiveInteraction(
    interactionChain,
    () => {
      removed.raiseEvent();
    },
    undefined,
    interactionId,
  );
  const currentFeatureInteractionEvent = eventHandler.featureInteraction.active;
  eventHandler.featureInteraction.setActive(
    EventType.CLICKMOVE | EventType.DRAGSTART,
  );

  return {
    interactionChain,
    destroy(): void {
      listener();
      removed.destroy();
      interactionChain.destroy();
      eventHandler.featureInteraction.setActive(currentFeatureInteractionEvent);
    },
    removed,
  };
}

export enum GeometryType {
  Point = 'Point',
  Circle = 'Circle',
  LineString = 'LineString',
  Polygon = 'Polygon',
  BBox = 'BBox',
}

export type GeometryToType<T extends GeometryType> =
  T extends GeometryType.Point
    ? Point
    : T extends GeometryType.Polygon
    ? Polygon
    : T extends GeometryType.BBox
    ? Polygon
    : T extends GeometryType.LineString
    ? LineString
    : T extends GeometryType.Circle
    ? Circle
    : never;
