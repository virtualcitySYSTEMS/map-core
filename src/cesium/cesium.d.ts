/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/consistent-type-imports,@typescript-eslint/naming-convention */
/**
 * Type overrides for types extended by the @vcmap/core API
 */
// eslint-disable-next-line max-classes-per-file
import type { StyleLike } from 'ol/style/Style.js';
import type VectorStyleItem from '../style/vectorStyleItem.js';
import type { scaleSymbol } from '../layer/cesium/vectorContext.js';
import type { allowPicking, vcsLayerName } from '../layer/layerSymbols.js';
import type {
  globalHidden,
  hidden,
  highlighted,
  originalStyle,
} from '../layer/featureVisibility.js';
import type { handlerSymbol } from '../util/editor/editorSymbols.js';
import type { AxisAndPlanes } from '../util/editor/transformation/transformationTypes.js';
import type {
  cesiumTilesetLastUpdated,
  updateFeatureOverride,
} from '../layer/cesium/cesiumTilesetCesiumImpl.js';
import type { isTiledFeature } from '../layer/featureStoreLayer.js';
import type { vectorClusterGroupName } from '../vectorCluster/vectorClusterSymbols.js';

declare module '@vcmap-cesium/engine' {
  interface Scene {
    render(): void;
    frameState: FrameState;
    context: Context;
    updateHeight(
      cartographic: Cartographic,
      callback: (cartographic: Cartographic) => void,
      heightReference: HeightReference,
    ): () => void;
    getHeight(
      cartographic: Cartographic,
      heightReference: HeightReference,
    ): number | undefined;
    pickFromRay(
      ray: Ray,
      objectToExclude?: any[],
      width?: number,
    ): { object: any; position: Cartesian3; exclude?: boolean } | undefined;
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
    getAttributes(): Record<string, unknown>;
    [vcsLayerName]?: string;
    [vectorClusterGroupName]?: string;
    [globalHidden]?: boolean;
    [hidden]?: boolean;
    [highlighted]?: VectorStyleItem;
    [originalStyle]?: StyleLike | Color;
  }

  interface Primitive {
    olFeature?: import('ol').Feature<import('ol/geom.js').Geometry>;
    [handlerSymbol]?: AxisAndPlanes;
    [scaleSymbol]?: number;
  }

  interface Model {
    olFeature?: import('ol').Feature<import('ol/geom.js').Geometry>;
    allowPicking?: boolean;
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
    _primitive?: Primitive; // internal API used to create clamped primitives
    _primitiveOptions: ConstructorParameters<typeof Primitive>[0];
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
    [vectorClusterGroupName]?: string;
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
    [updateFeatureOverride]?: () => void;
  }

  interface Cesium3DTileset {
    clippingPlanesOriginMatrix: Matrix4;
    [vcsLayerName]: string;
    [isTiledFeature]?: boolean;
    [allowPicking]?: boolean;
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
    getAttributes(): Record<string, unknown>;
    [vcsLayerName]?: string;
    [globalHidden]?: boolean;
    [hidden]?: boolean;
    [highlighted]?: VectorStyleItem;
    [originalStyle]?: StyleLike | Color;
    [isTiledFeature]?: boolean;
    [allowPicking]?: boolean;
  }

  interface Cesium3DTilePointFeature {
    content: Cesium3DTileContent;
    _batchId: number;
    getId(): number | string;
    getAttributes(): Record<string, unknown>;
    [vcsLayerName]?: string;
    [globalHidden]?: boolean;
    [hidden]?: boolean;
    [highlighted]?: VectorStyleItem;
    [originalStyle]?: StyleLike | Color;
    [allowPicking]?: boolean;
  }

  interface Cesium3DTileStyle {
    strokeColor: StyleExpression;
    strokeWidth: StyleExpression;
    scale: StyleExpression;
  }

  interface StyleExpression {
    evaluate<
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
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

    passes: Record<string, unknown>;

    fog: Fog;

    cullingVolume: CullingVolume;

    camera: Camera;
  }

  export namespace PolygonPipeline {
    function triangulate(positions: Cartesian2[], holes?: number[]): number[];
  }

  enum QuadtreeTileLoadState {
    START = 0,
    LOADING = 1,
    DONE = 2,
    FAILED = 3,
  }

  class TileBoundingRegion {
    constructor(options: {
      rectangle: Rectangle;
      minimumHeight: number;
      maximumHeight: number;
      ellipsoid?: Ellipsoid;
      computeBoundingVolumes?: boolean;
    });

    distanceToCamera(frameState: FrameState): number;

    boundingVolume: OrientedBoundingBox;
  }

  class QuadtreeTile<T = any> {
    constructor(options: {
      level: number;
      x: number;
      y: number;
      tilingScheme: TilingScheme;
      parent?: QuadtreeTile<T>;
    });

    data: T | undefined;

    level: number;

    x: number;

    y: number;

    tilingScheme: TilingScheme;

    parent: QuadtreeTile<T> | undefined;

    rectangle: Rectangle;

    children: QuadtreeTile[];

    state: QuadtreeTileLoadState;

    renderable: boolean;

    _distance?: number;

    upsampledFromParent: boolean;
  }

  namespace QuadtreeTileProvider {
    function computeDefaultLevelZeroMaximumGeometricError(
      tilingScheme: TilingScheme,
    ): number;
  }

  interface QuadtreeTileProviderInterface {
    quadtree: QuadtreePrimitive | undefined;
    readonly tilingScheme: TilingScheme;
    readonly errorEvent: Event;
    initialize(frameState: FrameState): void;
    update(frameState: FrameState): void;
    beginUpdate(frameState: FrameState, drawCommands: unknown[]): void;
    endUpdate(frameState: FrameState, drawCommands: unknown[]): void;
    updateForPick(frameState: FrameState): void;
    getLevelMaximumGeometricError(level: number): number;
    loadTile(frameState: FrameState, tile: QuadtreeTile): void;
    computeTileVisibility(
      tile: QuadtreeTile,
      frameState: FrameState,
    ): Visibility;
    showTileThisFrame(tile: QuadtreeTile, frameState: FrameState): void;
    computeDistanceToTile(tile: QuadtreeTile, frameState: FrameState): number;
    computeTileLoadPriority(tile: QuadtreeTile, frameState: FrameState): number;
    cancelReprojections(): void;
    isDestroyed(): boolean;
    canRefine(tile: QuadtreeTile): boolean;
    destroy(): void;
  }

  class QuadtreePrimitive {
    constructor(options: {
      tileProvider: QuadtreeTileProviderInterface;
      tileCacheSize?: number;
    });

    forEachLoadedTile(cb: (tile: QuadtreeTile) => void): void;
    forEachRenderedTile(cb: (tile: QuadtreeTile) => void): void;
    invalidateAllTiles(): void;

    beginFrame(f: FrameState): void;
    endFrame(f: FrameState): void;
    render(f: FrameState): void;
  }

  export namespace Math {
    function fog(distanceToCamera: number, density: number): number;
  }

  interface ClippingPolygon {
    _cachedPackedCartesians: number[];
    _cachedRectangle: Rectangle;
  }

  interface ClippingPolygonCollection {
    _totalPositions: number;
    setDirty(): void;
  }
}
