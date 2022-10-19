import { Feature } from 'ol';
import {
  ArcType, BoxGeometry,
  Cartesian3,
  Color, CoplanarPolygonGeometry, CylinderGeometry, EllipsoidGeometry,
  GeometryInstance, HeadingPitchRoll,
  Material,
  MaterialAppearance, Math as CesiumMath, Matrix3, Matrix4, PolygonHierarchy, PolylineGeometry,
  PolylineMaterialAppearance,
  Primitive, PrimitiveCollection, Transforms,
} from '@vcmap/cesium';
import { handlerSymbol } from '../editorSymbols.js';
import { AXIS_AND_PLANES, greyedOutColor, is1DAxis, is2DAxis, TransformationMode } from './transformationTypes.js';
import Projection from '../../projection.js';
import { mercatorToCartesian } from '../../math.js';

/**
 * @param {import("@vcmap/cesium").Primitive} primitive
 */
function setFeatureOnPrimitive(primitive) {
  if (primitive[handlerSymbol]) {
    const feature = new Feature();
    feature[handlerSymbol] = primitive[handlerSymbol];
    primitive.olFeature = feature;
  }
}

/**
 * @param {import("@vcmap/cesium").Color} color
 * @returns {{ depthFailAppearance: import("@vcmap/cesium").PolylineMaterialAppearance, appearance: import("@vcmap/cesium").PolylineMaterialAppearance }}
 */
function createPolylineAppearances(color) {
  return {
    appearance: new PolylineMaterialAppearance({
      material: Material.fromType('Color', {
        color,
      }),
    }),
    depthFailAppearance: new PolylineMaterialAppearance({
      material: Material.fromType('Color', {
        color: Color.divideByScalar(color, 1.5, new Color()).withAlpha(0.2),
      }),
    }),
  };
}

/**
 * @param {import("@vcmap/cesium").Color} color
 * @returns {{ depthFailAppearance: import("@vcmap/cesium").PolylineMaterialAppearance, appearance: import("@vcmap/cesium").PolylineMaterialAppearance }}
 */
function getPolygonAppearance(color) {
  return {
    appearance: new MaterialAppearance({
      flat: true,
      material: Material.fromType('Color', {
        color,
      }),
    }),
    depthFailAppearance: new MaterialAppearance({
      flat: true,
      material: Material.fromType('Color', {
        color: Color.divideByScalar(color, 1.5, new Color()).withAlpha(0.2),
      }),
    }),
  };
}

/**
 * @param {AXIS_AND_PLANES} axis
 * @param {import("@vcmap/cesium").Matrix4} modelMatrix
 * @param {boolean} [greyOut=false]
 * @returns {import("@vcmap/cesium").Primitive}
 */
function createRingPrimitive(axis, modelMatrix, greyOut = false) {
  let color;
  let rotation;

  if (axis === AXIS_AND_PLANES.Z) {
    color = Color.BLUE;
    rotation = Matrix3.IDENTITY.clone();
  } else if (axis === AXIS_AND_PLANES.X) {
    color = Color.RED;
    rotation = Matrix3.multiply(Matrix3.fromRotationY(Math.PI / 2), Matrix3.fromRotationX(Math.PI / 2), new Matrix3());
  } else {
    color = Color.GREEN;
    rotation = Matrix3.fromRotationY(Math.PI / 2);
  }
  color = greyOut ? greyedOutColor : color;
  const primitive = new Primitive({
    allowPicking: !greyOut,
    asynchronous: false,
    geometryInstances: [
      new GeometryInstance({
        geometry: new EllipsoidGeometry({
          radii: new Cartesian3(0.5, 0.5, 0.5),
          innerRadii: new Cartesian3(0.45, 0.45, 0.45),
          minimumCone: CesiumMath.toRadians(88),
          maximumCone: CesiumMath.toRadians(92),
        }),
      }),
    ],
    ...getPolygonAppearance(color),
  });

  let primitiveModelMatrix = Matrix4.multiplyByMatrix3(modelMatrix, rotation, new Matrix4());
  Object.defineProperty(primitive, 'modelMatrix', {
    set(newModelMatrix) { // updating requires recalculation using the geometry model matrix.
      if (!Matrix4.equals(newModelMatrix, primitiveModelMatrix)) {
        primitiveModelMatrix = Matrix4.multiplyByMatrix3(newModelMatrix, rotation, primitiveModelMatrix);
      }
    },
    get() {
      return primitiveModelMatrix;
    },
  });
  if (!greyOut) {
    primitive[handlerSymbol] = axis;
  }
  setFeatureOnPrimitive(primitive);
  return primitive;
}

