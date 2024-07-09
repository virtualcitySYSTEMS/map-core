/* eslint-disable */
import {
  Color,
  ConditionsExpression,
  Expression,
  Cesium3DTileStyle,
  TrustedServers,
} from '@vcmap-cesium/engine';
import { is } from '@vcsuite/check';

import Style, { type StyleFunction } from 'ol/style/Style.js';
import Stroke from 'ol/style/Stroke.js';
import Icon, { type Options as IconOptions } from 'ol/style/Icon.js';
import Circle, { type Options as CircleOptions } from 'ol/style/Circle.js';
import OLText from 'ol/style/Text.js';
import Fill from 'ol/style/Fill.js';
import type { Feature } from 'ol/index.js';

import StyleItem, { type StyleItemOptions } from './styleItem.js';
import {
  cesiumColorToColor,
  getDefaultCondition,
  whiteColor,
} from './styleHelpers.js';
import { originalFeatureSymbol } from '../layer/vectorSymbols.js';
import { styleClassRegistry } from '../classRegistry.js';
import { isSameOrigin } from '../util/urlHelpers.js';

type DeclarativeStyleItemConditions = {
  conditions: Array<string[] | string>;
};

type DeclarativeStyleOptions = {
  defines?: Record<string, unknown>;
  show?: DeclarativeStyleItemConditions | string | boolean;
  color?: DeclarativeStyleItemConditions | string;
  strokeColor?: DeclarativeStyleItemConditions | string;
  strokeWidth?: DeclarativeStyleItemConditions | string;
  scale?: DeclarativeStyleItemConditions | string;
  pointOutlineWidth?: DeclarativeStyleItemConditions | string;
  pointOutlineColor?: DeclarativeStyleItemConditions | string;
  pointSize?: DeclarativeStyleItemConditions | string;
  image?: DeclarativeStyleItemConditions | string;
  font?: DeclarativeStyleItemConditions | string;
  labelStyle?: DeclarativeStyleItemConditions | string;
  labelText?: DeclarativeStyleItemConditions | string;
  labelColor?: DeclarativeStyleItemConditions | string;
  labelOutlineWidth?: DeclarativeStyleItemConditions | string;
  labelOutlineColor?: DeclarativeStyleItemConditions | string;
  anchorLineEnabled?: DeclarativeStyleItemConditions | string;
  anchorLineColor?: DeclarativeStyleItemConditions | string;
  heightOffset?: DeclarativeStyleItemConditions | string;
  verticalOrigin?: DeclarativeStyleItemConditions | string;
  horizontalOrigin?: DeclarativeStyleItemConditions | string;
  labelHorizontalOrigin?: DeclarativeStyleItemConditions | string;
  labelVerticalOrigin?: DeclarativeStyleItemConditions | string;
};

export type DeclarativeStyleItemOptions = StyleItemOptions & {
  declarativeStyle?: DeclarativeStyleOptions;
};

const scratchColor = new Color();

const defaultText = new OLText({
  font: '30px sans-serif',
  fill: new Fill({ color: whiteColor }),
  textAlign: 'left',
  offsetY: -15,
});

/**
 * @param  style
 * @param  key
 * @param  options
 */
function addCustomProperty(
  style: Cesium3DTileStyle,
  key: keyof DeclarativeStyleOptions,
  options: DeclarativeStyleOptions,
): void {
  let expression: ConditionsExpression | Expression;
  if ((options[key] as DeclarativeStyleItemConditions)?.conditions) {
    expression = new ConditionsExpression(options[key], options.defines);
  } else {
    expression = new Expression(options[key] as string, options.defines);
  }
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  style[key] = expression;
}

/**
 * Style Object {@link https://github.com/AnalyticalGraphicsInc/3d-tiles/tree/master/Styling}
 * @group Style
 */
class DeclarativeStyleItem extends StyleItem {
  static get className(): 'DeclarativeStyleItem' {
    return 'DeclarativeStyleItem';
  }

  private _styleOptions: DeclarativeStyleOptions;

  private _circleCache: Map<string, Circle> = new Map();
  private _iconCache: Map<string, Icon> = new Map();

  /**
   * @param  options
   */
  constructor(options: DeclarativeStyleItemOptions) {
    super(options);

    const declarativeStyle = options.declarativeStyle || {};
    declarativeStyle.show =
      declarativeStyle.show != null ? declarativeStyle.show : true;

    this.cesiumStyle = new Cesium3DTileStyle(declarativeStyle);

    this._style = this._styleFunction.bind(this) as StyleFunction;

    if (declarativeStyle.strokeColor) {
      addCustomProperty(this.cesiumStyle, 'strokeColor', declarativeStyle);
    }
    if (declarativeStyle.strokeWidth) {
      addCustomProperty(this.cesiumStyle, 'strokeWidth', declarativeStyle);
    }
    // XXX is this even still needed?
    this._styleOptions = declarativeStyle;
    this._circleCache = new Map();
    this._iconCache = new Map();
  }

