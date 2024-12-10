/**
 * Type overrides for types extended by the @vcmap/core API
 */
import * as geom from 'ol/geom.js';
import * as style from 'ol/style.js';

import { Feature } from 'ol/index.js';
import CanvasImmediateRenderer from 'ol/render/canvas/Immediate.js';
import { Color } from '@vcmap-cesium/engine';
import { StyleLike } from 'ol/style/Style.js';
import VectorStyleItem, {
  vectorStyleSymbol,
} from '../style/vectorStyleItem.js';
import { ArcStruct, featureArcStruct } from '../style/arcStyle.js';
import {
  actuallyIsCircle,
  alreadyTransformedToImage,
  alreadyTransformedToMercator,
  createSync,
  doNotTransform,
  obliqueGeometry,
  originalFeatureSymbol,
} from '../layer/vectorSymbols.js';
import { vcsLayerName } from '../layer/layerSymbols.js';
import { isProvidedFeature } from '../featureProvider/featureProviderSymbols.js';
import {
  globalHidden,
  hidden,
  highlighted,
  originalStyle,
} from '../layer/featureVisibility.js';
import {
  FeatureStoreLayerState,
  featureStoreStateSymbol,
} from '../layer/featureStoreLayerState.js';
import { isTiledFeature } from '../layer/featureStoreLayer.js';
import { featureFromOptions } from '../layer/geojsonLayer.js';
import { handlerSymbol, vertexSymbol } from '../util/editor/editorSymbols.js';
import { AxisAndPlanes } from '../util/editor/transformation/transformationTypes.js';
import {
  fvLastUpdated,
  globalHiderLastUpdated,
} from '../layer/vectorHelpers.js';
import { validityPlaceholder } from '../util/editor/interactions/createPolygonInteraction.js';
import { vectorClusterGroupName } from '../vectorCluster/vectorClusterSymbols.js';

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
