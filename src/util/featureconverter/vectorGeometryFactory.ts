import type { Feature } from 'ol';
import type { Fill, Style } from 'ol/style.js';
import { getBottomLeft } from 'ol/extent.js';
import { Circle, LineString, Polygon } from 'ol/geom.js';
import {
  Cartesian3,
  type CircleGeometry,
  type CircleOutlineGeometry,
  ClassificationPrimitive,
  ClassificationType,
  Color,
  ColorGeometryInstanceAttribute,
  GeometryInstance,
  type GroundPolylineGeometry,
  GroundPolylinePrimitive,
  GroundPrimitive,
  HeightReference,
  Material,
  MaterialAppearance,
  PerInstanceColorAppearance,
  type PolygonGeometry,
  type PolygonOutlineGeometry,
  type PolylineGeometry,
  PolylineMaterialAppearance,
  Primitive,
  type Scene,
  SceneTransforms,
  ShadowMode,
  type WallGeometry,
  type WallOutlineGeometry,
} from '@vcmap-cesium/engine';
import type VectorProperties from '../../layer/vectorProperties.js';
import type { ConvertedItem } from './convert.js';
import { getCesiumColor } from '../../style/styleHelpers.js';
import { createSync } from '../../layer/vectorSymbols.js';
import {
  getGeometryHeight,
  isClampedHeightReference,
  RelativeHeightReference,
  VectorHeightInfo,
} from './vectorHeightInfo.js';
import { ColorType } from '../../style/vectorStyleItem.js';
import { getStoreyOptions } from './storeyHelpers.js';

export type PolygonGeometryOptions = ConstructorParameters<
  typeof PolygonGeometry
>[0];

export type PolylineGeometryOptions = ConstructorParameters<
  typeof PolylineGeometry
>[0];

export type CircleGeometryOptions = ConstructorParameters<
  typeof CircleGeometry
>[0];

export type GeometryFactoryType = 'polygon' | 'lineString' | 'circle' | 'arc';

type GeometryOptionsForFactoryType<T extends GeometryFactoryType> =
  T extends 'polygon'
    ? PolygonGeometryOptions
    : T extends 'lineString' | 'arc'
    ? PolylineGeometryOptions
    : T extends 'circle'
    ? CircleGeometryOptions
    : never;

export type GeometryForFactoryType<T extends GeometryFactoryType> =
  T extends 'polygon'
    ? Polygon
    : T extends 'lineString' | 'arc'
    ? LineString
    : T extends 'circle'
    ? Circle
    : never;

export type VectorGeometryFactory<
  T extends GeometryFactoryType = GeometryFactoryType,
> = {
  type: T;
  getGeometryOptions(
    geom: GeometryForFactoryType<T>,
    heightInfo: VectorHeightInfo,
  ): GeometryOptionsForFactoryType<T>;
  createSolidGeometries(
    geometryOptions: GeometryOptionsForFactoryType<T>,
    heightInfo: VectorHeightInfo,
    height: number,
    perPositionHeight: boolean,
    extrudedHeight?: number,
  ): CesiumGeometryOption<'solid'>[];
  createOutlineGeometries(
    geometryOptions: GeometryOptionsForFactoryType<T>,
    heightInfo: VectorHeightInfo,
    height: number,
    perPositionHeight: boolean,
    extrudedHeight?: number,
  ): CesiumGeometryOption<'outline'>[];
  createFillGeometries(
    geometryOptions: GeometryOptionsForFactoryType<T>,
    heightInfo: VectorHeightInfo,
    height: number,
    perPositionHeight: boolean,
  ): CesiumGeometryOption<'fill'>[];
  createGroundLineGeometries(
    geometryOptions: GeometryOptionsForFactoryType<T>,
    heightInfo: VectorHeightInfo,
    style: Style,
  ): CesiumGeometryOption<'groundLine'>[];
  createLineGeometries(
    geometryOptions: GeometryOptionsForFactoryType<T>,
    heightInfo: VectorHeightInfo,
    style: Style,
  ): CesiumGeometryOption<'line'>[];
  validateGeometry(geom: GeometryForFactoryType<T>): boolean;
};

