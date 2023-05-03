/**
 * Type overrides for types extended by the @vcmap/core API
 */

declare module '@vcmap-cesium/engine' {
  interface Scene {
    render(): void;
    frameState: FrameState;
    context: Context;
  }

  interface TileBoundingVolume {
    boundingVolume?: Object;
    boundingSphere?: import('@vcmap-cesium/engine').BoundingSphere;
    rectangle?: import('@vcmap-cesium/engine').Rectangle;
    distanceToCamera(frameState: Object): number;
    intersectPlane(
      plane: import('@vcmap-cesium/engine').Plane,
    ): import('@vcmap-cesium/engine').Intersect;
  }

  interface Entity {
    allowPicking?: boolean;
    attributes?: Object;
    olFeature?: import('ol').Feature<import('ol/geom').Geometry>;
    getId(): number | string;
    getProperty(key: string): any;
  }

  interface Primitive {
    olFeature?: import('ol').Feature<import('ol/geom').Geometry>;
  }

  interface Model {
    olFeature?: import('ol').Feature<import('ol/geom').Geometry>;
  }

  interface GroundPrimitive {
    olFeature?: import('ol').Feature<import('ol/geom').Geometry>;
  }

  interface GroundPolylinePrimitive {
    olFeature?: import('ol').Feature<import('ol/geom').Geometry>;
  }

  interface ClassificationPrimitive {
    olFeature?: import('ol').Feature<import('ol/geom').Geometry>;
  }

  interface Label {
    olFeature?: import('ol').Feature<import('ol/geom').Geometry>;
  }

  interface Billboard {
    olFeature?: import('ol').Feature<import('ol/geom').Geometry>;
  }

  interface ImageryProvider {
    _reload?(): void;
  }

  interface PrimitiveCollection {
    VCMLayerIndex?: number;
  }

  interface ImageryLayer {
    VCMLayerIndex?: number;
  }

  interface Cesium3DTile {
    boundingVolume: TileBoundingVolume;
    contentReady: boolean;
  }

  interface Cesium3DTileContent {
    readonly batchTable: Cesium3DTileBatchTable;
    isDestroyed(): boolean;
  }

  interface Cesium3DTileset {
    clippingPlanesOriginMatrix: import('@vcmap-cesium/engine').Matrix4;
  }

  interface DataSourceDisplay {
    getBoundingSphere(
      entity: import('@vcmap-cesium/engine').Entity,
      allowPartial: boolean,
      result: import('@vcmap-cesium/engine').BoundingSphere,
    ): import('@vcmap-cesium/engine').BoundingSphereState;
  }

  interface Cesium3DTileFeature {
    content: import('@vcmap-cesium/engine').Cesium3DTileContent;
    _batchId: number;
    getId(): number | string;
  }

  interface Cesium3DTilePointFeature {
    content: import('@vcmap-cesium/engine').Cesium3DTileContent;
    _batchId: number;
    getId(): number | string;
  }

  interface Cesium3DTileStyle {
    strokeColor: import('@vcmap-cesium/engine').StyleExpression;
    strokeWidth: import('@vcmap-cesium/engine').StyleExpression;
    scale: import('@vcmap-cesium/engine').StyleExpression;
  }

  interface StyleExpression {
    evaluate(
      feature:
        | import('@vcmap-cesium/engine').Cesium3DTileFeature
        | import('ol/Feature').default<import('ol/geom/Geometry').default>,
    ): any;
    evaluateColor(
      feature:
        | import('@vcmap-cesium/engine').Cesium3DTileFeature
        | import('ol/Feature').default<import('ol/geom/Geometry').default>,
    ): import('@vcmap-cesium/engine').Color;
  }

  interface Expression {
    evaluate(
      feature:
        | import('@vcmap-cesium/engine').Cesium3DTileFeature
        | import('ol/Feature').default<import('ol/geom/Geometry').default>,
    ): any;
    evaluateColor(
      feature:
        | import('@vcmap-cesium/engine').Cesium3DTileFeature
        | import('ol/Feature').default<import('ol/geom/Geometry').default>,
    ): import('@vcmap-cesium/engine').Color;
  }

  interface ShadowMap {
    viewshed?: {
      shadowColor?: import('@vcmap-cesium/engine').Color;
      visibleColor?: import('@vcmap-cesium/engine').Color;
      distance?: number;
    };
  }

  interface ScreenSpaceEventHandler {
    _positions: import('@vcmap-cesium/engine').Cartesian2[];
  }

  export class Cesium3DTileBatchTable {
    isDestroyed(): boolean;
  }

  class Context {
    fragmentDepth: boolean;
  }

  class FrameState {
    context: Context;
    creditDisplay: import('@vcmap-cesium/engine').CreditDisplay;
    frameNumber: number;
  }

  export namespace PolygonPipeline {
    function triangulate(
      positions: import('@vcmap-cesium/engine').Cartesian2[],
      holes?: number[],
    ): number[];
  }
}
