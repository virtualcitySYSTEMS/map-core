/**
 * Type overrides for types extended by the @vcmap/core API
 */
import * as geom from 'ol/geom';
import * as style from 'ol/style';

import { Feature } from 'ol/index';
import { Geometry } from 'ol/geom';
import CanvasImmediateRenderer from 'ol/render/canvas/Immediate';

declare module 'ol/geom' {
  interface Geometry {
    getCoordinates(): any;
    setCoordinates(coordinates: any, layout?: any): void;
    getFlatCoordinates(): number[];
    getLayout(): import('ol/geom/Geometry').GeometryLayout;
  }

  interface GeometryCollection {
    getCoordinates(): Array<
      | import('ol/coordinate').Coordinate
      | Array<import('ol/coordinate').Coordinate>
      | Array<Array<import('ol/coordinate').Coordinate>>
      | Array<Array<Array<import('ol/coordinate').Coordinate>>>
    >;
    setCoordinates(
      coordinates: Array<
        | import('ol/coordinate').Coordinate
        | Array<import('ol/coordinate').Coordinate>
        | Array<Array<import('ol/coordinate').Coordinate>>
        | Array<Array<Array<import('ol/coordinate').Coordinate>>>
      >,
    ): void;
    getLayout(): import('ol/geom/Geometry').GeometryLayout;
  }

  interface Circle {
    getCoordinates(): import('ol/coordinate').Coordinate[];
    setCoordinates(coordinates: import('ol/coordinate').Coordinate[]): void;
    rotate(angle: number, anchor: import('ol/coordinate').Coordinate): void;
  }
}

declare module 'ol/index' {
  interface Feature<Geometry> {
    getProperty(key: string): any;
    getPropertyInherited(key: string): any;
  }

  export class CanvasTileRenderer extends CanvasImmediateRenderer {
    constructor(
      context: CanvasRenderingContext2D,
      pixelRation: number,
      extent: import('ol/extent').Extent,
      transform: import('ol/transform').Transform,
      viewRotation: number,
      squaredTolerance?: number,
      userTransform?: import('ol/proj').TransformFunction,
      scaleY?: number,
    );
    drawCircle(geometry: import('ol/geom/Circle').default): void;
  }
}

declare module 'ol/style' {
  interface Fill {
    fallBackColor: import('ol/colorlike').ColorLike | import('ol/color').Color;
  }
}
