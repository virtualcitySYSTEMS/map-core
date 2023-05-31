import { Feature } from 'ol';
import type { Coordinate } from 'ol/coordinate.js';
import {
  ArcType,
  BoxGeometry,
  Cartesian3,
  Color,
  CoplanarPolygonGeometry,
  CylinderGeometry,
  EllipsoidGeometry,
  GeometryInstance,
  HeadingPitchRoll,
  Material,
  MaterialAppearance,
  Math as CesiumMath,
  Matrix3,
  Matrix4,
  PolygonHierarchy,
  PolylineGeometry,
  PolylineMaterialAppearance,
  Primitive,
  PrimitiveCollection,
  Scene,
  Transforms,
} from '@vcmap-cesium/engine';
import { handlerSymbol } from '../editorSymbols.js';
import {
  AxisAndPlanes,
  greyedOutColor,
  Handlers,
  is1DAxis,
  is2DAxis,
  TransformationMode,
} from './transformationTypes.js';
import Projection from '../../projection.js';
import { mercatorToCartesian } from '../../math.js';
import CesiumMap from '../../../map/cesiumMap.js';

function setFeatureOnPrimitive(primitive: Primitive): void {
  if (primitive[handlerSymbol]) {
    const feature = new Feature();
    feature[handlerSymbol] = primitive[handlerSymbol];
    primitive.olFeature = feature;
  }
}

