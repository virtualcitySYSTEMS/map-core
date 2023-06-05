import GeoJSON from 'ol/format/GeoJSON.js';
import Polygon from 'ol/geom/Polygon.js';
import MultiPolygon from 'ol/geom/MultiPolygon.js';
import Feature from 'ol/Feature.js';
import Point from 'ol/geom/Point.js';
import Circle from 'ol/geom/Circle.js';
import type GeoJSONFormat from 'ol/format/GeoJSON.js';
import type { ReadOptions } from 'ol/format/Feature.js';
import type {
  FeatureCollection,
  Feature as GeojsonFeature,
  Point as GeojsonPoint,
  Geometry as GeojsonGeometry,
} from 'geojson';
import { parseNumber } from '@vcsuite/parsers';

import { getDistance as haversineDistance } from 'ol/sphere.js';
import Projection, {
  mercatorProjection,
  wgs84Projection,
} from '../util/projection.js';
import VectorStyleItem, {
  defaultVectorStyle,
  VectorStyleItemOptions,
  vectorStyleSymbol,
} from '../style/vectorStyleItem.js';
import { parseColor } from '../style/styleHelpers.js';
import { featureStoreStateSymbol } from './featureStoreLayerState.js';
import { embedIconsInStyle } from '../style/writeStyle.js';
import DeclarativeStyleItem from '../style/declarativeStyleItem.js';
import { VcsMeta, vcsMetaVersion } from './vectorProperties.js';
import Extent3D from '../util/featureconverter/extent3D.js';
import {
  circleFromCenterRadius,
  enforceEndingVertex,
  removeEndingVertexFromGeometry,
} from '../util/geometryHelpers.js';
import type StyleItem from '../style/styleItem.js';
import { alreadyTransformedToMercator } from './vectorSymbols.js';

const featureProjection = 'EPSG:3857';

let format: GeoJSONFormat;

function getFormat(): GeoJSONFormat {
  if (!format) {
    format = new GeoJSON();
  }
  return format;
}

type GeoJSONData = {
  features: Feature[];
  style?: StyleItem;
  vcsMeta?: VcsMeta;
};

type GeoJSONinternalReadOptions = GeoJSONreadOptions & {
  formatOptions?: ReadOptions;
  embeddedIcons?: string[];
};

export type GeoJSONreadOptions = {
  /**
   * projection of the output features, if undefined Mercator will be used
   */
  targetProjection?: Projection;
  /**
   * projection of the input dataset if undefined WGS84 will be assumed
   */
  dataProjection?: Projection;
  dynamicStyle?: boolean;
  readLegacyStyleOptions?: boolean;
  dontReadStyle?: boolean;
  defaultStyle?: VectorStyleItem;
};

export type GeoJSONwriteOptions = {
  /**
   * whether to write an object or a string
   */
  asObject?: boolean;
  /**
   * whether to include vcsStyle options
   */
  writeStyle?: boolean;
  /**
   * whether to output the default style. if the style of a layer is the default layer it is not written.
   */
  writeDefaultStyle?: boolean;
  /**
   * whether to embed custom icons when writing styles, otherwise no style is written for custom icons
   */
  embedIcons?: boolean;
  /**
   * pretty print the json, if not asObject
   */
  prettyPrint?: boolean;
  /**
   * whether to output the feature ID
   */
  writeId?: boolean;
};

export function getEPSGCodeFromGeojson(
  geojson: FeatureCollection,
): string | null {
  const { crs } = geojson;
  if (crs) {
    if (crs.type === 'name') {
      return crs.properties.name;
    } else if (crs.type === 'EPSG') {
      // 'EPSG' is not part of the GeojsonLayer specification, but is generated by
      // GeoServer.
      // TODO: remove this when http://jira.codehaus.org/browse/GEOS-5996
      // is fixed and widely deployed.
      return `EPSG:${crs.properties.code}`;
    }
  }
  return null;
}

