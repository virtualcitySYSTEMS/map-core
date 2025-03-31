import { DEVICE_PIXEL_RATIO } from 'ol/has.js';
import Fill, { type Options as FillOptions } from 'ol/style/Fill.js';
import Stroke, { type Options as StrokeOptions } from 'ol/style/Stroke.js';
import OLText, { type Options as TextOptions } from 'ol/style/Text.js';
import Style from 'ol/style/Style.js';
import { Color, TrustedServers } from '@vcmap-cesium/engine';
import type { Color as OLColor } from 'ol/color.js';
import type { Size } from 'ol/size.js';
import type ImageStyle from 'ol/style/Image.js';
import Circle from 'ol/style/Circle.js';
import Icon, { type Options as IconOptions } from 'ol/style/Icon.js';
import RegularShape from 'ol/style/RegularShape.js';
import { getLogger as getLoggerByName, type Logger } from '@vcsuite/logger';
import type {
  ColorType,
  VectorStyleItemFill,
  VectorStyleItemOptions,
  VectorStyleItemText,
} from './vectorStyleItem.js';
import { isSameOrigin } from '../util/urlHelpers.js';

function getLogger(): Logger {
  return getLoggerByName('StyleHelpers');
}

export type FontObject = {
  fontStyle: string;
  fontSize: string;
  fontFamily: string;
  fontWeight: string;
  fontVariant: string;
  lineHeight: string;
};

export enum PatternType {
  NWSE = 1,
  SWNE = 2,
  DIAGONALCROSS = 3,
  NS = 4,
  WE = 5,
  CROSS = 6,
}

/**
 * Converts HEX colors to RGB
 * @param  h
 * @param  opacity
 */
export function hexToOlColor(h: string, opacity?: number): OLColor {
  let hex = h.substring(1);
  if (hex.length === 3) {
    hex = hex.replace(/([\w\d])/g, '$1$1');
  }

  return [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16),
    opacity != null ? opacity : 1.0,
  ];
}

export function cesiumColorToColor(cesiumColor: Color): OLColor {
  const color = cesiumColor.toBytes();
  color[3] /= 255;
  return color;
}

/**
 * converts an openlayers color to a cesium Color
 * @param  olColor
 * @param result
 */
export function olColorToCesiumColor(olColor: OLColor, result?: Color): Color {
  return Color.fromBytes(
    olColor[0],
    olColor[1],
    olColor[2],
    (olColor[3] || 1) * 255,
    result,
  );
}

/**
 * parses a color to an openlayers color
 * @param  color
 * @param  defaultColor
 */
export function parseColor(
  color?: ColorType | number[] | null,
  defaultColor?: OLColor,
): OLColor {
  if (Array.isArray(color)) {
    if (color.length === 3) {
      color.push(1.0);
    }
    return color;
  }

  if (typeof color === 'string') {
    if (/^#/.test(color)) {
      return hexToOlColor(color);
    }
    if (/^rgba?\((\d+(,\s?)?){3}((0|1)(\.\d+)?)?\)/.test(color)) {
      const output = color
        .replace(/^rgba?\(([\s\S]+?)\)/, '$1')
        .replace(/\s/, '')
        .split(',')
        .map((n) => Number(n));

      if (output.length === 3) {
        output.push(1.0);
      }
      return output;
    }
  }

  if (color instanceof CanvasPattern) {
    return [255, 255, 255, 0.4];
  }
  if (defaultColor) {
    return defaultColor;
  }
  throw new Error(`Cannot parse color ${String(color as unknown)}`);
}

export function getCesiumColor(
  color: ColorType | undefined | null,
  defaultColor: OLColor,
): Color {
  const olColor = parseColor(color, defaultColor);
  return Color.fromBytes(olColor[0], olColor[1], olColor[2], olColor[3] * 255);
}

export function getStringColor(color: ColorType): string {
  return `rgba(${parseColor(color).join(',')})`;
}

