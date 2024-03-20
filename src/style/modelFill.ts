import { Fill } from 'ol/style.js';

class ModelFill extends Fill {
  static fromFill(fill: Fill): ModelFill {
    return new ModelFill({ color: fill.getColor() });
  }

  toFill(result?: Fill): Fill {
    const fill = result ?? new Fill();
    fill.setColor(this.getColor());
    return fill;
  }
}

export default ModelFill;
