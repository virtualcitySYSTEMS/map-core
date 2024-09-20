import { Circle, LineString, Point, Polygon } from 'ol/geom.js';
import type { Coordinate } from 'ol/coordinate.js';
import { Style, Text as OLText } from 'ol/style.js';
import { Feature } from 'ol';
import { HeightReference } from '@vcmap-cesium/engine';
import AbstractInteraction, {
  InteractionEvent,
} from '../../../interaction/abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
} from '../../../interaction/interactionType.js';
import { isVertex } from '../editorHelpers.js';
import { vertexIndexSymbol } from '../editorSymbols.js';
import type VectorLayer from '../../../layer/vectorLayer.js';
import { is2DLayout } from '../../geometryHelpers.js';

import { ecef3DDistance, getMidPoint, spherical2Distance } from '../../math.js';
import { validityPlaceholder } from './createPolygonInteraction.js';
import { createSync } from '../../../layer/vectorSymbols.js';

type Segment = [Coordinate, Coordinate];

function getSegmentForCoordinateIndex(
  geometry: LineString | Polygon | Circle,
  index: number,
): Segment[] {
  if (geometry instanceof Circle) {
    return [geometry.getCoordinates() as Segment];
  }
  const flats = geometry.getFlatCoordinates();
  let end;
  let isPolygon = false;
  if (geometry instanceof Polygon) {
    isPolygon = true;
    end = geometry.getEnds()[0];
  } else {
    end = flats.length;
  }
  const stride = geometry.getStride();
  const layout = geometry.getLayout();

  if (flats.length < stride * 2) {
    return [];
  }

  let flatIndex = Math.round(index * stride);
  if (index === -1) {
    flatIndex = end - stride;
  }

  if (flats.length < flatIndex + stride) {
    return [];
  }

  const previousIndex = index === 0 ? stride : flatIndex - stride;
  let nextIndex;

  if (isPolygon && !(geometry as Polygon)[validityPlaceholder]) {
    if (flatIndex === 0) {
      nextIndex = end - stride;
    } else if (flatIndex + stride === end) {
      nextIndex = 0;
    } else {
      nextIndex = flatIndex + stride;
    }
  } else if (flatIndex > 0 && flatIndex + stride < end) {
    nextIndex = flatIndex + stride;
  }

  const getCoordinateFromIndex = is2DLayout(layout)
    ? (i: number): Coordinate => {
        return [flats[i], flats[i + 1]];
      }
    : (i: number): Coordinate => {
        return [flats[i], flats[i + 1], flats[i + 2]];
      };

  const segments: Segment[] = [
    [getCoordinateFromIndex(flatIndex), getCoordinateFromIndex(previousIndex)],
  ];

  if (nextIndex != null && flats.length >= nextIndex + stride) {
    segments.push([
      getCoordinateFromIndex(flatIndex),
      getCoordinateFromIndex(nextIndex),
    ]);
  }

  return segments;
}

function createSegmentsLabels(
  segments: Segment[],
  layer: VectorLayer,
  is3D: boolean,
): () => void {
  const features = segments.map((segment) => {
    const midPoint = getMidPoint(segment[0], segment[1]);
    const feature = new Feature({
      geometry: new Point(midPoint),
    });

    const segmentLength = is3D
      ? ecef3DDistance(segment[0], segment[1])
      : spherical2Distance(segment[0], segment[1]);

    feature.setStyle(
      new Style({
        text: new OLText({
          text: `${segmentLength.toFixed(2)} m`,
          font: '16px Helvetica, sans-serif',
        }),
      }),
    );
    feature[createSync] = true;

    return feature;
  });
  layer.addFeatures(features);

  return () => {
    layer.removeFeaturesById(features.map((f) => f.getId()!));
    features.splice(0);
  };
}

function createSegmentGeometry(
  segment: Segment,
  layer: VectorLayer,
): () => void {
  const feature = new Feature({
    geometry: new LineString(segment),
  });
  feature[createSync] = true;

  const features = [feature];
  layer.addFeatures(features);

  return () => {
    layer.removeFeaturesById(features.map((f) => f.getId()!));
    features.splice(0);
  };
}

export default class SegmentLengthInteraction extends AbstractInteraction {
  private _scratchLayer: VectorLayer;

  private _geometry: Polygon | LineString | Circle | undefined;

  private _isCircle = false;

  // eslint-disable-next-line class-methods-use-this
  private _removeLabels = (): void => {};

  // eslint-disable-next-line class-methods-use-this
  private _vectorPropertiesListener = (): void => {};

  private _is3D = false;

  creation: boolean;

  constructor(scratchLayer: VectorLayer, creation: boolean) {
    super(
      creation ? EventType.MOVE : EventType.DRAGEVENTS,
      ModificationKeyType.CTRL | ModificationKeyType.NONE,
    );

    this._scratchLayer = scratchLayer;
    this._is3D =
      scratchLayer.vectorProperties.altitudeMode === HeightReference.NONE;
    this._vectorPropertiesListener =
      scratchLayer.vectorProperties.propertyChanged.addEventListener(() => {
        this._is3D =
          scratchLayer.vectorProperties.altitudeMode === HeightReference.NONE;
      });

    this.creation = creation;
  }

  pipe(event: InteractionEvent): Promise<InteractionEvent> {
    this._removeLabels();

    if (this._geometry) {
      let index: number | undefined;
      if (this.creation) {
        index = -1;
      } else if (isVertex(event.feature)) {
        index = event.feature[vertexIndexSymbol];
      }

      if (index != null) {
        const segments = getSegmentForCoordinateIndex(this._geometry, index);
        let removeLabels = createSegmentsLabels(
          segments,
          this._scratchLayer,
          this._is3D,
        );
        if (this._isCircle) {
          const removeTextLabels = removeLabels;
          const removeSegment = createSegmentGeometry(
            segments[0],
            this._scratchLayer,
          );
          removeLabels = (): void => {
            removeTextLabels();
            removeSegment();
          };
        }
        this._removeLabels = removeLabels;
      }
    }

    return Promise.resolve(event);
  }

  setGeometry(geometry: LineString | Polygon | Circle): void {
    this._geometry = geometry;
    this._isCircle = geometry instanceof Circle;
  }

  destroy(): void {
    this._removeLabels();
    this._vectorPropertiesListener();
    super.destroy();
  }
}
