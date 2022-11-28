declare module "@vcmap/cesium" {
    interface Entity {
        getId():number|string;
        getProperty(key: string): any;
    }

    interface Cesium3DTileFeature {
        getId():number|string;
    }

    interface Cesium3DTilePointFeature {
        getId():number|string;
    }

    interface StyleExpression {
        evaluate(feature: import("@vcmap/cesium").Cesium3DTileFeature | import("ol/Feature").default<import("ol/geom/Geometry").default>):any;
        evaluateColor(feature: import("@vcmap/cesium").Cesium3DTileFeature | import("ol/Feature").default<import("ol/geom/Geometry").default>):import("@vcmap/cesium").Color;
    }

    interface Expression {
        evaluate(feature: import("@vcmap/cesium").Cesium3DTileFeature | import("ol/Feature").default<import("ol/geom/Geometry").default>):any;
        evaluateColor(feature: import("@vcmap/cesium").Cesium3DTileFeature | import("ol/Feature").default<import("ol/geom/Geometry").default>):import("@vcmap/cesium").Color;
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
    }
}
