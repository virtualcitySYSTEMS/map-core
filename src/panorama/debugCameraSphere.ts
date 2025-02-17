import {
  Scene,
  Math as CesiumMath,
  MaterialAppearance,
  Material,
  Primitive,
  VertexFormat,
  SphereGeometry,
  GeometryInstance,
  Cartesian3,
  Color,
  Matrix4,
  PolylineGeometry,
  PolylineMaterialAppearance,
} from '@vcmap-cesium/engine';
import { isEmpty } from 'ol/extent.js';
import {
  getFov,
  getFovImageSphericalExtent,
  getProjectedFov,
} from './panoramaCameraHelpers.js';
import type { PanoramaImage } from './panoramaImage.js';
import { getNumberOfTiles, tileSizeInRadians } from './panoramaTile.js';
import type PanoramaMap from '../map/panoramaMap.js';

export type DebugCameraSphereOptions = {
  paused?: boolean;
  grid?: boolean;
  tileGrid?: number | false;
  fov?: boolean;
  cameraAxis?: boolean;
  clickedPosition?: [number, number] | null;
};

export type DebugCameraSphere = DebugCameraSphereOptions & {
  setClickedPosition(position?: [number, number]): void;
  destroy(): void;
};

const PIXEL_PER_DEGREES = 5;

function drawGrid(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = 'black';
  ctx.fillStyle = 'black';
  ctx.font = '10px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 1;

  for (let i = 0; i < 360; i += 10) {
    ctx.beginPath();
    ctx.moveTo(i * PIXEL_PER_DEGREES, 0);
    ctx.lineTo(i * PIXEL_PER_DEGREES, 180 * PIXEL_PER_DEGREES);
    ctx.stroke();
    ctx.fillText(i.toString(), i * PIXEL_PER_DEGREES, 90 * PIXEL_PER_DEGREES);
  }

  for (let i = 0; i < 180; i += 10) {
    ctx.beginPath();
    ctx.moveTo(0, i * PIXEL_PER_DEGREES);
    ctx.lineTo(360 * PIXEL_PER_DEGREES, i * PIXEL_PER_DEGREES);
    ctx.stroke();
    ctx.fillText(i.toString(), 10, i * PIXEL_PER_DEGREES);
  }
}

function drawTiles(ctx: CanvasRenderingContext2D, level = 0): void {
  const [maxX, maxY] = getNumberOfTiles(level);
  const tileSize = CesiumMath.toDegrees(tileSizeInRadians(level));
  for (let x = 0; x < maxX; x++) {
    for (let y = 0; y < maxY; y++) {
      ctx.strokeStyle = 'cyan';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        x * tileSize * PIXEL_PER_DEGREES,
        y * tileSize * PIXEL_PER_DEGREES,
        tileSize * PIXEL_PER_DEGREES,
        tileSize * PIXEL_PER_DEGREES,
      );
      ctx.fillStyle = 'cyan';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        `${level}/${x}/${y}`,
        x * tileSize * PIXEL_PER_DEGREES + (tileSize * PIXEL_PER_DEGREES) / 2,
        y * tileSize * PIXEL_PER_DEGREES + (tileSize * PIXEL_PER_DEGREES) / 2,
      );
    }
  }
}

function drawCoordinate(ctx: CanvasRenderingContext2D, coord: number[]): void {
  const degreesCord = coord.map((value) => CesiumMath.toDegrees(value));
  ctx.beginPath();
  ctx.moveTo(
    degreesCord[0] * PIXEL_PER_DEGREES - PIXEL_PER_DEGREES,
    degreesCord[1] * PIXEL_PER_DEGREES,
  );
  ctx.lineTo(
    degreesCord[0] * PIXEL_PER_DEGREES + PIXEL_PER_DEGREES,
    degreesCord[1] * PIXEL_PER_DEGREES,
  );
  ctx.moveTo(
    degreesCord[0] * PIXEL_PER_DEGREES,
    degreesCord[1] * PIXEL_PER_DEGREES - PIXEL_PER_DEGREES,
  );
  ctx.lineTo(
    degreesCord[0] * PIXEL_PER_DEGREES,
    degreesCord[1] * PIXEL_PER_DEGREES + PIXEL_PER_DEGREES,
  );
  ctx.stroke();
}