export type CesiumGeometryOptionType =
  | 'solid'
  | 'fill'
  | 'outline'
  | 'line'
  | 'groundLine';

export type CesiumGeometryOption<
  T extends CesiumGeometryOptionType = CesiumGeometryOptionType,
> = T extends 'solid'
  ? {
      type: T;
      geometry: PolygonGeometry | WallGeometry | CircleGeometry;
      heightInfo: VectorHeightInfo;
    }
  : T extends 'fill'
  ? {
      type: T;
      geometry: PolygonGeometry | CircleGeometry;
      heightInfo: VectorHeightInfo;
    }
  : T extends 'outline'
  ? {
      type: T;
      geometry:
        | PolygonOutlineGeometry
        | WallOutlineGeometry
        | CircleOutlineGeometry;
      heightInfo: VectorHeightInfo;
    }
  : T extends 'line'
  ? {
      type: T;
      geometry: PolylineGeometry;
      heightInfo: VectorHeightInfo;
    }
  : T extends 'groundLine'
  ? {
      type: T;
      geometry: GroundPolylineGeometry;
      heightInfo: VectorHeightInfo;
    }
  : never;

export function getMaterialAppearance(
  scene: Scene,
  fill: Fill,
  feature: Feature,
): MaterialAppearance {
  const options: ConstructorParameters<typeof MaterialAppearance>[0] = {
    flat: true,
    renderState: {
      depthTest: {
        enabled: true,
      },
    },
  };
  const fillColor = fill.getColor();
  if (fillColor instanceof CanvasPattern) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.fillStyle = fillColor;
    ctx.fillRect(0, 0, 300, 300);
    options.material = Material.fromType('Wallpaper', {
      image: canvas,
      anchor: SceneTransforms.wgs84ToDrawingBufferCoordinates(
        scene,
        Cartesian3.fromDegreesArray(
          getBottomLeft(feature.getGeometry()!.getExtent()),
        )[0],
      ),
    });
  } else {
    const color = getCesiumColor(fillColor as string, [0, 0, 0, 1]);
    options.material = Material.fromType('Color', {
      color,
    });
    options.translucent = color.alpha !== 1;
  }
  return new MaterialAppearance(options);
}

function getClassificationForHeightReference(
  heightReference: HeightReference,
): ClassificationType {
  if (heightReference === HeightReference.CLAMP_TO_TERRAIN) {
    return ClassificationType.TERRAIN;
  }

  if (heightReference === HeightReference.CLAMP_TO_3D_TILE) {
    return ClassificationType.CESIUM_3D_TILE;
  }

  return ClassificationType.BOTH;
}

export function createClassificationPrimitiveItem(
  feature: Feature,
  style: Style,
  vectorProperties: VectorProperties,
  geometries: CesiumGeometryOption<'fill' | 'solid'>[],
): ConvertedItem<'primitive'> {
  const classificationType = vectorProperties.getClassificationType(feature);
  const allowPicking = vectorProperties.getAllowPicking(feature);
  const color = getCesiumColor(
    style.getFill()!.getColor() as ColorType, // XXX PatternDescriptor
    [0, 0, 0, 1],
  );
  const geometryInstances = geometries.map(
    ({ geometry }) =>
      new GeometryInstance({
        geometry,
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(color),
        },
      }),
  );

  const appearance = new PerInstanceColorAppearance({
    flat: false,
    renderState: {
      depthTest: {
        enabled: true,
      },
      lineWidth: 1,
    },
    translucent: color.alpha !== 1,
  });

  return {
    type: 'primitive',
    item: new ClassificationPrimitive({
      allowPicking,
      asynchronous: !feature[createSync],
      classificationType,
      geometryInstances,
      appearance,
    }),
  };
}

export function createSolidPrimitiveItem(
  feature: Feature,
  style: Style,
  vectorProperties: VectorProperties,
  scene: Scene,
  geometries: CesiumGeometryOption<'fill' | 'solid'>[],
): ConvertedItem<'primitive'> {
  const allowPicking = vectorProperties.getAllowPicking(feature);

  const geometryInstances = geometries.map(
    ({ geometry }) =>
      new GeometryInstance({
        geometry,
      }),
  );

  const appearance = getMaterialAppearance(scene, style.getFill()!, feature);

  return {
    type: 'primitive',
    item: new Primitive({
      shadows: ShadowMode.ENABLED,
      allowPicking,
      asynchronous: !feature[createSync],
      geometryInstances,
      appearance,
    }),
  };
}

