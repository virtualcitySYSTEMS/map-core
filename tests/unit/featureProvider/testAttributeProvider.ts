import {
  AbstractAttributeProvider,
  type AbstractAttributeProviderOptions,
} from '../../../index.js';

export default class TestAttributeProvider extends AbstractAttributeProvider {
  static get className(): string {
    return 'TestAttributeProvider';
  }

  private readonly _value: () => number;

  constructor(
    value: number | (() => number),
    options: AbstractAttributeProviderOptions = {},
  ) {
    super(options);
    this._value = typeof value === 'number' ? (): number => value : value;
  }

  protected _getAttributes(): Promise<Record<string, unknown> | undefined> {
    return Promise.resolve({ testAttribute: this._value() });
  }
}