/**
 * @param {import("ol/coordinate").Coordinate} coordinateWgs84
 */
function ensureWrappedCoordinate(coordinateWgs84) {
  if (coordinateWgs84[0] > 180) {
    coordinateWgs84[0] -= 360;
  } else if (coordinateWgs84[0] < -180) {
    coordinateWgs84[0] += 360;
  }

  if (coordinateWgs84[1] > 90) {
    coordinateWgs84[1] = 90 - (coordinateWgs84[1] - 90);
    if (coordinateWgs84[0] < 180) {
      coordinateWgs84[0] += 180;
    } else {
      coordinateWgs84[1] -= 180;
    }
  } else if (coordinateWgs84[1] < -90) {
    coordinateWgs84[1] = -90 + (coordinateWgs84[1] + 90);
    if (coordinateWgs84[0] < 180) {
      coordinateWgs84[0] += 180;
    } else {
      coordinateWgs84[1] -= 180;
    }
  }
}

/**
 * @param {import("ol/coordinate").Coordinate} centerWgs84
 * @param {AXIS_AND_PLANES} direction
 * @returns {Array<import("ol/coordinate").Coordinate>}
 */
function createRhumbLinePositions(centerWgs84, direction) {
  const offsets = [-15, -5, 0, 5, 15];
  return offsets.map((offset) => {
    const position = centerWgs84.slice();
    if (direction === AXIS_AND_PLANES.X) {
      position[0] += offset;
    } else {
      position[1] += offset;
    }
    ensureWrappedCoordinate(position);
    return position;
  });
}

/**
 * @param {AXIS_AND_PLANES} axis
 * @param {import("ol/coordinate").Coordinate} center
 * @returns {import("@vcmap/cesium").PrimitiveCollection}
 */
function createAxisPrimitive(axis, center) {
  const primitives = [];
  const centerWgs84 = Projection.mercatorToWgs84(center);
  if (axis === AXIS_AND_PLANES.X || axis === AXIS_AND_PLANES.XY || axis === AXIS_AND_PLANES.XZ) {
    primitives.push(new Primitive({
      asynchronous: false,
      geometryInstances: [
        new GeometryInstance({
          geometry: new PolylineGeometry({
            positions: Cartesian3
              .fromDegreesArrayHeights(createRhumbLinePositions(centerWgs84, AXIS_AND_PLANES.X).flat()),
            width: 1,
            arcType: ArcType.RHUMB,
          }),
        }),
      ],
      ...createPolylineAppearances(Color.RED.withAlpha(0.5)),
    }));
  }
  if (axis === AXIS_AND_PLANES.Y || axis === AXIS_AND_PLANES.XY || axis === AXIS_AND_PLANES.YZ) {
    primitives.push(new Primitive({
      asynchronous: false,
      geometryInstances: [
        new GeometryInstance({
          geometry: new PolylineGeometry({
            positions: Cartesian3
              .fromDegreesArrayHeights(createRhumbLinePositions(centerWgs84, AXIS_AND_PLANES.Y).flat()),
            width: 1,
            arcType: ArcType.RHUMB,
          }),
        }),
      ],
      ...createPolylineAppearances(Color.GREEN.withAlpha(0.5)),
    }));
  }
  if (axis === AXIS_AND_PLANES.Z || axis === AXIS_AND_PLANES.XZ || axis === AXIS_AND_PLANES.YZ) {
    primitives.push(new Primitive({
      asynchronous: false,
      geometryInstances: [
        new GeometryInstance({
          geometry: new PolylineGeometry({
            positions: Cartesian3.fromDegreesArrayHeights([
              centerWgs84[0], centerWgs84[1], center[2] - 500000,
              centerWgs84[0], centerWgs84[1], center[2],
              centerWgs84[0], centerWgs84[1], center[2] + 500000,
            ]),
            width: 1,
          }),
        }),
      ],
      ...createPolylineAppearances(Color.BLUE.withAlpha(0.5)),
    }));
  }
  const primitiveCollection = new PrimitiveCollection();
  primitives.forEach((p) => {
    primitiveCollection.add(p);
  });
  return primitiveCollection;
}

