import {
  type Geometry,
  Polygon,
  LineString,
  Circle,
  Point,
  MultiPoint,
  MultiLineString,
  MultiPolygon,
} from 'ol/geom.js';
import type { Scene } from '@vcmap-cesium/engine';
import Style, { type StyleLike } from 'ol/style/Style.js';
import type { Feature } from 'ol/index.js';
import GeometryCollection from 'ol/geom/GeometryCollection.js';
import polygonToCesium from './polygonToCesium.js';
import circleToCesium from './circleToCesium.js';
import lineStringToCesium from './lineStringToCesium.js';
import pointToCesium from './pointToCesium.js';
import arcToCesium from './arcToCesium.js';
import ArcStyle, { featureArcStruct } from '../../style/arcStyle.js';
import type VectorProperties from '../../layer/vectorProperties.js';
import type { CesiumVectorContext } from '../../layer/cesium/vectorContext.js';

function convertGeometry(
  feature: Feature,
  geometry: Geometry,
  style: Style,
  vectorProperties: VectorProperties,
  scene: Scene,
  context: CesiumVectorContext,
): void {
  if (geometry instanceof Point) {
    pointToCesium(feature, style, [geometry], vectorProperties, scene, context);
  } else if (geometry instanceof Polygon) {
    polygonToCesium(
      feature,
      style,
      [geometry],
      vectorProperties,
      scene,
      context,
    );
  } else if (geometry instanceof LineString) {
    if (style instanceof ArcStyle && feature[featureArcStruct]?.coordinates) {
      arcToCesium(feature, style, [geometry], vectorProperties, scene, context);
    } else {
      lineStringToCesium(
        feature,
        style,
        [geometry],
        vectorProperties,
        scene,
        context,
      );
    }
  } else if (geometry instanceof Circle) {
    circleToCesium(
      feature,
      style,
      [geometry],
      vectorProperties,
      scene,
      context,
    );
  } else if (geometry instanceof MultiPoint) {
    pointToCesium(
      feature,
      style,
      geometry.getPoints(),
      vectorProperties,
      scene,
      context,
    );
  } else if (geometry instanceof MultiPolygon) {
    polygonToCesium(
      feature,
      style,
      geometry.getPolygons(),
      vectorProperties,
      scene,
      context,
    );
  } else if (geometry instanceof MultiLineString) {
    lineStringToCesium(
      feature,
      style,
      geometry.getLineStrings(),
      vectorProperties,
      scene,
      context,
    );
  } else if (geometry instanceof GeometryCollection) {
    geometry.getGeometries().forEach((currentGeometry) => {
      convertGeometry(
        feature,
        currentGeometry,
        style,
        vectorProperties,
        scene,
        context,
      );
    });
  }
}

export function getStylesArray(
  style: StyleLike,
  feature: Feature,
  resolution = 1,
): Style[] {
  const styles = [];
  if (typeof style === 'function') {
    styles.push(
      ...getStylesArray(
        style(feature, resolution) as StyleLike,
        feature,
        resolution,
      ),
    );
  } else if (Array.isArray(style)) {
    style.forEach((currentStyle) => {
      styles.push(...getStylesArray(currentStyle, feature, resolution));
    });
  } else if (style instanceof Style) {
    styles.push(style);
  }
  return styles;
}

/**
 * function to convert a feature to an array of Cesium.Primitives given a style and default properties. the resulting primitives
 * must be added to the modules collections here
 * @param  feature
 * @param  style
 * @param  vectorProperties
 * @param  context
 * @param  scene
 */
export default function convert(
  feature: Feature,
  style: StyleLike,
  vectorProperties: VectorProperties,
  context: CesiumVectorContext,
  scene: Scene,
): void {
  const styles = getStylesArray(feature.getStyle() || style, feature, 0);
  styles.forEach((currentStyle) => {
    const geometry = currentStyle.getGeometryFunction()(feature) as Geometry;
    if (geometry) {
      convertGeometry(
        feature,
        geometry,
        currentStyle,
        vectorProperties,
        scene,
        context,
      );
    }
  });
}
