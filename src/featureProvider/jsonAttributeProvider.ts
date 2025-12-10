import { is, oneOf } from '@vcsuite/check';
import AbstractAttributeProvider, {
  type AbstractAttributeProviderOptions,
} from './abstractAttributeProvider.js';
import { getInitForUrl, requestJson } from '../util/fetch.js';

export type JsonAttributeData = {
  features: { id: string | number; properties: Record<string, unknown> }[];
};

export type JsonAttributeProviderOptions = AbstractAttributeProviderOptions & {
  data: string | JsonAttributeData;
  headers?: Record<string, string>;
};

export default class JsonAttributeProvider extends AbstractAttributeProvider {
  static get className(): string {
    return 'JsonAttributeProvider';
  }

  static getDefaultOptions(): JsonAttributeProviderOptions {
    return {
      ...AbstractAttributeProvider.getDefaultOptions(),
      data: '',
    };
  }

  private _data?: Map<string, Record<string, unknown>>;

  private readonly _dataOrUrl: string | JsonAttributeData;

  private readonly _headers?: Record<string, string>;

  constructor(options: JsonAttributeProviderOptions) {
    super(options);

    this._dataOrUrl = is(options.data, Object)
      ? structuredClone(options.data)
      : options.data;
    this._headers = options.headers;
  }

  private async _loadData(): Promise<void> {
    if (this._data) {
      return;
    }

    let serializedData;
    if (is(this._dataOrUrl, String)) {
      const init = getInitForUrl(this._dataOrUrl, this._headers);
      serializedData = await requestJson<JsonAttributeData>(
        this._dataOrUrl,
        init,
      );
    } else {
      serializedData = this._dataOrUrl;
    }

    const data = new Map<string, Record<string, unknown>>();
    if (Array.isArray(serializedData.features)) {
      serializedData?.features?.forEach(({ id, properties }) => {
        if (is(id, oneOf(String, Number)) && is(properties, Object)) {
          data.set(String(id), properties);
        }
      });
    }

    this._data = data;
  }

  protected async _getAttributes(
    key: string,
  ): Promise<Record<string, unknown> | undefined> {
    await this._loadData();
    return this._data?.get(key);
  }

  protected async _getBulkAttributes(
    bulk: {
      key: string;
    }[],
  ): Promise<(Record<string, unknown> | undefined)[]> {
    await this._loadData();
    return bulk.map(({ key }) => this._data?.get(key));
  }

  toJSON(
    defaultOptions = JsonAttributeProvider.getDefaultOptions(),
  ): JsonAttributeProviderOptions {
    const config = super.toJSON(defaultOptions) as JsonAttributeProviderOptions;
    if (is(this._dataOrUrl, Object)) {
      config.data = structuredClone(this._dataOrUrl);
    } else {
      config.data = this._dataOrUrl;
    }

    if (this._headers) {
      config.headers = structuredClone(this._headers);
    }

    return config;
  }

  destroy(): void {
    this._data?.clear();
    this._data = undefined;
    super.destroy();
  }
}
