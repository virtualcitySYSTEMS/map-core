import Polygon from 'ol/geom/Polygon.js';
import LineString from 'ol/geom/LineString.js';
import Circle from 'ol/geom/Circle.js';
import Point from 'ol/geom/Point.js';
import MultiPolygon from 'ol/geom/MultiPolygon.js';
import MultiLineString from 'ol/geom/MultiLineString.js';
import MultiPoint from 'ol/geom/MultiPoint.js';
import Style from 'ol/style/Style.js';
import GeometryCollection from 'ol/geom/GeometryCollection.js';
import polygonToCesium from './polygonToCesium.js';
import circleToCesium from './circleToCesium.js';
import lineStringToCesium from './lineStringToCesium.js';
import pointToCesium from './pointToCesium.js';

/**
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {import("ol/geom/Geometry").default} geometry
 * @param {import("ol/style/Style").default} style
 * @param {import("@vcmap/core").VectorProperties} vectorProperties
 * @param {import("@vcmap/cesium").Scene} scene
 * @param {import("@vcmap/core").VectorContext|import("@vcmap/core").ClusterContext} context
 */
function convertGeometry(feature, geometry, style, vectorProperties, scene, context) {
  if (geometry instanceof Point) {
    pointToCesium(feature, style, [geometry], vectorProperties, scene, context);
  } else if (geometry instanceof Polygon) {
    polygonToCesium(feature, style, [geometry], vectorProperties, scene, context);
  } else if (geometry instanceof LineString) {
    lineStringToCesium(feature, style, [geometry], vectorProperties, scene, context);
  } else if (geometry instanceof Circle) {
    circleToCesium(feature, style, [geometry], vectorProperties, scene, context);
  } else if (geometry instanceof MultiPoint) {
    pointToCesium(feature, style, geometry.getPoints(), vectorProperties, scene, context);
  } else if (geometry instanceof MultiPolygon) {
    polygonToCesium(feature, style, geometry.getPolygons(), vectorProperties, scene, context);
  } else if (geometry instanceof MultiLineString) {
    lineStringToCesium(feature, style, geometry.getLineStrings(), vectorProperties, scene, context);
  } else if (geometry instanceof GeometryCollection) {
    geometry.getGeometries().forEach((currentGeometry) => {
      convertGeometry(feature, currentGeometry, style, vectorProperties, scene, context);
    });
  }
}

/**
 * @param {void|import("ol/style/Style").StyleLike} style
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {number=} resolution
 * @returns {Array<import("ol/style/Style").default>}
 */
export function getStylesArray(style, feature, resolution = 1) {
  const styles = [];
  if (typeof style === 'function') {
    styles.push(...getStylesArray(style(feature, resolution), feature, resolution));
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
 * must be added to the contexts collections here
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {import("ol/style/Style").StyleLike} style
 * @param {import("@vcmap/core").VectorProperties} vectorProperties
 * @param {import("@vcmap/core").VectorContext|import("@vcmap/core").ClusterContext} context
 * @param {import("@vcmap/cesium").Scene} scene
 */
export default function convert(feature, style, vectorProperties, context, scene) {
  const styles = getStylesArray(feature.getStyle() || style, feature, 0);
  styles.forEach((currentStyle) => {
    const geometry = /** @type {import("ol/geom/Geometry").default} */(currentStyle.getGeometryFunction()(feature));
    if (geometry) {
      convertGeometry(feature, geometry, currentStyle, vectorProperties, scene, context);
    }
  });
}
