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
import {
  ClassificationPrimitive,
  GroundPolylinePrimitive,
  GroundPrimitive,
  Model,
  Primitive,
  Scene,
} from '@vcmap-cesium/engine';
import Style, { type StyleLike } from 'ol/style/Style.js';
import type { Feature } from 'ol/index.js';
import GeometryCollection from 'ol/geom/GeometryCollection.js';
import { getPolygonGeometryFactory } from './polygonToCesium.js';
import { getCircleGeometryFactory } from './circleToCesium.js';
import {
  getArrowHeadPrimitives,
  getLineStringGeometryFactory,
} from './lineStringToCesium.js';
import {
  BillboardOptions,
  getPointPrimitives,
  LabelOptions,
  validatePoint,
} from './pointToCesium.js';
import { getArcGeometryFactory } from './arcToCesium.js';
import { featureArcStruct } from '../../style/arcStyle.js';
import VectorProperties from '../../layer/vectorProperties.js';
import { setupClampedPrimitive } from './clampedPrimitive.js';
import {
  getHeightInfo,
  isClampedHeightReference,
  isRelativeHeightReference,
  RelativeHeightReference,
  VectorHeightInfo,
} from './vectorHeightInfo.js';
import {
  CesiumGeometryOption,
  createClassificationPrimitiveItem,
  createGroundLinePrimitiveItem,
  createGroundPrimitiveItem,
  createLinePrimitiveItem,
  createOutlinePrimitiveItem,
  createSolidPrimitiveItem,
  getCesiumGeometriesOptions,
  VectorGeometryFactory,
} from './vectorGeometryFactory.js';
import ArrowStyle from '../../style/arrowStyle.js';

export type PrimitiveType =
  | Primitive
  | GroundPrimitive
  | GroundPolylinePrimitive
  | ClassificationPrimitive
  | Model;

export type ConvertedItemType = 'primitive' | 'billboard' | 'label';

export type ConvertedItem<T extends ConvertedItemType = ConvertedItemType> =
  T extends 'primitive'
    ? {
        type: T;
        item: PrimitiveType;
        autoScale?: boolean;
      }
    : T extends 'billboard'
    ? {
        type: T;
        item: BillboardOptions;
      }
    : T extends 'label'
    ? {
        type: T;
        item: LabelOptions;
      }
    : never;

type SingleGeometry = Point | Polygon | LineString | Circle;

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

function getSingleGeometriesFromGeometry(geometry: Geometry): SingleGeometry[] {
  if (
    geometry instanceof Point ||
    geometry instanceof Polygon ||
    geometry instanceof LineString ||
    geometry instanceof Circle
  ) {
    return [geometry];
  }
  if (geometry instanceof MultiPoint) {
    return geometry.getPoints();
  } else if (geometry instanceof MultiPolygon) {
    return geometry.getPolygons();
  } else if (geometry instanceof MultiLineString) {
    return geometry.getLineStrings();
  } else if (geometry instanceof GeometryCollection) {
    return geometry
      .getGeometriesArray()
      .map(getSingleGeometriesFromGeometry)
      .flat();
  }
  throw new Error('Not an implemented geometry');
}

async function getCesiumOptionsForSingleGeometry(
  feature: Feature,
  geometry: SingleGeometry,
  style: Style,
  vectorProperties: VectorProperties,
  scene: Scene,
): Promise<(CesiumGeometryOption | ConvertedItem)[]> {
  const heightInfo = getHeightInfo(feature, geometry, vectorProperties);
  if (geometry instanceof Point) {
    if (
      (!style.getImage() && !style.getText()?.getText()) ||
      !validatePoint(geometry)
    ) {
      return [];
    }

    const pointPrimitives = await getPointPrimitives(
      feature,
      geometry,
      style,
      vectorProperties,
      scene,
      heightInfo,
    );
    return pointPrimitives;
  }

  let geometryFactory: VectorGeometryFactory;
  let arcStyle: ArrowStyle | undefined;
  if (geometry instanceof Polygon) {
    geometryFactory = getPolygonGeometryFactory();
  } else if (geometry instanceof LineString) {
    if (style instanceof ArrowStyle) {
      if (feature[featureArcStruct]?.coordinates) {
        geometryFactory = getArcGeometryFactory(
          feature[featureArcStruct]?.coordinates,
          heightInfo.heightReference,
        );
      } else {
        geometryFactory = getLineStringGeometryFactory();
      }
      arcStyle = style;
    } else {
      geometryFactory = getLineStringGeometryFactory();
    }
  } else {
    geometryFactory = getCircleGeometryFactory();
  }

  if (
    (!style.getFill() && !style.getStroke()) ||
    !geometryFactory.validateGeometry(geometry)
  ) {
    return [];
  }

  const geometryOptions = getCesiumGeometriesOptions(
    style,
    geometry,
    geometryFactory,
    heightInfo,
  );

  let convertedItems: ConvertedItem[] = [];
  if (arcStyle) {
    convertedItems = getArrowHeadPrimitives(
      feature,
      arcStyle,
      geometry as LineString,
      vectorProperties,
      scene,
      feature[featureArcStruct]?.coordinates,
    );
  }

  return [...geometryOptions, ...convertedItems];
}

