/* eslint-disable no-template-curly-in-string,@typescript-eslint/ban-ts-comment */
import Stroke, { Options as StrokeOptions } from 'ol/style/Stroke.js';
import { Color, VerticalOrigin } from '@vcmap-cesium/engine';
import Icon, { type Options as IconOptions } from 'ol/style/Icon.js';
import Style, { type StyleFunction } from 'ol/style/Style.js';
import OLText from 'ol/style/Text.js';
import OLImage from 'ol/style/Image.js';
import type { Size } from 'ol/size.js';
import Fill, { type Options as FillOptions } from 'ol/style/Fill.js';
import Circle from 'ol/style/Circle.js';
import RegularShape from 'ol/style/RegularShape.js';
import { Color as OLColor } from 'ol/color.js';
import { ColorLike as OLColorLike } from 'ol/colorlike.js';
import type { Feature } from 'ol/index.js';

import { check, checkMaybe } from '@vcsuite/check';
import StyleItem, { StyleItemOptions } from './styleItem.js';
import {
  parseColor,
  PatternType,
  createPattern,
  getFillOptions,
  getStrokeOptions,
  getTextOptions,
  getTextFromOptions,
  getStringColor,
  getDefaultCondition,
  getDefaultVectorStyleItemOptions,
  type FontObject,
  olColorToCesiumColor,
} from './styleHelpers.js';
import { getShapeFromOptions } from './shapesCategory.js';
import { styleClassRegistry } from '../classRegistry.js';

export type ColorType = OLColor | OLColorLike;
export type VectorStyleItemPattern = {
  type: PatternType;
  color: ColorType;
  width: number;
  size: number;
};

export type VectorStyleItemFill = {
  color: ColorType;
  pattern?: VectorStyleItemPattern;
};

export type VectorStyleItemImage = {
  src?: string;
  scale?: number | Size;
  opacity?: number;
  color?: ColorType;
  fill?: FillOptions | Fill;
  stroke?: StrokeOptions | Stroke;
  radius?: number;
  points?: number;
  angle?: number;
  anchor?: number[];
  circle?: VectorStyleItemImage;
  icon?: VectorStyleItemImage;
  currentImage?: string;
};

export type VectorStyleItemText = {
  text?: string;
  font?: string | FontObject;
  fill?: FillOptions | Fill;
  stroke?: StrokeOptions | Stroke;
  textBaseline?: string;
  offsetX?: number;
  offsetY?: number;
};

export type VectorStyleItemExclusion = {
  fill: boolean;
  stroke: boolean;
  image: boolean;
};

export enum OlcsGeometryType {
  POLYGON = 1,
  POLYLINE = 2,
  POINT = 3,
}

export type VectorStyleItemOptions = StyleItemOptions & {
  fill?: VectorStyleItemFill | false;
  stroke?: StrokeOptions | false;
  image?: VectorStyleItemImage | false;
  text?: VectorStyleItemText;
  label?: string;
};

/**
 * Is set on a feature and is used to signal that the feature has a specific vectorStyleItem.
 * Is set by the Editor if the layerStyle is overwritten. The VectorLayer layer assures this style is set, if
 * the style on the layer is not a DeclarativeStyle
 */
export const vectorStyleSymbol: unique symbol = Symbol('VcsVectorStyleItem');

/**
 * @group Style
 */
class VectorStyleItem extends StyleItem {
  static get className(): string {
    return 'VectorStyleItem';
  }

  exclude: VectorStyleItemExclusion;

  private _fillOptions: VectorStyleItemFill | null;

  private _fill: Fill | undefined;

  private _stroke: Stroke | undefined;

  private _text: OLText | undefined;

  private _label: string | undefined;

  private _cesiumColor: Color;

  private _image: OLImage | undefined;