/**
 * @param  options
 * @param  optCanvas
 */
export function createPattern(
  options: Required<VectorStyleItemFill>,
  optCanvas?: HTMLCanvasElement,
): CanvasPattern | null {
  const pixelRatio = DEVICE_PIXEL_RATIO;

  const canvas = optCanvas || document.createElement('canvas');
  if (!optCanvas || !canvas.width) {
    canvas.width = (options.pattern.size || 10) * pixelRatio;
    canvas.height = (options.pattern.size || 10) * pixelRatio;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }
  const size = canvas.width;

  ctx.fillStyle = getStringColor(options.color);
  ctx.fillRect(0, 0, size, size);

  function drawLineOnCanvas(
    start: [number, number],
    end: [number, number],
  ): void {
    ctx!.strokeStyle = getStringColor(options.pattern.color);
    ctx!.lineWidth = options.pattern.width;
    ctx!.lineCap = 'square';
    ctx!.beginPath();
    ctx!.moveTo(start[0], start[1]);
    ctx!.lineTo(end[0], end[1]);
    ctx!.stroke();
  }

  switch (options.pattern.type) {
    case PatternType.NWSE:
      drawLineOnCanvas([size / 2, size], [size, size / 2]);
      drawLineOnCanvas([0, size / 2], [size / 2, 0]);
      break;
    case PatternType.SWNE:
      drawLineOnCanvas([size / 2, size], [0, size / 2]);
      drawLineOnCanvas([size, size / 2], [size / 2, 0]);
      break;
    case PatternType.DIAGONALCROSS:
      drawLineOnCanvas([size / 2, size], [size, size / 2]);
      drawLineOnCanvas([0, size / 2], [size / 2, 0]);
      drawLineOnCanvas([size / 2, size], [0, size / 2]);
      drawLineOnCanvas([size, size / 2], [size / 2, 0]);
      break;
    case PatternType.NS:
      drawLineOnCanvas([size / 2, 0], [size / 2, size]);
      break;
    case PatternType.WE:
      drawLineOnCanvas([0, size / 2], [size, size / 2]);
      break;
    case PatternType.CROSS:
      drawLineOnCanvas([size / 2, 0], [size / 2, size]);
      drawLineOnCanvas([0, size / 2], [size, size / 2]);
      break;
    default:
      return null;
  }
  return ctx.createPattern(canvas, 'repeat');
}

export function olColorToHex(color: OLColor): string {
  function componentHex(c: number): string {
    const hex = c.toString(16);
    return hex.length === 1 ? `0${hex}` : hex;
  }
  return color
    .slice(0, 3)
    .reduce((prev, val) => `${prev}${componentHex(val)}`, '#');
}

export function validateHexColor(colorValue: string): boolean {
  return /^#[0-9a-f]{6}$/.test(colorValue);
}

export function parseFont(font: string | FontObject): FontObject {
  if (typeof font !== 'string') {
    return font;
  }
  let fontFamily: null | string = null;
  let fontSize: null | string = null;
  let fontStyle = 'normal';
  let fontWeight = 'normal';
  let fontVariant = 'normal';
  let lineHeight = 'normal';

  font.split(/\s+/).forEach((element) => {
    switch (element) {
      case 'normal':
        break;

      case 'italic':
      case 'oblique':
        fontStyle = element;
        break;

      case 'small-caps':
        fontVariant = element;
        break;

      case 'bold':
      case 'bolder':
      case 'lighter':
      case '100':
      case '200':
      case '300':
      case '400':
      case '500':
      case '600':
      case '700':
      case '800':
      case '900':
        fontWeight = element;
        break;

      default:
        if (!fontSize) {
          const parts = element.split('/');
          fontSize = parts[0];
          if (parts.length > 1) lineHeight = parts[1];
          break;
        }
        if (!fontFamily) {
          fontFamily = element;
        } else {
          fontFamily = `${fontFamily} ${element}`;
        }
        break;
    }
  });

  if (!(fontFamily && fontSize)) {
    throw new Error(`Failed to parse font: ${font}`);
  }

  return {
    fontStyle,
    fontVariant,
    fontWeight,
    fontSize,
    lineHeight,
    fontFamily,
  };
}

