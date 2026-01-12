import type {
  Scene,
  Cartesian2,
  Ray,
  Billboard,
  Label,
  I3SNode,
  I3SDataProvider,
} from '@vcmap-cesium/engine';
import {
  Cartesian3,
  Cesium3DTileFeature,
  Cesium3DTilePointFeature,
  Entity,
} from '@vcmap-cesium/engine';
import type OLMap from 'ol/Map.js';
import Feature from 'ol/Feature.js';
import { Point } from 'ol/geom.js';
import { v4 as uuid } from 'uuid';
import AbstractInteraction, {
  type EventFeature,
  type InteractionEvent,
} from './abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
  PointerKeyType,
} from './interactionType.js';
import { allowPicking, i3sData, vcsLayerName } from '../layer/layerSymbols.js';
import { originalFeatureSymbol, primitives } from '../layer/vectorSymbols.js';
import type OpenlayersMap from '../map/openlayersMap.js';
import type ObliqueMap from '../map/obliqueMap.js';
import { vectorClusterGroupName } from '../vectorCluster/vectorClusterSymbols.js';
import { cartesian3DDistance, cartesianToMercator } from '../util/math.js';
import type { PrimitiveType } from '../util/featureconverter/convert.js';
import type BaseCesiumMap from '../map/baseCesiumMap.js';
import type PanoramaMap from '../map/panoramaMap.js';
import { isProvidedFeature } from '../featureProvider/featureProviderSymbols.js';

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
  content?: {
    tile?: {
      i3sNode: I3SNode;
    };
  };
};

function getFeatureFromOlMap(
  map: OLMap,
  pixel: [number, number],
  hitTolerance: number,
): Feature | undefined {
  let feature: Feature | undefined;
  map.forEachFeatureAtPixel(
    pixel,
    (feat) => {
      let candidateFeature = feat;
      if (
        candidateFeature &&
        (candidateFeature.get('olcs_allowPicking') == null ||
          candidateFeature.get('olcs_allowPicking') === true)
      ) {
        if ((candidateFeature as Feature)[vectorClusterGroupName]) {
          const features = candidateFeature.get('features') as Feature[];
          if (features.length === 1) {
            candidateFeature = features[0];
          }
        }
        feature =
          (candidateFeature as Feature)[originalFeatureSymbol] ||
          (candidateFeature as Feature);
      }

      return true;
    },
    { hitTolerance },
  );

  return feature;
}

export function isI3SFeature(f: EventFeature): f is Feature & {
  [i3sData]: { i3sNode: I3SNode; cartesianPosition?: Cartesian3 };
} {
  return !!(f != null && (f as Feature)[i3sData]);
}

export function getFeatureFromPickObject(
  object: CesiumPickObject,
): EventFeature | undefined {
  let feature: EventFeature | undefined;
  if (object.primitive && object.primitive.olFeature) {
    feature = object.primitive.olFeature;
  } else if (
    object.primitive &&
    object.primitive[vcsLayerName] &&
    (object instanceof Cesium3DTileFeature ||
      object instanceof Cesium3DTilePointFeature) &&
    object.primitive[allowPicking] !== false
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
  } else if (object.content?.tile?.i3sNode) {
    // i3s feature
    const dataProvider =
      // @ts-expect-error eslint-disable-next-line no-underscore-dangle, @typescript-eslint/ban-ts-comment
      // eslint-disable-next-line no-underscore-dangle
      object.content.tile.i3sNode._dataProvider as I3SDataProvider;
    const layername = dataProvider[vcsLayerName];
    if (object instanceof Cesium3DTileFeature) {
      feature = object;
      feature[vcsLayerName] = layername;
    } else if (dataProvider[allowPicking] !== false) {
      feature = new Feature({});
      feature.setId(uuid());
      feature[vcsLayerName] = layername;
      feature[i3sData] = { i3sNode: object.content.tile.i3sNode };
      feature[isProvidedFeature] = true;
    }
  }
  return feature;
}

export function getFeatureFromScene(
  scene: Scene,
  windowPosition: Cartesian2,
  hitTolerance: number,
): { pickObject: unknown; feature?: EventFeature } {
  const pickObject = scene.pick(windowPosition, hitTolerance, hitTolerance) as
    | CesiumPickObject
    | undefined;

  let feature: EventFeature | undefined;
  if (pickObject) {
    feature = getFeatureFromPickObject(pickObject);
  }
  return { pickObject, feature };
}

