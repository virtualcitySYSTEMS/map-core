import deepEqual from 'fast-deep-equal';
import type { Coordinate } from 'ol/coordinate.js';
import type { Feature } from 'ol';
import { Polygon } from 'ol/geom.js';
import { check, oneOf } from '@vcsuite/check';
import { parseBoolean } from '@vcsuite/parsers';
import { getLogger } from '@vcsuite/logger';
import { Cartesian3, ClippingPolygon } from '@vcmap-cesium/engine';
import type { VcsObjectOptions } from '../../vcsObject.js';
import VcsObject from '../../vcsObject.js';
import VcsEvent from '../../vcsEvent.js';

export enum ClippingPolygonObjectState {
  INACTIVE = 1,
  ACTIVE = 2,
}

export type ClippingPolygonObjectOptions = VcsObjectOptions & {
  layerNames?: string[] | 'all';
  terrain?: boolean;
  activeOnStartup?: boolean;
  coordinates: Array<Coordinate>;
};

function getLayerNamesClone(layerNames: string[] | 'all'): string[] | 'all' {
  return Array.isArray(layerNames) ? layerNames.slice() : layerNames;
}

class ClippingPolygonObject extends VcsObject {
  static get className(): string {
    return 'ClippingPolygonObject';
  }

  static getDefaultOptions(): ClippingPolygonObjectOptions {
    return {
      activeOnStartup: false,
      layerNames: 'all',
      terrain: false,
      coordinates: [],
    };
  }

  static fromFeature(feature: Feature<Polygon>): ClippingPolygonObject | null {
    const geometry = feature.getGeometry();
    if (geometry instanceof Polygon) {
      return ClippingPolygonObject.fromGeometry(geometry);
    }
    return null;
  }

  static fromGeometry(geometry: Polygon): ClippingPolygonObject {
    check(geometry, Polygon);
    const ring = geometry.getLinearRing(0)!;
    const coordinates = ring.getCoordinates();
    return new ClippingPolygonObject({ coordinates });
  }

  activeOnStartup: boolean;

  private _state: ClippingPolygonObjectState;

  stateChanged = new VcsEvent<ClippingPolygonObjectState>();

  private _layerNames: string[] | 'all';

  private _terrain: boolean;

  private _coordinates: Array<Coordinate> = [];

  private _clippingPolygon: ClippingPolygon | undefined = undefined;

  clippingPolygonChanged = new VcsEvent<{
    newValue: ClippingPolygon;
    oldValue: ClippingPolygon | undefined;
  }>();

  layersChanged = new VcsEvent<{
    newValue: string[] | 'all';
    oldValue: string[] | 'all';
  }>();

  terrainChanged = new VcsEvent<boolean>();

  constructor(options: ClippingPolygonObjectOptions) {
    const defaultOptions = ClippingPolygonObject.getDefaultOptions();
    super({ ...defaultOptions, ...options });

    this.activeOnStartup = parseBoolean(
      options.activeOnStartup,
      defaultOptions.activeOnStartup,
    );

    this._state = ClippingPolygonObjectState.INACTIVE;

    this._layerNames = options.layerNames || defaultOptions.layerNames!;

    this._terrain = parseBoolean(options.terrain, defaultOptions.terrain);

    this.setCoordinates(options.coordinates || defaultOptions.coordinates);
  }

  /**
   * Whether the clipping polygon object is active or not
   */
  get active(): boolean {
    return this._state === ClippingPolygonObjectState.ACTIVE;
  }

  get layerNames(): string[] | 'all' {
    return this._layerNames;
  }

  get terrain(): boolean {
    return this._terrain;
  }

  set terrain(terrain: boolean) {
    check(terrain, Boolean);

    if (this._terrain !== terrain) {
      this._terrain = terrain;
      this.terrainChanged.raiseEvent(this._terrain);
    }
  }

  get clippingPolygon(): ClippingPolygon | undefined {
    return this._clippingPolygon;
  }

  get coordinates(): readonly Readonly<Coordinate>[] {
    return this._coordinates;
  }

  /**
   * Set polygon coordinates from an array of geographic wgs84 coordinates
   * @param coordinates
   */
  setCoordinates(coordinates: Coordinate[]): void {
    check(coordinates, [[Number]]);

    if (coordinates.length < 3) {
      getLogger('ClippingPolygonObject').error(
        'At least 3 coordinates are required!',
      );
      return;
    }

    if (deepEqual(this._coordinates, coordinates)) {
      getLogger('ClippingPolygonObject').error(
        'The provided coordinates are already set!',
      );
      return;
    }

    const positions = coordinates.map((c) => {
      return Cartesian3.fromDegrees(c[0], c[1], c[2]);
    });
    this._coordinates = structuredClone(coordinates);

    const oldValue = this._clippingPolygon;
    const newValue = new ClippingPolygon({ positions });
    this._clippingPolygon = newValue;
    this.clippingPolygonChanged.raiseEvent({ oldValue, newValue });
  }

  setLayerNames(layerNames: string[] | 'all'): void {
    check(layerNames, oneOf([String], 'all'));

    if (!deepEqual(this._layerNames, layerNames)) {
      const oldValue = this._layerNames;
      this._layerNames = getLayerNamesClone(layerNames);
      this.layersChanged.raiseEvent({
        newValue: layerNames,
        oldValue,
      });
    }
  }

  activate(): void {
    if (this._state === ClippingPolygonObjectState.INACTIVE) {
      this._state = ClippingPolygonObjectState.ACTIVE;
      this.stateChanged.raiseEvent(this._state);
    }
  }

  deactivate(): void {
    if (this._state === ClippingPolygonObjectState.ACTIVE) {
      this._state = ClippingPolygonObjectState.INACTIVE;
      this.stateChanged.raiseEvent(this._state);
    }
  }

  toJSON(
    defaultOptions = ClippingPolygonObject.getDefaultOptions(),
  ): ClippingPolygonObjectOptions {
    const config: ClippingPolygonObjectOptions = {
      ...super.toJSON(defaultOptions),
      coordinates: structuredClone(this._coordinates),
    };

    if (!deepEqual(this._layerNames, defaultOptions.layerNames)) {
      config.layerNames = getLayerNamesClone(this._layerNames);
    }

    if (this._terrain !== defaultOptions.terrain) {
      config.terrain = this._terrain;
    }

    if (this.activeOnStartup !== defaultOptions.activeOnStartup) {
      config.activeOnStartup = this.activeOnStartup;
    }

    return config;
  }

  destroy(): void {
    this.stateChanged.destroy();
    this.clippingPolygonChanged.destroy();
    this.layersChanged.destroy();
    this.terrainChanged.destroy();
    super.destroy();
  }
}

export default ClippingPolygonObject;