export function createGroundPrimitiveItem(
  feature: Feature,
  style: Style,
  vectorProperties: VectorProperties,
  scene: Scene,
  geometries: CesiumGeometryOption<'fill' | 'solid'>[],
): ConvertedItem<'primitive'> {
  const allowPicking = vectorProperties.getAllowPicking(feature);

  const geometryInstances = geometries.map(
    ({ geometry }) =>
      new GeometryInstance({
        geometry,
      }),
  );

  const appearance = getMaterialAppearance(scene, style.getFill()!, feature);
  const classificationType =
    vectorProperties.getClassificationType(feature) ??
    getClassificationForHeightReference(
      geometries[0].heightInfo.heightReference,
    );

  return {
    type: 'primitive',
    item: new GroundPrimitive({
      classificationType,
      allowPicking,
      asynchronous: !feature[createSync],
      geometryInstances,
      appearance,
    }),
  };
}

export function createOutlinePrimitiveItem(
  feature: Feature,
  style: Style,
  vectorProperties: VectorProperties,
  geometries: CesiumGeometryOption<'outline'>[],
): ConvertedItem<'primitive'> {
  const allowPicking = vectorProperties.getAllowPicking(feature);

  const color = getCesiumColor(style.getStroke()!.getColor(), [0, 0, 0, 1]);
  const instances = geometries.map(
    ({ geometry }) =>
      new GeometryInstance({
        geometry,
        attributes: {
          color: ColorGeometryInstanceAttribute.fromColor(color),
        },
      }),
  );
  const appearance = new PerInstanceColorAppearance({
    flat: true,
    renderState: {
      depthTest: {
        enabled: true,
      },
      lineWidth: 1,
    },
    translucent: color.alpha !== 1,
  });

  return {
    type: 'primitive',
    item: new Primitive({
      geometryInstances: instances,
      appearance,
      shadows: ShadowMode.ENABLED,
      allowPicking,
      asynchronous: !feature[createSync],
    }),
  };
}

export function createLinePrimitiveItem(
  feature: Feature,
  style: Style,
  vectorProperties: VectorProperties,
  geometries: CesiumGeometryOption<'line'>[],
): ConvertedItem<'primitive'> {
  const allowPicking = vectorProperties.getAllowPicking(feature);
  const instances = geometries.map(
    ({ geometry }) =>
      new GeometryInstance({
        geometry,
      }),
  );

  const color = getCesiumColor(style.getStroke()!.getColor(), [0, 0, 0, 1]);
  let material;
  if (style.getStroke()?.getLineDash()) {
    material = Material.fromType('Stripe', {
      horizontal: false,
      repeat: 500,
      evenColor: color,
      oddColor: new Color(0, 0, 0, 0), // transparent
    });
  } else {
    material = Material.fromType('Color', { color });
  }

  const appearance = new PolylineMaterialAppearance({
    renderState: {
      depthTest: {
        enabled: true,
      },
      lineWidth: 1,
    },
    translucent: color.alpha !== 1,
    material,
  });

  return {
    type: 'primitive',
    item: new Primitive({
      geometryInstances: instances,
      appearance,
      shadows: ShadowMode.ENABLED,
      allowPicking,
      asynchronous: !feature[createSync],
    }),
  };
}

export function createGroundLinePrimitiveItem(
  feature: Feature,
  style: Style,
  vectorProperties: VectorProperties,
  geometries: CesiumGeometryOption<'groundLine'>[],
): ConvertedItem<'primitive'> {
  const allowPicking = vectorProperties.getAllowPicking(feature);
  const instances = geometries.map(
    ({ geometry }) =>
      new GeometryInstance({
        geometry,
      }),
  );

  const color = getCesiumColor(style.getStroke()!.getColor(), [0, 0, 0, 1]);
  let material;
  if (style.getStroke()?.getLineDash()) {
    material = Material.fromType('Stripe', {
      horizontal: false,
      repeat: 500,
      evenColor: color,
      oddColor: new Color(0, 0, 0, 0), // transparent
    });
  } else {
    material = Material.fromType('Color', { color });
  }

  const appearance = new PolylineMaterialAppearance({
    renderState: {
      depthTest: {
        enabled: true,
      },
      lineWidth: 1,
    },
    translucent: color.alpha !== 1,
    material,
  });

  const classificationType =
    vectorProperties.getClassificationType(feature) ??
    getClassificationForHeightReference(
      geometries[0].heightInfo.heightReference,
    );

  return {
    type: 'primitive',
    item: new GroundPolylinePrimitive({
      classificationType,
      geometryInstances: instances,
      appearance,
      allowPicking,
      asynchronous: !feature[createSync],
    }),
  };
}

