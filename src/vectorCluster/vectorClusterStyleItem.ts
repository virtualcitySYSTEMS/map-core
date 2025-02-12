import Style, { StyleFunction } from 'ol/style/Style.js';
import Icon from 'ol/style/Icon.js';
import Feature from 'ol/Feature.js';
import { check, is, oneOf } from '@vcsuite/check';
import { parseInteger, parseNumber } from '@vcsuite/parsers';
import deepEqual from 'fast-deep-equal';
import { originalFeatureSymbol } from '../layer/vectorSymbols.js';
import { highlighted } from '../layer/featureVisibility.js';
import VcsObject, { VcsObjectOptions } from '../vcsObject.js';
import VcsEvent from '../vcsEvent.js';
import type VectorLayer from '../layer/vectorLayer.js';
import { renderTemplate } from '../util/vcsTemplate.js';
import { vectorClusterGroupName } from './vectorClusterSymbols.js';
import { vcsLayerName } from '../layer/layerSymbols.js';

export type VectorClusterStyleItemOptions = VcsObjectOptions & {
  template?: string | VectorClusterTemplateFunction;
  templateContext?: Record<string, unknown>;
  breaks?: number[];
  zeroScaleOffset?: number;
  scaleFactor?: number;
};

export type VectorClusterTemplateFunction = (
  styleItem: VectorClusterStyleItem,
  features: Feature[],
  getLayerByName: (layerName: string) => VectorLayer | undefined,
) => { template: string; cacheKey: string; context?: Record<string, unknown> };

function createDefaultTemplateFunction(
  template: string,
): VectorClusterTemplateFunction {
  return (styleItem, features) => ({
    template,
    cacheKey: String(styleItem.findBreakIndex(features.length)),
  });
}

export default class VectorClusterStyleItem extends VcsObject {
  static get className(): string {
    return 'VectorClusterStyleItem';
  }

  static getDefaultOptions(): Required<VectorClusterStyleItemOptions> {
    return {
      type: 'VectorClusterStyleItem',
      name: '',
      properties: {},
      template: [
        '<svg width="64" height="64" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
        ' <defs><style>',
        '  .cls-1 {',
        '   fill: #ffffff;',
        '   stroke: #2a2a2a;',
        '   stroke-miterlimit: 10;',
        '   stroke-width: 4px;',
        ' }',
        ' .text {',
        '   font: normal normal 700 32px Calibri-Bold,Calibri;',
        '   fill: #2a2a2a;',
        '   text-anchor: middle;',
        '   alignment-baseline: middle;',
        '   dominant-baseline: middle;',
        ' }',
        ' </style></defs>',
        ' <circle id="outer" class="cls-1" cx="32" cy="32" r="30"/>',
        ' <text x="32" y="32" class="text">',
        '   {{ text }}',
        ' </text>',
        '</svg>',
      ].join(''),
      templateContext: {},
      breaks: [2, 3, 4, 5, 10, 15, 20, 25],
      zeroScaleOffset: 3,
      scaleFactor: 0.08,
    };
  }

  private _template: string | VectorClusterTemplateFunction = '';

  private _templateFunction: VectorClusterTemplateFunction =
    createDefaultTemplateFunction('');

  private _breaks: number[] = [];

  private _zeroScaleOffset: number;

  private _templateContext?: Record<string, unknown>;

  private _scaleFactor: number;

  private _styleCache = new Map<string, Style>();

  styleChanged = new VcsEvent<void>();

  constructor(options: VectorClusterStyleItemOptions) {
    super(options);
    const defaultOptions = VectorClusterStyleItem.getDefaultOptions();

    const configTemplate = Array.isArray(options.template)
      ? options.template.join('')
      : options.template;

    this.setTemplate(configTemplate ?? defaultOptions.template);
    this._breaks = options.breaks?.slice() ?? defaultOptions.breaks;
    this._zeroScaleOffset = parseInteger(
      options.zeroScaleOffset,
      defaultOptions.zeroScaleOffset,
    );

    this._scaleFactor = parseNumber(
      options.scaleFactor,
      defaultOptions.scaleFactor,
    );

    this._templateContext = options.templateContext
      ? structuredClone(options.templateContext)
      : undefined;

    this.styleChanged.addEventListener(() => {
      this.clearCache();
    });
  }

