import AbstractAttributeProvider, {
  type AbstractAttributeProviderOptions,
} from './abstractAttributeProvider.js';
import { featureProviderClassRegistry } from '../classRegistry.js';
import { getInitForUrl } from '../util/fetch.js';

export type CsvAttributeProviderOptions = AbstractAttributeProviderOptions & {
  /**
   * CSV data as a string or URL to fetch the CSV data from
   */
  data: string;
  /**
   * Delimiter used in the CSV data (default: ",")
   */
  delimiter?: string;
  /**
   * Column name to use as the feature ID (default: "id")
   */
  idColumn?: string;
  /**
   * Optional array of headers, if the data does not contain a header row. If not provided, the first row of the CSV data will be used as headers.
   */
  headers?: string[] | null;
  httpHeaders?: Record<string, string>;
};

export default class CsvAttributeProvider extends AbstractAttributeProvider {
  static get className(): string {
    return 'CsvAttributeProvider';
  }

  static getDefaultOptions(): Required<CsvAttributeProviderOptions> {
    return {
      name: '',
      keyProperty: '',
      properties: {},
      type: CsvAttributeProvider.className,
      data: '',
      delimiter: ',',
      idColumn: 'id',
      headers: null,
      httpHeaders: {},
    };
  }

  private _urlOrData: string;

  private _data?: Map<string, Record<string, unknown>>;

  private _delimiter: string;

  private _idColumn: string;

  private _headers?: string[];

  private _httpHeaders?: Record<string, string>;

  private _dataLoadingPromise?: Promise<void>;

  constructor(options: CsvAttributeProviderOptions) {
    const defaultOptions = CsvAttributeProvider.getDefaultOptions();
    super({ ...defaultOptions, ...options });
    this._urlOrData = options.data;
    this._delimiter = options.delimiter ?? defaultOptions.delimiter;
    this._idColumn = options.idColumn ?? defaultOptions.idColumn;

    if (Array.isArray(options.headers)) {
      this._headers = options.headers.slice();
    }
    if (options.httpHeaders) {
      this._httpHeaders = structuredClone(options.httpHeaders);
    }
  }

  private _readLine(line: string): string[] {
    return line.split(this._delimiter).map((v) => v.trim());
  }

  private async _loadData(): Promise<void> {
    if (this._data) {
      return;
    }

    let csvData: string;
    // Check if URL contains newline - if so, it's the data itself
    if (this._urlOrData.includes('\n')) {
      csvData = this._urlOrData;
    } else {
      const init = getInitForUrl(this._urlOrData, this._httpHeaders);
      const response = await fetch(this._urlOrData, init);
      if (!response.ok) {
        throw new Error(`Failed to fetch CSV data from ${this._urlOrData}`);
      }
      csvData = await response.text();
    }

    // Split by both Windows (\r\n) and Unix (\n) line endings
    const lines = csvData.split(/\r?\n/).filter((line) => line.trim() !== '');
    if (lines.length === 0) {
      this.getLogger().warning('No CSV data available to load.');
      this._data = new Map<string, Record<string, unknown>>();
      return;
    }

    const dataMap = new Map<string, Record<string, unknown>>();

    let startIndex = 0;

    if (!this._headers) {
      this._headers = this._readLine(lines[0]);
      startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
      const values = this._readLine(lines[i]);

      const attributes: Record<string, unknown> = {};

      for (let j = 0; j < values.length; j++) {
        const key = this._headers[j] ?? `column_${j}`;
        attributes[key] = values[j];
      }

      const id = attributes[this._idColumn];
      if (typeof id === 'string') {
        dataMap.set(id, attributes);
      }
    }

    this._data = dataMap;
  }

  private _ensureDataLoaded(): Promise<void> {
    if (!this._dataLoadingPromise) {
      this._dataLoadingPromise = this._loadData();
    }
    return this._dataLoadingPromise;
  }

  protected async _getAttributes(
    key: string,
  ): Promise<Record<string, unknown> | undefined> {
    await this._ensureDataLoaded();
    return this._data?.get(key);
  }

  protected async _getBulkAttributes(
    bulk: {
      key: string;
    }[],
  ): Promise<(Record<string, unknown> | undefined)[]> {
    await this._ensureDataLoaded();
    return bulk.map(({ key }) => this._data?.get(key));
  }

  toJSON(
    defaultOptions = CsvAttributeProvider.getDefaultOptions(),
  ): CsvAttributeProviderOptions {
    const config = super.toJSON(defaultOptions) as CsvAttributeProviderOptions;
    config.data = this._urlOrData;
    if (this._delimiter !== defaultOptions.delimiter) {
      config.delimiter = this._delimiter;
    }
    if (this._idColumn !== defaultOptions.idColumn) {
      config.idColumn = this._idColumn;
    }
    if (this._headers && this._headers.length > 0) {
      config.headers = this._headers.slice();
    }
    if (this._httpHeaders) {
      config.httpHeaders = structuredClone(this._httpHeaders);
    }
    return config;
  }

  destroy(): void {
    this._data?.clear();
    this._data = undefined;
    super.destroy();
  }
}

featureProviderClassRegistry.registerClass(
  CsvAttributeProvider.className,
  CsvAttributeProvider,
);