  get styleOptions(): DeclarativeStyleOptions {
    return JSON.parse(
      JSON.stringify(this._styleOptions),
    ) as DeclarativeStyleOptions;
  }

  toJSON(): DeclarativeStyleItemOptions {
    const config: DeclarativeStyleItemOptions = super.toJSON();

    config.declarativeStyle = Object.fromEntries(
      Object.entries(this.cesiumStyle.style as Record<string, unknown>)
        .filter(([, value]) => value != null)
        .map(([key, value]) => {
          if (is(value, Boolean)) {
            return [key, String(value)];
          }
          return [key, value];
        }),
    );

    return config;
  }

  clone(result?: DeclarativeStyleItem): DeclarativeStyleItem {
    if (result) {
      return result.assign(this);
    }
    const config = this.toJSON();
    delete config.name;
    return new DeclarativeStyleItem(config);
  }

  assign(styleItem: DeclarativeStyleItem): DeclarativeStyleItem {
    super.assign(styleItem);
    this._styleOptions = styleItem.cesiumStyle.style as DeclarativeStyleOptions;

    this.cesiumStyle = new Cesium3DTileStyle(this._styleOptions);
    return this;
  }

  private _styleFunction(feature: Feature): Style | undefined {
    const actualFeature = feature[originalFeatureSymbol] || feature;
    if (!this.cesiumStyle.show.evaluate(actualFeature)) {
      return undefined;
    }

    const geometryType = actualFeature.getGeometry()?.getType();

    if (geometryType === 'Point') {
      return this._stylePoint(actualFeature);
    }
    if (geometryType === 'Polygon') {
      return this._stylePolygon(actualFeature);
    }
    if (geometryType === 'LineString') {
      return this._styleLineString(actualFeature);
    }
    if (geometryType === 'Circle') {
      return this._stylePolygon(actualFeature);
    }
    if (geometryType === 'MultiPoint') {
      return this._stylePoint(actualFeature);
    }
    if (geometryType === 'MultiPolygon') {
      return this._stylePolygon(actualFeature);
    }
    if (geometryType === 'MultiLineString') {
      return this._styleLineString(actualFeature);
    }

    this.getLogger().warning(
      `could not style geometry type: ${String(geometryType)}`,
    );
    return undefined;
  }

  private _stylePolygon(feature: Feature): Style {
    const style = new Style({});
    const color = this.cesiumStyle.color
      ? this.cesiumStyle.color.evaluate<Color>(feature, scratchColor)
      : Color.WHITE;
    if (color) {
      style.setFill(
        new Fill({
          color: cesiumColorToColor(color),
        }),
      );
    }

    this._evaluateStroke(feature, style);
    return style;
  }

  private _styleLineString(feature: Feature): Style {
    const style = new Style({});
    const isExtruded = !!feature.get('olcs_extrudedHeight');
    const color = this.cesiumStyle.color
      ? this.cesiumStyle.color.evaluate<Color>(feature, scratchColor)
      : Color.WHITE;
    if (color) {
      if (isExtruded) {
        style.setFill(
          new Fill({
            color: cesiumColorToColor(color),
          }),
        );
      } else {
        const strokeWidth = this.cesiumStyle.strokeWidth
          ? this.cesiumStyle.strokeWidth.evaluate<number>(feature)
          : 1;
        style.setStroke(
          new Stroke({
            width: Number.isFinite(strokeWidth) ? strokeWidth : 1,
            color: cesiumColorToColor(color),
          }),
        );
      }
    }

    if (isExtruded) {
      this._evaluateStroke(feature, style);
    }

    return style;
  }

