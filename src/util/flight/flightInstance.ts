import type { FeatureCollection, Point as GeojsonPoint } from 'geojson';
import { parseBoolean, parseNumber } from '@vcsuite/parsers';
import { check, oneOf } from '@vcsuite/check';
import VcsObject, { VcsObjectOptions } from '../../vcsObject.js';
import VcsEvent from '../../vcsEvent.js';
import { parseFlightOptionsFromGeoJson } from './flightHelpers.js';
import { requestJson } from '../fetch.js';
import {
  FlightAnchor,
  anchorFromGeojsonFeature,
  anchorToGeojsonFeature,
  FlightAnchorGeojsonFeature,
} from './flightAnchor.js';
import IndexedCollection from '../indexedCollection.js';
import { destroyCollection } from '../../vcsModuleHelpers.js';

export type FlightInterpolation = 'spline' | 'linear';

export type FlightInstanceMeta = VcsObjectOptions & {
  multiplier?: number;
  interpolation?: FlightInterpolation;
  loop?: boolean;
};

export type FlightInstanceOptions = FlightInstanceMeta & {
  anchors?: FlightAnchorGeojsonFeature[];
  url?: string;
};

class FlightInstance extends VcsObject {
  static get className(): string {
    return 'FlightInstance';
  }

  anchors: IndexedCollection<FlightAnchor>;

  private _multiplier: number;

  private _loop: boolean;

  private _interpolation: FlightInterpolation;

  /**
   * Raised when anchors are added, removed, moved or changed
   */
  anchorsChanged = new VcsEvent<void>();

  /**
   * Raised when multiplier, loop or interpolation changes.
   */
  propertyChanged = new VcsEvent<'multiplier' | 'loop' | 'interpolation'>();

  private readonly _url: string | undefined;

  private _readyPromise: Promise<void> | null = null;

  private _anchorListeners: Map<string, () => void> = new Map();

  static getDefaultOptions(): FlightInstanceOptions {
    return {
      multiplier: 1,
      loop: false,
      interpolation: 'spline',
      anchors: [],
    };
  }

  constructor(options: FlightInstanceOptions) {
    super(options);

    const defaultOptions = FlightInstance.getDefaultOptions();
    const anchorsArray = (options.anchors ?? defaultOptions.anchors!)
      .map(anchorFromGeojsonFeature)
      .filter((a): a is FlightAnchor => !!a);

    this.anchors = IndexedCollection.from(anchorsArray);

    this._multiplier = parseNumber(
      options.multiplier,
      defaultOptions.multiplier,
    );

    this._loop = parseBoolean(options.loop, defaultOptions.loop);

    this._interpolation =
      options.interpolation || defaultOptions.interpolation!;

    this.anchorsChanged = new VcsEvent();

    this._url = options.url;
  }

  get initialized(): boolean {
    return !!this._readyPromise;
  }

  get multiplier(): number {
    return this._multiplier;
  }

  set multiplier(value: number) {
    check(value, Number);

    if (this._multiplier !== value) {
      this._multiplier = value;
      this.propertyChanged.raiseEvent('multiplier');
    }
  }

  /**
   * Whether this flight represents a circular flight path or not
   */
  get loop(): boolean {
    return this._loop;
  }

  set loop(value: boolean) {
    check(value, Boolean);

    if (this._loop !== value) {
      this._loop = value;
      this.propertyChanged.raiseEvent('loop');
    }
  }

  get interpolation(): FlightInterpolation {
    return this._interpolation;
  }

  set interpolation(value: FlightInterpolation) {
    check(value, oneOf('linear', 'spline'));

    if (this._interpolation !== value) {
      this._interpolation = value;
      this.propertyChanged.raiseEvent('interpolation');
    }
  }

  initialize(): Promise<void> {
    if (!this._readyPromise) {
      if (this._url) {
        this._readyPromise = requestJson<
          FeatureCollection<
            GeojsonPoint,
            FlightAnchorGeojsonFeature['properties']
          >
        >(this._url).then((collection) => {
          const instance = parseFlightOptionsFromGeoJson(collection);
          (instance.anchors ?? [])
            .map(anchorFromGeojsonFeature)
            .filter((a): a is FlightAnchor => !!a)
            .forEach((anchor) => this.anchors.add(anchor));
          this._multiplier = instance.multiplier ?? this._multiplier;
          this._loop = instance.loop ?? this._loop;
          this._interpolation = instance.interpolation ?? this._interpolation;
        });
      } else {
        this._readyPromise = Promise.resolve();
      }
      for (const anchor of this.anchors) {
        this._anchorListeners.set(
          anchor.name,
          anchor.changed.addEventListener(() => {
            this.anchorsChanged.raiseEvent();
          }),
        );
      }

      this.anchors.added.addEventListener((anchor) => {
        this._anchorListeners.set(
          anchor.name,
          anchor.changed.addEventListener(() => {
            this.anchorsChanged.raiseEvent();
          }),
        );
        this.anchorsChanged.raiseEvent();
      });

      this.anchors.removed.addEventListener((anchor) => {
        this._anchorListeners.get(anchor.name)?.();
        this._anchorListeners.delete(anchor.name);
        this.anchorsChanged.raiseEvent();
      });

      this.anchors.moved.addEventListener(() => {
        this.anchorsChanged.raiseEvent();
      });
    }

    return this._readyPromise;
  }

  /**
   * checks if this flightInstance is valid. To be valid, a flight must have at least 2 anchors.
   * @returns
   */
  isValid(): boolean {
    return this.anchors.size >= 2;
  }

  /**
   * returns an options object for this flight. if this flight was configured via an URL, only the url will be configured.
   * @returns
   */
  toJSON(): FlightInstanceOptions {
    const config = super.toJSON() as FlightInstanceOptions;

    if (this._url) {
      config.url = this._url;
      return config;
    }

    const defaultOptions = FlightInstance.getDefaultOptions();
    if (this._multiplier !== defaultOptions.multiplier) {
      config.multiplier = this._multiplier;
    }

    if (this._loop !== defaultOptions.loop) {
      config.loop = this._loop;
    }

    if (this._interpolation !== defaultOptions.interpolation) {
      config.interpolation = this._interpolation;
    }

    if (this.anchors.size > 0) {
      config.anchors = [...this.anchors].map(anchorToGeojsonFeature);
    }
    return config;
  }

  destroy(): void {
    this.anchorsChanged.destroy();
    destroyCollection(this.anchors);
    this._anchorListeners.clear();
    super.destroy();
  }
}

export default FlightInstance;
