import {
  Primitive,
  PrimitiveCollection,
  Cartesian3,
} from '@vcmap-cesium/engine';
import PanoramaTileMaterial from './panoramaTileMaterial.js';
import VcsEvent from '../vcsEvent.js';

export default class PanoramaTilePrimitiveCollection extends PrimitiveCollection {
  declare private _primitives: Primitive[];

  // XXX get defautls from the material
  private _showIntensity = false;

  private _showDebug = false;

  private _showDepth = false;

  private _opacity = 1.0;

  private _intensityOpacity = 1.0;

  private _kernelRadius = 3.0;

  private _cursorPosition: Cartesian3 = new Cartesian3(-1, -1, -1);

  private _cursorRadius = 0.01;

  private _cursorRings = 3;

  showIntensityChanged = new VcsEvent<boolean>();

  get showIntensity(): boolean {
    return this._showIntensity;
  }

  set showIntensity(value: boolean) {
    if (this._showIntensity !== value) {
      this._showIntensity = value;
      this._primitives.forEach((primitive) => {
        (primitive.appearance.material as PanoramaTileMaterial).showIntensity =
          value;
      });
      this.showIntensityChanged.raiseEvent(this._showIntensity);
    }
  }

  get showDebug(): boolean {
    return this._showDebug;
  }

  set showDebug(value: boolean) {
    if (this._showDebug !== value) {
      this._showDebug = value;
      this._primitives.forEach((primitive) => {
        (primitive.appearance.material as PanoramaTileMaterial).showDebug =
          value;
      });
    }
  }

  get showDepth(): boolean {
    return this._showDepth;
  }

  set showDepth(value: boolean) {
    if (this._showDepth !== value) {
      this._showDepth = value;
      this._primitives.forEach((primitive) => {
        (primitive.appearance.material as PanoramaTileMaterial).showDepth =
          value;
      });
    }
  }

  get opacity(): number {
    return this._opacity;
  }

  set opacity(value: number) {
    if (this._opacity !== value) {
      this._opacity = value;
      this._primitives.forEach((primitive) => {
        (primitive.appearance.material as PanoramaTileMaterial).opacity = value;
      });
    }
  }

  get intensityOpacity(): number {
    return this._intensityOpacity;
  }

  set intensityOpacity(value: number) {
    if (this._intensityOpacity !== value) {
      this._intensityOpacity = value;
      this._primitives.forEach((primitive) => {
        (
          primitive.appearance.material as PanoramaTileMaterial
        ).intensityOpacity = value;
      });
    }
  }

  get kernelRadius(): number {
    return this._kernelRadius;
  }

  set kernelRadius(value: number) {
    if (this._kernelRadius !== value) {
      this._kernelRadius = value;
      this._primitives.forEach((primitive) => {
        (primitive.appearance.material as PanoramaTileMaterial).kernelRadius =
          value;
      });
    }
  }

  get cursorPosition(): Cartesian3 {
    return this._cursorPosition;
  }

  set cursorPosition(value: Cartesian3) {
    if (this._cursorPosition !== value) {
      this._cursorPosition = value;
      this._primitives.forEach((primitive) => {
        (primitive.appearance.material as PanoramaTileMaterial).cursorPosition =
          value;
      });
    }
  }

  get cursorRadius(): number {
    return this._cursorRadius;
  }

  set cursorRadius(value: number) {
    if (this._cursorRadius !== value) {
      this._cursorRadius = value;
      this._primitives.forEach((primitive) => {
        (primitive.appearance.material as PanoramaTileMaterial).cursorRadius =
          value;
      });
    }
  }

  get cursorRings(): number {
    return this._cursorRings;
  }

  set cursorRings(value: number) {
    if (this._cursorRings !== value) {
      this._cursorRings = value;
      this._primitives.forEach((primitive) => {
        (primitive.appearance.material as PanoramaTileMaterial).cursorRings =
          value;
      });
    }
  }

  add(primitive: Primitive, index?: number): Primitive {
    const { material } = primitive.appearance;

    if (!(material instanceof PanoramaTileMaterial)) {
      throw new Error('Material is not a PanoramaTileMaterial');
    }

    material.showIntensity = this.showIntensity;
    material.showDebug = this.showDebug;
    material.showDepth = this.showDepth;
    material.opacity = this.opacity;
    material.intensityOpacity = this.intensityOpacity;
    material.kernelRadius = this.kernelRadius;
    material.cursorPosition = this.cursorPosition;

    return super.add(primitive, index) as Primitive;
  }
}
