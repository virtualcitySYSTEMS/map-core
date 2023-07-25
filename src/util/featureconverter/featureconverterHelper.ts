import { getBottomLeft } from 'ol/extent.js';
import type { Feature } from 'ol/index.js';
import type { SimpleGeometry } from 'ol/geom.js';
import type { Style, Fill } from 'ol/style.js';
import type { Coordinate } from 'ol/coordinate.js';
import {
  Cartesian3,
  HeightReference,
  ColorGeometryInstanceAttribute,
  GeometryInstance,
  Material,
  SceneTransforms,
  MaterialAppearance,
  ClassificationType,
  PerInstanceColorAppearance,
  GroundPrimitive,
  GroundPolylinePrimitive,
  ClassificationPrimitive,
  ShadowMode,
  Primitive,
  Color,
  PolylineMaterialAppearance,
  type Scene,
  type PolylineGeometry,
  type GroundPolylineGeometry,
  type CircleOutlineGeometry,
  type WallOutlineGeometry,
  type PolygonOutlineGeometry,
  type PolygonGeometry,
  type CircleGeometry,
  type WallGeometry,
} from '@vcmap-cesium/engine';
import { getCesiumColor } from '../../style/styleHelpers.js';
import { createSync } from '../../layer/vectorSymbols.js';
import type VectorProperties from '../../layer/vectorProperties.js';
import type {
  VectorGeometryFactoryType,
  VectorHeightInfo,
} from '../../layer/vectorLayer.js';
import { CesiumVectorContext } from '../../layer/cesium/vectorContext.js';

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

