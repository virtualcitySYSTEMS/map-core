import {
  Cartographic,
  Cartesian3,
  Math as CesiumMath,
  Cesium3DTileFeature,
  Cesium3DTilePointFeature,
  Entity,
  Scene,
  Cartesian2,
} from '@vcmap-cesium/engine';
import OLMap from 'ol/Map.js';
import type { Feature } from 'ol/index.js';
import AbstractInteraction, {
  type EventFeature,
  type InteractionEvent,
} from './abstractInteraction.js';
import Projection from '../util/projection.js';
import {
  EventType,
  ModificationKeyType,
  PointerKeyType,
} from './interactionType.js';
import { vcsLayerName } from '../layer/layerSymbols.js';
import { originalFeatureSymbol } from '../layer/vectorSymbols.js';
import type OpenlayersMap from '../map/openlayersMap.js';
import type ObliqueMap from '../map/obliqueMap.js';
import type CesiumMap from '../map/cesiumMap.js';
import { vectorClusterGroupName } from '../vectorCluster/vectorClusterSymbols.js';

/**
 * This is the return from cesium scene.pick and scene.drillPick, which returns "any". We cast to this type.
 */
type CesiumPickObject = {
  primitive?: {
    olFeature?: Feature;
    pointCloudShading?: { attenuation: unknown };
    [vcsLayerName]?: string;
  };
  id?: {
    olFeature?: Feature;
    [vcsLayerName]?: string;
  };
};

function getFeaturesFromOlMap(
  map: OLMap,
  pixel: [number, number],
  hitTolerance: number,
  drill = 0,
): Feature[] {
  const features: Feature[] = [];
  let i = 0;
  map.forEachFeatureAtPixel(
    pixel,
    (feat) => {
      if (
        feat &&
        (feat.get('olcs_allowPicking') == null ||
          feat.get('olcs_allowPicking') === true)
      ) {
        const feature =
          (feat as Feature)[originalFeatureSymbol] || (feat as Feature);
        if (feature[vectorClusterGroupName]) {
          const clusterFeatures = feature.get('features') as Feature[];
          if (clusterFeatures.length === 1) {
            features.push(clusterFeatures[0]);
          } else {
            // not sure about spreading the cluster features.
            // since, even thought they are there, they are not rendered and
            // clusters should probably be handled differently anyway.
            features.push(feature, ...clusterFeatures);
          }
        } else {
          features.push(feature);
        }
      }
      i += 1;
      return i >= drill;
    },
    { hitTolerance },
  );

  return features;
}

function getFeatureFromPickObject(
  object: CesiumPickObject,
): EventFeature | EventFeature[] | undefined {
  let feature: EventFeature | undefined;
  if (object.primitive && object.primitive.olFeature) {
    feature = object.primitive.olFeature;
    if (feature[vectorClusterGroupName]) {
      const clusterFeatures = feature.get('features') as Feature[];
      // not sure about spreading the cluster features.
      // since, even thought they are there, they are not rendered and
      // clusters should probably be handled differently anyway.
      return [feature, ...clusterFeatures];
    }
  } else if (
    object.primitive &&
    object.primitive[vcsLayerName] &&
    (object instanceof Cesium3DTileFeature ||
      object instanceof Cesium3DTilePointFeature)
  ) {
    // cesium 3d tileset
    feature = object;
    const symbols = Object.getOwnPropertySymbols(object.primitive);
    const symbolLength = symbols.length;
    for (let i = 0; i < symbolLength; i++) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      feature[symbols[i]] = object.primitive[symbols[i]];
    }
  } else if (object.id && object.id.olFeature) {
    // cluster size === 1
    feature = object.id.olFeature;
  } else if (
    object.id &&
    object.id[vcsLayerName] &&
    object.id instanceof Entity
  ) {
    // entity
    feature = object.id;
  }

  return feature;
}

function getFeaturesFromScene(
  scene: Scene,
  windowPosition: Cartesian2,
  hitTolerance: number,
  drill = 0,
): EventFeature[] {
  const pickObjects =
    drill > 0
      ? (scene.drillPick(
          windowPosition,
          drill,
          hitTolerance,
          hitTolerance,
        ) as CesiumPickObject[])
      : ([
          scene.pick(windowPosition, hitTolerance, hitTolerance),
        ] as CesiumPickObject[]);

  return pickObjects.flatMap(getFeatureFromPickObject).filter((i) => !!i);
}

/**
 * @group Interaction
 */
class FeatureAtPixelInteraction extends AbstractInteraction {
  /**
   * event type for which to pick the position of the scene. this will create a second render.
   */
  pickPosition = EventType.CLICK;

  /**
   * whether to pick translucent depth or not, defaults to true
   */
  pickTranslucent = true;

  /**
   * Pulls the picked position towards the camera position by this number
   */
  pullPickedPosition = 0;