/**
 * updates legacy features to the new olcesium namespaceing olcs_
 * @param  feature
 */
export function updateLegacyFeature(feature: Feature): void {
  // these changes can be done silently, because the features haven't been added to any layer
  if (feature.get('altitudeMode')) {
    feature.set('olcs_altitudeMode', feature.get('altitudeMode'), true);
    feature.unset('altitudeMode', true);
  }
  if (feature.get('extrudedHeight')) {
    if (feature.get('drawingType')) {
      feature.set('olcs_extrudedHeight', feature.get('extrudedHeight'), true);
    } else {
      const extent = Extent3D.fromGeometry(feature.getGeometry());
      const minHeight = Number.isFinite(extent.minZ) ? extent.minZ : 0;
      feature.set(
        'olcs_extrudedHeight',
        feature.get('extrudedHeight') - minHeight,
        true,
      );
    }
    feature.unset('extrudedHeight', true);
  }
  if (feature.get('skirt')) {
    feature.set('olcs_skirt', feature.get('skirt'), true);
    feature.unset('skirt', true);
  }

  if (feature.get('radius')) {
    feature.unset('radius', true);
  }
}

function readGeometry(
  geometryObj: GeojsonGeometry,
  options: GeoJSONinternalReadOptions,
): Feature {
  const geometry = getFormat().readGeometry(geometryObj, options.formatOptions);
  if (String(options.formatOptions?.featureProjection) === 'EPSG:3857') {
    geometry[alreadyTransformedToMercator] = true;
  }
  removeEndingVertexFromGeometry(geometry);
  return new Feature({ geometry });
}

function setEmbeddedIcons(
  object: VectorStyleItemOptions,
  options: GeoJSONinternalReadOptions,
): VectorStyleItemOptions {
  if (object.image && object.image.src && /^:\d+$/.test(object.image.src)) {
    if (options.embeddedIcons) {
      object.image.src =
        options.embeddedIcons[Number(object.image.src.substring(1))];
    } else {
      delete object.image.src;
    }
  }
  return object;
}

function parseLegacyStyleOptions(
  properties: Record<string, unknown>,
  geometryType: string,
): VectorStyleItemOptions | undefined {
  const color = properties.color
    ? parseColor(properties.color as string)
    : false;
  const width = parseNumber(properties.width, 1.25);
  const radius = parseNumber(properties.pointRadius, 5);
  const opacity: number = parseNumber(properties.opacity, 0.8);

  delete properties.color;
  delete properties.width;
  delete properties.pointRadius;
  delete properties.opacity;

  if (geometryType === 'Polygon' || geometryType === 'Circle') {
    const fillColor = color ? color.slice() : [255, 255, 255, 0.4];
    fillColor[3] = opacity;
    return {
      fill: { color: fillColor },
      stroke: {
        color: color || parseColor('#3399CC'),
        width,
      },
    };
  }
  if (geometryType === 'LineString') {
    return {
      stroke: {
        color: color || parseColor('#3399CC'),
        width,
      },
    };
  }
  if (geometryType === 'Point') {
    return {
      image: {
        fill: {
          color: [255, 255, 255, 0.4],
        },
        radius,
        stroke: {
          color: color || parseColor('#3399CC'),
          width: 1,
        },
      },
    };
  }
  return undefined;
}

