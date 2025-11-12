import type { Point, Polygon, Circle, LineString } from 'ol/geom.js';
import { getLogger } from '@vcsuite/logger';
import { unByKey } from 'ol/Observable.js';
import VectorLayer from '../../layer/vectorLayer.js';
import { mercatorProjection } from '../projection.js';
import InteractionChain from '../../interaction/interactionChain.js';
import VcsEvent from '../../vcsEvent.js';
import { EventType } from '../../interaction/interactionType.js';
import type LayerCollection from '../layerCollection.js';
import { maxZIndex } from '../layerCollection.js';
import { markVolatile } from '../../vcsModule.js';
import { PrimitiveOptionsType } from '../../layer/vectorProperties.js';
import type VcsApp from '../../vcsApp.js';
import type { InteractionEvent } from '../../interaction/abstractInteraction.js';
import type FeatureAtPixelInteraction from '../../interaction/featureAtPixelInteraction.js';
import type MapCollection from '../mapCollection.js';

export const alreadySnapped = Symbol('alreadySnapped');

export type SnappingInteractionEvent = InteractionEvent & {
  [alreadySnapped]?: boolean;
};

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
export type EditorSession<T extends SessionType = SessionType> = {
  type: T;
  stop(): void;
  stopped: VcsEvent<void>;
};

/**
 * Sets up an editor session scratch layer & activates it. Does not wait for the activation promise to resolve.
 * Note: scratch layers are volatile.
 */
export function setupScratchLayer(
  layerCollection: LayerCollection,
  featureAtPixelInteraction: FeatureAtPixelInteraction,
): { layer: VectorLayer; destroy: () => void } {
  // IDEA pass in stopped and cleanup ourselves?
  const layer = new VectorLayer({
    ignoreMapLayerTypes: true,
    projection: mercatorProjection.toJSON(),
    vectorProperties: {
      altitudeMode: 'clampToGround',
      eyeOffset: [0, 0, -5],
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
  layer.activate().catch((e: unknown) => {
    getLogger('Editor').error('Failed to activate scratch layer', e);
  });

  const sourceListeners = [
    layer.getSource().on('addfeature', (event) => {
      featureAtPixelInteraction.excludeFromPickPosition(event.feature!);
    }),
    layer.getSource().on('removefeature', (event) => {
      featureAtPixelInteraction.includeInPickPosition(event.feature!);
    }),
  ];

  return {
    layer,
    destroy(): void {
      unByKey(sourceListeners);
      layer.getFeatures().forEach((f) => {
        featureAtPixelInteraction.includeInPickPosition(f);
      });
      layerCollection.remove(layer);
      layer.destroy();
    },
  };
}

/**
 * Sets up the default interaction chain for the editors. This will set the provided event handlers
 * feature interaction to be active on CLICKMOVE & DRAGSTART. Destroying the setup will reset the interaction
 * to its previous active state.
 * @param  maps
 * @param  [interactionId]
 * @private
 */
export function setupInteractionChain(
  maps: MapCollection,
  interactionId?: string,
): {
  interactionChain: InteractionChain;
  removed: VcsEvent<void>;
  destroy(this: void): void;
} {
  const { eventHandler } = maps;
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
    EventType.CLICKMOVE | EventType.DRAGEVENTS,
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

export function setupPickingBehavior(app: VcsApp): () => void {
  const initialPickPosition =
    app.maps.eventHandler.featureInteraction.pickPosition;

  app.maps.eventHandler.featureInteraction.pickPosition =
    EventType.CLICKMOVE | EventType.DRAGEVENTS;

  return () => {
    app.maps.eventHandler.featureInteraction.pickPosition = initialPickPosition;
  };
}