  /**
   * An array of cluster sizes to break at. Typically the first couple of sizes are
   * a series (meaning: not grouped). Later breaks are non sequential and used for grouping
   * clusters larger. [2, 3, 4, 5, 10] would start grouping at clusters larger or equal 5
   * entries.
   */
  get breaks(): number[] {
    return this._breaks.slice();
  }

  set breaks(breaks: number[]) {
    check(breaks, [Number]);

    const sortedBreaks = breaks.sort((a, b) => (a < b ? -1 : 1));
    const changed = sortedBreaks.find((b, i) => b !== this._breaks[i]);
    if (changed) {
      this._breaks = breaks;
      this.styleChanged.raiseEvent();
    }
  }

  /**
   * The index of breaks to st. for indexes [2, 3, 4, 5, 10] and a zeroScale offset of 3
   * would lead to icons 2, 3, 4 having the same size and no "+" attached. 5 and 10
   * would be scaled by the scale factor and a "+" added to the text
   */
  get zeroScaleOffset(): number {
    return this._zeroScaleOffset;
  }

  set zeroScaleOffset(zeroScaleOffset: number) {
    check(zeroScaleOffset, Number);

    if (zeroScaleOffset !== this._zeroScaleOffset) {
      this._zeroScaleOffset = zeroScaleOffset;
      this.styleChanged.raiseEvent();
    }
  }

  get templateContext(): Record<string, unknown> | undefined {
    return this._templateContext
      ? structuredClone(this._templateContext)
      : undefined;
  }

  set templateContext(context: Record<string, unknown> | undefined) {
    this._templateContext = context ? structuredClone(context) : undefined;
    this.styleChanged.raiseEvent();
  }

  /**
   * The factor by which to multiply the index of the used break grouping
   * (subtracted by the zeroScaleOffset)
   */
  get scaleFactor(): number {
    return this._scaleFactor;
  }

  set scaleFactor(scaleFactor: number) {
    check(scaleFactor, Number);

    if (scaleFactor !== this._scaleFactor) {
      this._scaleFactor = scaleFactor;
      this.styleChanged.raiseEvent();
    }
  }

  get template(): string | VectorClusterTemplateFunction {
    return this._template;
  }

  setTemplate(template: string | VectorClusterTemplateFunction): void {
    check(template, oneOf(String, Function));

    if (template !== this._template) {
      this._template = template;
      if (is(this._template, String)) {
        this._templateFunction = createDefaultTemplateFunction(this._template);
      } else {
        this._templateFunction = this._template;
      }
      this.styleChanged.raiseEvent();
    }
  }

  /**
   * Finds the breaks index of a specified cluster size.
   */
  findBreakIndex(size: number): number {
    const clusterTextIndex = this._breaks.findIndex((classBreak, i) =>
      i > this._zeroScaleOffset ? size < classBreak : size <= classBreak,
    );

    return clusterTextIndex === -1 ? this._breaks.length : clusterTextIndex;
  }

  /**
   * Gets the cluster text based on breaks and zeroScaleOffset. Adds a + to all sizes with an index larger then the zeroScaleOffset.
   */
  getClusterText(size: number): string {
    if (size === 1) {
      return '';
    }
    const clusterTextIndex = this.findBreakIndex(size);
    let clusterText =
      this._breaks[
        clusterTextIndex > this._zeroScaleOffset
          ? clusterTextIndex - 1
          : clusterTextIndex
      ].toString();
    if (clusterTextIndex > this._zeroScaleOffset) {
      clusterText = `${clusterText}+`;
    }

    return clusterText;
  }

