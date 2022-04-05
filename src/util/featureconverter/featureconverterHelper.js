import { getBottomLeft } from 'ol/extent.js';
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
} from '@vcmap/cesium';
import { parseInteger, parseNumber } from '@vcsuite/parsers';
import { getCesiumColor } from '../../style/styleHelpers.js';

/**
 * @param {import("@vcmap/cesium").Scene} scene
 * @param {import("ol/style/Fill").default} fill
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @returns {import("@vcmap/cesium").MaterialAppearance}
 */
export function getMaterialAppearance(scene, fill, feature) {
  const options = {
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
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = fillColor;
    ctx.fillRect(0, 0, 300, 300);
    options.material = Material.fromType('Wallpaper', {
      image: canvas,
      anchor: SceneTransforms.wgs84ToDrawingBufferCoordinates(
        scene,
        Cartesian3.fromDegreesArray(getBottomLeft(feature.getGeometry().getExtent()))[0],
      ),
    });
  } else {
    const color = getCesiumColor(fillColor, [0, 0, 0, 1]);
    options.material = Material.fromType('Color', {
      color,
    });
    options.translucent = color.alpha !== 1;
  }
  return new MaterialAppearance(options);
}

/**
 *
 * @param {Object} options
 * @param {Array<import("@vcmap/cesium").Geometry>} geometries
 * @param {import("@vcmap/cesium").Color} color
 * @param {import("@vcmap/cesium").ClassificationType} classificationType
 * @returns {import("@vcmap/cesium").ClassificationPrimitive}
 */
export function createClassificationPrimitive(options, geometries, color, classificationType) {
  const instances = geometries.map(geometry => new GeometryInstance({
    geometry,
    attributes: {
      color: ColorGeometryInstanceAttribute.fromColor(color),
    },
  }));

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

/**
 *
 * @param {import("@vcmap/cesium").Scene} scene
 * @param {import("@vcmap/core").VectorProperties} vectorProperties
 * @param {boolean} allowPicking
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {Array<import("@vcmap/cesium").Geometry>} geometries
 * @param {import("ol/style/Style").default} style
 * @param {boolean} groundPrimitive
 * @returns {import("@vcmap/cesium").Primitive|import("@vcmap/cesium").GroundPrimitive|import("@vcmap/cesium").ClassificationPrimitive|null}
 */
export function createPrimitive(scene, vectorProperties, allowPicking, feature, geometries, style, groundPrimitive) {
  const classificationType = vectorProperties.getClassificationType(feature);
  const options = {
    shadows: ShadowMode.ENABLED,
    allowPicking,
  };
  let primitive;
  if (classificationType !== undefined && !groundPrimitive) {
    if (!ClassificationPrimitive.isSupported(scene)) {
      return null;
    }
    const color = getCesiumColor(style.getFill().getColor(), [0, 0, 0, 1]);
    primitive = createClassificationPrimitive(options, geometries, color, classificationType);
  } else {
    const instances = geometries.map(geometry => new GeometryInstance({
      geometry,
    }));
    options.geometryInstances = instances;
    const appearance = getMaterialAppearance(scene, style.getFill(), feature);
    options.appearance = appearance;
    if (groundPrimitive) {
      if (!GroundPrimitive.isSupported(scene)) {
        return null;
      }
      options.classificationType = classificationType || ClassificationType.TERRAIN;
      primitive = new GroundPrimitive(options);
    } else {
      primitive = new Primitive(options);
    }
  }
  return primitive;
}

/**
 *
 * @param {import("@vcmap/cesium").Scene} scene
 * @param {import("@vcmap/core").VectorProperties} vectorProperties
 * @param {boolean} allowPicking
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {Array<import("@vcmap/cesium").Geometry>} geometries
 * @param {import("ol/style/Style").default} style
 * @returns {import("@vcmap/cesium").Primitive}
 */
export function createOutlinePrimitive(scene, vectorProperties, allowPicking, feature, geometries, style) {
  const color = getCesiumColor(style.getStroke().getColor(), [0, 0, 0, 1]);
  const instances = geometries.map(geometry => new GeometryInstance({
    geometry,
    attributes: {
      color: ColorGeometryInstanceAttribute.fromColor(color),
    },
  }));
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
  };
  const primitive = new Primitive(options);
  return primitive;
}