function drawLatitude(ctx: CanvasRenderingContext2D, latitude: number): void {
  ctx.beginPath();
  const latitudeDegrees = CesiumMath.toDegrees(latitude);
  ctx.moveTo(0, latitudeDegrees * PIXEL_PER_DEGREES);
  ctx.lineTo(360 * PIXEL_PER_DEGREES, latitudeDegrees * PIXEL_PER_DEGREES);
  ctx.stroke();
}

function drawView(
  scene: Scene,
  image: PanoramaImage,
  ctx: CanvasRenderingContext2D,
  options: Required<DebugCameraSphereOptions>,
): void {
  ctx.clearRect(0, 0, 360 * PIXEL_PER_DEGREES, 180 * PIXEL_PER_DEGREES);
  if (options.grid) {
    drawGrid(ctx);
  }
  if (options.tileGrid) {
    drawTiles(ctx, options.tileGrid);
  }
  if (options.fov) {
    const cameraView = getProjectedFov(scene.camera, image);
    if (cameraView) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'green';
      drawLatitude(ctx, cameraView.topRight[1]);
      ctx.strokeStyle = 'cyan';
      drawLatitude(ctx, cameraView.bottomLeft[1]);
      ctx.strokeStyle = 'lime';
      drawCoordinate(ctx, cameraView.topLeft);
      ctx.strokeStyle = 'red';
      drawCoordinate(ctx, cameraView.topRight);
      ctx.strokeStyle = 'orange';
      drawCoordinate(ctx, cameraView.bottomRight);
      ctx.strokeStyle = 'pink';
      drawCoordinate(ctx, cameraView.bottomLeft);
      ctx.strokeStyle = 'purple';
      drawCoordinate(ctx, cameraView.center);
    }

    ctx.strokeStyle = 'red';
    const { extents } = getFovImageSphericalExtent(scene.camera, image);
    extents.forEach((extent) => {
      if (!isEmpty(extent)) {
        const [minLon, minLat, maxLon, maxLat] = extent.map(
          CesiumMath.toDegrees,
        );
        ctx.strokeRect(
          minLon * PIXEL_PER_DEGREES,
          minLat * PIXEL_PER_DEGREES,
          (maxLon - minLon) * PIXEL_PER_DEGREES,
          (maxLat - minLat) * PIXEL_PER_DEGREES,
        );
      }
    });
  }
  if (options.clickedPosition) {
    ctx.strokeStyle = 'hotpink';
    drawCoordinate(ctx, options.clickedPosition);
  }
}

function createMaterial(canvas: HTMLCanvasElement): MaterialAppearance {
  return new MaterialAppearance({
    material: Material.fromType('Image', {
      image: canvas,
    }),
    translucent: true,
    closed: false,
    flat: true,
  });
}

function createPrimitive(
  canvas: HTMLCanvasElement,
  image: PanoramaImage,
): Primitive {
  return new Primitive({
    geometryInstances: [
      new GeometryInstance({
        geometry: new SphereGeometry({
          vertexFormat: VertexFormat.POSITION_NORMAL_AND_ST,
          radius: 0.9,
        }),
      }),
    ],
    appearance: createMaterial(canvas),
    asynchronous: false,
    modelMatrix: image.modelMatrix,
  });
}