function readFeature(
  featureObj: GeojsonFeature,
  options: GeoJSONinternalReadOptions,
): Feature | null {
  if (!featureObj.geometry) {
    return null;
  }
  const radius = (featureObj.geometry as GeojsonPoint).olcs_radius;
  let geometry = getFormat().readGeometry(
    featureObj.geometry,
    options.formatOptions,
  );

  if (featureObj.radius && geometry instanceof Point) {
    const coordinates = geometry.getCoordinates();
    if (coordinates.length === 2) {
      coordinates.push(0);
    }
    geometry = new Circle(coordinates, featureObj.radius, 'XYZ');
  }
  if (radius && geometry instanceof Point) {
    const coordinates = geometry.getCoordinates();
    if (coordinates.length === 2) {
      coordinates.push(0);
    }
    geometry = circleFromCenterRadius(coordinates, radius);
  }
  if (String(options.formatOptions?.featureProjection) === 'EPSG:3857') {
    geometry[alreadyTransformedToMercator] = true;
  }

  featureObj.vcsMeta = featureObj.vcsMeta || ({} as VcsMeta);
  if (featureObj.vcsStyle) {
    featureObj.vcsMeta.style = featureObj.vcsMeta.style || featureObj.vcsStyle;
  }
  const { properties } = featureObj;
  if (
    properties &&
    options.readLegacyStyleOptions &&
    !featureObj.vcsMeta.style
  ) {
    featureObj.vcsMeta.style = parseLegacyStyleOptions(
      properties,
      geometry.getType(),
    );
  }
  removeEndingVertexFromGeometry(geometry);
  const feature = new Feature({ ...properties, geometry });
  if (featureObj.id) {
    feature.setId(featureObj.id);
  }

  if (featureObj.state) {
    feature[featureStoreStateSymbol] = featureObj.state;
  }

  if (featureObj.vcsMeta.style && !options.dontReadStyle) {
    featureObj.vcsMeta.style = setEmbeddedIcons(
      featureObj.vcsMeta.style,
      options,
    );
    let styleItem;
    if (options.defaultStyle) {
      styleItem = options.defaultStyle
        .clone()
        .assign(new VectorStyleItem(featureObj.vcsMeta.style));
      if (styleItem.label != null) {
        geometry.set('_vcsGeomType', 'Label');
      }
    } else {
      styleItem = new VectorStyleItem(featureObj.vcsMeta.style);
    }
    feature[vectorStyleSymbol] = styleItem;
    feature.setStyle(styleItem.style);
  }
  updateLegacyFeature(feature);
  return feature;
}

/**
 * parses a string to GeojsonLayer
 */
export function parseGeoJSON(
  input: string | FeatureCollection | GeojsonFeature | GeojsonGeometry,
  readOptions: GeoJSONreadOptions = {},
): GeoJSONData {
  const geoJSON = (typeof input === 'string' ? JSON.parse(input) : input) as
    | FeatureCollection
    | GeojsonFeature
    | GeojsonGeometry;

  const epsgCode = getEPSGCodeFromGeojson(geoJSON as FeatureCollection);
  const defaultDataProjection = epsgCode
    ? { epsg: epsgCode }
    : readOptions.dataProjection;

  const options: GeoJSONinternalReadOptions = {
    formatOptions: {
      dataProjection: defaultDataProjection
        ? defaultDataProjection.epsg
        : wgs84Projection.epsg,
      featureProjection: readOptions.targetProjection
        ? readOptions.targetProjection.epsg
        : mercatorProjection.epsg,
    },
    dontReadStyle: readOptions.dontReadStyle,
    readLegacyStyleOptions: readOptions.readLegacyStyleOptions,
    defaultStyle: readOptions.defaultStyle,
  };

  if (readOptions.dynamicStyle && !options.defaultStyle) {
    options.defaultStyle = defaultVectorStyle;
  }

  if (geoJSON.type === 'FeatureCollection') {
    geoJSON.vcsMeta =
      geoJSON.vcsMeta ||
      ({
        embeddedIcons: geoJSON.vcsEmbeddedIcons,
        style: geoJSON.vcsStyle,
      } as VcsMeta);

    let style;
    if (geoJSON.vcsMeta.embeddedIcons) {
      options.embeddedIcons = geoJSON.vcsMeta.embeddedIcons;
    }
    if (geoJSON.vcsMeta.style && readOptions.dynamicStyle) {
      if (geoJSON.vcsMeta.style.type === DeclarativeStyleItem.className) {
        style = new DeclarativeStyleItem(geoJSON.vcsMeta.style);
      } else {
        geoJSON.vcsMeta.style = setEmbeddedIcons(
          geoJSON.vcsMeta.style,
          options,
        );
        options.defaultStyle = (options.defaultStyle ?? defaultVectorStyle)
          .clone()
          .assign(new VectorStyleItem(geoJSON.vcsMeta.style));
        style = options.defaultStyle;
      }
    }
    return {
      features: geoJSON.features
        .map((f) => readFeature(f, options))
        .filter((f) => f) as Feature[],
      style: geoJSON.vcsMeta.style ? style : undefined,
      vcsMeta: geoJSON.vcsMeta ? geoJSON.vcsMeta : undefined,
    };
  } else if (geoJSON.type === 'Feature') {
    const feature = readFeature(geoJSON, options);
    return {
      features: feature ? [feature] : [],
      vcsMeta: geoJSON.vcsMeta ? geoJSON.vcsMeta : undefined,
    };
  } else if (geoJSON.type != null) {
    return { features: [readGeometry(geoJSON, options)] };
  }
  return { features: [] };
}