export function getCesiumGeometriesOptions<T extends GeometryFactoryType>(
  style: Style,
  geometry: GeometryForFactoryType<T>,
  geometryFactory: VectorGeometryFactory<T>,
  heightInfo: VectorHeightInfo,
): CesiumGeometryOption[] {
  const hasFill = !!style.getFill();
  const hasStroke = !!style.getStroke();

  const cesiumGeometryOptions: CesiumGeometryOption[] = [];
  const geometryOptions = geometryFactory.getGeometryOptions(
    geometry,
    heightInfo,
  );

  if (isClampedHeightReference(heightInfo.heightReference)) {
    if (hasFill) {
      cesiumGeometryOptions.push(
        ...geometryFactory.createFillGeometries(
          geometryOptions,
          heightInfo,
          0,
          false,
        ),
      );
    }
    if (hasStroke) {
      cesiumGeometryOptions.push(
        ...geometryFactory.createGroundLineGeometries(
          geometryOptions,
          heightInfo,
          style,
        ),
      );
    }
  } else {
    const nonClampedHeightInfo = heightInfo as VectorHeightInfo<
      RelativeHeightReference | HeightReference.NONE
    >;
    const { extruded, perPositionHeight } = nonClampedHeightInfo;
    const geometryHeight = getGeometryHeight(geometry, nonClampedHeightInfo);

    if (extruded) {
      const storeyOptions = getStoreyOptions(
        nonClampedHeightInfo,
        geometryHeight,
      );

      if (hasFill) {
        storeyOptions.storeys.forEach((options) => {
          cesiumGeometryOptions.push(
            ...geometryFactory.createSolidGeometries(
              geometryOptions,
              heightInfo,
              options.currentHeight,
              perPositionHeight,
              options.extrudedHeight,
            ),
          );
        });
      }
      if (hasStroke) {
        storeyOptions.storeys.forEach((options) => {
          cesiumGeometryOptions.push(
            ...geometryFactory.createOutlineGeometries(
              geometryOptions,
              heightInfo,
              options.currentHeight,
              perPositionHeight,
              options.extrudedHeight,
            ),
          );
        });
      }
      if (nonClampedHeightInfo.skirt) {
        const currentHeight = storeyOptions.skirtLevel;

        const extrudedHeight = currentHeight - nonClampedHeightInfo.skirt;
        const skirtPositionHeight = nonClampedHeightInfo
          .storeyHeightsBelowGround.length
          ? false
          : perPositionHeight;

        if (hasFill) {
          cesiumGeometryOptions.push(
            ...geometryFactory.createSolidGeometries(
              geometryOptions,
              heightInfo,
              currentHeight,
              skirtPositionHeight,
              extrudedHeight,
            ),
          );
        }
        if (hasStroke) {
          cesiumGeometryOptions.push(
            ...geometryFactory.createOutlineGeometries(
              geometryOptions,
              heightInfo,
              currentHeight,
              skirtPositionHeight,
              extrudedHeight,
            ),
          );
        }
      }
    } else {
      if (hasFill) {
        cesiumGeometryOptions.push(
          ...geometryFactory.createFillGeometries(
            geometryOptions,
            heightInfo,
            geometryHeight,
            perPositionHeight,
          ),
        );
      }
      if (hasStroke) {
        cesiumGeometryOptions.push(
          ...geometryFactory.createLineGeometries(
            geometryOptions,
            heightInfo,
            style,
          ),
        );
      }
    }
  }

  return cesiumGeometryOptions;
}
