/**
 * Type overrides for types extended by the @vcmap/core API
 */
// eslint-disable-next-line max-classes-per-file
import {
  Cartesian2,
  Cartesian3,
  Cartesian4,
  Color,
} from '@vcmap-cesium/engine';
import { StyleLike } from 'ol/style/Style.js';
import VectorStyleItem from '../style/vectorStyleItem.js';
import { scaleSymbol } from '../layer/cesium/vectorContext.js';
import { vcsLayerName } from '../layer/layerSymbols.js';
import {
  globalHidden,
  hidden,
  highlighted,
  originalStyle,
} from '../layer/featureVisibility.js';
import { handlerSymbol } from '../util/editor/editorSymbols.js';
import { AxisAndPlanes } from '../util/editor/transformation/transformationTypes.js';
import { cesiumTilesetLastUpdated } from '../layer/cesium/cesiumTilesetCesiumImpl.js';
import { isTiledFeature } from '../layer/featureStoreLayer.js';

declare module '@vcmap-cesium/engine' {
  interface Scene {
    render(): void;
    frameState: FrameState;
    context: Context;
  }

  interface TileBoundingVolume {
    boundingVolume?: object;
    boundingSphere?: BoundingSphere;
    rectangle?: Rectangle;
    distanceToCamera(frameState: object): number;
    intersectPlane(plane: Plane): Intersect;
  }

  interface Entity {
    allowPicking?: boolean;
    attributes?: Record<string, unknown>;
    olFeature?: import('ol').Feature<import('ol/geom.js').Geometry>;
    getId(): number | string;
    getProperty(key: string): any;
    getPropertyInherited(key: string): any;
    [vcsLayerName]?: string;
    [globalHidden]?: boolean;
    [hidden]?: boolean;
    [highlighted]?: VectorStyleItem;
    [originalStyle]?: StyleLike | Color;
  }

  interface Primitive {
    olFeature?: import('ol').Feature<import('ol/geom.js').Geometry>;
    [handlerSymbol]?: AxisAndPlanes;
  }

  interface Model {
    olFeature?: import('ol').Feature<import('ol/geom.js').Geometry>;
    [scaleSymbol]?: number;
  }

  interface GroundPrimitive {
    olFeature?: import('ol').Feature<import('ol/geom.js').Geometry>;
  }

  interface GroundPolylinePrimitive {
    olFeature?: import('ol').Feature<import('ol/geom.js').Geometry>;
  }

  interface ClassificationPrimitive {
    olFeature?: import('ol').Feature<import('ol/geom.js').Geometry>;
  }

  interface Label {
    olFeature?: import('ol').Feature<import('ol/geom.js').Geometry>;
  }

  interface Billboard {
    olFeature?: import('ol').Feature<import('ol/geom.js').Geometry>;
  }

  interface ImageryProvider {
    _reload?(): void;
  }

  interface PrimitiveCollection {
    VCMLayerIndex?: number;
    [vcsLayerName]?: string;
  }

  interface CustomDataSource {
    [vcsLayerName]?: string;
  }

  interface CzmlDataSource {
    [vcsLayerName]?: string;
  }

  interface DataSource {
    [vcsLayerName]?: string;
  }

  interface ImageryLayer {
    VCMLayerIndex?: number;
    [vcsLayerName]?: string;
  }

  interface TerrainProvider {
    [vcsLayerName]?: string;
  }

  interface Cesium3DTile {
    boundingVolume: TileBoundingVolume;
    contentReady: boolean;
    [cesiumTilesetLastUpdated]?: number;
  }

  interface Cesium3DTileContent {
    readonly batchTable: Cesium3DTileBatchTable;
    isDestroyed(): boolean;
    [cesiumTilesetLastUpdated]?: number;
  }

  interface Cesium3DTileset {
    clippingPlanesOriginMatrix: Matrix4;
    [vcsLayerName]: string;
    [isTiledFeature]?: boolean;
  }

  interface CesiumTerrainProvider {
    [vcsLayerName]?: string;
  }

  interface DataSourceDisplay {
    getBoundingSphere(
      entity: Entity,
      allowPartial: boolean,
      result: BoundingSphere,
    ): BoundingSphereState;
  }

  interface Cesium3DTileFeature {
    content: Cesium3DTileContent;
    _batchId: number;
    getId(): number | string;
    [vcsLayerName]?: string;
    [globalHidden]?: boolean;
    [hidden]?: boolean;
    [highlighted]?: VectorStyleItem;
    [originalStyle]?: StyleLike | Color;
    [isTiledFeature]?: boolean;
  }

  interface Cesium3DTilePointFeature {
    content: Cesium3DTileContent;
    _batchId: number;
    getId(): number | string;
    [vcsLayerName]?: string;
    [globalHidden]?: boolean;
    [hidden]?: boolean;
    [highlighted]?: VectorStyleItem;
    [originalStyle]?: StyleLike | Color;
  }

  interface Cesium3DTileStyle {
    strokeColor: StyleExpression;
    strokeWidth: StyleExpression;
    scale: StyleExpression;
  }

  interface StyleExpression {
    evaluate<
      T extends
        | boolean
        | number
        | string
        | RegExp
        | Cartesian2
        | Cartesian3
        | Cartesian4
        | Color = string,
    >(
      feature:
        | Cesium3DTileFeature
        | import('ol/Feature.js').default<
            import('ol/geom/Geometry.js').default
          >,
      result?: any,
    ): T | undefined;
    evaluateColor(
      feature:
        | Cesium3DTileFeature
        | import('ol/Feature.js').default<
            import('ol/geom/Geometry.js').default
          >,
      result?: Color,
    ): Color;
  }

  interface Expression {
    evaluate(
      feature:
        | Cesium3DTileFeature
        | import('ol/Feature.js').default<
            import('ol/geom/Geometry.js').default
          >,
      result?: any,
    ): any;
    evaluateColor(
      feature:
        | Cesium3DTileFeature
        | import('ol/Feature.js').default<
            import('ol/geom/Geometry.js').default
          >,
      result?: Color,
    ): Color;
  }

  interface ShadowMap {
    viewshed?: {
      shadowColor?: Color;
      visibleColor?: Color;
      distance?: number;
    };
  }

  interface ScreenSpaceEventHandler {
    _positions: Cartesian2[];
  }

  export class Cesium3DTileBatchTable {
    isDestroyed(): boolean;
  }

  class Context {
    fragmentDepth: boolean;
  }

  class FrameState {
    context: Context;

    creditDisplay: CreditDisplay;

    frameNumber: number;
  }

  export namespace PolygonPipeline {
    function triangulate(positions: Cartesian2[], holes?: number[]): number[];
  }
}
