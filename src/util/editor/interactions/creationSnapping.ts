import { LineString, Polygon } from 'ol/geom.js';
import { Coordinate } from 'ol/coordinate.js';
import { unByKey } from 'ol/Observable.js';
import AbstractInteraction, {
  InteractionEvent,
} from '../../../interaction/abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
} from '../../../interaction/interactionType.js';
import {
  getSnappedCoordinateForResults,
  getSnapResultForSegment,
  setSnappingFeatures,
  SnapResult,
} from '../snappingHelpers.js';
import { getCartesianBearing } from '../../math.js';
import type VectorLayer from '../../../layer/vectorLayer.js';
import { validityPlaceholder } from './createPolygonInteraction.js';

function getBearings(coordinates: Coordinate[]): number[] {
  // we dont want to take into account the last bearing, since that would be our own
  const length = coordinates.length - 2;
  if (length > 0) {
    const bearings = new Array<number>(length);
    for (let i = 0; i < length; i++) {
      bearings[i] = getCartesianBearing(coordinates[i], coordinates[i + 1]);
    }
    return bearings;
  }

  return [];
}

export default class CreationSnapping extends AbstractInteraction {
  private _coordinates: Coordinate[] = [];

  private _bearings: number[] = [];

  private _scratchLayer: VectorLayer;

  private _isPolygon = false;

  private _coordinatesDirty = false;

  private _geometryLister: (() => void) | undefined;

  private _removeFeatures: (() => void) | undefined;

  constructor(scratchLayer: VectorLayer) {
    super(
      EventType.CLICKMOVE | EventType.DBLCLICK,
      ModificationKeyType.NONE | ModificationKeyType.CTRL,
    );

    this._scratchLayer = scratchLayer;
  }

  setGeometry(geometry: LineString | Polygon): void {
    this._geometryLister?.();
    let setCoordinates: () => void;
    if (geometry instanceof Polygon) {
      this._isPolygon = true;
      setCoordinates = (): void => {
        if (!geometry[validityPlaceholder]) {
          this._coordinates = geometry.getCoordinates()[0];
          this._bearings = getBearings(this._coordinates);
        }
      };
    } else {
      this._isPolygon = false;
      setCoordinates = (): void => {
        this._coordinates = geometry.getCoordinates();
        this._bearings = getBearings(this._coordinates);
      };
    }
    setCoordinates();
    const key = geometry.on('change', () => {
      if (this._coordinatesDirty) {
        setCoordinates();
        this._coordinatesDirty = false;
      }
    });
    this._geometryLister = (): void => {
      unByKey(key);
    };
  }

  pipe(event: InteractionEvent): Promise<InteractionEvent> {
    this._removeFeatures?.();
    if (event.type === EventType.CLICK) {
      event.chainEnded?.addEventListener(() => {
        this._coordinatesDirty = true;
      });
    }
    if (
      event.key !== ModificationKeyType.CTRL &&
      this._coordinates.length >= 3
    ) {
      const results = new Array<SnapResult | undefined>(2);
      results[0] = getSnapResultForSegment(
        event.positionOrPixel!,
        this._coordinates.at(-2)!,
        this._coordinates.at(-3)!,
        this._bearings,
        this._coordinates.length - 2,
        event.map,
      );

      if (this._isPolygon) {
        const newCandidate = results[0]?.snapped ?? event.positionOrPixel!;
        results[1] = getSnapResultForSegment(
          newCandidate,
          this._coordinates.at(0)!,
          this._coordinates.at(1)!,
          this._bearings,
          0,
          event.map,
        );
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
      }
    }

    return Promise.resolve(event);
  }

  destroy(): void {
    this._geometryLister?.();
    this._removeFeatures?.();
    super.destroy();
  }
}