/**
 * @param {import("@vcmap/cesium").PrimitiveCollection} primitiveCollection
 * @returns {function(AXIS_AND_PLANES, import("ol/coordinate").Coordinate):void}
 */
function createShowAxisPrimitive(primitiveCollection) {
  let primitive;
  return (axis, center) => {
    if (primitive) {
      primitiveCollection.remove(primitive);
      primitive = null;
    }
    if (axis !== AXIS_AND_PLANES.NONE) {
      primitive = createAxisPrimitive(axis, center);
      primitiveCollection.add(primitive);
    }
  };
}

/**
 * @param {import("@vcmap/cesium").CylinderGeometry|import("@vcmap/cesium").BoxGeometry} geometry
 * @param {import("@vcmap/cesium").Color} color
 * @param {import("@vcmap/cesium").Matrix4} modelMatrix
 * @param {import("@vcmap/cesium").Matrix4} geometryModelMatrix
 * @param {boolean} allowPicking
 * @returns {import("@vcmap/cesium").Primitive}
 */
function createAxisEndingPrimitive(geometry, color, modelMatrix, geometryModelMatrix, allowPicking) {
  const primitive = new Primitive({
    allowPicking,
    asynchronous: false,
    geometryInstances: [
      new GeometryInstance({
        geometry,
      }),
    ],
    ...getPolygonAppearance(color),
  });

  let primitiveModelMatrix = Matrix4.multiply(modelMatrix, geometryModelMatrix, new Matrix4());
  Object.defineProperty(primitive, 'modelMatrix', {
    set(newModelMatrix) { // updating requires recalculation using the geometry model matrix.
      if (!Matrix4.equals(newModelMatrix, primitiveModelMatrix)) {
        primitiveModelMatrix = Matrix4.multiply(newModelMatrix, geometryModelMatrix, primitiveModelMatrix);
      }
    },
    get() {
      return primitiveModelMatrix;
    },
  });
  return primitive;
}

/**
 * @param {AXIS_AND_PLANES} axis
 * @param {import("@vcmap/cesium").Matrix4} modelMatrix
 * @param {TransformationMode} mode
 * @param {boolean} [greyOut=false]
 * @returns {Array<import("@vcmap/cesium").Primitive>}
 */
function createLineAxisPrimitives(axis, modelMatrix, mode, greyOut = false) {
  let to;
  let color;
  let arrowTransformation;
  if (axis === AXIS_AND_PLANES.X) {
    to = new Cartesian3(1, CesiumMath.EPSILON8, 0); // we cannot use 0 because of normalization issues
    color = Color.RED;
    arrowTransformation = Matrix4.fromRotationTranslation(
      Matrix3.fromRotationY(Math.PI / 2),
      new Cartesian3(1, 0, 0),
    );
  } else if (axis === AXIS_AND_PLANES.Y) {
    to = new Cartesian3(CesiumMath.EPSILON8, 1, 0);
    color = Color.GREEN;
    arrowTransformation = Matrix4.fromRotationTranslation(
      Matrix3.multiply(Matrix3.fromRotationY(Math.PI / 2), Matrix3.fromRotationX(-(Math.PI / 2)), new Matrix3()),
      new Cartesian3(0, 1, 0),
    );
  } else {
    to = new Cartesian3(CesiumMath.EPSILON8, CesiumMath.EPSILON8, 1);
    color = Color.BLUE;
    arrowTransformation = Matrix4.fromRotationTranslation(
      Matrix3.IDENTITY.clone(),
      new Cartesian3(0, 0, 1),
    );
  }
  color = greyOut ? greyedOutColor : color;

  const arrowGeometry = mode === TransformationMode.SCALE ?
    new BoxGeometry({
      minimum: new Cartesian3(-0.1, -0.1, -0.1),
      maximum: new Cartesian3(0.1, 0.1, 0.1),
    }) :
    new CylinderGeometry({
      length: 0.2,
      topRadius: 0,
      bottomRadius: 0.06,
    });

  const primitives = [
    new Primitive({
      allowPicking: !greyOut,
      asynchronous: false,
      geometryInstances: [
        new GeometryInstance({
          geometry: new PolylineGeometry({
            positions: [
              new Cartesian3(CesiumMath.EPSILON8, CesiumMath.EPSILON8, 0),
              to,
            ],
            width: 5,
            arcType: ArcType.NONE,
          }),
        }),
      ],
      ...createPolylineAppearances(color),
      modelMatrix,
    }),
    createAxisEndingPrimitive(arrowGeometry, color, modelMatrix, arrowTransformation, !greyOut),
  ];

  if (!greyOut) {
    primitives.forEach((p) => {
      p[handlerSymbol] = axis;
    });
  }

  return primitives;
}

