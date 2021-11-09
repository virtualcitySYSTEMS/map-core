import { Math as CesiumMath } from '@vcmap/cesium';
import View from 'ol/View.js';
import { getTransform } from 'ol/proj.js';
import { inAndOut } from 'ol/easing.js';
import { boundingExtent, containsXY } from 'ol/extent.js';
import { parseBoolean } from '@vcsuite/parsers';
import ViewPoint from '../util/viewpoint.js';
import BaseOLMap from './baseOLMap.js';
import VcsMap from './map.js';
import { VcsClassRegistry } from '../classRegistry.js';

/**
 * @typedef {vcs.vcm.maps.VcsMap.Options} vcs.vcm.maps.Openlayers.Options
 * @property {boolean} [fixedNorthOrientation=true] -  sets whether the openlayers map has a fixed orientation towards north (default true)
 * @api stable
 */

/**
 * Openlayers Map Class (2D map)
 * @class
 * @export
 * @extends {vcs.vcm.maps.BaseOLMap}
 * @api stable
 * @memberOf vcs.vcm.maps
 */
class Openlayers extends BaseOLMap {
  /**
   * @type {string}
   */
  static get className() { return 'vcs.vcm.maps.Openlayers'; }

  /**
   * @returns {vcs.vcm.maps.Openlayers.Options}
   */
  static getDefaultOptions() {
    return {
      ...VcsMap.getDefaultOptions(),
      fixedNorthOrientation: true,
    };
  }

  /**
   * @param {vcs.vcm.maps.Openlayers.Options} options
   */
  constructor(options) {
    super(options);

    const defaultOptions = Openlayers.getDefaultOptions();

    /** @type {boolean} */
    this.fixedNorthOrientation = parseBoolean(options.fixedNorthOrientation, defaultOptions.fixedNorthOrientation);
  }

  /**
   * @returns {Promise<void>}
   */
  async initialize() {
    if (!this.initialized) {
      await super.initialize();
      this.olMap.setView(new View({
        center: [1230922.6203948376, 6350766.117974091],
        zoom: 13,
      }));
      this.initialized = true;
    }
  }

  /**
   * @inheritDoc
   * @returns {Promise<vcs.vcm.util.ViewPoint>}
   */
  async getViewPoint() {
    return this.getViewPointSync();
  }

  /**
   * @inheritDoc
   * @returns {vcs.vcm.util.ViewPoint}
   */
  getViewPointSync() {
    const view = this.olMap.getView();
    const coord = view.getCenter();
    const toLatLon = getTransform(view.getProjection(), 'EPSG:4326');
    const fov = Math.PI / 3.0;
    const viewport = this.olMap.getViewport();
    const size = {};
    size.height = viewport.offsetHeight || 1;
    size.width = viewport.offsetWidth || 1;
    const aspectRatio = size.width / size.height;
    const fovy = Math.atan(Math.tan(fov * 0.5) / aspectRatio) * 2.0;
    const latlon = toLatLon(coord.slice(0, 2));
    const metersPerUnit = view.getProjection().getMetersPerUnit();

    const resolution = view.getResolution();
    const visibleMapUnits = resolution * size.height;
    const relativeCircumference = Math.cos(Math.abs(CesiumMath.toRadians(latlon[1])));
    const visibleMeters = visibleMapUnits * metersPerUnit * relativeCircumference;
    const height = Math.abs((visibleMeters / 2) / Math.tan(fovy / 2));

    const heading = -CesiumMath.toDegrees(view.getRotation());
    // don't add 0;
    const groundPosition = latlon; // .concat([0]);
    const pitch = -90;
    return new ViewPoint({
      groundPosition,
      pitch,
      heading,
      distance: height,
    });
  }

  /**
   * @param {vcs.vcm.util.ViewPoint} viewpoint
   * @returns {Promise<void>}
   * @inheritDoc
   */
  gotoViewPoint(viewpoint) {
    if (this.movementDisabled || !viewpoint.isValid()) {
      return Promise.resolve();
    }
    if (this.fixedNorthOrientation) {
      viewpoint.heading = 0;
    }
    const view = this.olMap.getView();
    const fromLatLon = getTransform('EPSG:4326', view.getProjection());
    let coords = [];
    if (viewpoint.groundPosition) {
      coords = viewpoint.groundPosition.slice(0, 2);
    } else {
      coords = viewpoint.cameraPosition.slice(0, 2);
    }
    const { distance } = viewpoint;
    const center = fromLatLon(coords);

    const fov = Math.PI / 3.0;
    const viewport = this.olMap.getViewport();
    const size = {};
    size.height = viewport.offsetHeight ? viewport.offsetHeight : 1;
    size.width = viewport.offsetWidth ? viewport.offsetWidth : 1;
    const aspectRatio = size.width / size.height;
    const fovy = Math.atan(Math.tan(fov * 0.5) / aspectRatio) * 2.0;
    const visibleMeters = 2 * distance * Math.tan(fovy / 2);
    const metersPerUnit = view.getProjection().getMetersPerUnit();
    const relativeCircumference = Math.cos(Math.abs(CesiumMath.toRadians(coords[1])));
    const visibleMapUnits = visibleMeters / metersPerUnit / relativeCircumference;

    const resolution = visibleMapUnits / size.height;

    if (viewpoint.animate) {
      let rotation = 0;
      if (!this.fixedNorthOrientation && viewpoint.heading != null) {
        rotation = -CesiumMath.toRadians(viewpoint.heading);
      }
      return new Promise((resolve) => {
        view.animate({
          duration: viewpoint.duration ? viewpoint.duration * 1000 : 100,
          center,
          easing: inAndOut, // XXX map to viewpoint easingFunctionName?
          resolution,
          rotation,
        }, () => { resolve(); });
      });
    } else {
      view.setCenter(center);
      view.setResolution(resolution);
      if (!this.fixedNorthOrientation && viewpoint.heading != null) {
        view.setRotation(-CesiumMath.toRadians(viewpoint.heading));
      }
    }
    return Promise.resolve();
  }

  /**
   * @param {ol/Coordinate} coords in WGS84 degrees
   * @returns {boolean}
   * @api
   */
  pointIsVisible(coords) {
    const view = this.olMap.getView();
    const extent = view.calculateExtent(this.olMap.getSize());
    const toLatLon = getTransform(view.getProjection(), 'EPSG:4326');
    const topLeft = [extent[0], extent[3]];
    const bottomRight = [extent[2], extent[1]];
    const bbox = [toLatLon(topLeft), toLatLon(bottomRight)];

    return containsXY(boundingExtent(bbox), coords[0], coords[1]);
  }

  /**
   * @returns {vcs.vcm.maps.Openlayers.Options}
   * @api
   */
  getConfigObject() {
    const config = /** @type {vcs.vcm.maps.Openlayers.Options} */ (super.getConfigObject());

    const defaultOptions = Openlayers.getDefaultOptions();
    if (this.fixedNorthOrientation !== defaultOptions.fixedNorthOrientation) {
      config.fixedNorthOrientation = this.fixedNorthOrientation;
    }

    return config;
  }
}

VcsClassRegistry.registerClass(Openlayers.className, Openlayers);
export default Openlayers;