/**
 * @param  fontObject
 */
export function combineFont(fontObject: FontObject): string {
  const order = [
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontSize',
    'fontFamily',
  ];
  let font: string | null = null;
  Object.entries(fontObject)
    .filter((e) => e[1] !== 'normal' && e[0] !== 'lineWeight')
    .sort((a, b) => {
      const indexA = order.indexOf(a[0]);
      const indexB = order.indexOf(b[0]);
      if (indexA < indexB) {
        return -1;
      }
      if (indexA > indexB) {
        return 1;
      }

      return 0;
    })
    .forEach((e) => {
      if (!font) {
        font = e[1];
      } else {
        font = `${font} ${e[1]}`;
      }
    });

  return font || '';
}

/**
 * tints the given canvas to the specified color
 * @param  canvasContext
 * @param  color
 * @param  size
 * @param  [optOrigin=[0, 0]]
 */
export function colorInCanvas(
  canvasContext: CanvasRenderingContext2D,
  color: OLColor,
  size: Size,
  optOrigin?: Size,
): void {
  const origin = optOrigin || [0, 0];
  const imgData = canvasContext.getImageData(
    origin[0],
    origin[1],
    size[0],
    size[1],
  );
  const { data } = imgData;
  const [r, g, b] = color;
  const ii = data.length;

  for (let i = 0; i < ii; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }

  canvasContext.putImageData(imgData, origin[0], origin[1]);
}

export function getFillOptions(fill: Fill): FillOptions {
  let color = fill.getColor();
  try {
    color = parseColor(color as ColorType).slice();
  } catch (e) {
    getLogger().warning((e as Error).message);
  }
  return { color };
}

export function getFillFromOptions(options: FillOptions): Fill {
  return new Fill(options);
}

export function getStrokeFromOptions(options: StrokeOptions): Stroke {
  return new Stroke(options);
}

export function getStrokeOptions(stroke: Stroke): StrokeOptions {
  let color = stroke.getColor();
  if (color) {
    try {
      color = parseColor(color).slice();
    } catch (e) {
      getLogger().warning((e as Error).message);
    }
  }
  const options: StrokeOptions = {
    color,
  };
  if (stroke.getWidth() != null) {
    options.width = stroke.getWidth();
  }
  const lineDash = stroke.getLineDash();
  if (lineDash) {
    options.lineDash = lineDash;
  }
  return options;
}

export function getTextOptions(text: OLText): VectorStyleItemText {
  return {
    font: text.getFont(),
    fill: text.getFill() ? getFillOptions(text.getFill()!) : undefined,
    stroke: text.getStroke() ? getStrokeOptions(text.getStroke()!) : undefined,
    textBaseline: text.getTextBaseline(),
    offsetY: text.getOffsetY(),
    offsetX: text.getOffsetX(),
    text: text.getText(),
  };
}

export function getTextFromOptions(options: VectorStyleItemText): OLText {
  const textOptions: VectorStyleItemText = { ...options };
  if (textOptions.fill && !(textOptions.fill instanceof Fill)) {
    textOptions.fill = new Fill(textOptions.fill);
  }
  if (textOptions.stroke && !(textOptions.stroke instanceof Stroke)) {
    textOptions.stroke = new Stroke(textOptions.stroke);
  }
  if (textOptions.font && typeof textOptions.font !== 'string') {
    textOptions.font = combineFont(textOptions.font);
  }
  return new OLText(textOptions as TextOptions);
}

