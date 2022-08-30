import Cartographic from '@vcmap/cesium/Source/Core/Cartographic.js';
import Cartesian3 from '@vcmap/cesium/Source/Core/Cartesian3.js';
import CesiumMath from '@vcmap/cesium/Source/Core/Math.js';
import Cesium3DTileFeature from '@vcmap/cesium/Source/Scene/Cesium3DTileFeature.js';
import Cesium3DTilePointFeature from '@vcmap/cesium/Source/Scene/Cesium3DTilePointFeature.js';

import AbstractInteraction from './abstractInteraction.js';
import Projection from '../util/projection.js';
import { EventType, ModificationKeyType } from './interactionType.js';
import { vcsLayerName } from '../layer/layerSymbols.js';
import { originalFeatureSymbol } from '../layer/vectorSymbols.js';

/**
 * @class
 * @extends {vcs.vcm.interaction.AbstractInteraction}
 * @memberOf vcs.vcm.interaction
 */
class FeatureAtPixelInteraction extends AbstractInteraction {
  constructor() {
    super();
    /**
     * @type {vcs.vcm.interaction.EventType|number}
     * @private
     */
    this._pickPosition = EventType.CLICK;
    /**
     * @type {number}
     * @private
     */
    this._pickPositionMask = -1;

    /**
     * whether to pick translucent depth or not, defaults to true
     * @type {boolean}
     * @api
     */
    this.pickTranslucent = true;

    /**
     * <i>Pulls</i> the picked position towards the camera position by this number
     * @type {number}
     * @default 0
     * @api
     */
    this.pullPickedPosition = 0;

    /**
     * The number of pixels to take into account for picking features
     * @type {number}
     * @default 10
     * @api
     */
    this.hitTolerance = 10;

    /**
     * @inheritDoc
     * @type {vcs.vcm.interaction.ModificationKeyType|number}
     * @protected
     */
    this._defaultModificationKey = ModificationKeyType.ALL;
    /**
     * @inheritDoc
     * @type {vcs.vcm.interaction.ModificationKeyType|number}
     * @protected
     */
    this._defaultActive = EventType.ALL ^ EventType.MOVE;

    /**
     * @type {ol/Feature|Object|null}
     * @private
     */
    this._draggingFeature = null;
    this.setActive();
  }

  /**
   * Bitmask of {@link vcs.vcm.interaction.EventType} for which events to pick the position
   * @type {number}
   * @api
   */
  get pickPosition() { return this._pickPosition; }

  /**
   * @param {number} position
   */
  set pickPosition(position) {
    this._pickPosition = position & this._pickPositionMask;
  }

  /**
   * Bitmask of {@link vcs.vcm.interaction.EventType} for which to never pick positions.
   * @type {number}
   * @api
   */
  get excludedPickPositionEvents() { return ~this._pickPositionMask; }

  /**
   * @param {number} position
   */
  set excludedPickPositionEvents(position) {
    this._pickPositionMask = ~position;
  }