type PrimitiveBatches = {
  classificationPrimitive: CesiumGeometryOption<'solid' | 'fill'>[];
  groundPrimitive: CesiumGeometryOption<'solid' | 'fill'>[];
  solidPrimitive: CesiumGeometryOption<'solid' | 'fill'>[];
  outlinePrimitive: CesiumGeometryOption<'outline'>[];
  linePrimitive: CesiumGeometryOption<'line'>[];
  groundLinePrimitive: CesiumGeometryOption<'groundLine'>[];
  clampedPrimitives: Map<
    string,
    CesiumGeometryOption<'solid' | 'outline' | 'line' | 'fill'>[]
  >;
};

function createPrimitiveBatches(): PrimitiveBatches {
  return {
    classificationPrimitive: [],
    groundPrimitive: [],
    solidPrimitive: [],
    outlinePrimitive: [],
    linePrimitive: [],
    groundLinePrimitive: [],
    clampedPrimitives: new Map(),
  };
}

function addRelativeGeometryOptions(
  item: CesiumGeometryOption<'solid' | 'outline' | 'line' | 'fill'>,
  origin: [number, number],
  clampedPrimitivesMap: Map<
    string,
    CesiumGeometryOption<'solid' | 'outline' | 'line' | 'fill'>[]
  >,
): void {
  const clampOriginHash = `${origin.join(':')}:${
    item.heightInfo.heightReference
  }`;

  if (!clampedPrimitivesMap.has(clampOriginHash)) {
    clampedPrimitivesMap.set(clampOriginHash, []);
  }
  clampedPrimitivesMap.get(clampOriginHash)!.push(item);
}

function getPrimitiveBatches(
  items: (CesiumGeometryOption | ConvertedItem)[],
  feature: Feature,
  vectorProperties: VectorProperties,
  scene: Scene,
): { batches: PrimitiveBatches; convertedItems: ConvertedItem[] } {
  const convertedItems: ConvertedItem[] = [];
  const batches = createPrimitiveBatches();
  const classification = vectorProperties.getClassificationType(feature);
  const classificationSupported = ClassificationPrimitive.isSupported(scene);
  const groundPrimitiveSupported = GroundPrimitive.isSupported(scene);
  const groundLinePrimitiveSupported =
    GroundPolylinePrimitive.isSupported(scene);

  items.forEach((item) => {
    if (
      item.type === 'primitive' ||
      item.type === 'billboard' ||
      item.type === 'label'
    ) {
      convertedItems.push(item);
    } else if (item.type === 'groundLine') {
      if (groundLinePrimitiveSupported) {
        batches.groundLinePrimitive.push(item);
      }
    } else {
      const options = item as CesiumGeometryOption<
        'solid' | 'outline' | 'line' | 'fill'
      >;
      const { heightReference } = options.heightInfo;
      if (
        isRelativeHeightReference(heightReference) &&
        (options.heightInfo as VectorHeightInfo<RelativeHeightReference>)
          .clampOrigin
      ) {
        addRelativeGeometryOptions(
          options,
          (options.heightInfo as VectorHeightInfo<RelativeHeightReference>)
            .clampOrigin!,
          batches.clampedPrimitives,
        );
      } else if (item.type === 'fill' || item.type === 'solid') {
        if (isClampedHeightReference(heightReference)) {
          if (groundPrimitiveSupported) {
            batches.groundPrimitive.push(item);
          }
        } else if (classification != null) {
          if (classificationSupported) {
            batches.classificationPrimitive.push(item);
          }
        } else {
          batches.solidPrimitive.push(item);
        }
      } else if (item.type === 'outline') {
        // never clamped, never classified
        batches.outlinePrimitive.push(item);
      } else if (item.type === 'line') {
        // never clamped, never classified
        batches.linePrimitive.push(item);
      }
    }
  });

  return { batches, convertedItems };
}