/**
 *
 * @param {import("@vcmap/cesium").Scene} scene
 * @param {import("@vcmap/core").VectorProperties} vectorProperties
 * @param {boolean} allowPicking
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {Array<import("@vcmap/cesium").PolylineGeometry|import("@vcmap/cesium").GroundPolylineGeometry>} geometries
 * @param {import("ol/style/Style").default} style
 * @param {boolean} groundPrimitive
 * @returns {import("@vcmap/cesium").Primitive|import("@vcmap/cesium").GroundPolylinePrimitive|null}
 */
export function createLinePrimitive(
  scene, vectorProperties, allowPicking, feature, geometries, style, groundPrimitive,
) {
  const classificationType = vectorProperties.getClassificationType(feature);
  const instances = geometries.map(geometry => new GeometryInstance({
    geometry,
  }));

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

  const options = {
    geometryInstances: instances,
    appearance,
    shadows: ShadowMode.ENABLED,
    allowPicking,
  };
  let primitive;
  if (groundPrimitive) {
    if (!GroundPolylinePrimitive.isSupported(scene)) {
      return null;
    }
    options.classificationType = classificationType || ClassificationType.TERRAIN;
    primitive = new GroundPolylinePrimitive(options);
  } else {
    primitive = new Primitive(options);
  }
  return primitive;
}

/**
 * returns groundlevel or extracts the minimum height from the coordinates, returns 0 if no z coordinates are set
 * @param {number|null|undefined} groundLevel
 * @param {Array<import("ol/coordinate").Coordinate>=} coordinates
 * @returns {number}
 */
export function getMinHeightOrGroundLevel(groundLevel, coordinates) {
  if (groundLevel != null && Number.isFinite(Number(groundLevel))) {
    return groundLevel;
  }
  if (coordinates) {
    let minimumHeight = Infinity;
    for (let i = 0; i < coordinates.length; i++) {
      minimumHeight = coordinates[i][2] < minimumHeight ? coordinates[i][2] : minimumHeight;
    }
    if (Number.isFinite(minimumHeight)) {
      return minimumHeight;
    }
  }
  return 0;
}


/**
 * @param {number} extrudedHeight should be a number > 0
 * @param {Array<number>} storeyHeights
 * @param {number} storeyNumber
 * @returns {Array<number>}
 */
export function getStoreyHeights(extrudedHeight, storeyHeights, storeyNumber) {
  const positiveExtrudedHeight = Math.abs(extrudedHeight);
  const fittedStoreyHeights = [];
  if (storeyHeights.length) {
    let height = 0;
    for (let i = 0; i < storeyHeights.length; i++) {
      height += storeyHeights[i];
      if (height < positiveExtrudedHeight) {
        fittedStoreyHeights.push(storeyHeights[i]);
      } else {
        fittedStoreyHeights.push(storeyHeights[i] - (height - positiveExtrudedHeight));
        return fittedStoreyHeights;
      }
    }
    const lastStoreyHeight = storeyHeights[storeyHeights.length - 1];
    while (height < positiveExtrudedHeight) {
      height += lastStoreyHeight;
      if (height < positiveExtrudedHeight) {
        fittedStoreyHeights.push(lastStoreyHeight);
      } else {
        fittedStoreyHeights.push(lastStoreyHeight - (height - positiveExtrudedHeight));
        return fittedStoreyHeights;
      }
    }
  } else if (storeyNumber) {
    return new Array(storeyNumber).fill(positiveExtrudedHeight / storeyNumber);
  }
  // case no predefined storeyHeights
  return [positiveExtrudedHeight];
}


/**
 * @param {number} storeys
 * @param {Array<number>} storeyHeights
 */