function createPolylineAppearances(color: Color): {
  depthFailAppearance: PolylineMaterialAppearance;
  appearance: PolylineMaterialAppearance;
} {
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

function getPolygonAppearance(color: Color): {
  depthFailAppearance: PolylineMaterialAppearance;
  appearance: PolylineMaterialAppearance;
} {
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

function createRingPrimitive(
  axis: AxisAndPlanes,
  modelMatrix: Matrix4,
  greyOut = false,
): Primitive {
  let color;
  let rotation: Matrix3;

  if (axis === AxisAndPlanes.Z) {
    color = Color.BLUE;
    rotation = Matrix3.IDENTITY.clone();
  } else if (axis === AxisAndPlanes.X) {
    color = Color.RED;
    rotation = Matrix3.multiply(
      Matrix3.fromRotationY(Math.PI / 2),
      Matrix3.fromRotationX(Math.PI / 2),
      new Matrix3(),
    );
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

  let primitiveModelMatrix = Matrix4.multiplyByMatrix3(
    modelMatrix,
    rotation,
    new Matrix4(),
  );
  Object.defineProperty(primitive, 'modelMatrix', {
    set(newModelMatrix: Matrix4) {
      // updating requires recalculation using the geometry model matrix.
      if (!Matrix4.equals(newModelMatrix, primitiveModelMatrix)) {
        primitiveModelMatrix = Matrix4.multiplyByMatrix3(
          newModelMatrix,
          rotation,
          primitiveModelMatrix,
        );
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

function ensureWrappedCoordinate(coordinateWgs84: Coordinate): void {
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
 * @param  centerWgs84
 * @param  direction
 */
function createRhumbLinePositions(
  centerWgs84: Coordinate,
  direction: AxisAndPlanes,
): Coordinate[] {
  const offsets = [-15, -5, 0, 5, 15];
  return offsets.map((offset) => {
    const position = centerWgs84.slice();
    if (direction === AxisAndPlanes.X) {
      position[0] += offset;
    } else {
      position[1] += offset;
    }
    ensureWrappedCoordinate(position);
    return position;
  });
}

/**
 * @param  axis
 * @param  center
 */
function createAxisPrimitive(
  axis: AxisAndPlanes,
  center: Coordinate,
): PrimitiveCollection {
  const primitives = [];
  const centerWgs84 = Projection.mercatorToWgs84(center);
  if (
    axis === AxisAndPlanes.X ||
    axis === AxisAndPlanes.XY ||
    axis === AxisAndPlanes.XZ
  ) {
    primitives.push(
      new Primitive({
        asynchronous: false,
        geometryInstances: [
          new GeometryInstance({
            geometry: new PolylineGeometry({
              positions: Cartesian3.fromDegreesArrayHeights(
                createRhumbLinePositions(centerWgs84, AxisAndPlanes.X).flat(),
              ),
              width: 1,
              arcType: ArcType.RHUMB,
            }),
          }),
        ],
        ...createPolylineAppearances(Color.RED.withAlpha(0.5)),
      }),
    );
  }
  if (
    axis === AxisAndPlanes.Y ||
    axis === AxisAndPlanes.XY ||
    axis === AxisAndPlanes.YZ
  ) {
    primitives.push(
      new Primitive({
        asynchronous: false,
        geometryInstances: [
          new GeometryInstance({
            geometry: new PolylineGeometry({
              positions: Cartesian3.fromDegreesArrayHeights(
                createRhumbLinePositions(centerWgs84, AxisAndPlanes.Y).flat(),
              ),
              width: 1,
              arcType: ArcType.RHUMB,
            }),
          }),
        ],
        ...createPolylineAppearances(Color.GREEN.withAlpha(0.5)),
      }),
    );
  }
  if (
    axis === AxisAndPlanes.Z ||
    axis === AxisAndPlanes.XZ ||
    axis === AxisAndPlanes.YZ
  ) {
    primitives.push(
      new Primitive({
        asynchronous: false,
        geometryInstances: [
          new GeometryInstance({
            geometry: new PolylineGeometry({
              positions: Cartesian3.fromDegreesArrayHeights([
                centerWgs84[0],
                centerWgs84[1],
                center[2] - 500000,
                centerWgs84[0],
                centerWgs84[1],
                center[2],
                centerWgs84[0],
                centerWgs84[1],
                center[2] + 500000,
              ]),
              width: 1,
            }),
          }),
        ],
        ...createPolylineAppearances(Color.BLUE.withAlpha(0.5)),
      }),
    );
  }
  const primitiveCollection = new PrimitiveCollection();
  primitives.forEach((p) => {
    primitiveCollection.add(p);
  });
  return primitiveCollection;
}

function createShowAxisPrimitive(
  primitiveCollection: PrimitiveCollection,
): (axis: AxisAndPlanes, center: Coordinate) => void {
  let primitive: PrimitiveCollection | undefined;
  return (axis, center) => {
    if (primitive) {
      primitiveCollection.remove(primitive);
      primitive = undefined;
    }
    if (axis !== AxisAndPlanes.NONE) {
      primitive = createAxisPrimitive(axis, center);
      primitiveCollection.add(primitive);
    }
  };
}

function createAxisEndingPrimitive(
  geometry: CylinderGeometry | BoxGeometry,
  color: Color,
  modelMatrix: Matrix4,
  geometryModelMatrix: Matrix4,
  allowPicking: boolean,
): Primitive {
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

  let primitiveModelMatrix = Matrix4.multiply(
    modelMatrix,
    geometryModelMatrix,
    new Matrix4(),
  );
  Object.defineProperty(primitive, 'modelMatrix', {
    set(newModelMatrix: Matrix4) {
      // updating requires recalculation using the geometry model matrix.
      if (!Matrix4.equals(newModelMatrix, primitiveModelMatrix)) {
        primitiveModelMatrix = Matrix4.multiply(
          newModelMatrix,
          geometryModelMatrix,
          primitiveModelMatrix,
        );
      }
    },
    get() {
      return primitiveModelMatrix;
    },
  });
  return primitive;
}

function createLineAxisPrimitives(
  axis: AxisAndPlanes,
  modelMatrix: Matrix4,
  mode: TransformationMode,
  greyOut: unknown = false,
): Primitive[] {
  let to;
  let color;
  let arrowTransformation;
  if (axis === AxisAndPlanes.X) {
    to = new Cartesian3(1, CesiumMath.EPSILON8, 0); // we cannot use 0 because of normalization issues
    color = Color.RED;
    arrowTransformation = Matrix4.fromRotationTranslation(
      Matrix3.fromRotationY(Math.PI / 2),
      new Cartesian3(1, 0, 0),
    );
  } else if (axis === AxisAndPlanes.Y) {
    to = new Cartesian3(CesiumMath.EPSILON8, 1, 0);
    color = Color.GREEN;
    arrowTransformation = Matrix4.fromRotationTranslation(
      Matrix3.multiply(
        Matrix3.fromRotationY(Math.PI / 2),
        Matrix3.fromRotationX(-(Math.PI / 2)),
        new Matrix3(),
      ),
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

  const arrowGeometry =
    mode === TransformationMode.SCALE
      ? new BoxGeometry({
          minimum: new Cartesian3(-0.1, -0.1, -0.1),
          maximum: new Cartesian3(0.1, 0.1, 0.1),
        })
      : new CylinderGeometry({
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
    createAxisEndingPrimitive(
      arrowGeometry,
      color,
      modelMatrix,
      arrowTransformation,
      !greyOut,
    ),
  ];

  if (!greyOut) {
    primitives.forEach((p) => {
      p[handlerSymbol] = axis;
    });
  }

  return primitives;
}

function createPlanePrimitive(
  plane: AxisAndPlanes,
  modelMatrix: Matrix4,
  greyOut = false,
): Primitive {
  let positions;
  let color;
  if (plane === AxisAndPlanes.XY) {
    positions = [
      new Cartesian3(0.2, 0.2, 0),
      new Cartesian3(0.4, 0.2, 0),
      new Cartesian3(0.4, 0.4, 0),
      new Cartesian3(0.2, 0.4, 0),
    ];
    color = Color.BLUE;
  } else if (plane === AxisAndPlanes.XZ) {
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

function createShowShadowPrimitive(
  primitiveCollection: PrimitiveCollection,
): (
  axis: AxisAndPlanes,
  modelMatrix: Matrix4,
  mode: TransformationMode,
) => void {
  let primitive: PrimitiveCollection | undefined;

  return (axis, modelMatrix, mode) => {
    if (primitive) {
      primitiveCollection.remove(primitive);
      primitive = undefined;
    }
    if (axis !== AxisAndPlanes.NONE) {
      primitive = new PrimitiveCollection();
      if (is1DAxis(axis)) {
        createLineAxisPrimitives(axis, modelMatrix, mode, true).forEach((p) => {
          primitive!.add(p);
        });
      } else if (is2DAxis(axis)) {
        primitive.add(createPlanePrimitive(axis, modelMatrix, true));
      }
      primitiveCollection.add(primitive);
    }
  };
}

/**
 * The function will create 3D handlers for the  depending on the provided mode.
 * In most scenarios, handlers must not be created using this function, but using the startEditFeaturesSession or for lower
 * level access the createTransformationHandler instead.
 * @param  map
 * @param  mode
 */
export default function create3DHandlers(
  map: CesiumMap,
  mode: TransformationMode,
): Handlers {
  const primitiveCollection = new PrimitiveCollection();
  const modelMatrix = Matrix4.fromTranslation(Cartesian3.fromDegrees(0, 0, 0));
  const zPrimitives: Primitive[] = [];

  if (
    mode === TransformationMode.TRANSLATE ||
    mode === TransformationMode.SCALE
  ) {
    const primitives = [
      ...createLineAxisPrimitives(AxisAndPlanes.X, modelMatrix, mode),
      ...createLineAxisPrimitives(AxisAndPlanes.Y, modelMatrix, mode),
      createPlanePrimitive(AxisAndPlanes.XY, modelMatrix),
    ];

    if (mode === TransformationMode.TRANSLATE) {
      zPrimitives.push(
        ...createLineAxisPrimitives(AxisAndPlanes.Z, modelMatrix, mode),
        createPlanePrimitive(AxisAndPlanes.XZ, modelMatrix),
        createPlanePrimitive(AxisAndPlanes.YZ, modelMatrix),
      );
      primitives.push(...zPrimitives);
    }
    primitives.forEach((p) => {
      setFeatureOnPrimitive(p);
      primitiveCollection.add(p);
    });
  } else if (mode === TransformationMode.ROTATE) {
    primitiveCollection.add(
      createRingPrimitive(AxisAndPlanes.X, modelMatrix, true),
    );
    primitiveCollection.add(
      createRingPrimitive(AxisAndPlanes.Y, modelMatrix, true),
    );
    primitiveCollection.add(createRingPrimitive(AxisAndPlanes.Z, modelMatrix));
  } else if (mode === TransformationMode.EXTRUDE) {
    createLineAxisPrimitives(AxisAndPlanes.Z, modelMatrix, mode).forEach(
      (p) => {
        setFeatureOnPrimitive(p);
        primitiveCollection.add(p);
      },
    );
  }

  const scene = map.getScene() as Scene;
  let center = [0, 0, 0];
  let scale = 1;

  const postRenderListener = scene.postRender.addEventListener(() => {
    if (!(center[0] === 0 && center[1] === 0 && center[2] === 0)) {
      const res = map.getCurrentResolution(center) * 60;
      if (res !== scale) {
        Matrix4.setScale(
          modelMatrix,
          new Cartesian3(res, res, res),
          modelMatrix,
        );
        for (let i = 0; i < primitiveCollection.length; i++) {
          (primitiveCollection.get(i) as Primitive).modelMatrix = modelMatrix;
        }
      }

      scale = res;
    }
  });

  let showAxis = AxisAndPlanes.NONE;
  const showAxisPrimitives = createShowAxisPrimitive(primitiveCollection);
  const showShadowPrimitive = createShowShadowPrimitive(primitiveCollection);

  let greyOutZ = false;
  return {
    get show(): boolean {
      return primitiveCollection.show;
    },
    set show(show) {
      primitiveCollection.show = show;
      if (show && !scene.primitives.contains(primitiveCollection)) {
        scene.primitives.add(primitiveCollection);
      }
    },
    get showAxis(): AxisAndPlanes {
      return showAxis;
    },
    set showAxis(axis) {
      showAxis = axis;
      showAxisPrimitives(axis, center.slice());
      showShadowPrimitive(axis, modelMatrix.clone(), mode);
    },
    get greyOutZ(): boolean {
      return greyOutZ;
    },
    set greyOutZ(greyOut) {
      if (greyOut !== greyOutZ) {
        greyOutZ = greyOut;
        zPrimitives.forEach((p) => {
          primitiveCollection.remove(p);
        });
        zPrimitives.splice(0);
        if (mode === TransformationMode.TRANSLATE) {
          zPrimitives.push(
            ...createLineAxisPrimitives(
              AxisAndPlanes.Z,
              modelMatrix,
              mode,
              greyOut,
            ),
            createPlanePrimitive(AxisAndPlanes.XZ, modelMatrix, greyOut),
            createPlanePrimitive(AxisAndPlanes.YZ, modelMatrix, greyOut),
          );
        }

        zPrimitives.forEach((p) => {
          setFeatureOnPrimitive(p);
          primitiveCollection.add(p);
        });
      }
    },
    setCenter(newCenter: Coordinate): void {
      center = newCenter.slice();
      Transforms.headingPitchRollToFixedFrame(
        mercatorToCartesian(center),
        new HeadingPitchRoll(0, 0, 0),
        undefined,
        undefined,
        modelMatrix,
      );
      Matrix4.multiplyByUniformScale(modelMatrix, scale, modelMatrix);

      for (let i = 0; i < primitiveCollection.length; i++) {
        (primitiveCollection.get(i) as Primitive).modelMatrix = modelMatrix;
      }
    },
    destroy(): void {
      postRenderListener();
      showAxisPrimitives(AxisAndPlanes.NONE, center);
      showShadowPrimitive(AxisAndPlanes.NONE, modelMatrix.clone(), mode);
      if (scene.primitives.contains(primitiveCollection)) {
        scene.primitives.remove(primitiveCollection);
      }
    },
  };
}