function createFovPrimitive(
  position: Cartesian3,
  center: Cartesian3,
  scene: Scene,
  color = Color.RED.withAlpha(0.7),
): {
  update: (position: Cartesian3) => void;
  destroy: () => void;
  show: boolean;
} {
  const pointPrimitive = new Primitive({
    geometryInstances: [
      new GeometryInstance({
        geometry: new SphereGeometry({
          vertexFormat: VertexFormat.POSITION_AND_ST,
          radius: 0.02,
        }),
      }),
    ],
    appearance: new MaterialAppearance({
      translucent: true,
      material: Material.fromType('Color', { color }),
    }),
    asynchronous: false,
    modelMatrix: Matrix4.fromTranslation(position),
  });

  const createLinePrimitve = (corner: Cartesian3): Primitive =>
    new Primitive({
      geometryInstances: [
        new GeometryInstance({
          geometry: new PolylineGeometry({
            positions: [center, corner],
          }),
        }),
      ],
      appearance: new PolylineMaterialAppearance({
        renderState: {
          depthTest: {
            enabled: true,
          },
          lineWidth: 1,
        },
        translucent: color.alpha !== 1,
        material: Material.fromType('Color', { color }),
      }),
      asynchronous: false,
      releaseGeometryInstances: false,
    });
  let linePrimitive = createLinePrimitve(position);
  scene.primitives.add(pointPrimitive);
  scene.primitives.add(linePrimitive);

  return {
    update(newPosition: Cartesian3): void {
      pointPrimitive.modelMatrix = Matrix4.fromTranslation(newPosition);
      scene.primitives.remove(linePrimitive);
      linePrimitive = createLinePrimitve(newPosition);
      scene.primitives.add(linePrimitive);
    },
    destroy(): void {
      scene.primitives.remove(pointPrimitive);
      scene.primitives.remove(linePrimitive);
    },
    get show(): boolean {
      return linePrimitive.show && pointPrimitive.show;
    },
    set show(value: boolean) {
      linePrimitive.show = value;
      pointPrimitive.show = value;
    },
  };
}

export function createFovPrimitives(scene: Scene): {
  show: boolean;
  update(): void;
  destroy(): void;
} {
  const { camera } = scene;

  const cornerToUnit = (corner: Cartesian3): Cartesian3 => {
    const direction = Cartesian3.subtract(
      corner,
      camera.position,
      new Cartesian3(),
    );
    Cartesian3.normalize(direction, direction);
    const newPos = Cartesian3.add(camera.position, direction, new Cartesian3());
    return newPos;
  };
  const fov = getFov(camera);
  const primitives = Object.entries(fov).map(([key, corner]) => {
    const isEdge = ['top', 'bottom', 'left', 'right'].includes(key);
    let color = Color.RED.withAlpha(0.7);
    if (isEdge) {
      color = Color.PINK.withAlpha(0.7);
    }
    if (key === 'center') {
      color = Color.GREEN.withAlpha(0.7);
    }
    return createFovPrimitive(
      cornerToUnit(corner),
      camera.position,
      scene,
      color,
    );
  });

  primitives.push(
    createFovPrimitive(
      camera.position,
      camera.position,
      scene,
      Color.GREEN.withAlpha(0.7),
    ),
  );

  function update(): void {
    const newFov = getFov(camera);
    [...Object.values(newFov)].forEach((corner, index) => {
      primitives[index].update(cornerToUnit(corner));
    });
  }

  function destroy(): void {
    primitives.forEach((primitive) => {
      primitive.destroy();
    });
  }
  let show = true;
  return {
    get show(): boolean {
      return show;
    },
    set show(value: boolean) {
      show = value;
      primitives.forEach((primitive) => {
        primitive.show = value;
      });
    },
    update,
    destroy,
  };
}

/**
 * Create axis primitives for debugging purposes. The axis represent the spheres cartesian coordinate system. The axis have a length of 1.
 */
function createAxisPrimitives(image: PanoramaImage): Primitive[] {
  const directionColors: [Cartesian3, Color][] = [
    [new Cartesian3(1, 0, 0), Color.RED],
    [new Cartesian3(0, 1, 0), Color.GREEN],
    [new Cartesian3(0, 0, 1), Color.BLUE],
    [new Cartesian3(-1, 0, 0), Color.RED.withAlpha(0.2)],
    [new Cartesian3(0, -1, 0), Color.GREEN.withAlpha(0.2)],
    [new Cartesian3(0, 0, -1), Color.BLUE.withAlpha(0.2)],
  ];

  return directionColors.map(([direction, color]) => {
    Matrix4.multiplyByPoint(image.modelMatrix, direction, direction);

    return new Primitive({
      geometryInstances: [
        new GeometryInstance({
          geometry: new PolylineGeometry({
            positions: [image.position, direction],
          }),
        }),
      ],
      appearance: new PolylineMaterialAppearance({
        translucent: true,
        material: Material.fromType('Color', {
          color,
        }),
      }),
      asynchronous: false,
    });
  });
}

