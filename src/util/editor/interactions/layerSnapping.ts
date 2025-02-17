import { Feature } from 'ol';
import VectorSource from 'ol/source/Vector.js';
import AbstractInteraction from '../../../interaction/abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
} from '../../../interaction/interactionType.js';
import VectorLayer from '../../../layer/vectorLayer.js';
import { originalFeatureSymbol } from '../../../layer/vectorSymbols.js';
import ObliqueMap from '../../../map/obliqueMap.js';
import type VectorObliqueImpl from '../../../layer/oblique/vectorObliqueImpl.js';
import {
  alreadySnapped,
  SnappingInteractionEvent,
} from '../editorSessionHelpers.js';
import {
  setSnappingFeatures,
  getGeometrySnapResult,
  SnapType,
} from '../snappingHelpers.js';

export default class LayerSnapping extends AbstractInteraction {
  private _removeFeatures: (() => void) | undefined;

  private _filter: (f: Feature) => boolean;

  private _snapToVertex = true;

  private _snapToEdge = true;

  constructor(
    public layers: VectorLayer[],
    private _scratchLayer: VectorLayer,
    filter: (f: Feature) => boolean,
    snapTo: SnapType[] = ['vertex', 'edge'],
    type: EventType = EventType.CLICKMOVE | EventType.DBLCLICK,
  ) {
    super(type, ModificationKeyType.NONE | ModificationKeyType.CTRL);

    this._filter = filter;
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

    return snapTo;
  }

  set snapTo(snapTo: SnapType[]) {
    this._snapToVertex = snapTo.includes('vertex');
    this._snapToEdge = snapTo.includes('edge');
  }

  pipe(event: SnappingInteractionEvent): Promise<SnappingInteractionEvent> {
    this._removeFeatures?.();
    if (event.key !== ModificationKeyType.CTRL) {
      const coordinate = event.positionOrPixel!;
      const bufferDistance = event.map.getCurrentResolution(coordinate) * 12;
      const maxDistanceSquared = bufferDistance ** 2;

      const isOblique = event.map instanceof ObliqueMap;

      const geometries = this.layers
        .flatMap((layer) => {
          let source: VectorSource;

          if (isOblique) {
            source = (
              layer.getImplementationsForMap(event.map)[0] as VectorObliqueImpl
            )
              .getOLLayer()
              .getSource() as VectorSource;
          } else {
            source = layer.getSource();
          }

          return source.getFeaturesInExtent([
            coordinate[0] - bufferDistance,
            coordinate[1] - bufferDistance,
            coordinate[0] + bufferDistance,
            coordinate[1] + bufferDistance,
          ]);
        })
        .filter((feature) => {
          const originalFeature = feature[originalFeatureSymbol] ?? feature;
          return this._filter(originalFeature);
        })
        .map((f) => f.getGeometry()!);

      const result = getGeometrySnapResult(
        geometries,
        coordinate,
        maxDistanceSquared,
        this._snapToVertex,
        this._snapToEdge,
        this._scratchLayer.vectorProperties.altitudeMode,
      );

      if (result) {
        const closest = result.snapped;
        if (coordinate.length > closest.length) {
          closest[2] = coordinate[2];
        } else if (coordinate.length < closest.length) {
          closest.pop();
        }
        event.positionOrPixel = closest;
        event[alreadySnapped] = true;
        this._removeFeatures = setSnappingFeatures(
          [result],
          [result.snapped],
          this._scratchLayer,
        );
      }
    }
    return Promise.resolve(event);
  }

  destroy(): void {
    this._removeFeatures?.();
    this.layers = [];
    super.destroy();
  }
}
