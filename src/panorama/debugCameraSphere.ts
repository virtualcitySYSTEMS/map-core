import { getHeight, getWidth } from 'ol/extent.js';
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
} from '@vcmap-cesium/engine';
import {
  calculateView,
  unwrapImageView,
  viewToImageView,
} from './panoramaImageSource.js';

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

function drawView(scene: Scene, ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, 360 * PIXEL_PER_DEGREES, 180 * PIXEL_PER_DEGREES);
  drawGrid(ctx);
  const cameraView = calculateView(scene);
  const imageView = viewToImageView(cameraView);
  const unwrappedImageViews = unwrapImageView(imageView).map((view) =>
    view.map(CesiumMath.toDegrees),
  );

  unwrappedImageViews.forEach((imageViewDegrees) => {
    console.log(imageViewDegrees);
    ctx.strokeStyle = 'lime';
    ctx.lineWidth = 5;
    ctx.strokeRect(
      Math.floor(imageViewDegrees[0]) * PIXEL_PER_DEGREES,
      Math.floor(imageViewDegrees[1]) * PIXEL_PER_DEGREES,
      Math.ceil(getWidth(imageViewDegrees)) * PIXEL_PER_DEGREES,
      Math.ceil(getHeight(imageViewDegrees)) * PIXEL_PER_DEGREES,
    );
  });
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
  const primitive = createPrimitive(canvas, position);
  scene.primitives.add(primitive);

  let paused = false;

  const changeListener = scene.camera.changed.addEventListener(() => {
    if (!paused) {
      drawView(scene, ctx);
      primitive.appearance = createMaterial(canvas);
    }
  });

  return {
    get paused(): boolean {
      return paused;
    },
    set paused(value: boolean) {
      paused = value;
    },
    destroy(): void {
      scene.primitives.remove(primitive);
      changeListener();
    },
  };
}