  /**
   * Determines the scale based on break index and zeroScaleOffset. Cluster sizes with an index less then zeroScaleOffset
   * are not scaled.
   */
  determineScale(size: number): number {
    const index = this.findBreakIndex(size);

    let indexScale = index - this._zeroScaleOffset;
    indexScale = indexScale > 0 ? indexScale : 0;
    return 0.6 + this._scaleFactor * indexScale;
  }

  createStyleFunction(
    getLayerByName: (layerName: string) => VectorLayer | undefined,
  ): StyleFunction {
    const styleFunction = (
      feature: Feature,
      resolution: number,
    ): Style | undefined => {
      let features: Feature[] = [feature];
      if (feature[vectorClusterGroupName]) {
        features = (feature.get('features') as Feature[]) ?? [feature];
      }
      const size = features.length;
      if (size > 1) {
        const { template, cacheKey, context } = this._templateFunction(
          this,
          features,
          getLayerByName,
        );
        if (!this._styleCache.has(cacheKey)) {
          try {
            const src = `data:image/svg+xml,${encodeURIComponent(
              renderTemplate(template, {
                text: this.getClusterText(size),
                size,
                ...this._templateContext,
                ...context,
              }),
            )}`;
            const scale = this.determineScale(size);
            this._styleCache.set(
              cacheKey,
              new Style({
                image: new Icon({
                  src,
                  scale,
                  anchor: [0.5, 0.5], // XXX make configurable?
                  size: [64, 64], // XXX make configurable?
                }),
              }),
            );
          } catch (e) {
            this.getLogger().error('Error creating cluster style', e);
            this._styleCache.set(cacheKey, new Style({}));
          }
        }
        return this._styleCache.get(cacheKey)!;
      } else if (size === 1) {
        const singleFeature = features[0][originalFeatureSymbol] || features[0];
        if (singleFeature[vcsLayerName]) {
          const layer = getLayerByName(singleFeature[vcsLayerName]);

          let style =
            singleFeature[highlighted]?.style ?? singleFeature.getStyle();
          if (!style && layer) {
            ({ style } = layer.style);
          }
          if (style instanceof Style) {
            return style;
          }

          if (typeof style === 'function') {
            return style(singleFeature, resolution) as Style;
          }
        }
      }

      return undefined;
    };

    return styleFunction as StyleFunction;
  }

  /**
   * Clears the style cache to ensure new changes can take effect.
   * @api
   */
  clearCache(): void {
    this._styleCache.clear();
  }

  toJSON(): VectorClusterStyleItemOptions {
    const config: Partial<VectorClusterStyleItemOptions> = super.toJSON();
    const defaultOptions = VectorClusterStyleItem.getDefaultOptions();
    if (this.template !== defaultOptions.template) {
      config.template = this.template;
    }
    const { breaks } = this;
    if (
      breaks.length !== defaultOptions.breaks.length ||
      breaks.some((b) => !defaultOptions.breaks.includes(b))
    ) {
      config.breaks = breaks;
    }
    if (this.zeroScaleOffset !== defaultOptions.zeroScaleOffset) {
      config.zeroScaleOffset = this.zeroScaleOffset;
    }
    if (this.scaleFactor !== defaultOptions.scaleFactor) {
      config.scaleFactor = this.scaleFactor;
    }
    if (this._templateContext) {
      config.templateContext = structuredClone(this._templateContext);
    }

    return config;
  }

  equals(other: VectorClusterStyleItem): boolean {
    const thisJson = this.toJSON();
    delete thisJson.name;

    const otherJson = other.toJSON();
    delete otherJson.name;

    return deepEqual(thisJson, otherJson);
  }

  destroy(): void {
    this.clearCache();
    this.styleChanged.destroy();
    super.destroy();
  }
}

export function getDefaultClusterStyleItem(): VectorClusterStyleItem {
  return new VectorClusterStyleItem({});
}