  constructor(options: VectorStyleItemOptions) {
    super(options);

    this.validateOptions(options);
    this.exclude = {
      fill: options.fill === false,
      stroke: options.stroke === false,
      image: options.image === false,
    };
    this._fillOptions = null;
    this._fill = undefined;
    this._stroke = options.stroke ? new Stroke(options.stroke) : undefined;
    this._text = undefined;
    if (options.text) {
      this._text = getTextFromOptions(options.text);
    }
    this._label = options.label;
    this.label = this._label;

    this._cesiumColor = new Color();
    this._image = undefined;
    if (options.image) {
      this._image = options.image.radius
        ? getShapeFromOptions({ ...options.image })
        : new Icon(options.image as IconOptions);
    }

    this._style = new Style({
      image: this._image,
      stroke: this._stroke,
      text: this._text,
    });

    if (options.fill) {
      this._fillOptions = options.fill;
      this._setFill();
    } else {
      this.updateCesiumStyle();
    }
  }

  validateOptions(options: VectorStyleItemOptions): void {
    const checkColor = (option: { color?: ColorType | null }): void => {
      try {
        option.color = parseColor(option.color as ColorType);
        check(option.color, [Number]);
        check(option.color.length, [3, 4]);
      } catch (e) {
        this.getLogger().error((e as Error).message);
        option.color = [255, 255, 255, 0.4];
      }
    };

    const checkStroke = (option: {
      color?: ColorType | null;
      width?: number;
    }): void => {
      checkColor(option);
      if (!option.width) {
        this.getLogger().error('missing width for stroke, setting to 1.5');
        option.width = 1.5;
      }
    };

    if (options.fill) {
      checkColor(options.fill);
      if (options.fill.pattern) {
        checkStroke(options.fill.pattern);
        if (
          !(
            options.fill.pattern.type &&
            Object.values(PatternType).includes(options.fill.pattern.type)
          )
        ) {
          this.getLogger().error(
            `Cannot find pattern ${options.fill.pattern.type}`,
          );
          options.fill.pattern.type = PatternType.NWSE;
        }
      }
    }

    if (options.stroke) {
      checkStroke(options.stroke);
    }

    if (options.image) {
      // XXX Legacy...
      if (options.image.icon) {
        options.image = options.image.icon;
      } else if (options.image.circle) {
        options.image = options.image.circle;
      }

      if (!(options.image.src || options.image.radius)) {
        this.getLogger().error(
          'missing source or label in style, setting default circle',
        );
        options.image = {
          fill: {
            color: 'rgba(255,255,255,0.4)',
          },
          stroke: {
            color: '#3399CC',
            width: 1,
          },
          radius: 5,
        };
      }

      if (options.image.radius) {
        options.image.radius = Number(options.image.radius);
        if (!Number.isFinite(options.image.radius)) {
          this.getLogger().error('radius must be a number');
          options.image.radius = 5;
        }
        if ((options.image.fill as FillOptions)?.color) {
          checkColor(options.image.fill as FillOptions);
        }
        if ((options.image.stroke as StrokeOptions)?.color) {
          checkStroke(options.image.stroke as StrokeOptions);
        }
      }
    }
    // TODO text validation
  }

  /**
   * the current fill color, not the pattern
   */
  get fillColor(): OLColor | undefined {
    return this._fillOptions ? (this._fillOptions.color as OLColor) : undefined;
  }

  set fillColor(color: ColorType | undefined) {
    this.exclude.fill = false;
    if (this._style instanceof Style) {
      if (!color) {
        this._fillOptions = null;
        this._fill = undefined;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore // bug in ol def. you can set fill undefined
        this._style.setFill(this._fill);
        this.updateCesiumStyleColor(true);
      } else {
        if (!this._fillOptions) {
          this._fillOptions = { color: parseColor(color) };
        } else {
          this._fillOptions.color = parseColor(color);
        }
        this._setFill();
      }
    } else {
      this.getLogger().info('trying to set fill on a style function');
    }
  }

  /**
   * the current fill color as a cesium color
   */
  get cesiumFillColor(): Color | null {
    const fillColor = this.fillColor ? this.fillColor.slice() : null;
    if (fillColor) {
      return olColorToCesiumColor(fillColor, this._cesiumColor);
    }
    return Color.RED.clone(this._cesiumColor); // TODO should not be red - transparent?
  }

  get pattern(): VectorStyleItemPattern | undefined {
    return this._fillOptions && this._fillOptions.pattern
      ? this._fillOptions.pattern
      : undefined;
  }