  /**
   * The number of pixels to take into account for picking features
   */
  hitTolerance = 10;

  drillPick = EventType.CLICK;

  drillPickDepth = 10;

  private _draggingFeature: EventFeature | null = null;

  constructor() {
    super(
      EventType.ALL ^ EventType.MOVE,
      ModificationKeyType.ALL,
      PointerKeyType.ALL,
    );
    this.setActive();
  }

  async pipe(event: InteractionEvent): Promise<InteractionEvent> {
    if (event.type & EventType.DRAG && !(this.pickPosition & EventType.DRAG)) {
      if (this._draggingFeature) {
        event.feature = this._draggingFeature;
      }
      return event;
    }

    if (event.type & EventType.DRAGEND) {
      this._draggingFeature = null;
    }

    if (event.map.className === 'OpenlayersMap') {
      await this._openlayersHandler(event);
    } else if (event.map.className === 'ObliqueMap') {
      await this._obliqueHandler(event);
    } else if (event.map.className === 'CesiumMap') {
      await this._cesiumHandler(event);
    }
    if (event.type & EventType.DRAGSTART && event.feature) {
      this._draggingFeature = event.feature;
    }

    if (event.type & EventType.DRAG && this._draggingFeature) {
      event.feature = this._draggingFeature;
    }
    return event;
  }

  setActive(active?: boolean | number): void {
    if (typeof active === 'undefined') {
      this.pickPosition = EventType.CLICK;
      this.pullPickedPosition = 0;
    }
    super.setActive(active);
  }

  private _drillDepthForEvent(event: InteractionEvent): number {
    if (event.type & this.drillPick) {
      return this.drillPickDepth;
    }
    return 0;
  }

  private _openlayersHandler(
    event: InteractionEvent,
  ): Promise<InteractionEvent> {
    const features = getFeaturesFromOlMap(
      (event.map as OpenlayersMap).olMap!,
      [event.windowPosition.x, event.windowPosition.y],
      this.hitTolerance,
      this._drillDepthForEvent(event),
    );

    if (features.length > 0) {
      event.feature = features[0];
      event.features = features;
      event.exactPosition = true;
    }
    return Promise.resolve(event);
  }

  private _obliqueHandler(event: InteractionEvent): Promise<InteractionEvent> {
    const features = getFeaturesFromOlMap(
      (event.map as ObliqueMap).olMap!,
      [event.windowPosition.x, event.windowPosition.y],
      this.hitTolerance,
      this._drillDepthForEvent(event),
    );

    if (features.length > 0) {
      event.feature = features[0];
      event.features = features;
      event.exactPosition = true;
    }
    return Promise.resolve(event);
  }

  private _cesiumHandler(event: InteractionEvent): Promise<InteractionEvent> {
    const cesiumMap = event.map as CesiumMap;
    const scene = cesiumMap.getScene();

    if (!scene) {
      return Promise.resolve(event);
    }

    const features = getFeaturesFromScene(
      scene,
      event.windowPosition,
      this.hitTolerance,
      this._drillDepthForEvent(event),
    );

    let scratchCartographic = new Cartographic();
    let scratchCartesian = new Cartesian3();
    let scratchPullCartesian = new Cartesian3();
    const { pickTranslucentDepth } = scene;

    const handlePick = (): Promise<InteractionEvent> => {
      if (!scratchCartesian) {
        scratchCartesian = new Cartesian3();
        return Promise.resolve(event);
      }

      if (this.pullPickedPosition && event.ray) {
        scratchPullCartesian = Cartesian3.multiplyByScalar(
          event.ray.direction,
          this.pullPickedPosition,
          scratchPullCartesian,
        );

        scratchCartesian = Cartesian3.subtract(
          scratchCartesian,
          scratchPullCartesian,
          scratchCartesian,
        );
      }
      scratchCartographic = Cartographic.fromCartesian(
        scratchCartesian,
        scene.globe.ellipsoid,
        scratchCartographic,
      );

      event.position = Projection.wgs84ToMercator(
        [
          CesiumMath.toDegrees(scratchCartographic.longitude),
          CesiumMath.toDegrees(scratchCartographic.latitude),
          scratchCartographic.height,
        ],
        true,
      );
      event.positionOrPixel = event.position;
      scene.pickTranslucentDepth = pickTranslucentDepth;
      return Promise.resolve(event);
    };

    if (features.length > 0) {
      event.feature = features[0];
      event.features = features;
      if (!(event.type & this.pickPosition)) {
        return Promise.resolve(event);
      }

      if (scene.pickPositionSupported) {
        if (this.pickTranslucent) {
          scene.pickTranslucentDepth = true;
          event.exactPosition = true;
        }
        scratchCartesian = scene.pickPosition(
          event.windowPosition,
          scratchCartesian,
        );
        return handlePick();
      }
    }
    return Promise.resolve(event);
  }
}

export default FeatureAtPixelInteraction;