/**
 * @param  feature
 * @param  options
 * @param  embeddedIcons
 */
export function writeGeoJSONFeature(
  feature: Feature,
  options: GeoJSONwriteOptions = {},
  embeddedIcons: string[] = [],
): GeojsonFeature {
  let geometry = feature.getGeometry();
  if (!geometry) {
    throw new Error('Cannot write geometry less feature to geojson');
  }
  let radius = null;
  if (geometry instanceof Circle) {
    const coordinates = geometry.getCoordinates();
    radius = haversineDistance(
      Projection.mercatorToWgs84(coordinates[0], true),
      Projection.mercatorToWgs84(coordinates[1], true),
    );
    geometry = new Point(geometry.getCenter());
  } else if (geometry instanceof Polygon) {
    const coordinates = geometry.getCoordinates();
    coordinates.forEach((ring) => {
      enforceEndingVertex(ring);
    });
    geometry.setCoordinates(coordinates);
  } else if (geometry instanceof MultiPolygon) {
    const coordinates = geometry.getCoordinates();
    coordinates.forEach((poly) => {
      poly.forEach((ring) => {
        enforceEndingVertex(ring);
      });
    });
    geometry.setCoordinates(coordinates);
  }

  const geojsonGeometry = getFormat().writeGeometryObject(geometry, {
    featureProjection,
    rightHanded: true,
  });

  const properties = feature.getProperties();
  delete properties[feature.getGeometryName()];
  delete properties.style;
  delete properties.olcs_allowPicking;

  const featureObject: GeojsonFeature = {
    type: 'Feature',
    properties,
    geometry: geojsonGeometry,
  };

  if (options.writeId) {
    featureObject.id = feature.getId();
  }

  if (radius) {
    (featureObject.geometry as GeojsonPoint).olcs_radius = radius;
  }

  featureObject.vcsMeta = {
    version: vcsMetaVersion,
  };

  if (options.writeStyle && feature[vectorStyleSymbol]) {
    featureObject.vcsMeta.style = embedIconsInStyle(
      feature[vectorStyleSymbol].getOptionsForFeature(feature),
      embeddedIcons,
    );
  }

  return featureObject;
}

/**
 * Writes all the features of the current layer to GeojsonLayer
 */
export function writeGeoJSON(
  data: GeoJSONData,
  options: GeoJSONwriteOptions = {},
): string | FeatureCollection {
  // how to handel embedded icons when they are not set on the vcsMeta but options is true?
  const vcsMeta = data.vcsMeta || { version: vcsMetaVersion };
  vcsMeta.version = vcsMetaVersion;
  const featureObjs = data.features.map((feature) =>
    writeGeoJSONFeature(feature, options, vcsMeta.embeddedIcons),
  );
  const obj: FeatureCollection = {
    type: 'FeatureCollection',
    features: featureObjs,
    vcsMeta,
  };

  return options.asObject
    ? obj
    : JSON.stringify(obj, undefined, options.prettyPrint ? 2 : undefined);
}