  set pattern(patternOptions: VectorStyleItemPattern | undefined) {
    if (!this._fillOptions) {
      this.getLogger().error('Missing fill color');
      return;
    }
    if (patternOptions) {
      checkMaybe(
        patternOptions,
        {
          color: [String, [Number]],
          width: Number,
          type: Number,
          size: [Number, undefined, null],
        },
        true,
      );
      this._fillOptions.pattern = patternOptions;
    } else {
      this._fillOptions.pattern = undefined;
    }
    this._setFill();
  }

  get stroke(): Stroke | undefined {
    return this._stroke;
  }

  set stroke(stroke: Stroke | undefined) {
    this.exclude.stroke = false;
    if (this._style instanceof Style) {
      checkMaybe(stroke, Stroke);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore // bug in ol
      this._style.setStroke(stroke);
      this._stroke = stroke;
      this.updateCesiumStyleColor(true);
    } else {
      this.getLogger().info('trying to set stroke on a style function');
    }
  }

  get label(): string | undefined {
    return this._label;
  }

  set label(label: string | undefined) {
    checkMaybe(label, String);
    if (!label) {
      this._label = undefined;
    } else {
      this._label = label;
    }
    if (this._text) {
      this._text.setText(label);
    }
  }

  get text(): OLText | undefined {
    return this._text;
  }

  set text(text: OLText | undefined) {
    if (this._style instanceof Style) {
      checkMaybe(text, OLText);
      this._text = text;
      this._text?.setText?.(this._label);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore // bug in ol
      this._style.setText(this._text);
    } else {
      this.getLogger().info('trying to set text on a style function');
    }
  }

  get image(): OLImage | undefined {
    return this._image;
  }

  set image(image: OLImage | undefined) {
    this.exclude.image = false;
    if (this._style instanceof Style) {
      checkMaybe(image, OLImage);
      this._image = image;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore // bug in ol
      this._style.setImage(this._image);
      this.updateCesiumStyle();
    } else {
      this.getLogger().info('trying to set text on a style function');
    }
  }

  get style(): Style | StyleFunction {
    return this._style;
  }

  set style(style: Style | StyleFunction) {
    checkMaybe(style, [Style, Function]);
    if (style instanceof Style) {
      this._stroke = style.getStroke();
      this._fill = style.getFill();
      this._text = style.getText();
      this._image = style.getImage();
    } else {
      this._stroke = undefined;
      this._fill = undefined;
      this._text = undefined;
      this._image = undefined;
    }
    this._style = style;
    if (this._fill && this._fill.getColor()) {
      this._fillOptions = {
        color: parseColor(this._fill.getColor() as OLColor),
      };
    }
    if (this._text) {
      this._text.setText(this._label);
    }
    this.updateCesiumStyle();
  }

  private _setFill(): void {
    if (this._style instanceof Style) {
      const color = this._fillOptions?.pattern
        ? createPattern(this._fillOptions as Required<VectorStyleItemFill>)
        : this._fillOptions?.color;

      if (!color) {
        return;
      }

      if (this._fill) {
        this._fill.setColor(color);
      } else {
        this._fill = new Fill({ color });
        this._style.setFill(this._fill);
      }

      if (this._fillOptions?.pattern) {
        this._fill.fallBackColor = this._fillOptions.color;
      }
      this.updateCesiumStyle();
    }
  }

  updateCesiumStyle(): void {
    this.updateCesiumStyleColor(true);
    this.updateCesiumStyleImage(true);
    this.updateCesiumStyleText(true);
    this._styleChanged();
  }

  updateCesiumStyleColor(silent: boolean): void {
    const colorConditions = getDefaultCondition('olcs_color', true);
    if (this.stroke && this.stroke.getColor()) {
      colorConditions.splice(1, 0, [
        `\${olcs_geometryType}===${OlcsGeometryType.POLYLINE}`,
        getStringColor(this.stroke.getColor()),
      ]);
    }
    if (this._image instanceof Circle && this._image.getFill()) {
      colorConditions.splice(1, 0, [
        `\${olcs_geometryType}===${OlcsGeometryType.POINT}`,
        getStringColor(this._image.getFill().getColor() as OLColor),
      ]);
    }
    if (this.fillColor) {
      colorConditions.splice(-1, 1, ['true', getStringColor(this.fillColor)]);
    }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.cesiumStyle.color = { conditions: colorConditions };

    if (!silent) {
      this._styleChanged();
    }
  }

