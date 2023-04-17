import { LinearRing } from 'ol/geom.js';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
} from '../../../interaction/interactionType.js';
import { cartesian2DDistance } from '../../math.js';
import {
  createVertex,
  pointOnLine2D,
  pointOnLine3D,
} from '../editorHelpers.js';
import VcsEvent from '../../../vcsEvent.js';

/**
 * @typedef {Object} VertexInsertedEvent
 * @property {import("@vcmap/core").Vertex} vertex
 * @property {number} index
 */

/**
 * @class
 * @extends {AbstractInteraction}
 */
class InsertVertexInteraction extends AbstractInteraction {
  /**
   * @param {import("ol").Feature<import("ol/geom").LineString|import("ol/geom").Polygon>} feature
   * @param {import("ol/geom").LineString|import("ol/geom").LinearRing} geometry
   */
  constructor(feature, geometry) {
    super(EventType.CLICK, ModificationKeyType.NONE);

    /**
     * @type {import("@vcmap/core").VcsEvent<VertexInsertedEvent>}
     */
    this.vertexInserted = new VcsEvent();
    /**
     * @type {import("ol").Feature<import("ol/geom").LineString|import("ol/geom").Polygon>}
     * @private
     */
    this._feature = feature;
    /**
     * @type {import("ol/geom").LineString|import("ol/geom").LinearRing}
     * @private
     */
    this._geometry = geometry;

    /**
     * @type {boolean}
     * @private
     */
    this._isLinearRing = this._geometry instanceof LinearRing;
    this.setActive();
  }

  /**
   * @inheritDoc
   * @param {InteractionEvent} event
   * @returns {Promise<InteractionEvent>}
   */
  async pipe(event) {
    if (event.feature === this._feature) {
      const lineCoords = this._geometry.getCoordinates();
      const coordinate = event.positionOrPixel;
      const closestCoord = this._geometry.getClosestPoint(coordinate);

      if (this._isLinearRing) {
        lineCoords.push(lineCoords[0]);
      }
      const distance = cartesian2DDistance(closestCoord, coordinate); // todo respect altitude mode here. e.g. distance3D
      if (distance < event.map.getCurrentResolution(coordinate) * 5) {
        const length = lineCoords.length - 1;
        let i = 0;
        for (i; i < length; i++) {
          const onLine =
            this._feature.get('olcs_altitudeMode') === 'clampToGround' // todo altitude mode
              ? pointOnLine2D(lineCoords[i], lineCoords[i + 1], closestCoord)
              : pointOnLine3D(lineCoords[i], lineCoords[i + 1], closestCoord);
          if (onLine) {
            break;
          }
        }

        let index = i + 1;
        if (this._isLinearRing && index === lineCoords.length) {
          index = 0;
        }
        this.vertexInserted.raiseEvent({
          vertex: createVertex(closestCoord),
          index,
        });
      }
    }
    return event;
  }

  destroy() {
    this.vertexInserted.destroy();
    super.destroy();
  }
}

export default InsertVertexInteraction;
