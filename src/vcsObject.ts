import { v4 as uuidv4 } from 'uuid';
import { getLogger, type Logger } from '@vcsuite/logger';
import { moduleIdSymbol } from './moduleIdSymbol.js';

export type VcsObjectOptions = {
  /**
   * the type of object, typically only used in configs
   */
  type?: string;
  /**
   *  name of the object, if not given a uuid is generated, is used for the framework functions getObjectByName
   */
  name?: string;
  /**
   * key value store for framework independent values per Object
   */
  properties?: Record<string, unknown>;
};

/**
 * baseclass for all Objects
 */
class VcsObject {
  static get className(): string {
    return 'VcsObject';
  }

  /**
   * unique Name
   */
  readonly name: string;

  properties: Record<string, unknown>;

  isDestroyed: boolean;

  [moduleIdSymbol]?: string;

  constructor(options: VcsObjectOptions) {
    this.name = options.name || uuidv4();
    this.properties = options.properties || {};
    this.isDestroyed = false;
  }

  get className(): string {
    return (this.constructor as typeof VcsObject).className;
  }

  getLogger(): Logger {
    return getLogger(this.className);
  }

  toJSON(): VcsObjectOptions {
    const config: VcsObjectOptions = {
      type: this.className,
      name: this.name,
    };

    if (Object.keys(this.properties).length > 0) {
      config.properties = { ...this.properties };
    }

    return config;
  }

  destroy(): void {
    this.isDestroyed = true;
    this.properties = {};
  }
}

export default VcsObject;
