import {
  Cartesian3,
  Matrix4,
  Plane,
  ClippingPlane,
  ClippingPlaneCollection,
  ImagerySplitDirection,
} from '@vcmap/cesium';

import { check } from '@vcsuite/check';
import CesiumMap from '../maps/cesium.js';
import ClippingObject from './clipping/clippingObject.js';
import Openlayers from '../maps/openlayers.js';

/**
 * @class
 * @api
 * @memberOf vcs.vcm.util
 */
class SplitScreen {
  /**
   * @param {vcs.vcm.util.clipping.ClippingObjectManager} clippingObjectManager
   */
  constructor(clippingObjectManager) {
    /**
     * @type {number}
     * @private
     */
    this._position = 0.5;
    /**
     * @type {Cesium/Scene|null}
     */
    this.scene = null;
    /**
     * @type {ol/Map|null}
     */
    this.olMap = null;
    /**
     * @type {boolean}
     * @api
     */
    this.initialized = false;
    /**
     * @type {vcs.vcm.util.clipping.ClippingObject}
     */
    this.leftScreenClippingObject = new ClippingObject();
    /**
     * @type {vcs.vcm.util.clipping.ClippingObject}
     */
    this.rightScreenClippingObject = new ClippingObject();
    /**
     * @type {Function|null}
     * @private
     */
    this._cameraListener = null;
    /**
     * @type {number|null}
     */
    this.originalCameraPercentageChanged = null;
    /**
     * @type {Array<Function>}
     * @private
     */
    this._targetsChangedListeners = [];

    this._targetsChangedListeners = [
      this.rightScreenClippingObject.targetsUpdated.addEventListener(() => { this._targetsChanged(); }),
      this.leftScreenClippingObject.targetsUpdated.addEventListener(() => { this._targetsChanged(); }),
    ];

    /**
     * @type {vcs.vcm.util.clipping.ClippingObjectManager}
     * @private
     */
    this._clippingObjectManager = clippingObjectManager;
    this._clippingObjectManager.addClippingObject(this.rightScreenClippingObject);
    this._clippingObjectManager.addClippingObject(this.leftScreenClippingObject);
  }

  /**
   * @type {number}
   * @api
   */
  get position() { return this._position; }

  /**
   * @param {number} position
   */
  set position(position) {
    check(position, Number);
    if (position < 0 || position > 1) {
      throw new Error('Position must be between 0 and 1');
    }

    if (Math.abs(this._position - position) > 0.0001) {
      this._updatePosition(position);
    }
  }

  _targetsChanged() {
    if (this.scene) {
      const numTargets = this.rightScreenClippingObject.targets.size + this.leftScreenClippingObject.targets.size;
      const { camera } = this.scene;

      if (this._cameraListener && numTargets === 0) {
        this._cameraListener();
        this._cameraListener = null;
        camera.percentageChanged = this.originalCameraPercentageChanged;
      } else if (!this._cameraListener && numTargets > 0) {
        this.originalCameraPercentageChanged = camera.percentageChanged;
        camera.percentageChanged = 0;
        this._cameraListener = camera.changed.addEventListener(this._updateClippingPlanes.bind(this));
        this._updateClippingPlanes();
      }
    }
  }

  /**
   * @param {number} position
   * @private
   */
  _updatePosition(position) {
    this._position = position;
    if (this.scene) {
      this.scene.imagerySplitPosition = position;
      this._updateClippingPlanes();
    } else if (this.olMap) {
      this.olMap.render();
    }
  }

  /**
   * @param {vcs.vcm.maps.VcsMap} map
   */
  mapActivated(map) {
    if (map instanceof CesiumMap) {
      this.scene = map.getScene();
      this.olMap = null;
      this._targetsChanged();
    } else if (map instanceof Openlayers) {
      this.scene = null;
      this.olMap = map.olMap;
    }
    this._updatePosition(this.position);
  }

  /**
   * calculate a clipping plane from the current swipe position for the given Cesium3DTileset
   * @returns {Cesium/ClippingPlane}
   * @private
   */
  _calcClippingPlane() {
    const { camera } = this.scene;
    const { fov, near } = /** @type {Cesium/PerspectiveFrustum} */ (camera.frustum);
    const screenWidth = this.scene.canvas.width || 1;
    const screenHeight = this.scene.canvas.height || 1;
    let pixelSize;
    if (screenHeight > screenWidth) {
      pixelSize = (near * Math.tan(0.5 * fov) * 2.0) / screenHeight;
    } else {
      pixelSize = (near * Math.tan(0.5 * fov) * 2.0) / screenWidth;
    }

    // extract 3 points lying on swipe plane
    const screenX = (screenWidth * this.position) - (screenWidth / 2);
    const screenY = screenHeight / 2;
    const p1 = new Cartesian3(pixelSize * screenX, pixelSize * screenY, -1 * near);
    const p2 = new Cartesian3(pixelSize * screenX, -1 * pixelSize * screenY, -1 * near);
    Matrix4.multiplyByPoint(camera.inverseViewMatrix, p1, p1);
    Matrix4.multiplyByPoint(camera.inverseViewMatrix, p2, p2);
    const p3WC = camera.positionWC;

    Cartesian3.subtract(p3WC, p1, p1);
    Cartesian3.subtract(p3WC, p2, p2);
    const normal = Cartesian3.cross(p1, p2, new Cartesian3());
    Cartesian3.normalize(normal, normal);
    const planeInFixedFrame = Plane.fromPointNormal(p3WC, normal);

    return ClippingPlane.fromPlane(planeInFixedFrame);
  }

  /**
   * update the clipping planes for all Cesium3DTilesets loaded in the vcMap
   * @private
   */
  _updateClippingPlanes() {
    const plane = this._calcClippingPlane();
    this.leftScreenClippingObject.clippingPlaneCollection = new ClippingPlaneCollection({ planes: [plane] });
    const revClippingPlane = ClippingPlane.clone(plane);
    revClippingPlane.normal = Cartesian3.negate(revClippingPlane.normal, revClippingPlane.normal);
    revClippingPlane.distance *= -1;
    this.rightScreenClippingObject.clippingPlaneCollection =
      new ClippingPlaneCollection({ planes: [revClippingPlane] });
  }

  /**
   * Gets the clipping object for a split direction
   * @param {Cesium/ImagerySplitDirection} splitDirection
   * @returns {vcs.vcm.util.clipping.ClippingObject|null}
   * @api
   */
  getClippingObjectForDirection(splitDirection) {
    check(splitDirection, [
      ImagerySplitDirection.LEFT,
      ImagerySplitDirection.RIGHT,
      ImagerySplitDirection.NONE,
    ]);

    if (splitDirection === ImagerySplitDirection.LEFT) {
      return this.leftScreenClippingObject;
    }
    if (splitDirection === ImagerySplitDirection.RIGHT) {
      return this.rightScreenClippingObject;
    }

    return null;
  }

  destroy() {
    if (this._clippingObjectManager) {
      this._clippingObjectManager.removeClippingObject(this.rightScreenClippingObject);
      this._clippingObjectManager.removeClippingObject(this.leftScreenClippingObject);
    }
    this._targetsChangedListeners.forEach((cb) => { cb(); });
    this._targetsChangedListeners = [];
    this._clippingObjectManager = null;
    if (this._cameraListener) {
      this._cameraListener();
      this._cameraListener = null;
    }
  }
}

export default SplitScreen;
