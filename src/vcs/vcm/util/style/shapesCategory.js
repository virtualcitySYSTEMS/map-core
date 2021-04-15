import Fill from 'ol/style/Fill.js';
import Stroke from 'ol/style/Stroke.js';
import RegularShape from 'ol/style/RegularShape.js';
import Circle from 'ol/style/Circle.js';

/**
 * @param {vcs.vcm.util.style.VectorStyleItem.Image} options
 * @returns {ol/style/RegularShape|ol/style/Circle}
 * @memberOf vcs.vcm.util.style
 * @export
 */

export function getShapeFromOptions(options) {
  if (options.fill && !(options.fill instanceof Fill)) {
    options.fill = new Fill(options.fill);
  }
  if (options.stroke && !(options.stroke instanceof Stroke)) {
    options.stroke = new Stroke(options.stroke);
  }
  return options.points ?
    new RegularShape(/** @type {ol/style/RegularShapeOptions} */ (options)) :
    new Circle(/** @type {ol/style/CircleOptions} */ (options));
}

/**
 * @class
 * @memberOf vcs.vcm.util.style
 */
class ShapeCategory {
  constructor() {
    /** @type {Array<vcs.vcm.util.style.VectorStyleItem.Image>} */
    this.shapes = [];
  }

  /**
   * @param {vcs.vcm.util.style.VectorStyleItem.Image} options
   */
  addImage(options) {
    const shape = getShapeFromOptions({ ...options });

    const canvas = /** @type {HTMLCanvasElement} */ (shape.getImage(1));
    options.src = canvas.toDataURL();
    this.shapes.push(options);
  }
}

/**
 * @memberOf vcs.vcm.util.style
 * @export
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
  const shapeOptions = additionalOptions ?
    Object.assign(additionalOptions, defaultShapeOptions) :
    defaultShapeOptions;

  shapeCategory.addImage(shapeOptions);
});