export function createDebugCameraSphere(
  scene: Scene,
  image: PanoramaImage,
  options: DebugCameraSphereOptions = {},
): DebugCameraSphere {
  const canvas = document.createElement('canvas');
  canvas.width = 360 * PIXEL_PER_DEGREES;
  canvas.height = 180 * PIXEL_PER_DEGREES;
  const currentOptions: Required<DebugCameraSphereOptions> = {
    paused: false,
    grid: true,
    tileGrid: 0,
    fov: false,
    cameraAxis: true,
    clickedPosition: null,
    ...options,
  };

  const ctx = canvas.getContext('2d')!;
  ctx.translate(360 * PIXEL_PER_DEGREES, 0);
  ctx.scale(-1, 1); // Flip the context horizontally
  drawView(scene, image, ctx, currentOptions);
  const primitive = createPrimitive(canvas, image);
  scene.primitives.add(primitive);

  const fovPrimitives = createFovPrimitives(scene);
  fovPrimitives.show = currentOptions.fov;
  const changeListener = scene.camera.changed.addEventListener(() => {
    if (!currentOptions.paused) {
      drawView(scene, image, ctx, currentOptions);
      fovPrimitives.update();
      primitive.appearance = createMaterial(canvas);
    }
  });
  scene.camera.percentageChanged = 0.1;

  const axisPrimitives = createAxisPrimitives(image);
  axisPrimitives.forEach((axis) => {
    axis.show = currentOptions.cameraAxis;
    scene.primitives.add(axis);
  });

  return {
    get paused(): boolean {
      return currentOptions.paused;
    },
    set paused(value: boolean) {
      currentOptions.paused = value;
    },
    get grid(): boolean {
      return currentOptions.grid;
    },
    set grid(value: boolean) {
      currentOptions.grid = value;
    },
    get tileGrid(): number | false {
      return currentOptions.tileGrid;
    },
    set tileGrid(value: number | false) {
      currentOptions.tileGrid = value;
    },
    get fov(): boolean {
      return currentOptions.fov;
    },
    set fov(value: boolean) {
      currentOptions.fov = value;
      fovPrimitives.show = value;
    },
    get cameraAxis(): boolean {
      return currentOptions.cameraAxis;
    },
    set cameraAxis(value: boolean) {
      currentOptions.cameraAxis = value;
      axisPrimitives.forEach((axis) => {
        axis.show = currentOptions.cameraAxis;
      });
    },
    setClickedPosition(position?: [number, number]): void {
      currentOptions.clickedPosition = position ?? null;
      drawView(scene, image, ctx, currentOptions);
      primitive.appearance = createMaterial(canvas);
    },
    destroy(): void {
      scene.primitives.remove(primitive);
      axisPrimitives.forEach((axis) => {
        scene.primitives.remove(axis);
      });
      fovPrimitives.destroy();
      changeListener();
    },
  };
}

export function debugNavigation(
  map: PanoramaMap,
  debugCamera: DebugCameraSphere,
): () => void {
  const widget = map.getCesiumWidget();
  const view = map.panoramaView;
  const altHandler = (event: KeyboardEvent): void => {
    if (event.altKey) {
      widget.scene.screenSpaceCameraController.enableInputs =
        !widget.scene.screenSpaceCameraController.enableInputs;

      if (!widget.scene.screenSpaceCameraController.enableInputs) {
        const image = map.currentPanoramaImage;
        if (image) {
          widget.scene.camera.setView({
            destination: image.position,
            orientation: {
              heading: 0,
              pitch: 0,
              roll: 0,
            },
          });
        }

        debugCamera.paused = false;
        view.suspendTileLoading = false;
      } else {
        view.suspendTileLoading = true;
        debugCamera.paused = true;
      }
    }
  };
  document.addEventListener('keydown', altHandler);

  return (): void => {
    document.removeEventListener('keydown', altHandler);
  };
}
