import { LineString, Polygon } from 'ol/geom.js';
import { Coordinate } from 'ol/coordinate.js';
import { unByKey } from 'ol/Observable.js';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
} from '../../../interaction/interactionType.js';
import {
  getSnappedCoordinateForResults,
  getAngleSnapResult,
  setSnappingFeatures,
  SnapResult,
  getGeometrySnapResult,
  SnapType,
  snapTypes,
} from '../snappingHelpers.js';
import { getCartesianBearing } from '../../math.js';
import type VectorLayer from '../../../layer/vectorLayer.js';
import { validityPlaceholder } from './createPolygonInteraction.js';
import {
  alreadySnapped,
  SnappingInteractionEvent,
} from '../editorSessionHelpers.js';

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

  private _snappingGeometry: LineString | undefined;

  private _snapToVertex = true;

  private _snapToEdge = true;

  private _snapOrthogonal = true;

  private _snapParallel = true;

  constructor(scratchLayer: VectorLayer, snapTo: SnapType[] = [...snapTypes]) {
    super(
      EventType.CLICKMOVE | EventType.DBLCLICK,
      ModificationKeyType.NONE | ModificationKeyType.CTRL,
    );

    this._scratchLayer = scratchLayer;
    this.snapTo = snapTo;
  }

  get snapTo(): SnapType[] {
    const snapTo: SnapType[] = [];
    if (this._snapToVertex) {
      snapTo.push('vertex');
    }

    if (this._snapToEdge) {
      snapTo.push('edge');
    }

    if (this._snapOrthogonal) {
      snapTo.push('orthogonal');
    }

    if (this._snapParallel) {
      snapTo.push('parallel');
    }

    return snapTo;
  }

  set snapTo(snapTo: SnapType[]) {
    this._snapToVertex = snapTo.includes('vertex');
    this._snapToEdge = snapTo.includes('edge');
    this._snapOrthogonal = snapTo.includes('orthogonal');
    this._snapParallel = snapTo.includes('parallel');
  }

  private _setCoordinates(coordinates: Coordinate[]): void {
    this._coordinates = coordinates;
    this._bearings = getBearings(this._coordinates);
    if (this._coordinates.length > 2) {
      this._snappingGeometry = new LineString(
        this._coordinates.slice(0, this._coordinates.length - 1),
      );
    }
  }

  setGeometry(geometry: LineString | Polygon): void {
    this._geometryLister?.();
    this._snappingGeometry = undefined;
    let setCoordinates: () => void;
    if (geometry instanceof Polygon) {
      this._isPolygon = true;
      setCoordinates = (): void => {
        if (!geometry[validityPlaceholder]) {
          this._setCoordinates(geometry.getCoordinates()[0]);
        }
      };
    } else {
      this._isPolygon = false;
      setCoordinates = (): void => {
        this._setCoordinates(geometry.getCoordinates());
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

  pipe(event: SnappingInteractionEvent): Promise<SnappingInteractionEvent> {
    this._removeFeatures?.();
    if (event.type === EventType.CLICK) {
      event.chainEnded?.addEventListener(() => {
        this._coordinatesDirty = true;
      });
    }
    if (
      !event[alreadySnapped] &&
      event.key !== ModificationKeyType.CTRL &&
      this._coordinates.length >= 3
    ) {
      const results = new Array<SnapResult | undefined>(2);
      const maxDistanceSquared =
        (event.map.getCurrentResolution(event.positionOrPixel!) * 12) ** 2;

      if (this._snappingGeometry) {
        results[0] = getGeometrySnapResult(
          [this._snappingGeometry],
          event.positionOrPixel!,
          maxDistanceSquared,
          this._snapToVertex,
          this._snapToEdge,
        );
      }

      if (!results[0] && (this._snapOrthogonal || this._snapParallel)) {
        results[0] = getAngleSnapResult(
          event.positionOrPixel!,
          this._coordinates.at(-2)!,
          this._coordinates.at(-3)!,
          this._bearings,
          this._coordinates.length - 2,
          maxDistanceSquared,
          this._snapOrthogonal,
          this._snapParallel,
        );

        if (this._isPolygon) {
          const newCandidate = results[0]?.snapped ?? event.positionOrPixel!;
          results[1] = getAngleSnapResult(
            newCandidate,
            this._coordinates.at(0)!,
            this._coordinates.at(1)!,
            this._bearings,
            0,
            maxDistanceSquared,
            this._snapOrthogonal,
            this._snapParallel,
          );
        }
      }

      const lastResult = getSnappedCoordinateForResults(
        results,
        this._coordinates,
        maxDistanceSquared,
      );

      if (lastResult) {
        if (event.positionOrPixel!.length > lastResult.length) {
          lastResult[2] = event.positionOrPixel![2];
        } else if (event.positionOrPixel!.length < lastResult.length) {
          lastResult.pop();
        }

        event.positionOrPixel = lastResult;

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