  private _stylePoint(feature: Feature): Style {
    const style = new Style({});

    if (this.cesiumStyle.labelText) {
      const text = this.cesiumStyle.labelText.evaluate(feature);
      if (text) {
        const textStyle = defaultText.clone();
        textStyle.setText(text.toString());
        if (this.cesiumStyle.font) {
          const font = this.cesiumStyle.font.evaluate(feature);
          if (font) {
            textStyle.setFont(font);
          }
        }
        if (this.cesiumStyle.labelColor) {
          const textColor = this.cesiumStyle.labelColor.evaluateColor(
            feature,
            scratchColor,
          );
          if (textColor) {
            textStyle.getFill().setColor(cesiumColorToColor(textColor));
          }
        }
        if (this.cesiumStyle.labelOutlineColor) {
          const outlineColor =
            this.cesiumStyle.labelOutlineColor.evaluate<Color>(
              feature,
              scratchColor,
            );
          if (outlineColor) {
            const outlineWidth = this.cesiumStyle.labelOutlineWidth
              ? this.cesiumStyle.labelOutlineWidth.evaluate<number>(feature)
              : 1;
            textStyle.setStroke(
              new Stroke({
                color: cesiumColorToColor(outlineColor),
                width: Number.isFinite(outlineWidth) ? outlineWidth : 1,
              }),
            );
          }
        }
        style.setText(textStyle);
      }
    }

    if (this.cesiumStyle.image) {
      const src = this.cesiumStyle.image.evaluate(feature);
      if (src) {
        const iconOptions: IconOptions = { src };
        if (TrustedServers.contains(src)) {
          iconOptions.crossOrigin = 'use-credentials';
        } else if (!isSameOrigin(src)) {
          iconOptions.crossOrigin = 'anonymous';
        }
        const iconCacheKey = `${src}${iconOptions.crossOrigin}`;
        if (!this._iconCache.has(iconCacheKey)) {
          this._iconCache.set(iconCacheKey, new Icon(iconOptions));
        }
        style.setImage(this._iconCache.get(iconCacheKey)!);
      }
    } else {
      const color =
        this.cesiumStyle.color?.evaluate<Color>(feature, scratchColor) ??
        Color.WHITE;

      let radius = 4;
      if (this.cesiumStyle.pointSize) {
        const size = this.cesiumStyle.pointSize.evaluate<number>(feature) ?? 8;
        radius = size / 2;
      }
      const width =
        this.cesiumStyle.pointOutlineWidth?.evaluate<number>(feature) ?? 0;

      let pointOutlineColor = Color.BLACK;
      if (width) {
        if (this.cesiumStyle.pointOutlineColor) {
          pointOutlineColor = this.cesiumStyle.pointOutlineColor.evaluateColor(
            feature,
            scratchColor,
          );
        }
        radius += width / 2;
      }

      const circleCacheKey = `${radius}${String(color)}${String(width)}${String(
        pointOutlineColor,
      )}`;
      if (!this._circleCache.has(circleCacheKey)) {
        const circleOptions: CircleOptions = {
          radius,
          fill: new Fill({
            color: cesiumColorToColor(color),
          }),
        };
        if (width) {
          circleOptions.stroke = new Stroke({
            color: cesiumColorToColor(pointOutlineColor),
            width,
          });
        }
        this._circleCache.set(circleCacheKey, new Circle(circleOptions));
      }
      style.setImage(this._circleCache.get(circleCacheKey) as Circle);
    }

    if (this.cesiumStyle.scale && style.getImage()) {
      const scale = this.cesiumStyle.scale.evaluate<number>(feature);
      if (scale && Number.isFinite(scale)) {
        style.getImage().setScale(scale);
      }
    }

    this._evaluateStroke(feature, style);
    return style;
  }

  private _evaluateStroke(feature: Feature, style: Style): void {
    if (this.cesiumStyle.strokeColor) {
      const strokeColor = this.cesiumStyle.strokeColor.evaluateColor(
        feature,
        scratchColor,
      );
      if (strokeColor) {
        const strokeWidth = this.cesiumStyle.strokeWidth
          ? this.cesiumStyle.strokeWidth.evaluate<number>(feature)
          : 1;
        style.setStroke(
          new Stroke({
            width: Number.isFinite(strokeWidth) ? strokeWidth : 1,
            color: cesiumColorToColor(strokeColor),
          }),
        );
      }
    }
  }

  get show(): DeclarativeStyleItemConditions | string | boolean | undefined {
    return this._styleOptions.show;
  }

  set show(
    show: DeclarativeStyleItemConditions | string | boolean | undefined,
  ) {
    this._styleOptions.show = show;
    // @ts-ignore setter != getter
    this.cesiumStyle.show = show;
    this._styleChanged();
  }

  get color(): DeclarativeStyleItemConditions | string | undefined {
    return this._styleOptions.color;
  }

  set color(color: DeclarativeStyleItemConditions | string | undefined) {
    this._styleOptions.color = color;
    // @ts-ignore setter != getter
    this.cesiumStyle.color = color;
    this._styleChanged();
  }

  get strokeColor(): DeclarativeStyleItemConditions | string | undefined {
    return this._styleOptions.strokeColor;
  }

