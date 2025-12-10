import AbstractAttributeProvider from './abstractAttributeProvider.js';
import type { VcsObjectOptions } from '../vcsObject.js';
import { getInitForUrl, requestJson } from '../util/fetch.js';
import { featureProviderClassRegistry } from '../classRegistry.js';

export type UrlIdAttributeProviderOptions = VcsObjectOptions & {
  urlTemplate: string;
  headers?: Record<string, string>;
};

/**
 * Provides attributes for features by fetching data from a URL based on feature IDs.
 * The URL template should contain a {id} placeholder that will be replaced with the encoded feature ID.
 * urlTemplate: 'https://api.example.com/features/{id}'
 * For a feature with ID "123", this would request: https://api.example.com/features/123
 *
 * The backend should return a JSON object with attribute key-value pairs.
 * {
 * "name": "Feature Name",
 * "description": "Feature description",
 * "value": 42
 * }
 * If the request fails or returns invalid data, the provider returns undefined.
 */
export default class UrlIdAttributeProvider extends AbstractAttributeProvider {
  static get className(): string {
    return 'UrlIdAttributeProvider';
  }

  private _urlTemplate: string;

  private _headers?: Record<string, string> | undefined;

  constructor(options: UrlIdAttributeProviderOptions) {
    super(options);

    this._urlTemplate = options.urlTemplate;

    this._headers = options.headers
      ? structuredClone(options.headers)
      : undefined;
  }

  protected async _getAttributes(
    id: string,
  ): Promise<Record<string, unknown> | undefined> {
    const url = this._urlTemplate.replace(
      '{id}',
      encodeURIComponent(String(id)),
    );

    try {
      return await requestJson<Record<string, unknown>>(
        url,
        getInitForUrl(url, this._headers),
      );
    } catch {
      return undefined;
    }
  }

  override toJSON(
    _defaultOptions?: UrlIdAttributeProviderOptions,
  ): UrlIdAttributeProviderOptions {
    const config: Partial<UrlIdAttributeProviderOptions> = super.toJSON(
      _defaultOptions,
    );

    config.urlTemplate = this._urlTemplate;

    if (this._headers) {
      config.headers = structuredClone(this._headers);
    }

    return config as UrlIdAttributeProviderOptions;
  }
}

featureProviderClassRegistry.registerClass(
  UrlIdAttributeProvider.className,
  UrlIdAttributeProvider,
);
