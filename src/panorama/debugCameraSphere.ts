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
  Transforms,
  HeadingPitchRoll,
  Color,
  Matrix4,
} from '@vcmap-cesium/engine';
import { getFov, getProjectedFov } from './cameraHelpers.js';

export type DebugCameraSphere = {
  paused: boolean;
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

function drawView(scene: Scene, ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, 360 * PIXEL_PER_DEGREES, 180 * PIXEL_PER_DEGREES);
  drawGrid(ctx);
  const cameraView = getProjectedFov(scene.camera);
  if (cameraView) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'lime';
    drawCoordinate(ctx, cameraView.topLeft);
    ctx.strokeStyle = 'green';
    drawLatitude(ctx, cameraView.topRight[1]);
    ctx.strokeStyle = 'red';
    drawCoordinate(ctx, cameraView.topRight);
    ctx.strokeStyle = 'orange';
    drawCoordinate(ctx, cameraView.bottomRight);
    ctx.strokeStyle = 'pink';
    drawCoordinate(ctx, cameraView.bottomLeft);
    ctx.strokeStyle = 'cyan';
    drawLatitude(ctx, cameraView.bottomLeft[1]);
    ctx.strokeStyle = 'purple';
    drawCoordinate(ctx, cameraView.center);
  }
}

function createMaterial(canvas: HTMLCanvasElement): MaterialAppearance {
  return new MaterialAppearance({
    material: Material.fromType('Image', {
      image: canvas.toDataURL('image/png'),
    }),
  });
}

function createPrimitive(
  canvas: HTMLCanvasElement,
  position: Cartesian3,
): Primitive {
  return new Primitive({
    geometryInstances: [
      new GeometryInstance({
        geometry: new SphereGeometry({
          vertexFormat: VertexFormat.POSITION_AND_ST,
          radius: 0.9,
        }),
      }),
    ],
    appearance: createMaterial(canvas),
    asynchronous: false,
    modelMatrix: Transforms.headingPitchRollToFixedFrame(
      position,
      new HeadingPitchRoll(CesiumMath.PI_OVER_TWO, 0, 0),
    ),
  });
}

function createFovPrimitive(
  position: Cartesian3,
  color = Color.RED.withAlpha(0.7),
): Primitive {
  return new Primitive({
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
}

export function createFovPrimitives(scene: Scene): {
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
    console.log(corner, newPos);
    return newPos;
  };
  const fov = getFov(camera);
  const primitives = [...Object.values(fov)].map((corner) =>
    createFovPrimitive(cornerToUnit(corner)),
  );
  primitives.push(
    createFovPrimitive(camera.position, Color.GREEN.withAlpha(0.7)),
  );
  primitives.forEach((primitive) => {
    scene.primitives.add(primitive);
  });

  function update(): void {
    const newFov = getFov(camera);
    [...Object.values(newFov)].forEach((corner, index) => {
      primitives[index].modelMatrix = Matrix4.fromTranslation(
        cornerToUnit(corner),
      );
    });
  }

  function destroy(): void {
    primitives.forEach((primitive) => {
      scene.primitives.remove(primitive);
    });
  }

  return { update, destroy };
}

export function createDebugCameraSphere(
  scene: Scene,
  position: Cartesian3,
): DebugCameraSphere {
  const canvas = document.createElement('canvas');
  canvas.width = 360 * PIXEL_PER_DEGREES;
  canvas.height = 180 * PIXEL_PER_DEGREES;

  const ctx = canvas.getContext('2d')!;
  ctx.translate(360 * PIXEL_PER_DEGREES, 0);
  ctx.scale(-1, 1); // Flip the context horizontally
  drawView(scene, ctx);
  // const primitive = createPrimitive(canvas, position);
  // scene.primitives.add(primitive);

  let paused = false;

  const fovPrimitives = createFovPrimitives(scene);
  const changeListener = scene.camera.changed.addEventListener(() => {
    if (!paused) {
      drawView(scene, ctx);
      fovPrimitives.update();
      // primitive.appearance = createMaterial(canvas);
    }
  });
  scene.camera.percentageChanged = 0.1;

  return {
    get paused(): boolean {
      return paused;
    },
    set paused(value: boolean) {
      paused = value;
    },
    destroy(): void {
      // scene.primitives.remove(primitive);
      fovPrimitives.destroy();
      changeListener();
    },
  };
}