  updateCesiumStyleImage(silent: boolean): void {
    /* this.cesiumStyle.show = {
      conditions: [
        ['${olcs_color}===false', false],
        ['true', 'true'],
      ],
    } */
    const scaleConditions = getDefaultCondition('olcs_scale');
    const pointOutlineWidthConditions =
      getDefaultCondition('olcs_outlineWidth');
    const pointOutlineColorConditions = getDefaultCondition(
      'olcs_outlineColor',
      true,
    );
    const pointSizeConditions = getDefaultCondition('olcs_pointSize');
    const imageConditions = getDefaultCondition('olcs_image');
    /* commented out, because we simulate the anchorline via a line in the tileset, TODO Evaluate again
    const heightOffsetCondition = [
      [defaultExtrudedHeightCondition, '${attributes.olcs_extrudedHeight}'],
      ['true', '0'],
    ];
    const anchorLineEnabledConditions = [
      [defaultExtrudedHeightCondition, 'true'],
      ['true', 'false'],
    ];
    const anchorLineColorConditions = getDefaultCondition('olcs_anchorLineColor', true);
    */
    if (this._image) {
      if (this._image.getScale() != null) {
        scaleConditions.splice(1, 1, [
          'true',
          `${String(this._image.getScale())}`,
        ]);
      }
      if (this._image instanceof Circle) {
        const stroke = this._image.getStroke();
        let size = this._image.getRadius() * 2;
        if (stroke) {
          if (this._image.getStroke().getColor()) {
            pointOutlineColorConditions.splice(1, 1, [
              'true',
              getStringColor(this._image.getStroke().getColor()),
            ]);
          }
          const width = this._image.getStroke().getWidth() as number;
          pointOutlineWidthConditions.splice(1, 1, ['true', `${width}`]);
          size -= width;
        }
        pointSizeConditions.splice(1, 1, ['true', `${size}`]);
      } else if (this._image instanceof RegularShape) {
        const dataUrl = this._image.getImage(1).toDataURL();
        imageConditions.splice(1, 1, ['true', `"${dataUrl}"`]);
      } else if (this._image instanceof Icon) {
        imageConditions.splice(1, 1, [
          'true',
          `"${String(this._image.getSrc())}"`,
        ]);
      }
    }
    /*
    if (this._stroke && this._stroke.getColor()) {
      anchorLineColorConditions.splice(1, 1, ['true', getStringColor(this._stroke.getColor())]);
    }
    */
    // @ts-ignore
    this.cesiumStyle.scale = { conditions: scaleConditions };
    this.cesiumStyle.pointOutlineWidth = {
      // @ts-ignore
      conditions: pointOutlineWidthConditions,
    };
    this.cesiumStyle.pointOutlineColor = {
      // @ts-ignore
      conditions: pointOutlineColorConditions,
    };
    // @ts-ignore
    this.cesiumStyle.pointSize = { conditions: pointSizeConditions };
    // @ts-ignore
    this.cesiumStyle.image = { conditions: imageConditions };
    /*
    // @ts-ignore
    this.cesiumStyle.heightOffset = { conditions: heightOffsetCondition };
    // @ts-ignore
    this.cesiumStyle.anchorLineEnabled = { conditions: anchorLineEnabledConditions };
    // @ts-ignore
    this.cesiumStyle.anchorLineColor = { conditions: anchorLineColorConditions };
    */
    // @ts-ignore
    this.cesiumStyle.verticalOrigin = '1';
    // @ts-ignore
    this.cesiumStyle.horizontalOrigin = '0';
    if (!silent) {
      this._styleChanged();
    }
  }