  set strokeColor(color: DeclarativeStyleItemConditions | string | undefined) {
    this._styleOptions.strokeColor = color;
    // @ts-ignore setter != getter
    this.cesiumStyle.strokeColor = color;
    this._styleChanged();
  }

  get strokeWidth(): DeclarativeStyleItemConditions | string | undefined {
    return this._styleOptions.strokeWidth;
  }

  set strokeWidth(width: DeclarativeStyleItemConditions | string | undefined) {
    this._styleOptions.strokeWidth = width;
    // @ts-ignore setter != getter
    this.cesiumStyle.strokeWidth = width;
    this._styleChanged();
  }

  get image(): DeclarativeStyleItemConditions | string | undefined {
    return this._styleOptions.image;
  }

  set image(src: DeclarativeStyleItemConditions | string | undefined) {
    this._styleOptions.image = src;
    // @ts-ignore setter != getter
    this.cesiumStyle.image = src;
    this._styleChanged();
  }

  get labelText(): DeclarativeStyleItemConditions | string | undefined {
    return this._styleOptions.labelText;
  }

  set labelText(text: DeclarativeStyleItemConditions | string | undefined) {
    this._styleOptions.labelText = text;
    // @ts-ignore setter != getter
    this.cesiumStyle.labelText = text;
    this._styleChanged();
  }

  get labelColor(): DeclarativeStyleItemConditions | string | undefined {
    return this._styleOptions.labelColor;
  }

  set labelColor(color: DeclarativeStyleItemConditions | string | undefined) {
    this._styleOptions.labelColor = color;
    // @ts-ignore setter != getter
    this.cesiumStyle.labelColor = color;
    this._styleChanged();
  }

  get font(): DeclarativeStyleItemConditions | string | undefined {
    return this._styleOptions.font;
  }

  set font(font: DeclarativeStyleItemConditions | string | undefined) {
    this._styleOptions.font = font;
    // @ts-ignore setter != getter
    this.cesiumStyle.font = font;
    this._styleChanged();
  }

  get pointSize(): DeclarativeStyleItemConditions | string | undefined {
    return this._styleOptions.pointSize;
  }

  set pointSize(
    pointSize: DeclarativeStyleItemConditions | string | undefined,
  ) {
    this._styleOptions.pointSize = pointSize;
    // @ts-ignore setter != getter
    this.cesiumStyle.pointSize = pointSize;
    this._styleChanged();
  }

  destroy(): void {
    this._circleCache.clear();
    super.destroy();
  }
}

export default DeclarativeStyleItem;
styleClassRegistry.registerClass(
  DeclarativeStyleItem.className,
  DeclarativeStyleItem,
);

export const defaultDeclarativeStyle = new DeclarativeStyleItem({
  declarativeStyle: {
    show: true,
    color: {
      conditions: getDefaultCondition('olcs_color', true),
    },
    scale: {
      conditions: getDefaultCondition('olcs_scale'),
    },
    pointOutlineWidth: {
      conditions: getDefaultCondition('olcs_outlineWidth'),
    },
    pointOutlineColor: {
      conditions: getDefaultCondition('olcs_outlineColor', true),
    },
    pointSize: {
      conditions: getDefaultCondition('olcs_pointSize'),
    },
    image: {
      conditions: getDefaultCondition('olcs_image'),
    },
    font: {
      conditions: getDefaultCondition('olcs_font'),
    },
    labelStyle: '2',
    labelText: {
      conditions: getDefaultCondition('olcs_labelText'),
    },
    labelColor: {
      conditions: getDefaultCondition('olcs_fontColor', true),
    },
    labelOutlineWidth: {
      conditions: getDefaultCondition('olcs_fontOutlineWidth'),
    },
    labelOutlineColor: {
      conditions: getDefaultCondition('olcs_fontOutlineColor', true),
    },
    /*
    anchorLineEnabled: {
      conditions: [
        [
          defaultExtrudedHeightCondition,
          'true',
        ],
        ['true', 'false'],
      ],
    },
    anchorLineColor: {
      conditions: getDefaultCondition('olcs_anchorLineColor', true),
    },
    heightOffset: {
      conditions: [
        [
          defaultExtrudedHeightCondition,
          // eslint-disable-next-line no-template-curly-in-string
          '${attributes.olcs_extrudedHeight}',
        ],
        ['true', '0'],
      ],
    },
    */
    verticalOrigin: '1',
    horizontalOrigin: '0',
    labelHorizontalOrigin: '0',
    labelVerticalOrigin: '1',
  },
});