function getClampedPrimitiveBatches(
  options: CesiumGeometryOption<'solid' | 'outline' | 'line' | 'fill'>[],
): PrimitiveBatches {
  const batches = createPrimitiveBatches();

  options.forEach((item) => {
    if (item.type === 'solid' || item.type === 'fill') {
      batches.solidPrimitive.push(item);
    } else if (item.type === 'outline') {
      batches.outlinePrimitive.push(item);
    } else if (item.type === 'line') {
      batches.linePrimitive.push(item);
    }
  });

  return batches;
}

function batchPrimitives(
  batches: PrimitiveBatches,
  feature: Feature,
  style: Style,
  vectorProperties: VectorProperties,
  scene: Scene,
): ConvertedItem[] {
  const convertedItems: ConvertedItem[] = [];

  if (batches.classificationPrimitive.length) {
    convertedItems.push(
      createClassificationPrimitiveItem(
        feature,
        style,
        vectorProperties,
        batches.classificationPrimitive,
      ),
    );
  }
  if (batches.solidPrimitive.length) {
    convertedItems.push(
      createSolidPrimitiveItem(
        feature,
        style,
        vectorProperties,
        scene,
        batches.solidPrimitive,
      ),
    );
  }
  if (batches.outlinePrimitive.length) {
    convertedItems.push(
      createOutlinePrimitiveItem(
        feature,
        style,
        vectorProperties,
        batches.outlinePrimitive,
      ),
    );
  }
  if (batches.linePrimitive.length) {
    convertedItems.push(
      createLinePrimitiveItem(
        feature,
        style,
        vectorProperties,
        batches.linePrimitive,
      ),
    );
  }
  if (batches.groundLinePrimitive.length) {
    convertedItems.push(
      createGroundLinePrimitiveItem(
        feature,
        style,
        vectorProperties,
        batches.groundLinePrimitive,
      ),
    );
  }
  if (batches.groundPrimitive.length) {
    convertedItems.push(
      createGroundPrimitiveItem(
        feature,
        style,
        vectorProperties,
        scene,
        batches.groundPrimitive,
      ),
    );
  }

  batches.clampedPrimitives.forEach((options, originHash) => {
    const [x, y, heightReference] = originHash.split(':').map(Number);
    const clampedBatches = getClampedPrimitiveBatches(options);
    const clampedItems = batchPrimitives(
      clampedBatches,
      feature,
      style,
      vectorProperties,
      scene,
    );
    clampedItems.forEach(({ item }) => {
      setupClampedPrimitive(
        scene,
        item as Primitive | Model,
        [x, y],
        heightReference,
      );
    });
    convertedItems.push(...clampedItems);
  });

  return convertedItems;
}

/**
 * Converts a feature and all its associated geometries to items which can be added to
 * cesium collections directly: Primitives, BillboardOptions or LabelOptions. This is
 * an internal API, typically it is enough to simple use a `VectorLayer` to handle conversions for you.
 * 1. All styles provided by the style like are flattened.
 * 2. All single OL geometries which should be rendered with each style are extracted
 * 3. Cesium geometry options are extracted from each OL geometry based on the geometry, feature & vector properties
 * 4. Cesium geometries which can be batched into a single primitive (for instance, an extruded volume would have all its solids batched and all its outlines batched
 *    In case of relativeTo* altitude modes, primitives are batched based _on the clamp origin_
 * 5. The converted items are returned, typically to the vector context which called convert in the first place.
 * @param  feature
 * @param  style
 * @param  vectorProperties
 * @param  scene
 */
export default async function convert(
  feature: Feature,
  style: StyleLike,
  vectorProperties: VectorProperties,
  scene: Scene,
): Promise<ConvertedItem[]> {
  const styles = getStylesArray(feature.getStyle() || style, feature, 0);
  const styledGeometries: { geometries: SingleGeometry[]; style: Style }[] =
    styles.map((currentStyle) => {
      const geometry = currentStyle.getGeometryFunction()(feature) as Geometry;
      if (geometry) {
        return {
          style: currentStyle,
          geometries: getSingleGeometriesFromGeometry(geometry),
        };
      }
      return {
        style: currentStyle,
        geometries: [],
      };
    });

  return (
    await Promise.all(
      styledGeometries.map(async ({ geometries, style: currentStyle }) => {
        const itemArrays = await Promise.all(
          geometries.map((geometry) =>
            getCesiumOptionsForSingleGeometry(
              feature,
              geometry,
              currentStyle,
              vectorProperties,
              scene,
            ),
          ),
        );

        const items = itemArrays.flat();
        const { batches, convertedItems } = getPrimitiveBatches(
          items,
          feature,
          vectorProperties,
          scene,
        );

        convertedItems.push(
          ...batchPrimitives(
            batches,
            feature,
            currentStyle,
            vectorProperties,
            scene,
          ),
        );
        return convertedItems;
      }),
    )
  ).flat();
}