export function createClassificationPrimitive(
  options: Partial<ConstructorParameters<typeof ClassificationPrimitive>[0]>,
  geometries: (PolygonGeometry | CircleGeometry | WallGeometry)[],
  color: Color,
  classificationType: ClassificationType,
): ClassificationPrimitive {
  const instances = geometries.map(
    (geometry) =>
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

  const classificationPrimitiveOptions = {
    ...options,
    geometryInstances: instances,
    appearance,
    shadows: ShadowMode.ENABLED,
    classificationType,
  };
  return new ClassificationPrimitive(classificationPrimitiveOptions);
}

export function createPrimitive(
  scene: Scene,
  vectorProperties: VectorProperties,
  allowPicking: boolean,
  feature: Feature,
  geometries: (PolygonGeometry | CircleGeometry | WallGeometry)[],
  style: Style,
  groundPrimitive: boolean,
): Primitive | GroundPrimitive | ClassificationPrimitive | null {
  const classificationType = vectorProperties.getClassificationType(feature);
  const options: Partial<ConstructorParameters<typeof Primitive>[0]> & {
    classificationType?: ClassificationType;
  } = {
    shadows: ShadowMode.ENABLED,
    allowPicking,
    asynchronous: !feature[createSync],
  };
  let primitive;
  if (classificationType !== undefined && !groundPrimitive) {
    if (!ClassificationPrimitive.isSupported(scene)) {
      return null;
    }
    const color = getCesiumColor(style.getFill()!.getColor(), [0, 0, 0, 1]);
    primitive = createClassificationPrimitive(
      options,
      geometries,
      color,
      classificationType,
    );
  } else {
    const instances = geometries.map(
      (geometry) =>
        new GeometryInstance({
          geometry,
        }),
    );
    options.geometryInstances = instances;
    const appearance = getMaterialAppearance(scene, style.getFill(), feature);
    options.appearance = appearance;
    if (groundPrimitive) {
      if (!GroundPrimitive.isSupported(scene)) {
        return null;
      }
      options.classificationType =
        classificationType || ClassificationType.TERRAIN;
      primitive = new GroundPrimitive(options);
    } else {
      primitive = new Primitive(options);
    }
  }
  return primitive;
}

export function createOutlinePrimitive(
  _scene: Scene,
  _vectorProperties: VectorProperties,
  allowPicking: boolean,
  feature: Feature,
  geometries: (PolygonGeometry | CircleGeometry | WallGeometry)[],
  style: Style,
): Primitive {
  const color = getCesiumColor(style.getStroke().getColor(), [0, 0, 0, 1]);
  const instances = geometries.map(
    (geometry) =>
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
  const options = {
    geometryInstances: instances,
    appearance,
    shadows: ShadowMode.ENABLED,
    allowPicking,
    asynchronous: !feature[createSync],
  };
  const primitive = new Primitive(options);
  return primitive;
}

export function createLinePrimitive(
  scene: Scene,
  vectorProperties: VectorProperties,
  allowPicking: boolean,
  feature: Feature,
  geometries: (PolylineGeometry | GroundPolylineGeometry)[],
  style: Style,
  groundPrimitive: boolean,
): Primitive | GroundPolylinePrimitive | null {
  const classificationType = vectorProperties.getClassificationType(feature);
  const instances = geometries.map(
    (geometry) =>
      new GeometryInstance({
        geometry,
      }),
  );

  const color = getCesiumColor(style.getStroke().getColor(), [0, 0, 0, 1]);
  let material;
  if (style.getStroke().getLineDash()) {
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

  const options: Partial<ConstructorParameters<typeof Primitive>[0]> & {
    classificationType?: ClassificationType;
  } = {
    geometryInstances: instances,
    appearance,
    shadows: ShadowMode.ENABLED,
    allowPicking,
    asynchronous: !feature[createSync],
  };
  let primitive;
  if (groundPrimitive) {
    if (!GroundPolylinePrimitive.isSupported(scene)) {
      return null;
    }
    options.classificationType =
      classificationType || ClassificationType.TERRAIN;
    primitive = new GroundPolylinePrimitive(options);
  } else {
    primitive = new Primitive(options);
  }
  return primitive;
}

/**
 * returns groundlevel or extracts the minimum height from the coordinates, returns 0 if no z coordinates are set
 * @param  groundLevel
 * @param  coordinates
 */
export function getMinHeightOrGroundLevel(
  groundLevel: number | null | undefined,
  coordinates?: Coordinate[],
): number {
  if (groundLevel != null && Number.isFinite(Number(groundLevel))) {
    return groundLevel;
  }
  if (coordinates) {
    let minimumHeight = Infinity;
    for (let i = 0; i < coordinates.length; i++) {
      minimumHeight =
        coordinates[i][2] < minimumHeight ? coordinates[i][2] : minimumHeight;
    }
    if (Number.isFinite(minimumHeight)) {
      return minimumHeight;
    }
  }
  return 0;
}

/**
 * @param  extrudedHeight should be a number > 0
 * @param  storeyHeights
 * @param  storeyNumber
 */
export function getStoreyHeights(
  extrudedHeight: number,
  storeyHeights: number[],
  storeyNumber: number,
): number[] {
  const positiveExtrudedHeight = Math.abs(extrudedHeight);
  const fittedStoreyHeights = [];
  if (storeyHeights.length) {
    let height = 0;
    for (let i = 0; i < storeyHeights.length; i++) {
      height += storeyHeights[i];
      if (height < positiveExtrudedHeight) {
        fittedStoreyHeights.push(storeyHeights[i]);
      } else {
        fittedStoreyHeights.push(
          storeyHeights[i] - (height - positiveExtrudedHeight),
        );
        return fittedStoreyHeights;
      }
    }
    const lastStoreyHeight = storeyHeights[storeyHeights.length - 1];
    while (height < positiveExtrudedHeight) {
      height += lastStoreyHeight;
      if (height < positiveExtrudedHeight) {
        fittedStoreyHeights.push(lastStoreyHeight);
      } else {
        fittedStoreyHeights.push(
          lastStoreyHeight - (height - positiveExtrudedHeight),
        );
        return fittedStoreyHeights;
      }
    }
  } else if (storeyNumber) {
    return new Array(storeyNumber).fill(
      positiveExtrudedHeight / storeyNumber,
    ) as number[];
  }
  // case no predefined storeyHeights
  return [positiveExtrudedHeight];
}

export function validateStoreys(
  storeys: number,
  storeyHeights: number[],
): void {
  if (storeys && storeyHeights.length) {
    const missingStoreyHeights = storeys - storeyHeights.length;
    if (missingStoreyHeights > 0) {
      storeyHeights.push(
        ...(new Array(missingStoreyHeights).fill(
          storeyHeights[storeyHeights.length - 1],
        ) as number[]),
      );
    } else if (missingStoreyHeights < 0) {
      storeyHeights.splice(storeyHeights.length + missingStoreyHeights);
    }
    if (storeys > 100) {
      storeyHeights.splice(100);
    }
  } else {
    storeyHeights.splice(0);
  }
}

export function getHeightAboveGround(
  feature: Feature,
  heightReference: HeightReference,
  vectorProperties: VectorProperties,
): number {
  if (heightReference === HeightReference.RELATIVE_TO_GROUND) {
    return vectorProperties.getHeightAboveGround(feature);
  }
  return 0;
}

export function getHeightInfo(
  feature: Feature,
  vectorProperties: VectorProperties,
  coordinates: Coordinate[],
): VectorHeightInfo {
  const extrudedHeight = vectorProperties.getExtrudedHeight(feature);

  let storeysAboveGround = vectorProperties.getStoreysAboveGround(feature);
  let storeysBelowGround = vectorProperties.getStoreysBelowGround(feature);
  let storeyHeightsAboveGround =
    vectorProperties.getStoreyHeightsAboveGround(feature);
  let storeyHeightsBelowGround =
    vectorProperties.getStoreyHeightsBelowGround(feature);
  if (extrudedHeight) {
    // current Case only extrudedHeight
    if (extrudedHeight > 0) {
      storeyHeightsAboveGround = getStoreyHeights(
        extrudedHeight,
        storeyHeightsAboveGround,
        storeysAboveGround,
      );
      storeysAboveGround = storeyHeightsAboveGround.length;
      storeyHeightsBelowGround = [];
      storeysBelowGround = 0;
    } else if (extrudedHeight < 0) {
      storeyHeightsBelowGround = getStoreyHeights(
        extrudedHeight,
        storeyHeightsBelowGround,
        storeysBelowGround,
      );
      storeysBelowGround = storeyHeightsBelowGround.length;
      storeyHeightsAboveGround = [];
      storeysAboveGround = 0;
    }
  }

  validateStoreys(storeysAboveGround, storeyHeightsAboveGround);
  validateStoreys(storeysBelowGround, storeyHeightsBelowGround);

  const skirt = vectorProperties.getSkirt(feature);
  const olcsGroundLevel = vectorProperties.getGroundLevel(feature);

  const heightReference = vectorProperties.getAltitudeMode(feature);
  const heightAboveGroundAdjustment = getHeightAboveGround(
    feature,
    heightReference,
    vectorProperties,
  );

  const groundLevel =
    getMinHeightOrGroundLevel(olcsGroundLevel, coordinates) +
    heightAboveGroundAdjustment;
  const hasZCoordinate = !!coordinates.find((value) => value[2]);

  const extruded = !!(
    storeyHeightsAboveGround.length ||
    storeyHeightsBelowGround.length ||
    skirt
  );
  const perPositionHeight =
    hasZCoordinate &&
    olcsGroundLevel == null &&
    (!extruded ||
      (extruded &&
        storeyHeightsAboveGround.length + storeyHeightsBelowGround.length ===
          1));

  return {
    extruded,
    storeyHeightsAboveGround,
    storeyHeightsBelowGround,
    skirt,
    groundLevel,
    perPositionHeight,
    heightReference,
    heightAboveGroundAdjustment,
  };
}

type StoreyOptions = { currentHeight: number; extrudedHeight: number };

export function getStoreyOptions(
  storeyHeights: number[],
  initialHeight: number,
  down?: boolean,
  result?: StoreyOptions[],
): StoreyOptions[] {
  const direction = down ? -1 : 1;
  let currentHeight = initialHeight;
  const storeys = storeyHeights.length;
  const options = new Array(storeys);
  for (let i = 0; i < storeys; i++) {
    const extrudedHeight = currentHeight + direction * storeyHeights[i];
    options[i] = {
      currentHeight,
      extrudedHeight,
    };
    currentHeight = extrudedHeight;
  }

  if (result) {
    result.push(...(options as StoreyOptions[]));
    return result;
  }
  return options as StoreyOptions[];
}

export function addPrimitivesToContext(
  feature: Feature,
  style: Style,
  geometries: SimpleGeometry[],
  vectorProperties: VectorProperties,
  scene: Scene,
  geometryFactory: VectorGeometryFactoryType,
  context: CesiumVectorContext,
): void {
  // no geometries, so early escape
  if (!geometries.length) {
    return;
  }

  const fillGeometries: (PolygonGeometry | CircleGeometry | WallGeometry)[] =
    [];
  const outlineGeometries: (
    | CircleOutlineGeometry
    | WallOutlineGeometry
    | PolygonOutlineGeometry
  )[] = [];
  const lineGeometries: (PolylineGeometry | GroundPolylineGeometry)[] = [];

  const heightInfo = getHeightInfo(
    feature,
    vectorProperties,
    geometryFactory.getCoordinates(geometries),
  );

  const hasFill = !!style.getFill();
  const hasStroke = !!style.getStroke();

  let groundPrimitive = false;

  geometries.forEach((geometry) => {
    const geometryOptions = geometryFactory.getGeometryOptions(
      geometry,
      heightInfo.heightAboveGroundAdjustment,
    );
    const storeyOptions = getStoreyOptions(
      heightInfo.storeyHeightsAboveGround,
      heightInfo.groundLevel,
    );
    getStoreyOptions(
      heightInfo.storeyHeightsBelowGround,
      heightInfo.groundLevel,
      true,
      storeyOptions,
    );

    if (hasFill) {
      storeyOptions.forEach((options) => {
        fillGeometries.push(
          ...geometryFactory.createSolidGeometries(
            geometryOptions,
            options.currentHeight,
            heightInfo.perPositionHeight,
            options.extrudedHeight,
          ),
        );
      });
    }
    if (hasStroke) {
      storeyOptions.forEach((options) => {
        outlineGeometries.push(
          ...geometryFactory.createOutlineGeometries(
            geometryOptions,
            options.currentHeight,
            heightInfo.perPositionHeight,
            options.extrudedHeight,
          ),
        );
      });
    }
    if (heightInfo.skirt) {
      const currentHeight =
        heightInfo.groundLevel -
        heightInfo.storeyHeightsBelowGround.reduce((a, b) => a + b, 0);
      const extrudedHeight = currentHeight - heightInfo.skirt;
      const skirtPositionHeight = heightInfo.storeyHeightsBelowGround.length
        ? false
        : heightInfo.perPositionHeight;
      if (hasFill) {
        fillGeometries.push(
          ...geometryFactory.createSolidGeometries(
            geometryOptions,
            currentHeight,
            skirtPositionHeight,
            extrudedHeight,
          ),
        );
      }
      if (hasStroke) {
        outlineGeometries.push(
          ...geometryFactory.createOutlineGeometries(
            geometryOptions,
            currentHeight,
            skirtPositionHeight,
            extrudedHeight,
          ),
        );
      }
    }

    if (!heightInfo.extruded) {
      if (heightInfo.heightReference === HeightReference.CLAMP_TO_GROUND) {
        groundPrimitive = true;
      }
      if (hasFill) {
        fillGeometries.push(
          ...geometryFactory.createFillGeometries(
            geometryOptions,
            heightInfo.groundLevel,
            heightInfo.perPositionHeight,
          ),
        );
      }
      if (hasStroke) {
        if (heightInfo.heightReference === HeightReference.CLAMP_TO_GROUND) {
          lineGeometries.push(
            ...geometryFactory.createGroundLineGeometries(
              geometryOptions,
              style,
            ),
          );
        } else {
          lineGeometries.push(
            ...geometryFactory.createLineGeometries(geometryOptions, style),
          );
        }
      }
    }
  });

  const allowPicking = vectorProperties.getAllowPicking(feature);
  const primitives = [];
  if (lineGeometries.length) {
    const linePrimitive = createLinePrimitive(
      scene,
      vectorProperties,
      allowPicking,
      feature,
      lineGeometries,
      style,
      groundPrimitive,
    );
    if (linePrimitive) {
      primitives.push(linePrimitive);
    }
  }

  if (fillGeometries.length) {
    const fillPrimitive = createPrimitive(
      scene,
      vectorProperties,
      allowPicking,
      feature,
      fillGeometries,
      style,
      groundPrimitive,
    );
    if (fillPrimitive) {
      primitives.push(fillPrimitive);
    }
  }

  if (outlineGeometries.length) {
    const outlinePrimitive = createOutlinePrimitive(
      scene,
      vectorProperties,
      allowPicking,
      feature,
      outlineGeometries,
      style,
    );
    if (outlinePrimitive) {
      primitives.push(outlinePrimitive);
    }
  }

  context.addPrimitives(primitives, feature, allowPicking);
}
