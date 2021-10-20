import { Cartographic, Cartesian3, Math as CesiumMath } from '@vcmap/cesium';
import AbstractInteraction from './abstractInteraction.js';
import Projection, { mercatorProjection } from '../util/projection.js';
import { EventType, ModificationKeyType } from './interactionType.js';
import { transformFromImage } from '../oblique/helpers.js';

/**
 * @class
 * @extends {vcs.vcm.interaction.AbstractInteraction}
 * @memberOf vcs.vcm.interaction
 */
class CoordinateAtPixel extends AbstractInteraction {
  constructor() {
    super();
    /**
     * @type {Cesium/Cartographic}
     * @private
     */
    this._scratchCartographic = new Cartographic();
    /**
     * @type {Cesium/Cartesian3}
     * @private
     */
    this._scratchCartesian = new Cartesian3();

    this._defaultActive = EventType.ALL;
    this._defaultModificationKey = ModificationKeyType.ALL;

    this.setActive();
  }

  /**
   * @inheritDoc
   * @param {vcs.vcm.interaction.Event} event
   * @returns {Promise<vcs.vcm.interaction.Event>}
   */
  // eslint-disable-next-line class-methods-use-this
  async pipe(event) {
    if (event.map.className === 'vcs.vcm.maps.Cesium') {
      return this._cesiumHandler(event);
    } else if (event.map.className === 'vcs.vcm.maps.Oblique') {
      return CoordinateAtPixel.obliqueHandler(event);
    }
    return event;
  }

  /**
   * @param {vcs.vcm.interaction.Event} event
   * @returns {Promise<vcs.vcm.interaction.Event>}
   * @private
   */
  _cesiumHandler(event) {
    const cesiumMap = /** @type {vcs.vcm.maps.CesiumMap} */ (event.map);
    const scene = cesiumMap.getScene();
    event.ray = scene.camera.getPickRay(event.windowPosition);
    const pickResult = scene.globe.pick(event.ray, scene, this._scratchCartesian);
    if (!pickResult) {
      event.position = [0, 0, 0];
    } else {
      this._scratchCartographic = Cartographic
        .fromCartesian(pickResult, scene.globe.ellipsoid, this._scratchCartographic);
      event.position = Projection.wgs84ToMercator([
        CesiumMath.toDegrees(this._scratchCartographic.longitude),
        CesiumMath.toDegrees(this._scratchCartographic.latitude),
        this._scratchCartographic.height,
      ], true);
    }
    event.positionOrPixel = event.position;
    return Promise.resolve(event);
  }

  /**
   * @param {vcs.vcm.interaction.Event} event
   * @returns {Promise<vcs.vcm.interaction.Event>}
   * @private
   */
  static obliqueHandler(event) {
    const obliqueMap = /** @type {vcs.vcm.maps.Oblique} */ (event.map);
    const image = obliqueMap.currentImage;
    if (image) {
      // don't use Terrain for coordinate Transformation if the event is a move or drag event,
      // to avoid requesting the terrain each mousemove...
      // XXX but what about DRAGSTART and DRAGEND? this could be usefull, no?
      const move = event.type & (EventType.MOVE ^ EventType.DRAGEVENTS);
      const pixel = event.position.slice(0, 2);
      if (Number.isFinite(pixel[0]) && Number.isFinite(pixel[1])) {
        return transformFromImage(image, pixel, {
          dontUseTerrain: !!move,
          dataProjection: mercatorProjection.proj,
        }).then((coordinates) => {
          event.obliqueParameters = { pixel };
          event.position = coordinates.coords;
          event.obliqueParameters.estimate = coordinates.estimate;
          return event;
        });
      }
    }
    event.stopPropagation = true;
    return Promise.resolve(event);
  }
}

export default CoordinateAtPixel;
