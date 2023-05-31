import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import RegularShape, {
  type Options as RegularShapeOptions,
} from 'ol/style/RegularShape.js';
import Circle, { type Options as CircleOptions } from 'ol/style/Circle.js';
import type { VectorStyleItemImage } from './vectorStyleItem.js';

export function getShapeFromOptions(
  options: VectorStyleItemImage,
): RegularShape | Circle {
  if (options.fill && !(options.fill instanceof Fill)) {
    options.fill = new Fill(options.fill);
  }
  if (options.stroke && !(options.stroke instanceof Stroke)) {
    options.stroke = new Stroke(options.stroke);
  }
  return options.points
    ? new RegularShape(options as RegularShapeOptions)
    : new Circle(options as CircleOptions);
}

class ShapeCategory {
  shapes: VectorStyleItemImage[] = [];

  addImage(options: VectorStyleItemImage): void {
    const shape = getShapeFromOptions({ ...options });

    const canvas = shape.getImage(1);
    options.src = canvas.toDataURL();
    this.shapes.push(options);
  }
}

/**
 * TODO refactor to getdefaultShapeCategory...
 */
export const shapeCategory = new ShapeCategory();
const defaultShapeOptions = {
  fill: new Fill({ color: [255, 255, 255, 1] }),
  stroke: new Stroke({ color: [0, 0, 0, 1], width: 1 }),
  radius: 16,
};
[
  null,
  { points: 3 },
  { points: 3, angle: Math.PI },
  { points: 4, angle: Math.PI / 4 },
  { points: 6 },
].forEach((additionalOptions) => {
  const shapeOptions = additionalOptions
    ? Object.assign(additionalOptions, defaultShapeOptions)
    : defaultShapeOptions;

  shapeCategory.addImage(shapeOptions);
});
