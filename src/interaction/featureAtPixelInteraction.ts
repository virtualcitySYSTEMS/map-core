import {
  Cartographic,
  Cartesian3,
  Math as CesiumMath,
  Cesium3DTileFeature,
  Cesium3DTilePointFeature,
  Entity,
} from '@vcmap-cesium/engine';
import type { Feature } from 'ol/index.js';
import type { Layer as OLLayer } from 'ol/layer.js';

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

  private _openlayersHandler(
    event: InteractionEvent,
  ): Promise<InteractionEvent> {
    let found: Feature | null = null;
    let foundLayer: OLLayer | null = null;
    (event.map as OpenlayersMap).olMap!.forEachFeatureAtPixel(
      [event.windowPosition.x, event.windowPosition.y],
      (feat, layer) => {
        if (
          feat &&
          (feat.get('olcs_allowPicking') == null ||
            feat.get('olcs_allowPicking') === true)
        ) {
          found = feat as Feature;
          foundLayer = layer;
        }
        return true;
      },
      { hitTolerance: this.hitTolerance },
    );

    if (found && foundLayer) {
      event.feature = found as Feature;
      if (event.feature.get('features') as Feature[] | undefined) {
        event.feature[vcsLayerName] = foundLayer[vcsLayerName];
      }
      event.exactPosition = true;
    }
    return Promise.resolve(event);
  }

  private _obliqueHandler(event: InteractionEvent): Promise<InteractionEvent> {
    let found: Feature | null = null;
    let foundLayer: OLLayer | null = null;
    (event.map as ObliqueMap).olMap!.forEachFeatureAtPixel(
      [event.windowPosition.x, event.windowPosition.y],
      (feat, layer) => {
        if (feat) {
          found = (feat as Feature)[originalFeatureSymbol] || (feat as Feature);
        }
        foundLayer = layer;
        return true;
      },
      { hitTolerance: this.hitTolerance },
    );

    if (found && foundLayer) {
      event.feature = found as Feature;
      if (event.feature.get('features') as Feature[] | undefined) {
        event.feature[vcsLayerName] = foundLayer[vcsLayerName];
      }
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

    const object = scene.pick(
      event.windowPosition,
      this.hitTolerance,
      this.hitTolerance,
    ) as {
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

    if (object) {
      if (object.primitive && object.primitive.olFeature) {
        // vector & vectorCluster
        event.feature = object.primitive.olFeature;
      } else if (
        object.primitive &&
        object.primitive[vcsLayerName] &&
        (object instanceof Cesium3DTileFeature ||
          object instanceof Cesium3DTilePointFeature)
      ) {
        // building
        event.feature = object;
        const symbols = Object.getOwnPropertySymbols(object.primitive);
        const symbolLength = symbols.length;
        for (let i = 0; i < symbolLength; i++) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          event.feature[symbols[i]] = object.primitive[symbols[i]];
        }
      } else if (object.id && object.id.olFeature) {
        // cluster size === 1
        event.feature = object.id.olFeature;
      } else if (
        object.id &&
        object.id[vcsLayerName] &&
        object.id instanceof Entity
      ) {
        // entity
        event.feature = object.id;
      }

      if (!(event.type & this.pickPosition)) {
        return Promise.resolve(event);
      }

      if (scene.pickPositionSupported) {
        if (object.primitive && this.pickTranslucent) {
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
