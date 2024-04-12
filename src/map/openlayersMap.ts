import { Math as CesiumMath } from '@vcmap-cesium/engine';
import View from 'ol/View.js';
import { getTransform } from 'ol/proj.js';
import { inAndOut } from 'ol/easing.js';
import { boundingExtent, containsXY } from 'ol/extent.js';
import type { Coordinate } from 'ol/coordinate.js';
import { parseBoolean } from '@vcsuite/parsers';
import Viewpoint from '../util/viewpoint.js';
import BaseOLMap from './baseOLMap.js';
import VcsMap, { type VcsMapOptions } from './vcsMap.js';
import { mapClassRegistry } from '../classRegistry.js';

export type OpenlayersOptions = VcsMapOptions & {
  fixedNorthOrientation?: boolean;
};

/**
 * @group Map
 */
class OpenlayersMap extends BaseOLMap {
  static get className(): string {
    return 'OpenlayersMap';
  }

  fixedNorthOrientation: boolean;

  static getDefaultOptions(): OpenlayersOptions {
    return {
      ...VcsMap.getDefaultOptions(),
      fixedNorthOrientation: true,
    };
  }

  /**
   * @param  options
   */
  constructor(options: OpenlayersOptions) {
    super(options);

    const defaultOptions = OpenlayersMap.getDefaultOptions();

    this.fixedNorthOrientation = parseBoolean(
      options.fixedNorthOrientation,
      defaultOptions.fixedNorthOrientation,
    );
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      await super.initialize();
      this.olMap!.setView(
        new View({
          center: [1230922.6203948376, 6350766.117974091],
          zoom: 13,
        }),
      );
      this.initialized = true;
    }
  }

  getViewpoint(): Promise<Viewpoint | null> {
    return Promise.resolve(this.getViewpointSync());
  }

  getViewpointSync(): Viewpoint | null {
    if (!this.olMap) {
      return null;
    }
    const view = this.olMap.getView();
    const coord = view.getCenter();
    if (!coord) {
      return null;
    }
    const toLatLon = getTransform(view.getProjection(), 'EPSG:4326');
    const fov = Math.PI / 3.0;
    const viewport = this.olMap.getViewport();
    const size = {
      height: viewport.offsetHeight || 1,
      width: viewport.offsetWidth || 1,
    };
    const aspectRatio = size.width / size.height;
    const fovy = Math.atan(Math.tan(fov * 0.5) / aspectRatio) * 2.0;
    // error in TransformFunction type definition, remove undefined after openlayer fixed the type
    const latlon = toLatLon(coord.slice(0, 2), undefined, undefined);
    const metersPerUnit = view.getProjection().getMetersPerUnit() ?? 1;

    const resolution = view.getResolution() ?? 1;
    const visibleMapUnits = resolution * size.height;
    const relativeCircumference = Math.cos(
      Math.abs(CesiumMath.toRadians(latlon[1])),
    );
    const visibleMeters =
      visibleMapUnits * metersPerUnit * relativeCircumference;
    const height = Math.abs(visibleMeters / 2 / Math.tan(fovy / 2));

    const heading = -CesiumMath.toDegrees(view.getRotation());
    // don't add 0;
    const groundPosition = latlon; // .concat([0]);
    const pitch = -90;
    return new Viewpoint({
      groundPosition,
      pitch,
      heading,
      distance: height,
    });
  }

  gotoViewpoint(viewpoint: Viewpoint): Promise<void> {
    if (this.movementApiCallsDisabled || !viewpoint.isValid() || !this.olMap) {
      return Promise.resolve();
    }
    let { heading } = viewpoint;
    if (this.fixedNorthOrientation) {
      heading = 0;
    }
    const view = this.olMap.getView();
    const fromLatLon = getTransform('EPSG:4326', view.getProjection());
    let coords = [];
    if (viewpoint.groundPosition) {
      coords = viewpoint.groundPosition.slice(0, 2);
    } else {
      coords = viewpoint.cameraPosition!.slice(0, 2);
    }
    const { distance } = viewpoint;
    // error in TransformFunction type definition, remove undefined after openlayer fixed the type
    const center = fromLatLon(coords, undefined, undefined);

    const fov = Math.PI / 3.0;
    const viewport = this.olMap.getViewport();
    const size = {
      height: viewport.offsetHeight ? viewport.offsetHeight : 1,
      width: viewport.offsetWidth ? viewport.offsetWidth : 1,
    };
    const aspectRatio = size.width / size.height;
    const fovy = Math.atan(Math.tan(fov * 0.5) / aspectRatio) * 2.0;
    const visibleMeters = 2 * (distance ?? 1) * Math.tan(fovy / 2);
    const metersPerUnit = view.getProjection().getMetersPerUnit() ?? 1;
    const relativeCircumference = Math.cos(
      Math.abs(CesiumMath.toRadians(coords[1])),
    );
    const visibleMapUnits =
      visibleMeters / metersPerUnit / relativeCircumference;

    const resolution = visibleMapUnits / size.height;

    if (viewpoint.animate) {
      let rotation = 0;
      if (!this.fixedNorthOrientation && heading != null) {
        rotation = -CesiumMath.toRadians(heading);
      }
      return new Promise((resolve) => {
        view.animate(
          {
            duration: viewpoint.duration ? viewpoint.duration * 1000 : 100,
            center,
            easing: inAndOut, // XXX map to viewpoint easingFunctionName?
            resolution,
            rotation,
          },
          () => {
            resolve();
          },
        );
      });
    } else {
      view.setCenter(center);
      view.setResolution(resolution);
      if (!this.fixedNorthOrientation && heading != null) {
        view.setRotation(-CesiumMath.toRadians(heading));
      }
    }
    return Promise.resolve();
  }

  pointIsVisible(coords: Coordinate): boolean {
    if (!this.olMap) {
      return false;
    }
    const view = this.olMap.getView();
    const extent = view.calculateExtent(this.olMap.getSize());
    const toLatLon = getTransform(view.getProjection(), 'EPSG:4326');
    const topLeft = [extent[0], extent[3]];
    const bottomRight = [extent[2], extent[1]];
    // error in TransformFunction type definition, remove undefined after openlayer fixed the type
    const bbox = [
      toLatLon(topLeft, undefined, undefined),
      toLatLon(bottomRight, undefined, undefined),
    ];

    return containsXY(boundingExtent(bbox), coords[0], coords[1]);
  }

  toJSON(): OpenlayersOptions {
    const config: OpenlayersOptions = super.toJSON();

    const defaultOptions = OpenlayersMap.getDefaultOptions();
    if (this.fixedNorthOrientation !== defaultOptions.fixedNorthOrientation) {
      config.fixedNorthOrientation = this.fixedNorthOrientation;
    }

    return config;
  }
}

mapClassRegistry.registerClass(OpenlayersMap.className, OpenlayersMap);
export default OpenlayersMap;
