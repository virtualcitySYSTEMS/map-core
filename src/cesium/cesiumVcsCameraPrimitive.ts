import {
  Cartesian3,
  Matrix3,
  Quaternion,
  Color,
  Primitive,
  GeometryInstance,
  FrustumGeometry,
  ColorGeometryInstanceAttribute,
  PerInstanceColorAppearance,
  FrustumOutlineGeometry,
  destroyObject,
  type Camera,
  type PerspectiveFrustum,
} from '@vcmap-cesium/engine';

const scratchRight = new Cartesian3();
const scratchRotation = new Matrix3();
const scratchOrientation = new Quaternion();

const scratchColor = new Color();
const scratchSplits = [1.0, 100000.0];

export type VcsCameraPrimitiveOptions = {
  camera: Camera;
  color?: Color;
  show?: boolean;
  allowPicking?: boolean;
  id?: object;
};

class VcsCameraPrimitive {
  private _outlinePrimitives: Primitive[] = [];

  private _planesPrimitives: Primitive[] = [];

  show = true;

  private _camera: Camera;

  private _color: Color;

  private allowPicking = true;

  private id: object = {};

  constructor(options: VcsCameraPrimitiveOptions) {
    this.show = typeof options.show === 'undefined' ? true : options.show;
    this._camera = options.camera;
    this._color = options.color || Color.YELLOW;
    this.allowPicking =
      typeof options.allowPicking === 'undefined' ? true : options.allowPicking;
    this.id = options.id || {};
  }

  update(frameState: unknown): void {
    if (!this.show) {
      return;
    }

    const planesPrimitives = this._planesPrimitives;
    const outlinePrimitives = this._outlinePrimitives;
    let i;
    if (planesPrimitives.length === 0) {
      const camera = this._camera;
      const cameraFrustum = camera.frustum;
      const frustum = cameraFrustum.clone() as PerspectiveFrustum;
      const frustumSplits = scratchSplits; // Use near and far planes if no splits created
      frustumSplits[0] = this._camera.frustum.near;
      frustumSplits[1] = this._camera.frustum.far;

      const position = camera.positionWC;
      const direction = camera.directionWC;
      const up = camera.upWC;
      let right = camera.rightWC;
      right = Cartesian3.negate(right, scratchRight);

      const rotation = scratchRotation;
      Matrix3.setColumn(rotation, 0, right, rotation);
      Matrix3.setColumn(rotation, 1, up, rotation);
      Matrix3.setColumn(rotation, 2, direction, rotation);

      const orientation = Quaternion.fromRotationMatrix(
        rotation,
        scratchOrientation,
      );

      planesPrimitives.length = 1;
      outlinePrimitives.length = 1;

      frustum.near = frustumSplits[0];
      frustum.far = frustumSplits[1];

      planesPrimitives[0] = new Primitive({
        allowPicking: this.allowPicking,
        geometryInstances: new GeometryInstance({
          geometry: new FrustumGeometry({
            origin: position,
            orientation,
            frustum,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            _drawNearPlane: true,
          }),
          attributes: {
            color: ColorGeometryInstanceAttribute.fromColor(
              Color.fromAlpha(this._color, 0.1, scratchColor),
            ),
          },
          id: this.id,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          pickPrimitive: this,
        }),
        appearance: new PerInstanceColorAppearance({
          translucent: true,
          flat: true,
        }),
        asynchronous: false,
      });

      outlinePrimitives[0] = new Primitive({
        allowPicking: this.allowPicking,
        geometryInstances: new GeometryInstance({
          geometry: new FrustumOutlineGeometry({
            origin: position,
            orientation,
            frustum,
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            _drawNearPlane: true,
          }),
          attributes: {
            color: ColorGeometryInstanceAttribute.fromColor(this._color),
          },
          id: this.id,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          pickPrimitive: this,
        }),
        appearance: new PerInstanceColorAppearance({
          translucent: false,
          flat: true,
        }),
        asynchronous: false,
      });
    }
    const { length } = planesPrimitives;
    for (i = 0; i < length; ++i) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      outlinePrimitives[i].update(frameState);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      planesPrimitives[i].update(frameState);
    }
  }

  destroy(): void {
    const { length } = this._planesPrimitives;
    for (let i = 0; i < length; ++i) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this._outlinePrimitives[i] =
        this._outlinePrimitives[i] && this._outlinePrimitives[i].destroy();
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this._planesPrimitives[i] =
        this._planesPrimitives[i] && this._planesPrimitives[i].destroy();
    }
    return destroyObject(this);
  }
}

export default VcsCameraPrimitive;
