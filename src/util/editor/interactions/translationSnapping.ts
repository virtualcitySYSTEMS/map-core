import { LineString, Polygon } from 'ol/geom.js';
import { Coordinate } from 'ol/coordinate.js';
import AbstractInteraction, {
  InteractionEvent,
} from '../../../interaction/abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
} from '../../../interaction/interactionType.js';
import type VectorLayer from '../../../layer/vectorLayer.js';
import { getCartesianBearing } from '../../math.js';
import {
  getSnappedCoordinateForResults,
  getSnapResultForSegment,
  setSnappingFeatures,
  SnapResult,
} from '../snappingHelpers.js';
import { vertexIndex, vertexSymbol } from '../editorSymbols.js';
import { Vertex } from '../editorHelpers.js';

function getBearings(coordinates: Coordinate[], isPolygon: boolean): number[] {
  const length = isPolygon ? coordinates.length : coordinates.length - 1;
  if (length > 0) {
    const bearings = new Array<number>(length);
    for (let i = 0; i < length; i++) {
      if (i === coordinates.length - 1) {
        bearings[i] = getCartesianBearing(coordinates[i], coordinates[0]);
      } else {
        bearings[i] = getCartesianBearing(coordinates[i], coordinates[i + 1]);
      }
    }
    return bearings;
  }

  return [];
}

export default class TranslationSnapping extends AbstractInteraction {
  private _coordinates: Coordinate[] = [];

  private _bearings: number[] = [];

  private _scratchLayer: VectorLayer;

  private _isPolygon = false;

  private _setCoordinates: () => void;

  private _removeFeatures: (() => void) | undefined;

  private _lastCoordinate: Coordinate | undefined;

  constructor(scratchLayer: VectorLayer, geometry: LineString | Polygon) {
    super(
      EventType.DRAGEVENTS,
      ModificationKeyType.NONE | ModificationKeyType.CTRL,
    );

    this._scratchLayer = scratchLayer;

    if (geometry instanceof Polygon) {
      this._isPolygon = true;
      this._setCoordinates = (): void => {
        this._coordinates = geometry.getCoordinates()[0];
        this._bearings = getBearings(this._coordinates, true);
      };
    } else {
      this._isPolygon = false;
      this._setCoordinates = (): void => {
        this._coordinates = geometry.getCoordinates();
        this._bearings = getBearings(this._coordinates, false);
      };
    }
  }

  pipe(event: InteractionEvent): Promise<InteractionEvent> {
    this._removeFeatures?.();
    if (event.type === EventType.DRAGEND && this._lastCoordinate) {
      event.positionOrPixel = this._lastCoordinate;
      this._lastCoordinate = undefined;
    } else if (
      event.key !== ModificationKeyType.CTRL &&
      (event.feature as Vertex | undefined)?.[vertexSymbol]
    ) {
      if (event.type === EventType.DRAGSTART) {
        this._setCoordinates?.();
      }
      const index = (event.feature as Vertex)[vertexIndex];
      const results = new Array<SnapResult | undefined>(2);
      const coordinate = event.positionOrPixel!;

      const bearings = this._bearings.map((b, i) => {
        if (i === index || i === index - 1) {
          return -1;
        }
        if (this._isPolygon && index === 0 && i === this._bearings.length - 1) {
          return -1;
        }
        return b;
      });

      if (index > 1) {
        results[0] = getSnapResultForSegment(
          coordinate,
          this._coordinates[index - 1],
          this._coordinates[index - 2],
          bearings,
          index - 1,
          event.map,
        );
      } else if (this._isPolygon) {
        if (index === 1) {
          results[0] = getSnapResultForSegment(
            coordinate,
            this._coordinates[index - 1],
            this._coordinates.at(-1)!,
            bearings,
            index - 1,
            event.map,
          );
        } else {
          results[0] = getSnapResultForSegment(
            coordinate,
            this._coordinates.at(-1)!,
            this._coordinates.at(-2)!,
            bearings,
            this._coordinates.length - 1,
            event.map,
          );
        }
      }

      if (this._coordinates.length > 2) {
        const candidate = results[0]?.snapped ?? coordinate;
        if (index < this._coordinates.length - 2) {
          // snap to following segment
          results[1] = getSnapResultForSegment(
            candidate,
            this._coordinates[index + 1],
            this._coordinates[index + 2],
            bearings,
            index + 1,
            event.map,
          );
        } else if (this._isPolygon) {
          if (index === this._coordinates.length - 1) {
            // snap to first segment
            results[1] = getSnapResultForSegment(
              candidate,
              this._coordinates[0],
              this._coordinates[1],
              bearings,
              0,
              event.map,
            );
          } else {
            // we need to wrap around: snap to _last segment
            results[1] = getSnapResultForSegment(
              candidate,
              this._coordinates.at(-1)!,
              this._coordinates[0],
              bearings,
              this._coordinates.length - 1,
              event.map,
            );
          }
        }
      }

      const lastResult = getSnappedCoordinateForResults(
        results,
        this._coordinates,
      );
      if (lastResult) {
        if (event.positionOrPixel?.length === 2) {
          event.positionOrPixel = [lastResult[0], lastResult[1]];
        } else {
          event.positionOrPixel = lastResult;
        }

        this._removeFeatures = setSnappingFeatures(
          results,
          this._coordinates,
          this._scratchLayer,
        );
        this._lastCoordinate = event.positionOrPixel;
      } else {
        this._lastCoordinate = undefined;
      }
    }

    return Promise.resolve(event);
  }

  destroy(): void {
    this._removeFeatures?.();
    super.destroy();
  }
}