/**
 * @param {AXIS_AND_PLANES} plane
 * @param {import("@vcmap/cesium").Matrix4} modelMatrix
 * @param {boolean} [greyOut]
 * @returns {import("@vcmap/cesium").Primitive}
 */
function createPlanePrimitive(plane, modelMatrix, greyOut = false) {
  let positions;
  let color;
  if (plane === AXIS_AND_PLANES.XY) {
    positions = [
      new Cartesian3(0.2, 0.2, 0),
      new Cartesian3(0.4, 0.2, 0),
      new Cartesian3(0.4, 0.4, 0),
      new Cartesian3(0.2, 0.4, 0),
    ];
    color = Color.BLUE;
  } else if (plane === AXIS_AND_PLANES.XZ) {
    positions = [
      new Cartesian3(0.2, 0.0000001, 0.2),
      new Cartesian3(0.4, 0.0000001, 0.2),
      new Cartesian3(0.4, 0.0000001, 0.4),
      new Cartesian3(0.2, 0.0000001, 0.4),
    ];
    color = Color.GREEN;
  } else {
    positions = [
      new Cartesian3(0.0000001, 0.2, 0.2),
      new Cartesian3(0.0000001, 0.4, 0.2),
      new Cartesian3(0.0000001, 0.4, 0.4),
      new Cartesian3(0.0000001, 0.2, 0.4),
    ];
    color = Color.RED;
  }
  color = greyOut ? greyedOutColor : color;
  const primitive = new Primitive({
    allowPicking: !greyOut,
    asynchronous: false,
    geometryInstances: [
      new GeometryInstance({
        geometry: new CoplanarPolygonGeometry({
          polygonHierarchy: new PolygonHierarchy(positions),
        }),
      }),
    ],
    ...getPolygonAppearance(color),
    modelMatrix,
  });
  if (!greyOut) {
    primitive[handlerSymbol] = plane;
  }
  return primitive;
}

/**
 * @param {import("@vcmap/cesium").PrimitiveCollection} primitiveCollection
 * @returns {(function(AXIS_AND_PLANES, import("@vcmap/cesium").Matrix4, TransformationMode): void)}
 */
function createShowShadowPrimitive(primitiveCollection) {
  let primitive;

  return (axis, modelMatrix, mode) => {
    if (primitive) {
      primitiveCollection.remove(primitive);
      primitive = null;
    }
    if (axis !== AXIS_AND_PLANES.NONE) {
      primitive = new PrimitiveCollection();
      if (is1DAxis(axis)) {
        createLineAxisPrimitives(axis, modelMatrix, mode, true)
          .forEach((p) => {
            primitive.add(p);
          });
      } else if (is2DAxis(axis)) {
        primitive.add(createPlanePrimitive(axis, modelMatrix, true));
      }
      primitiveCollection.add(primitive);
    }
  };
}

/**
 * The function will create 3D handlers for the {@see CesiumMap} depending on the provided mode.
 * In most scenarios, handlers must not be created using this function, but using the startEditFeaturesSession or for lower
 * level access the createTransformationHandler instead.
 * @param {import("@vcmap/core").CesiumMap} map
 * @param {TransformationMode} mode
 * @returns {Handlers}
 */