const MAX_UNDERGROUND_FEATURE_DEPTH_SQRD = 1000 ** 2;
function getPositionFromScene(
  scene: Scene,
  windowPosition: Cartesian2,
  ray: Ray,
  primitivesToExclude?: (PrimitiveType | Label | Billboard | Entity)[],
): Cartesian3 | undefined {
  if (primitivesToExclude) {
    const intersection = scene.pickFromRay(ray, primitivesToExclude);
    if (intersection?.position) {
      if (scene.globe.translucency.enabled) {
        const globeIntersection = scene.globe.pick(ray, scene);
        if (
          globeIntersection &&
          Cartesian3.distanceSquared(globeIntersection, intersection.position) >
            MAX_UNDERGROUND_FEATURE_DEPTH_SQRD
        ) {
          return globeIntersection;
        }
      }

      return intersection.position;
    }
  }
  return scene.pickPosition(windowPosition);
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

  private _draggingFeature: EventFeature | undefined;

  private _excludeFromPickPosition = new Set<Feature>();

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
      this._draggingFeature = undefined;
    }

    if (event.map.className === 'OpenlayersMap') {
      await this._openlayersHandler(event);
    } else if (event.map.className === 'ObliqueMap') {
      await this._obliqueHandler(event);
    } else if (
      event.map.className === 'CesiumMap' ||
      event.map.className === 'PanoramaMap'
    ) {
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

  excludeFromPickPosition(feature: Feature): void {
    this._excludeFromPickPosition.add(feature);
  }

  includeInPickPosition(feature: Feature): void {
    this._excludeFromPickPosition.delete(feature);
  }

  isExcludedFromPickPosition(feature: Feature): boolean {
    return this._excludeFromPickPosition.has(feature);
  }

  private _openlayersHandler(
    event: InteractionEvent,
  ): Promise<InteractionEvent> {
    const feature = getFeatureFromOlMap(
      (event.map as OpenlayersMap).olMap!,
      [event.windowPosition.x, event.windowPosition.y],
      this.hitTolerance,
    );

    if (feature) {
      event.feature = feature;
      event.exactPosition = true;
    }
    return Promise.resolve(event);
  }

  private _obliqueHandler(event: InteractionEvent): Promise<InteractionEvent> {
    const feature = getFeatureFromOlMap(
      (event.map as ObliqueMap).olMap!,
      [event.windowPosition.x, event.windowPosition.y],
      this.hitTolerance,
    );

    if (feature) {
      event.feature = feature;
      event.exactPosition = true;
    }
    return Promise.resolve(event);
  }

  private _cesiumHandler(event: InteractionEvent): Promise<InteractionEvent> {
    const cesiumMap = event.map as BaseCesiumMap;
    const { scene } = cesiumMap.getCesiumWidget()!;

    if (!scene) {
      return Promise.resolve(event);
    }

    const { feature, pickObject } = getFeatureFromScene(
      scene,
      event.windowPosition,
      this.hitTolerance,
    );

    if (feature) {
      event.feature = feature;
    }

    const { pickTranslucentDepth } = scene;
    if (
      !!(event.type & this.pickPosition) &&
      pickObject &&
      scene.pickPositionSupported
    ) {
      if (this.pickTranslucent) {
        scene.pickTranslucentDepth = true;
        event.exactPosition = true;
      }

      let primitivesToExclude;
      if (
        feature &&
        (feature as Feature)[primitives] &&
        this._excludeFromPickPosition.has(feature as Feature)
      ) {
        primitivesToExclude = [...this._excludeFromPickPosition]
          .flatMap((f) => f[primitives])
          .filter((f) => !!f);
      }

      const cartesianPosition = getPositionFromScene(
        scene,
        event.windowPosition,
        event.ray!,
        primitivesToExclude,
      );

      if (
        cartesianPosition &&
        !Cartesian3.equals(cartesianPosition, Cartesian3.ZERO)
      ) {
        if (this.pullPickedPosition && event.ray) {
          const pulledCartesian = Cartesian3.multiplyByScalar(
            event.ray.direction,
            this.pullPickedPosition,
            new Cartesian3(),
          );

          Cartesian3.subtract(
            cartesianPosition,
            pulledCartesian,
            cartesianPosition,
          );
        }

        if (event.map.className === 'CesiumMap') {
          event.position = cartesianToMercator(cartesianPosition);
          event.positionOrPixel = event.position.slice();
          if (
            feature instanceof Feature &&
            feature[isProvidedFeature] &&
            isI3SFeature(feature)
          ) {
            feature.setGeometry(new Point(event.position));
            feature.set('olcs_altitudeMode', 'absolute');
            feature[i3sData].cartesianPosition = cartesianPosition;
          }
        } else {
          const currentImage = (event.map as PanoramaMap).currentPanoramaImage;
          if (currentImage) {
            const imageCenter = cartesianToMercator(currentImage.position);
            const newPosition = cartesianToMercator(cartesianPosition);
            const newDistance = cartesian3DDistance(imageCenter, newPosition);
            const currentDistance = event.position
              ? cartesian3DDistance(imageCenter, event.position)
              : undefined;

            if (currentDistance == null || newDistance < currentDistance) {
              event.position = newPosition;
              event.positionOrPixel = event.position.slice();
              if (
                feature instanceof Feature &&
                feature[isProvidedFeature] &&
                isI3SFeature(feature)
              ) {
                feature.setGeometry(new Point(event.position));
                feature.set('olcs_altitudeMode', 'absolute');
                feature[i3sData].cartesianPosition = cartesianPosition;
              }
            }
          }
        }
      }
      scene.pickTranslucentDepth = pickTranslucentDepth;
    }

    return Promise.resolve(event);
  }

  destroy(): void {
    this._excludeFromPickPosition.clear();
    this._draggingFeature = undefined;
    super.destroy();
  }
}

export default FeatureAtPixelInteraction;