  /**
   * @inheritDoc
   * @param {vcs.vcm.interaction.Event} event
   * @returns {Promise<vcs.vcm.interaction.Event>}
   */
  async pipe(event) {
    if (event.type & EventType.DRAG && !(this._pickPosition & EventType.DRAG)) {
      if (this._draggingFeature) {
        event.feature = this._draggingFeature;
      }
      return event;
    }

    if (event.type & EventType.DRAGEND) {
      this._draggingFeature = null;
    }

    if (event.map.className === 'vcs.vcm.maps.Openlayers') {
      await this._openlayersHandler(event);
    } else if (event.map.className === 'vcs.vcm.maps.Oblique') {
      await this._obliqueHandler(event);
    } else if (event.map.className === 'vcs.vcm.maps.Cesium') {
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

  /**
   * @inheritDoc
   * @param {(boolean|number)=} active
   */
  setActive(active) {
    if (typeof active === 'undefined') {
      this.pickPosition = EventType.CLICK;
      this.pullPickedPosition = 0;
    }
    super.setActive(active);
  }

  /**
   * @param {vcs.vcm.interaction.Event} event
   * @returns {Promise.<vcs.vcm.interaction.Event>}
   * @private
   */
  _openlayersHandler(event) {
    /** @type {null|ol/Feature} */
    let found = null;
    /** @type {null|ol/layer.Layer} */
    let foundLayer = null;
    /** @type {vcs.vcm.maps.Openlayers} */ (event.map).olMap
      .forEachFeatureAtPixel([event.windowPosition.x, event.windowPosition.y], (feat, layer) => {
        if (feat && (feat.get('olcs_allowPicking') == null || feat.get('olcs_allowPicking') === true)) {
          found = /** @type {ol/Feature} */ (feat);
          foundLayer = layer;
        }
        return true;
      }, { hitTolerance: this.hitTolerance });
    if (found && foundLayer) {
      event.feature = found;
      if (found.get('features')) {
        event.feature[vcsLayerName] = foundLayer[vcsLayerName];
      }
      event.exactPosition = true;
    }
    return Promise.resolve(event);
  }

  /**
   * @param {vcs.vcm.interaction.Event} event
   * @returns {Promise.<vcs.vcm.interaction.Event>}
   * @private
   */
  _obliqueHandler(event) {
    /** @type {null|ol/Feature} */
    let found = null;
    /** @type {null|ol/layer/Layer} */
    let foundLayer = null;
    /** @type {vcs.vcm.maps.Oblique} */ (event.map).olMap
      .forEachFeatureAtPixel([event.windowPosition.x, event.windowPosition.y], (feat, layer) => {
        if (feat) {
          found = feat[originalFeatureSymbol] || feat;
        }
        foundLayer = layer;
        return true;
      }, { hitTolerance: this.hitTolerance });

    if (found && foundLayer) {
      event.feature = found;
      if (found.get('features')) {
        event.feature[vcsLayerName] = foundLayer[vcsLayerName];
      }
      event.exactPosition = true;
    }
    return Promise.resolve(event);
  }

  /**
   * @param {vcs.vcm.interaction.Event} event
   * @returns {Promise.<vcs.vcm.interaction.Event>}
   * @private
   */
  _cesiumHandler(event) {
    const cesiumMap = /** @type {vcs.vcm.maps.CesiumMap} */ (event.map);
    const scene = cesiumMap.getScene();

    const object = scene.pick(event.windowPosition, this.hitTolerance, this.hitTolerance);

    let scratchCartographic = new Cartographic();
    let scratchCartesian = new Cartesian3();
    let scratchPullCartesian = new Cartesian3();
    const { pickTranslucentDepth } = scene;

    const handlePick = () => {
      if (!scratchCartesian) {
        scratchCartesian = new Cartesian3();
        return Promise.resolve(event);
      }
      if (this.pullPickedPosition && event.ray) {
        scratchPullCartesian = Cartesian3
          .multiplyByScalar(event.ray.direction, this.pullPickedPosition, scratchPullCartesian);

        scratchCartesian = Cartesian3.subtract(scratchCartesian, scratchPullCartesian, scratchCartesian);
      }
      scratchCartographic = Cartographic
        .fromCartesian(scratchCartesian, scene.globe.ellipsoid, scratchCartographic);
      event.position = Projection.wgs84ToMercator([
        CesiumMath.toDegrees(scratchCartographic.longitude),
        CesiumMath.toDegrees(scratchCartographic.latitude),
        scratchCartographic.height,
      ], true);
      event.positionOrPixel = event.position;
      scene.pickTranslucentDepth = pickTranslucentDepth;
      return Promise.resolve(event);
    };

    if (object) {
      if (object.primitive && object.primitive.olFeature) { // vector & vectorCluster
        event.feature = object.primitive.olFeature;
      } else if (
        object.primitive &&
        object.primitive[vcsLayerName] &&
        (object instanceof Cesium3DTileFeature || object instanceof Cesium3DTilePointFeature)
      ) { // building
        event.feature = object;
        const symbols = Object.getOwnPropertySymbols(object.primitive);
        const symbolLength = symbols.length;
        for (let i = 0; i < symbolLength; i++) {
          event.feature[symbols[i]] = object.primitive[symbols[i]];
        }
      } else if (object.id && object.id.olFeature) { // cluster size === 1
        event.feature = object.id.olFeature;
      } else if (object.id && object.id[vcsLayerName]) { // entity
        event.feature = object;
        event.feature[vcsLayerName] = object.id[vcsLayerName];
      } else {
        event.feature = object;
      }

      if (!(event.type & this.pickPosition)) {
        return Promise.resolve(event);
      }

      if (scene.pickPositionSupported) {
        if (
          object.primitive &&
          this.pickTranslucent &&
          !(object.primitive.pointCloudShading && object.primitive.pointCloudShading.attenuation)
        ) { // XXX should this always be on, also for non vector?
          scene.pickTranslucentDepth = true;
          scene.render(cesiumMap.getCesiumWidget().clock.currentTime);
          event.exactPosition = true;
        }
        scratchCartesian = scene.pickPosition(event.windowPosition, scratchCartesian);
        return handlePick();
      }
    }
    return Promise.resolve(event);
  }
}

export default FeatureAtPixelInteraction;