  updateCesiumStyleText(silent: boolean): void {
    const fontConditions = getDefaultCondition('olcs_font');
    const labelTextConditions = getDefaultCondition('olcs_labelText');
    const labelColorConditions = getDefaultCondition('olcs_fontColor', true);
    const labelOutlineWidthConditions = getDefaultCondition(
      'olcs_fontOutlineWidth',
    );
    const labelOutlineColorConditions = getDefaultCondition(
      'olcs_fontOutlineColor',
      true,
    );

    if (this._text) {
      if (this._text.getFont()) {
        fontConditions.splice(1, 1, [
          'true',
          `'${String(this._text.getFont())}'`,
        ]);
      }
      if (this._text.getText()) {
        labelTextConditions.splice(1, 1, [
          'true',
          `'${String(this._text.getText())}'`,
        ]);
      }
      if (this._text.getFill() && this._text.getFill().getColor()) {
        labelColorConditions.splice(1, 1, [
          'true',
          getStringColor(this._text.getFill().getColor() as OLColor),
        ]);
      }

      if (this._text.getStroke() && this._text.getStroke().getColor()) {
        labelOutlineColorConditions.splice(1, 1, [
          'true',
          getStringColor(this._text.getStroke().getColor()),
        ]);
        labelOutlineWidthConditions.splice(1, 1, [
          'true',
          `${this._text.getStroke().getWidth() || 1.25}`,
        ]);
      }
    }

    // @ts-ignore
    this.cesiumStyle.font = { conditions: fontConditions };
    // @ts-ignore
    this.cesiumStyle.labelText = { conditions: labelTextConditions };
    // @ts-ignore
    this.cesiumStyle.labelColor = { conditions: labelColorConditions };

    this.cesiumStyle.labelOutlineWidth = {
      // @ts-ignore
      conditions: labelOutlineWidthConditions,
    };
    this.cesiumStyle.labelOutlineColor = {
      // @ts-ignore
      conditions: labelOutlineColorConditions,
    };
    // @ts-ignore
    this.cesiumStyle.labelStyle =
      'Boolean(${olcs_fontOutlineWidth}) === true ? 2 : 0';
    // @ts-ignore
    this.cesiumStyle.labelHorizontalOrigin = '0';

    let verticalOrigin = VerticalOrigin.CENTER;
    if (this._text) {
      switch (this._text.getTextBaseline()) {
        case 'top':
          verticalOrigin = VerticalOrigin.TOP;
          break;
        case 'middle':
          verticalOrigin = VerticalOrigin.CENTER;
          break;
        case 'bottom':
          verticalOrigin = VerticalOrigin.BOTTOM;
          break;
        case 'alphabetic':
          verticalOrigin = VerticalOrigin.TOP;
          break;
        case 'hanging':
          verticalOrigin = VerticalOrigin.BOTTOM;
          break;
        default:
          break;
      }
    }
    // @ts-ignore
    this.cesiumStyle.labelVerticalOrigin = verticalOrigin;

    if (!silent) {
      this._styleChanged();
    }
  }

  clone(result?: VectorStyleItem): VectorStyleItem {
    if (result) {
      result.style =
        this._style instanceof Style ? this._style.clone() : this._style;
      if (this._fillOptions && this._fillOptions.color) {
        result.fillColor = (this._fillOptions.color as OLColor).slice();
        if (this._fillOptions.pattern) {
          result.pattern = { ...this._fillOptions.pattern };
        }
      }

      Object.keys(this.exclude).forEach((section) => {
        if (this.exclude[section as keyof VectorStyleItemExclusion]) {
          result.unset(section as keyof VectorStyleItemExclusion);
        }
      });
      return result;
    }
    const config = this.toJSON();
    delete config.name;
    return new VectorStyleItem(config);
  }

  assign(result: VectorStyleItem): VectorStyleItem {
    super.assign(result);
    if (result.fillColor) {
      this.fillColor = result.fillColor.slice();
    }

    if (result.pattern) {
      this.pattern = { ...result.pattern };
    } else {
      this.pattern = undefined;
    }

    if (result.stroke) {
      this.stroke = result.stroke.clone();
    }

    if (result.image) {
      this.image = result.image.clone();
    }

    if (result.text) {
      this.text = result.text.clone();
    }

    if (result.label) {
      this.label = result.label;
    }

    Object.keys(result.exclude).forEach((section) => {
      if (result.exclude[section as keyof VectorStyleItemExclusion]) {
        this.unset(section as keyof VectorStyleItemExclusion);
      }
    });

    return this;
  }