export function validateStoreys(storeys, storeyHeights) {
  if (storeys && storeyHeights.length) {
    const missingStoreyHeights = storeys - storeyHeights.length;
    if (missingStoreyHeights > 0) {
      storeyHeights.push(
        ...new Array(missingStoreyHeights).fill(storeyHeights[storeyHeights.length - 1]),
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

/**
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {import("@vcmap/cesium").HeightReference} heightReference
 * @param {import("@vcmap/core").VectorProperties} vectorProperties
 * @returns {number}
 */
export function getHeightAboveGround(feature, heightReference, vectorProperties) {
  if (heightReference === HeightReference.RELATIVE_TO_GROUND) {
    return vectorProperties.getHeightAboveGround(feature);
  }
  return 0;
}

/**
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {import("@vcmap/core").VectorProperties} vectorProperties
 * @param {Array<import("ol/coordinate").Coordinate>} coordinates
 * @returns {VectorHeightInfo}
 */
export function getHeightInfo(feature, vectorProperties, coordinates) {
  const extrudedHeight = vectorProperties.getExtrudedHeight(feature);
  const storeyNumber = Math.abs(parseInteger(feature.get('olcs_storeyNumber'), 0)); // legacy
  const storeyHeight = Math.abs(parseNumber(feature.get('olcs_storeyHeight'), 0)); // legacy
  let storeysAboveGround = 0;
  let storeysBelowGround = 0;
  let storeyHeightsAboveGround = [];
  let storeyHeightsBelowGround = [];

  // legacy CASE
  if (storeyHeight || storeyNumber) {
    if (extrudedHeight && extrudedHeight > 0 && storeyHeight) {
      storeysAboveGround = Math.ceil(extrudedHeight / storeyHeight);
      storeyHeightsAboveGround = new Array(storeysAboveGround - 1).fill(storeyHeight);
      storeyHeightsAboveGround.push(extrudedHeight - (storeysAboveGround - 1) * storeyHeight);
    } else if (extrudedHeight && extrudedHeight < 0 && storeyHeight) {
      storeysBelowGround = Math.ceil(Math.abs(extrudedHeight / storeyHeight));
      storeyHeightsBelowGround = new Array(storeysBelowGround - 1).fill(storeyHeight);
      storeyHeightsBelowGround.push(Math.abs(extrudedHeight) - (storeysBelowGround - 1) * storeyHeight);
    } else if (extrudedHeight && extrudedHeight > 0 && storeyNumber) {
      storeysAboveGround = storeyNumber;
      const currentStoreyHeight = Math.abs(extrudedHeight / storeyNumber);
      storeyHeightsAboveGround = new Array(storeyNumber).fill(currentStoreyHeight);
    } else if (extrudedHeight && extrudedHeight < 0 && storeyNumber) {
      storeysBelowGround = storeyNumber;
      const currentStoreyHeight = Math.abs(extrudedHeight / storeyNumber);
      storeyHeightsBelowGround = new Array(storeyNumber).fill(currentStoreyHeight);
    } else if (storeyNumber && storeyHeight) {
      storeysAboveGround = storeyNumber;
      storeyHeightsAboveGround = new Array(storeyNumber).fill(storeyHeight);
    } else if (storeyNumber && vectorProperties.storeyHeight) {
      storeysAboveGround = storeyNumber;
      storeyHeightsAboveGround = new Array(storeyNumber).fill(vectorProperties.storeyHeight);
    }
  }

  // no legacy case // can also be an invalid legacy case
  if (!(storeysAboveGround && storeyHeightsAboveGround.length) &&
    !(storeysBelowGround && storeyHeightsBelowGround.length)) {
    storeysAboveGround = vectorProperties.getStoreysAboveGround(feature);
    storeysBelowGround = vectorProperties.getStoreysBelowGround(feature);
    storeyHeightsAboveGround = vectorProperties.getStoreyHeightsAboveGround(feature);
    storeyHeightsBelowGround = vectorProperties.getStoreyHeightsBelowGround(feature);
    if (extrudedHeight) { // current Case only extrudedHeight
      if (extrudedHeight > 0) {
        storeyHeightsAboveGround = getStoreyHeights(extrudedHeight, storeyHeightsAboveGround, storeysAboveGround);
        storeysAboveGround = storeyHeightsAboveGround.length;
        storeyHeightsBelowGround = [];
        storeysBelowGround = 0;
      } else if (extrudedHeight < 0) {
        storeyHeightsBelowGround = getStoreyHeights(extrudedHeight, storeyHeightsBelowGround, storeysBelowGround);
        storeysBelowGround = storeyHeightsBelowGround.length;
        storeyHeightsAboveGround = [];
        storeysAboveGround = 0;
      }
    }
  }

  validateStoreys(storeysAboveGround, storeyHeightsAboveGround);
  validateStoreys(storeysBelowGround, storeyHeightsBelowGround);

  const skirt = vectorProperties.getSkirt(feature);
  const olcsGroundLevel = vectorProperties.getGroundLevel(feature);

  const heightReference = vectorProperties.getAltitudeMode(feature);
  const heightAboveGroundAdjustment = getHeightAboveGround(feature, heightReference, vectorProperties);

  const groundLevel = getMinHeightOrGroundLevel(olcsGroundLevel, coordinates) + heightAboveGroundAdjustment;
  const hasZCoordinate = !!coordinates.find(value => value[2]);

  const extruded = !!(storeyHeightsAboveGround.length || storeyHeightsBelowGround.length || skirt);
  const perPositionHeight = hasZCoordinate && (
    !extruded ||
    (extruded && ((storeyHeightsAboveGround.length + storeyHeightsBelowGround.length) === 1))
  );

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

/**
 * @param {Array<number>} storeyHeights
 * @param {number} initialHeight
 * @param {boolean} [down=false]
 * @param {Array<{currentHeight:number, extrudedHeight:number}>=} result
 * @returns {Array<{currentHeight:number, extrudedHeight:number}>}
 */
export function getStoreyOptions(storeyHeights, initialHeight, down, result) {
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
    result.push(...options);
    return result;
  }
  return options;
}

/**
 *
 * @param {import("ol").Feature<import("ol/geom/Geometry").default>} feature
 * @param {import("ol/style/Style").default} style
 * @param {Array<import("ol/geom/SimpleGeometry").default>} geometries
 * @param {import("@vcmap/core").VectorProperties} vectorProperties
 * @param {import("@vcmap/cesium").Scene} scene
 * @param {VectorGeometryFactoryType} geometryFactory
 * @param {import("@vcmap/core").VectorContext|import("@vcmap/core").ClusterContext} context
 */
export function addPrimitivesToContext(
  feature, style, geometries, vectorProperties, scene, geometryFactory, context,
) {
  // no geometries, so early escape
  if (!geometries.length) {
    return;
  }

  const fillGeometries = [];
  const outlineGeometries = [];
  const lineGeometries = [];

  const heightInfo = getHeightInfo(feature, vectorProperties, geometryFactory.getCoordinates(geometries));

  const hasFill = !!style.getFill();
  const hasStroke = !!style.getStroke();

  let groundPrimitive = false;


  geometries.forEach((geometry) => {
    const geometryOptions = geometryFactory.getGeometryOptions(geometry, heightInfo.heightAboveGroundAdjustment);
    const storeyOptions = getStoreyOptions(heightInfo.storeyHeightsAboveGround, heightInfo.groundLevel);
    getStoreyOptions(heightInfo.storeyHeightsBelowGround, heightInfo.groundLevel, true, storeyOptions);

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
      const currentHeight = heightInfo.groundLevel - heightInfo.storeyHeightsBelowGround.reduce((a, b) => a + b, 0);
      const extrudedHeight = currentHeight - heightInfo.skirt;
      const skirtPositionHeight = heightInfo.storeyHeightsBelowGround.length ? false : heightInfo.perPositionHeight;
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
        fillGeometries.push(...geometryFactory.createFillGeometries(
          geometryOptions, heightInfo.groundLevel, heightInfo.perPositionHeight,
        ));
      }
      if (hasStroke) {
        if (heightInfo.heightReference === HeightReference.CLAMP_TO_GROUND) {
          lineGeometries.push(...geometryFactory.createGroundLineGeometries(geometryOptions, style));
        } else {
          lineGeometries.push(...geometryFactory.createLineGeometries(geometryOptions, style));
        }
      }
    }
  });

  const allowPicking = vectorProperties.getAllowPicking(feature);
  const primitives = [];
  if (lineGeometries.length) {
    const linePrimitive =
      createLinePrimitive(scene, vectorProperties, allowPicking, feature, lineGeometries, style, groundPrimitive);
    if (linePrimitive) {
      primitives.push(linePrimitive);
    }
  }

  if (fillGeometries.length) {
    const fillPrimitive =
      createPrimitive(scene, vectorProperties, allowPicking, feature, fillGeometries, style, groundPrimitive);
    if (fillPrimitive) {
      primitives.push(fillPrimitive);
    }
  }

  if (outlineGeometries.length) {
    const outlinePrimitive =
      createOutlinePrimitive(scene, vectorProperties, allowPicking, feature, outlineGeometries, style);
    if (outlinePrimitive) {
      primitives.push(outlinePrimitive);
    }
  }

  context.addPrimitives(primitives, feature, allowPicking);
}