export type ImageStyleOptions = {
  src?: string;
  scale?: number | Size;
  opacity?: number;
  color?: OLColor;
  fill?: FillOptions;
  stroke?: StrokeOptions;
  radius?: number;
  radius2?: number;
  points?: number;
  angle?: number;
  rotation?: number;
  anchor?: number[];
};

export function getImageStyleOptions(image: ImageStyle): ImageStyleOptions {
  if (image instanceof Icon) {
    const options: ImageStyleOptions = {
      scale: image.getScale(),
    };
    try {
      const color = image.getColor() ? parseColor(image.getColor()) : undefined;
      if (color) {
        options.color = color;
      }
    } catch (e) {
      getLogger().warning((e as Error).message);
    }
    if (image.getSrc()) {
      options.src = image.getSrc();
    }
    if (image.getOpacity() != null) {
      options.opacity = image.getOpacity();
    }
    if (image.getAnchor() && image.getSize()) {
      const widthFraction = image.getAnchor()[0] / image.getSize()[0];
      const heightFraction = image.getAnchor()[1] / image.getSize()[1];
      options.anchor = [widthFraction, heightFraction];
    }
    return options;
  } else if (image instanceof Circle) {
    const options: ImageStyleOptions = {
      scale: image.getScale(),
    };
    if (image.getFill()) {
      options.fill = getFillOptions(image.getFill()!);
    }
    if (image.getRadius() != null) {
      options.radius = image.getRadius();
    }
    if (image.getStroke()) {
      options.stroke = getStrokeOptions(image.getStroke()!);
    }
    return options;
  } else if (image instanceof RegularShape) {
    const options: ImageStyleOptions = {
      scale: image.getScale(),
    };
    if (image.getFill()) {
      options.fill = getFillOptions(image.getFill()!);
    }
    if (image.getPoints()) {
      options.points = image.getPoints();
    }
    if (image.getAngle()) {
      options.angle = image.getAngle();
    }
    if (image.getRotation()) {
      options.rotation = image.getRotation();
    }
    if (image.getRadius() != null) {
      options.radius = image.getRadius();
    }
    if (image.getRadius2() != null) {
      options.radius2 = image.getRadius2();
    }
    if (image.getStroke()) {
      options.stroke = getStrokeOptions(image.getStroke()!);
    }
    return options;
  }
  throw new Error('no Subclass of ImageStyle found');
}

export function getImageStyleFromOptions(
  options: ImageStyleOptions,
): ImageStyle {
  if (options.radius) {
    const fill = options.fill ? getFillFromOptions(options.fill) : undefined;
    const stroke = options.stroke
      ? getStrokeFromOptions(options.stroke)
      : undefined;
    if (options.points) {
      return new RegularShape({
        fill,
        stroke,
        points: options.points,
        radius: options.radius,
        radius2: options.radius2,
        scale: options.scale,
        angle: options.angle,
        rotation: options.rotation,
      });
    } else {
      return new Circle({
        fill,
        stroke,
        radius: options.radius,
        scale: options.scale,
      });
    }
  } else {
    const iconOptions: IconOptions = {
      src: options.src,
      scale: options.scale,
      opacity: options.opacity,
      color: options.color,
      anchor: options.anchor,
    };
    if (options.src) {
      if (TrustedServers.contains(options.src)) {
        iconOptions.crossOrigin = 'use-credentials';
      } else if (!isSameOrigin(options.src)) {
        iconOptions.crossOrigin = 'anonymous';
      }
    }
    return new Icon(iconOptions);
  }
}

export type StyleOptions = {
  fill?: FillOptions | undefined;
  stroke?: StrokeOptions | undefined;
  image?: ImageStyleOptions | undefined;
  text?: VectorStyleItemText | undefined;
};

export function getStyleFromOptions(options: StyleOptions): Style {
  return new Style({
    stroke: options.stroke ? getStrokeFromOptions(options.stroke) : undefined,
    fill: options.fill ? getFillFromOptions(options.fill) : undefined,
    image: options.image ? getImageStyleFromOptions(options.image) : undefined,
    text: options.text ? getTextFromOptions(options.text) : undefined,
  });
}

