import { LinearRing, type LineString, type Polygon } from 'ol/geom.js';
import type { Feature } from 'ol/index.js';
import AbstractInteraction, {
  EventAfterEventHandler,
} from '../../../interaction/abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
} from '../../../interaction/interactionType.js';
import { cartesian2DDistance } from '../../math.js';
import {
  createVertex,
  getOlcsPropsFromFeature,
  pointOnLine2D,
  pointOnLine3D,
  type Vertex,
} from '../editorHelpers.js';
import VcsEvent from '../../../vcsEvent.js';
import { is2DLayout } from '../../geometryHelpers.js';
import { isClampedHeightReference } from '../../featureconverter/vectorHeightInfo.js';
import VectorProperties from '../../../layer/vectorProperties.js';

export type VertexInsertedEvent = {
  vertex: Vertex;
  index: number;
};

class InsertVertexInteraction extends AbstractInteraction {
  vertexInserted = new VcsEvent<VertexInsertedEvent>();

  private _feature: Feature<LineString | Polygon>;

  private _geometry: LineString | LinearRing;

  private _isLinearRing: boolean;

  private _vectorProperties: VectorProperties;

  /**
   * @param  feature
   * @param  geometry
   */
  constructor(
    feature: Feature<LineString | Polygon>,
    geometry: LineString | LinearRing,
    vectorProperties: VectorProperties,
  ) {
    super(EventType.CLICK, ModificationKeyType.NONE);

    this._feature = feature;
    this._geometry = geometry;
    this._vectorProperties = vectorProperties;
    this._isLinearRing = this._geometry instanceof LinearRing;
    this.setActive();
  }

  pipe(event: EventAfterEventHandler): Promise<EventAfterEventHandler> {
    if (event.feature === this._feature) {
      const lineCoords = this._geometry.getCoordinates();
      const coordinate = event.positionOrPixel;
      const closestCoord = this._geometry.getClosestPoint(coordinate);

      if (this._isLinearRing) {
        lineCoords.push(lineCoords[0]);
      }
      const distance = cartesian2DDistance(closestCoord, coordinate); // todo respect altitude mode here. e.g. distance3D
      const is2DLine =
        is2DLayout(this._geometry.getLayout()) ||
        isClampedHeightReference(
          this._vectorProperties.getAltitudeMode(this._feature),
        );

      // XXX how to handle relative to ground height references?
      if (distance < event.map.getCurrentResolution(coordinate) * 5) {
        const length = lineCoords.length - 1;
        let i = 0;
        for (i; i < length; i++) {
          const onLine = is2DLine
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
          vertex: createVertex(
            closestCoord,
            getOlcsPropsFromFeature(this._feature),
          ),
          index,
        });
      }
    }
    return Promise.resolve(event);
  }

  destroy(): void {
    this.vertexInserted.destroy();
    super.destroy();
  }
}

export default InsertVertexInteraction;
