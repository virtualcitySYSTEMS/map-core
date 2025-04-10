import {
  Cartographic,
  Cartesian3,
  Math as CesiumMath,
} from '@vcmap-cesium/engine';
import type { Coordinate } from 'ol/coordinate.js';

import AbstractInteraction, {
  type InteractionEvent,
} from './abstractInteraction.js';
import Projection, { mercatorProjection } from '../util/projection.js';
import {
  EventType,
  ModificationKeyType,
  PointerKeyType,
} from './interactionType.js';
import { transformFromImage } from '../oblique/helpers.js';
import type CesiumMap from '../map/cesiumMap.js';
import type ObliqueMap from '../map/obliqueMap.js';
import type PanoramaMap from '../map/panoramaMap.js';
import { cartesianToMercator } from '../util/math.js';
import { windowPositionToImageSpherical } from '../panorama/fieldOfView.js';

const scratchPanoramaCartesian = new Cartesian3();
async function getCoordinateFromPanoramap(
  map: PanoramaMap,
  event: InteractionEvent,
): Promise<InteractionEvent> {
  const image = map.currentPanoramaImage;
  let position = [0, 0, 0];
  if (image) {
    const { camera } = map.getCesiumWidget();
    const imageCoordinate = windowPositionToImageSpherical(
      event.windowPosition,
      camera,
      image.invModelMatrix,
    );

    event.positionOrPixel = imageCoordinate;

    if (imageCoordinate) {
      const cartesian = await image.getPositionAtImageCoordinate(
        imageCoordinate,
        scratchPanoramaCartesian,
      );
      if (cartesian) {
        position = cartesianToMercator(cartesian);
      }
    }
  }

  event.position = position;
  return event;
}

/**
 * @group Interaction
 */
class CoordinateAtPixel extends AbstractInteraction {
  private _scratchCartographic = new Cartographic();

  private _scratchCartesian = new Cartesian3();

  constructor() {
    super(EventType.ALL, ModificationKeyType.ALL, PointerKeyType.ALL);

    this.setActive();
  }

  async pipe(event: InteractionEvent): Promise<InteractionEvent> {
    if (event.map.className === 'CesiumMap') {
      return this._cesiumHandler(event);
    } else if (event.map.className === 'ObliqueMap') {
      return CoordinateAtPixel.obliqueHandler(event);
    } else if (event.map.className === 'PanoramaMap') {
      return getCoordinateFromPanoramap(event.map as PanoramaMap, event);
    }
    return event;
  }

  private _cesiumHandler(event: InteractionEvent): Promise<InteractionEvent> {
    const cesiumMap = event.map as CesiumMap;
    const scene = cesiumMap.getScene();
    if (!scene) {
      return Promise.resolve(event);
    }
    event.ray = scene.camera.getPickRay(event.windowPosition);
    if (!event.ray) {
      return Promise.resolve(event);
    }
    const pickResult = scene.globe.pick(
      event.ray,
      scene,
      this._scratchCartesian,
    );
    if (!pickResult) {
      event.position = [0, 0, 0];
    } else {
      this._scratchCartographic = Cartographic.fromCartesian(
        pickResult,
        scene.globe.ellipsoid,
        this._scratchCartographic,
      );
      event.position = Projection.wgs84ToMercator(
        [
          CesiumMath.toDegrees(this._scratchCartographic.longitude),
          CesiumMath.toDegrees(this._scratchCartographic.latitude),
          this._scratchCartographic.height,
        ],
        true,
      );
    }
    event.positionOrPixel = event.position;
    return Promise.resolve(event);
  }

  static obliqueHandler(event: InteractionEvent): Promise<InteractionEvent> {
    const obliqueMap = event.map as ObliqueMap;
    const image = obliqueMap.currentImage;
    if (image) {
      // don't use TerrainLayer for coordinate Transformation if the event is a move or drag event,
      // to avoid requesting the terrain each mousemove...
      // XXX but what about DRAGSTART and DRAGEND? this could be usefull, no?
      const move = event.type & (EventType.MOVE ^ EventType.DRAGEVENTS);
      const pixel = (event.position as Coordinate).slice(0, 2);
      if (Number.isFinite(pixel[0]) && Number.isFinite(pixel[1])) {
        return transformFromImage(image, pixel, {
          dontUseTerrain: !!move,
          dataProjection: mercatorProjection,
        }).then((coordinates) => {
          event.obliqueParameters = { pixel, estimate: coordinates.estimate };
          event.position = coordinates.coords;
          return event;
        });
      }
    }
    event.stopPropagation = true;
    return Promise.resolve(event);
  }
}

export default CoordinateAtPixel;