export function getStyleOptions(style: Style): StyleOptions {
  return {
    fill: style.getFill() ? getFillOptions(style.getFill()!) : undefined,
    stroke: style.getStroke()
      ? getStrokeOptions(style.getStroke()!)
      : undefined,
    image: style.getImage()
      ? getImageStyleOptions(style.getImage()!)
      : undefined,
    text: style.getText() ? getTextOptions(style.getText()!) : undefined,
  };
}

export function getCssStyleFromTextStyle(textStyle: OLText): {
  font: string;
  textShadow?: string;
  color?: string;
} {
  const style: { font: string; textShadow?: string; color?: string } = {
    font: textStyle.getFont() as string,
    textShadow: undefined,
    color: undefined,
  };
  if (textStyle.getStroke()) {
    let width = textStyle.getStroke()!.getWidth() as number;
    width = width > 1 ? 1 : width;
    const color = olColorToHex(parseColor(textStyle.getStroke()!.getColor()));
    style.textShadow = `-${width}px ${width}px 0 ${color},${width}px ${width}px 0 ${color},${width}px -${width}px 0 ${color},-${width}px -${width}px 0 ${color}`;
  }
  if (textStyle.getFill()) {
    style.color = olColorToHex(
      parseColor(textStyle.getFill()!.getColor() as ColorType),
    );
  }
  return style;
}

export const emptyStyle = new Style({});

export const emptyColor: OLColor = [0, 0, 0, 0];

export const whiteColor: OLColor = [255, 255, 255, 1];

export const blackColor: OLColor = [0, 0, 0, 1];

export function getDefaultVectorStyleItemOptions(): VectorStyleItemOptions {
  return {
    image: {
      fill: {
        color: [255, 255, 255, 0.4],
      },
      stroke: {
        color: blackColor,
        width: 1,
      },
      radius: 5,
    },
    stroke: {
      color: [51, 153, 204, 1],
      width: 1.25,
    },
    fill: {
      color: [255, 255, 255, 0.4],
    },
    text: {
      font: 'bold 18px sans-serif',
      textBaseline: 'bottom',
      offsetY: -15,
      offsetX: 0,
    },
  };
}

/**
 * default Values @link https://github.com/AnalyticalGraphicsInc/3d-tiles/tree/3d-tiles-next/Styling
 */
const default3DTileStyleValues = {
  olcs_color: getStringColor(whiteColor),
  olcs_scale: '1.0',
  olcs_outlineWidth: '0.0',
  olcs_outlineColor: getStringColor(blackColor),
  olcs_pointSize: '8.0',
  olcs_image: String(null),
  olcs_font: `'${getDefaultVectorStyleItemOptions().text?.font as string}'`,
  olcs_fontColor: getStringColor(blackColor),
  olcs_fontOutlineWidth: '1.0',
  olcs_fontOutlineColor: getStringColor(whiteColor),
  olcs_labelText: String(null),
  olcs_anchorLineColor: getStringColor(whiteColor),
};

/**
 * returns the cesium3DTilesetStyle Condition with the value as the given Attribute
 * The condition checks for undefined and null
 * @param  attribute
 * @param  isColor
 */
export function getDefaultCondition(
  attribute: keyof typeof default3DTileStyleValues,
  isColor?: boolean,
): string[][] {
  const condition = `Boolean(\${${attribute}})===true`;
  const value = isColor ? `color(\${${attribute}})` : `\${${attribute}}`;
  return [
    [condition, value],
    ['true', default3DTileStyleValues[attribute]],
  ];
}

export const defaultExtrudedHeightCondition =
  // eslint-disable-next-line no-template-curly-in-string
  '${attributes} !== undefined && ${attributes} !== null && ${attributes.olcs_extrudedHeight} !== undefined && ${attributes.olcs_extrudedHeight}!==null';