  toJSON(): VectorStyleItemOptions {
    // TODO clean default, only copy relevant keys
    const options: VectorStyleItemOptions = super.toJSON();
    if (this._fillOptions) {
      options.fill = {
        color: parseColor(this._fillOptions.color).slice(),
      };
      if (this._fillOptions.pattern) {
        options.fill.pattern = { ...this._fillOptions.pattern };
      }
    } else if (this.exclude.fill) {
      options.fill = false;
    }

    if (this._stroke) {
      options.stroke = getStrokeOptions(this._stroke);
    } else if (this.exclude.stroke) {
      options.stroke = false;
    }

    if (this._text) {
      options.text = getTextOptions(this._text);
    }

    if (this._label) {
      options.label = this._label;
    }

    if (this._image instanceof Icon) {
      options.image = {
        src: this._image.getSrc(), // XXX this is an issue... we dont want a data URI in the geoJSON
        scale: this._image.getScale(),
        opacity: this._image.getOpacity(),
      };
    } else if (this._image instanceof Circle) {
      options.image = {
        scale: this._image.getScale(),
        fill: getFillOptions(this._image),
        radius: this._image.getRadius(),
        stroke: this._image.getStroke()
          ? getStrokeOptions(this._image.getStroke())
          : undefined,
      };
    } else if (this._image instanceof RegularShape) {
      options.image = {
        scale: this._image.getScale(),
        fill: getFillOptions(this._image),
        points: this._image.getPoints(),
        angle: this._image.getAngle(),
        radius: this._image.getRadius(),
        stroke: this._image.getStroke()
          ? getStrokeOptions(this._image.getStroke())
          : undefined,
      };
    } else if (this.exclude.image) {
      options.image = false;
    }

    return options;
  }

  getOptionsForFeature(feature: Feature): VectorStyleItemOptions {
    const type = feature.getGeometry()?.getType();
    const extrusion = (!!feature.get('olcs_extrudedHeight') ||
      (feature.get('olcs_storeyHeight') &&
        feature.get('olcs_storeyNumber'))) as boolean;
    const sections: Set<keyof VectorStyleItemOptions> = new Set();

    if (type === 'Point' || type === 'MultiPoint') {
      if (feature[vectorStyleSymbol]?.label != null) {
        sections.add('text');
        sections.add('label');
      }
      sections.add('image');

      if (extrusion) {
        sections.add('stroke');
      }
    } else if (type === 'LineString' || type === 'MultiLineString') {
      sections.add('stroke');
      if (extrusion) {
        sections.add('fill');
      }
    } else if (
      type === 'Polygon' ||
      type === 'MultiPolygon' ||
      type === 'Circle'
    ) {
      sections.add('stroke');
      sections.add('fill');
    } else if (type === 'GeometryCollection') {
      sections.add('stroke');
      sections.add('fill');
      sections.add('image');
      sections.add('text');
    }
    const config = this.toJSON();
    const options: VectorStyleItemOptions = {};
    sections.forEach((key) => {
      // @ts-ignore
      options[key] = config[key];
    });
    return options;
  }

  /**
   * Exclude a section from this style. Excluded section are not returned and cannot be assigned via .assign.
   * Setting the section over a property will remove it from the excluded sections.
   * @param  section - one of fill, stroke, image
   */
  unset(section: keyof VectorStyleItemExclusion): void {
    check(section, Object.keys(this.exclude));
    if (section === 'fill') {
      this.fillColor = undefined;
    } else {
      this[section] = undefined;
    }
    this.exclude[section] = true;
  }

  destroy(): void {
    this._image = undefined;
    this._stroke = undefined;
    this._fill = undefined;
    this._label = undefined;
    this._text = undefined;
    this._style = (): void => {};
    super.destroy();
  }
}

export default VectorStyleItem;

export const defaultVectorStyle = new VectorStyleItem(
  getDefaultVectorStyleItemOptions(),
);
styleClassRegistry.registerClass(VectorStyleItem.className, VectorStyleItem);

export function fromCesiumColor(cesiumColor: Color): VectorStyleItem {
  const color = cesiumColor.toBytes();
  color[3] /= 255;
  return new VectorStyleItem({
    fill: { color },
    stroke: {
      color,
      width: defaultVectorStyle.stroke?.getWidth() as number,
    },
  });
}
