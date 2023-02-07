declare module "@vcmap-cesium/engine" {
    interface Entity {
        getId():number|string;
        getProperty(key: string): any;
        [vcsLayerName]: string|null;
    }

    interface Cesium3DTileFeature {
        getId():number|string;
        [vcsLayerName]: string|null;
    }

    interface Cesium3DTilePointFeature {
        getId():number|string;
        [vcsLayerName]: string|null;
    }

    interface StyleExpression {
        evaluate(feature: import("@vcmap-cesium/engine").Cesium3DTileFeature | import("ol/Feature").default<import("ol/geom/Geometry").default>):any;
        evaluateColor(feature: import("@vcmap-cesium/engine").Cesium3DTileFeature | import("ol/Feature").default<import("ol/geom/Geometry").default>):import("@vcmap-cesium/engine").Color;
    }

    interface Expression {
        evaluate(feature: import("@vcmap-cesium/engine").Cesium3DTileFeature | import("ol/Feature").default<import("ol/geom/Geometry").default>):any;
        evaluateColor(feature: import("@vcmap-cesium/engine").Cesium3DTileFeature | import("ol/Feature").default<import("ol/geom/Geometry").default>):import("@vcmap-cesium/engine").Color;
    }
}

declare module "ol/geom" {
    interface Geometry {
        getCoordinates(): any;
        setCoordinates(coordinates: any, layout?: any): void;
        getFlatCoordinates(): number[];
        getLayout(): import("ol/geom/Geometry").GeometryLayout;
    }

    interface GeometryCollection {
        getCoordinates(): Array<import("ol/coordinate").Coordinate | Array<import("ol/coordinate").Coordinate> | Array<Array<import("ol/coordinate").Coordinate>> | Array<Array<Array<import("ol/coordinate").Coordinate>>>>;
        setCoordinates(coordinates: Array<import("ol/coordinate").Coordinate | Array<import("ol/coordinate").Coordinate> | Array<Array<import("ol/coordinate").Coordinate>> | Array<Array<Array<import("ol/coordinate").Coordinate>>>>): void;
        getLayout(): import("ol/geom/Geometry").GeometryLayout;
    }

    interface Circle {
        getCoordinates(): import("ol/coordinate").Coordinate[];
        setCoordinates(coordinates: import("ol/coordinate").Coordinate[]): void;
        rotate(angle: number, anchor: import("ol/coordinate").Coordinate): void;
    }
}

declare module "ol/index" {
    interface Feature<Geometry> {
        getProperty(key: string): any;
        getPropertyInherited(key: string): any;
        [vcsLayerName]: string|null;
    }
}
