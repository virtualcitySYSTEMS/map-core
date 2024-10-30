import { v4 as uuidv4 } from 'uuid';
import Projection, { type ProjectionOptions } from './util/projection.js';
import type { VcsMapOptions } from './map/vcsMap.js';
import type { LayerOptions } from './layer/layer.js';
import type { StyleItemOptions } from './style/styleItem.js';
import type { ViewpointOptions } from './util/viewpoint.js';
import type { ObliqueCollectionOptions } from './oblique/obliqueCollection.js';
import type VcsApp from './vcsApp.js';
import { moduleIdSymbol } from './moduleIdSymbol.js';
import { HiddenObject } from './util/hiddenObjects.js';
import { FlightInstanceOptions } from './util/flight/flightInstance.js';

export type VcsModuleConfig = {
  _id?: string;
  name?: string;
  description?: string | null;
  properties?: Record<string, unknown>;
  layers?: LayerOptions[];
  maps?: VcsMapOptions[];
  styles?: StyleItemOptions[];
  viewpoints?: ViewpointOptions[];
  startingViewpointName?: string | null;
  startingMapName?: string | null;
  startingObliqueCollectionName?: string | null;
  projection?: ProjectionOptions | null;
  obliqueCollections?: ObliqueCollectionOptions[];
  categories?: { name: string; items: object[] }[];
  hiddenObjects?: HiddenObject[];
  flights?: FlightInstanceOptions[];
};

/**
 * The id of the volatile module. Objects with this id shall never be serialized.
 */
export const volatileModuleId = uuidv4();

/**
 * This marks an object as "volatile". This ensures, that an object added to the {@link VcsApp}
 * will never be serialized into a module, regardless of the current dynamic module. Typical use case is a scratch layer
 * which represents temporary features.
 * @param  object - the object to mark as volatile
 */
export function markVolatile(
  object: object & { [moduleIdSymbol]?: string },
): void {
  object[moduleIdSymbol] = volatileModuleId;
}

/**
 * @group Application
 */
class VcsModule {
  private _uuid: string;

  name: string;

  description: string | undefined | null;

  properties: Record<string, unknown> | undefined;

  startingViewpointName: string | undefined | null;

  startingMapName: string | undefined | null;

  startingObliqueCollectionName: string | undefined | null;

  projection: Projection | undefined | null;

  private _config: VcsModuleConfig;

  /**
   * @param  config
   */
  constructor(config: VcsModuleConfig) {
    this._uuid = config._id || uuidv4();
    this.name = config.name ?? this._uuid;
    this.description = config.description;
    this.properties = config.properties;
    this.startingViewpointName = config.startingViewpointName;
    this.startingMapName = config.startingMapName;
    this.startingObliqueCollectionName = config.startingObliqueCollectionName;
    this.projection = config.projection
      ? new Projection(config.projection)
      : config.projection;
    this._config = config;
  }

  get _id(): string {
    return this._uuid;
  }

  get config(): VcsModuleConfig {
    return JSON.parse(JSON.stringify(this._config)) as VcsModuleConfig;
  }

  /**
   * Sets the config object by serializing all runtime objects of the current app.
   * @param  app
   */
  setConfigFromApp(app: VcsApp): void {
    this._config = { ...this.config, ...app.serializeModule(this._uuid) };
  }

  toJSON(): VcsModuleConfig {
    const config: VcsModuleConfig = {};
    if (this._config._id) {
      config._id = this._config._id;
    }
    config.name = this.name;

    if (this.properties && Object.keys(this.properties).length > 0) {
      config.properties = JSON.parse(JSON.stringify(this.properties)) as Record<
        string,
        unknown
      >;
    }

    if (this.description !== undefined) {
      config.description = this.description;
    }
    if (this.startingViewpointName !== undefined) {
      config.startingViewpointName = this.startingViewpointName;
    }
    if (this.startingMapName !== undefined) {
      config.startingMapName = this.startingMapName;
    }
    if (this.startingObliqueCollectionName !== undefined) {
      config.startingObliqueCollectionName = this.startingObliqueCollectionName;
    }
    if (this.projection !== undefined) {
      config.projection = this.projection?.toJSON() ?? null;
    }
    return config;
  }
}

export default VcsModule;