export default function create3DHandlers(map, mode) {
  const primitiveCollection = new PrimitiveCollection();
  const modelMatrix = Matrix4.fromTranslation(Cartesian3.fromDegrees(0, 0, 0));
  const zPrimitives = [];

  if (mode === TransformationMode.TRANSLATE || mode === TransformationMode.SCALE) {
    const primitives = [
      ...createLineAxisPrimitives(AXIS_AND_PLANES.X, modelMatrix, mode),
      ...createLineAxisPrimitives(AXIS_AND_PLANES.Y, modelMatrix, mode),
      createPlanePrimitive(AXIS_AND_PLANES.XY, modelMatrix),
    ];

    if (mode === TransformationMode.TRANSLATE) {
      zPrimitives.push(
        ...createLineAxisPrimitives(AXIS_AND_PLANES.Z, modelMatrix, mode),
        createPlanePrimitive(AXIS_AND_PLANES.XZ, modelMatrix),
        createPlanePrimitive(AXIS_AND_PLANES.YZ, modelMatrix),
      );
      primitives.push(...zPrimitives);
    }
    primitives.forEach((p) => {
      setFeatureOnPrimitive(p);
      primitiveCollection.add(p);
    });
  } else if (mode === TransformationMode.ROTATE) {
    primitiveCollection.add(createRingPrimitive(AXIS_AND_PLANES.X, modelMatrix, true));
    primitiveCollection.add(createRingPrimitive(AXIS_AND_PLANES.Y, modelMatrix, true));
    primitiveCollection.add(createRingPrimitive(AXIS_AND_PLANES.Z, modelMatrix));
  } else if (mode === TransformationMode.EXTRUDE) {
    createLineAxisPrimitives(AXIS_AND_PLANES.Z, modelMatrix, mode)
      .forEach((p) => {
        setFeatureOnPrimitive(p);
        primitiveCollection.add(p);
      });
  }

  const scene = map.getScene();
  let center = [0, 0, 0];
  let scale = 1;

  const postRenderListener = scene.postRender.addEventListener(() => {
    if (!(center[0] === 0 && center[1] === 0 && center[2] === 0)) {
      const res = map.getCurrentResolution(center) * 60;
      if (res !== scale) {
        Matrix4.setScale(modelMatrix, new Cartesian3(res, res, res), modelMatrix);
        for (let i = 0; i < primitiveCollection.length; i++) {
          primitiveCollection.get(i).modelMatrix = modelMatrix;
        }
      }

      scale = res;
    }
  });

  let showAxis = AXIS_AND_PLANES.NONE;
  const showAxisPrimitives = createShowAxisPrimitive(primitiveCollection);
  const showShadowPrimitive = createShowShadowPrimitive(primitiveCollection);

  let greyOutZ = false;
  return {
    get show() {
      return primitiveCollection.show;
    },
    set show(show) {
      primitiveCollection.show = show;
      if (show && !scene.primitives.contains(primitiveCollection)) {
        scene.primitives.add(primitiveCollection);
      }
    },
    get showAxis() {
      return showAxis;
    },
    set showAxis(axis) {
      showAxis = axis;
      showAxisPrimitives(axis, center.slice());
      showShadowPrimitive(axis, modelMatrix.clone(), mode);
    },
    get greyOutZ() { return greyOutZ; },
    set greyOutZ(greyOut) {
      if (greyOut !== greyOutZ) {
        greyOutZ = greyOut;
        zPrimitives.forEach((p) => {
          primitiveCollection.remove(p);
        });
        zPrimitives.splice(0);
        if (mode === TransformationMode.TRANSLATE) {
          zPrimitives.push(
            ...createLineAxisPrimitives(AXIS_AND_PLANES.Z, modelMatrix, mode, greyOut),
            createPlanePrimitive(AXIS_AND_PLANES.XZ, modelMatrix, greyOut),
            createPlanePrimitive(AXIS_AND_PLANES.YZ, modelMatrix, greyOut),
          );
        }

        zPrimitives.forEach((p) => {
          setFeatureOnPrimitive(p);
          primitiveCollection.add(p);
        });
      }
    },
    setCenter(newCenter) {
      center = newCenter.slice();
      Transforms.headingPitchRollToFixedFrame(
        mercatorToCartesian(center),
        new HeadingPitchRoll(0, 0, 0),
        null,
        null,
        modelMatrix,
      );
      Matrix4.multiplyByUniformScale(modelMatrix, scale, modelMatrix);

      for (let i = 0; i < primitiveCollection.length; i++) {
        primitiveCollection.get(i).modelMatrix = modelMatrix;
      }
    },
    destroy() {
      postRenderListener();
      showAxisPrimitives(AXIS_AND_PLANES.NONE, center);
      showShadowPrimitive(AXIS_AND_PLANES.NONE, modelMatrix.clone(), mode);
      if (scene.primitives.contains(primitiveCollection)) {
        scene.primitives.remove(primitiveCollection);
      }
    },
  };
}
