import { LineString, MultiLineString, Polygon } from 'ol/geom.js';
import type { Coordinate } from 'ol/coordinate.js';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
} from '../../../interaction/interactionType.js';
import type VectorLayer from '../../../layer/vectorLayer.js';
import { getCartesianBearing } from '../../math.js';
import type { SnapResult, SnapType } from '../snappingHelpers.js';
import {
  getSnappedCoordinateForResults,
  getAngleSnapResult,
  setSnappingFeatures,
  getGeometrySnapResult,
  snapTypes,
} from '../snappingHelpers.js';
import { vertexIndexSymbol } from '../editorSymbols.js';
import { isVertex } from '../editorHelpers.js';
import type { SnappingInteractionEvent } from '../editorSessionHelpers.js';
import { alreadySnapped } from '../editorSessionHelpers.js';
import PanoramaMap from '../../../map/panoramaMap.js';

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

  private _getCoordinates: () => Coordinate[];

  private _removeFeatures: (() => void) | undefined;

  private _lastCoordinate: Coordinate | undefined;

  private _snappingGeometry: LineString | MultiLineString | undefined;

  private _snapToVertex = true;

  private _snapToEdge = true;

  private _snapOrthogonal = true;

  private _snapParallel = true;

  constructor(
    scratchLayer: VectorLayer,
    geometry: LineString | Polygon,
    snapTo: SnapType[] = [...snapTypes],
  ) {
    super(
      EventType.DRAGEVENTS,
      ModificationKeyType.NONE | ModificationKeyType.CTRL,
    );

    this._scratchLayer = scratchLayer;

    if (geometry instanceof Polygon) {
      this._isPolygon = true;
      this._getCoordinates = (): Coordinate[] => geometry.getCoordinates()[0];
    } else {
      this._isPolygon = false;
      this._getCoordinates = (): Coordinate[] => geometry.getCoordinates();
    }

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

  private _setCoordinates(vertexIndex: number): void {
    this._coordinates = this._getCoordinates();
    this._bearings = getBearings(this._coordinates, this._isPolygon);
    if (this._coordinates.length > 2) {
      if (this._isPolygon) {
        const lineCoordinates = [
          ...this._coordinates.slice(0, vertexIndex),
          ...this._coordinates.slice(vertexIndex + 1),
        ];
        lineCoordinates.push(lineCoordinates[0]);
        this._snappingGeometry = new LineString(lineCoordinates);
      } else {
        this._snappingGeometry = new MultiLineString([
          this._coordinates.slice(0, vertexIndex),
          this._coordinates.slice(vertexIndex + 1),
        ]);
      }
    }
  }

  pipe(event: SnappingInteractionEvent): Promise<SnappingInteractionEvent> {
    this._removeFeatures?.();
    if (event[alreadySnapped]) {
      this._lastCoordinate = undefined;
      this._snappingGeometry = undefined;
      return Promise.resolve(event);
    }

    const ctrlKey = event.key === ModificationKeyType.CTRL;
    const useSnapping =
      event.map.className === PanoramaMap.className ? ctrlKey : !ctrlKey;

    if (event.type === EventType.DRAGEND && this._lastCoordinate) {
      event.positionOrPixel = this._lastCoordinate;
      this._lastCoordinate = undefined;
    } else if (useSnapping && isVertex(event.feature)) {
      const index = event.feature[vertexIndexSymbol];
      if (event.type === EventType.DRAGSTART) {
        this._setCoordinates(index);
      }
      const results = new Array<SnapResult | undefined>(2);
      const maxDistanceSquared =
        (event.map.getCurrentResolution(event.positionOrPixel!) * 12) ** 2;
      const coordinate = event.positionOrPixel!;

      if (this._snappingGeometry) {
        results[0] = getGeometrySnapResult(
          [this._snappingGeometry],
          event.positionOrPixel!,
          maxDistanceSquared,
          this._snapToVertex,
          this._snapToEdge,
          this._scratchLayer.vectorProperties.altitudeMode,
        );
      }

      if (!results[0] && (this._snapOrthogonal || this._snapParallel)) {
        const bearings = this._bearings.map((b, i) => {
          if (i === index || i === index - 1) {
            return -1;
          }
          if (
            this._isPolygon &&
            index === 0 &&
            i === this._bearings.length - 1
          ) {
            return -1;
          }
          return b;
        });

        if (index > 1) {
          results[0] = getAngleSnapResult(
            coordinate,
            this._coordinates[index - 1],
            this._coordinates[index - 2],
            bearings,
            index - 1,
            maxDistanceSquared,
            this._snapOrthogonal,
            this._snapParallel,
            this._scratchLayer.vectorProperties.altitudeMode,
          );
        } else if (this._isPolygon) {
          if (index === 1) {
            results[0] = getAngleSnapResult(
              coordinate,
              this._coordinates[index - 1],
              this._coordinates.at(-1)!,
              bearings,
              index - 1,
              maxDistanceSquared,
              this._snapOrthogonal,
              this._snapParallel,
              this._scratchLayer.vectorProperties.altitudeMode,
            );
          } else {
            results[0] = getAngleSnapResult(
              coordinate,
              this._coordinates.at(-1)!,
              this._coordinates.at(-2)!,
              bearings,
              this._coordinates.length - 1,
              maxDistanceSquared,
              this._snapOrthogonal,
              this._snapParallel,
              this._scratchLayer.vectorProperties.altitudeMode,
            );
          }
        }

        if (this._coordinates.length > 2) {
          const candidate = results[0]?.snapped ?? coordinate;
          if (index < this._coordinates.length - 2) {
            // snap to following segment
            results[1] = getAngleSnapResult(
              candidate,
              this._coordinates[index + 1],
              this._coordinates[index + 2],
              bearings,
              index + 1,
              maxDistanceSquared,
              this._snapOrthogonal,
              this._snapParallel,
            );
          } else if (this._isPolygon) {
            if (index === this._coordinates.length - 1) {
              // snap to first segment
              results[1] = getAngleSnapResult(
                candidate,
                this._coordinates[0],
                this._coordinates[1],
                bearings,
                0,
                maxDistanceSquared,
                this._snapOrthogonal,
                this._snapParallel,
              );
            } else {
              // we need to wrap around: snap to _last segment
              results[1] = getAngleSnapResult(
                candidate,
                this._coordinates.at(-1)!,
                this._coordinates[0],
                bearings,
                this._coordinates.length - 1,
                maxDistanceSquared,
                this._snapOrthogonal,
                this._snapParallel,
              );
            }
          }
        }
      }

      const lastResult = getSnappedCoordinateForResults(
        results,
        this._coordinates,
        maxDistanceSquared,
      );

      if (lastResult) {
        if (coordinate.length > lastResult.length) {
          lastResult[2] = event.positionOrPixel![2];
        } else if (coordinate.length < lastResult.length) {
          lastResult.pop();
        }

        event.positionOrPixel = lastResult;

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
