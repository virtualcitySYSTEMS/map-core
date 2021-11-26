// @ts-nocheck
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
} from '@vcmap/cesium';

const scratchRight = new Cartesian3();
const scratchRotation = new Matrix3();
const scratchOrientation = new Quaternion();

const scratchColor = new Color();
const scratchSplits = [1.0, 100000.0];

/**
 * @typedef {Object} VcsCameraPrimitiveOptions
 * @property {import("@vcmap/cesium").Camera} camera
 * @property {import("@vcmap/cesium").Color|undefined} [color=Color.YELLOW]
 * @property {boolean|undefined} [show=true]
 * @property {boolean|undefined} [allowPicking=true]
 * @property {Object|undefined} id
 */

/**
 * @class
 */
class VcsCameraPrimitive {
  /**
   * @param {VcsCameraPrimitiveOptions} options
   */
  constructor(options) {
    this._outlinePrimitives = [];
    this._planesPrimitives = [];
    /** @type {boolean} */
    this.show = typeof options.show === 'undefined' ? true : options.show;
    this._camera = options.camera;
    this._color = options.color || Color.YELLOW;
    this.allowPicking = typeof options.allowPicking === 'undefined' ? true : options.allowPicking;
    this.id = options.id || {};
  }

  update(frameState) {
    if (!this.show) {
      return;
    }

    const planesPrimitives = this._planesPrimitives;
    const outlinePrimitives = this._outlinePrimitives;
    let i;
    if (planesPrimitives.length === 0) {
      const camera = this._camera;
      const cameraFrustum = camera.frustum;
      const frustum = cameraFrustum.clone();
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

      const orientation = Quaternion.fromRotationMatrix(rotation, scratchOrientation);

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
            _drawNearPlane: true,
          }),
          attributes: {
            color: ColorGeometryInstanceAttribute.fromColor(Color.fromAlpha(this._color, 0.1, scratchColor)),
          },
          id: this.id,
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
            _drawNearPlane: true,
          }),
          attributes: {
            color: ColorGeometryInstanceAttribute.fromColor(this._color),
          },
          id: this.id,
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
      outlinePrimitives[i].update(frameState);
      planesPrimitives[i].update(frameState);
    }
  }

  destroy() {
    const { length } = this._planesPrimitives;
    for (let i = 0; i < length; ++i) {
      this._outlinePrimitives[i] = this._outlinePrimitives[i] && this._outlinePrimitives[i].destroy();
      this._planesPrimitives[i] = this._planesPrimitives[i] && this._planesPrimitives[i].destroy();
    }
    return destroyObject(this);
  }
}

export default VcsCameraPrimitive;
