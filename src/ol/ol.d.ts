/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/consistent-type-imports */
/**
 * Type overrides for types extended by the @vcmap/core API
 */
import type CanvasImmediateRenderer from 'ol/render/canvas/Immediate.js';
import type { Billboard, Color, Entity, Label } from '@vcmap-cesium/engine';
import type { StyleLike } from 'ol/style/Style.js';
import type { vectorStyleSymbol } from '../style/vectorStyleItem.js';
import type VectorStyleItem from '../style/vectorStyleItem.js';
import type { ArcStruct, featureArcStruct } from '../style/arcStyle.js';
import type {
  actuallyIsCircle,
  alreadyTransformedToImage,
  alreadyTransformedToMercator,
  createSync,
  doNotTransform,
  obliqueGeometry,
  originalFeatureSymbol,
  primitives,
} from '../layer/vectorSymbols.js';
import type { vcsLayerName } from '../layer/layerSymbols.js';
import type {
  isProvidedFeature,
  isProvidedClusterFeature,
} from '../featureProvider/featureProviderSymbols.js';
import type {
  globalHidden,
  hidden,
  highlighted,
  originalStyle,
} from '../layer/featureVisibility.js';
import type {
  FeatureStoreLayerState,
  featureStoreStateSymbol,
} from '../layer/featureStoreLayerState.js';
import type { isTiledFeature } from '../layer/featureStoreLayer.js';
import type { featureFromOptions } from '../layer/geojsonLayer.js';
import type {
  handlerSymbol,
  vertexSymbol,
} from '../util/editor/editorSymbols.js';
import type { AxisAndPlanes } from '../util/editor/transformation/transformationTypes.js';
import type {
  fvLastUpdated,
  globalHiderLastUpdated,
} from '../layer/vectorHelpers.js';
import type { validityPlaceholder } from '../util/editor/interactions/createPolygonInteraction.js';
import type { vectorClusterGroupName } from '../vectorCluster/vectorClusterSymbols.js';
import type { PrimitiveType } from '../util/featureconverter/convert.js';

declare module 'ol/geom.js' {
  interface Geometry {
    getCoordinates(): any;
    setCoordinates(
      coordinates: any,
      layout?: import('ol/geom/Geometry.js').GeometryLayout,
    ): void;
    getFlatCoordinates(): number[];
    getStride(): number;
    getLayout(): import('ol/geom/Geometry.js').GeometryLayout;
    [alreadyTransformedToMercator]?: boolean;
    [actuallyIsCircle]?: boolean;
    [alreadyTransformedToImage]?: boolean;
  }

  interface GeometryCollection {
    getCoordinates(): Array<
      | import('ol/coordinate.js').Coordinate
      | Array<import('ol/coordinate.js').Coordinate>
      | Array<Array<import('ol/coordinate.js').Coordinate>>
      | Array<Array<Array<import('ol/coordinate.js').Coordinate>>>
    >;
    setCoordinates(
      coordinates: Array<
        | import('ol/coordinate.js').Coordinate
        | Array<import('ol/coordinate.js').Coordinate>
        | Array<Array<import('ol/coordinate.js').Coordinate>>
        | Array<Array<Array<import('ol/coordinate.js').Coordinate>>>
      >,
      layout?: import('ol/geom/Geometry.js').GeometryLayout,
    ): void;
    getLayout(): import('ol/geom/Geometry.js').GeometryLayout;
  }

  interface Circle {
    getCoordinates(): import('ol/coordinate.js').Coordinate[];
    setCoordinates(
      coordinates: import('ol/coordinate.js').Coordinate[],
      layout?: import('ol/geom/Geometry.js').GeometryLayout,
    ): void;
    rotate(angle: number, anchor: import('ol/coordinate.js').Coordinate): void;
  }

  interface Polygon {
    [validityPlaceholder]?: boolean;
  }
}

declare module 'ol/index.js' {
  interface Feature<Geometry> {
    getProperty(key: string): any;
    getPropertyInherited(key: string): any;
    getAttributes(): Record<string, unknown>;
    [vcsLayerName]?: string;
    [originalFeatureSymbol]?: Feature<Geometry>;
    [vectorStyleSymbol]?: VectorStyleItem;
    [featureArcStruct]?: ArcStruct;
    [isProvidedFeature]?: boolean;
    [isProvidedClusterFeature]?: boolean;
    [globalHidden]?: boolean;
    [hidden]?: boolean;
    [highlighted]?: VectorStyleItem;
    [originalStyle]?: StyleLike | Color;
    [featureStoreStateSymbol]?: FeatureStoreLayerState;
    [isTiledFeature]?: boolean;
    [featureFromOptions]?: boolean;
    [obliqueGeometry]?: Geometry;
    [doNotTransform]?: boolean;
    [handlerSymbol]?: AxisAndPlanes;
    [vertexSymbol]?: boolean;
    [createSync]?: boolean;
    [vectorClusterGroupName]?: string;
    [primitives]?: (PrimitiveType | Label | Billboard | Entity)[];
  }

  class CanvasTileRenderer extends CanvasImmediateRenderer {
    constructor(
      context: CanvasRenderingContext2D,
      pixelRation: number,
      extent: import('ol/extent.js').Extent,
      transform: import('ol/transform.js').Transform,
      viewRotation: number,
      squaredTolerance?: number,
      userTransform?: import('ol/proj.js').TransformFunction,
      scaleY?: number,
    );
    drawCircle(geometry: import('ol/geom/Circle.js').default): void;
  }
}

declare module 'ol/style.js' {
  interface Fill {
    fallBackColor:
      | import('ol/colorlike.js').ColorLike
      | import('ol/color.js').Color;
  }
}

declare module 'ol/layer.js' {
  interface Layer {
    [vcsLayerName]: string;
    [vectorClusterGroupName]?: string;
  }
}

declare module 'ol/source.js' {
  interface Vector {
    [fvLastUpdated]?: number;
    [globalHiderLastUpdated]?: number;
  }
}
