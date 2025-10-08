import type { Primitive } from '@vcmap-cesium/engine';
import {
  Cartesian3,
  Color,
  Math as CesiumMath,
  PrimitiveCollection,
} from '@vcmap-cesium/engine';
import PanoramaTileMaterial, {
  defaultCursorColor,
  PanoramaOverlayMode,
} from './panoramaTileMaterial.js';
import VcsEvent from '../vcsEvent.js';

export default class PanoramaTilePrimitiveCollection extends PrimitiveCollection {
  declare private _primitives: Primitive[];

  private _showDebug = false;

  private _opacity = 1.0;

  private _cursorPosition: Cartesian3 = new Cartesian3(-1, -1, -1);

  private _overlay: PanoramaOverlayMode = PanoramaOverlayMode.None;

  private _overlayOpacity = 1.0;

  private _overlayNaNColor: Color = Color.RED;

  private _cursorColor: Color = Color.fromCssColorString(defaultCursorColor);

  private _contrast = 1.0;

  private _brightness = 0.0;

  overlayChanged = new VcsEvent<PanoramaOverlayMode>();

  constructor(options?: ConstructorParameters<typeof PrimitiveCollection>[0]) {
    super(options ?? { destroyPrimitives: false });
  }

  get overlay(): PanoramaOverlayMode {
    return this._overlay;
  }

  set overlay(value: PanoramaOverlayMode) {
    if (this._overlay !== value) {
      this._overlay = value;
      this._primitives.forEach((primitive) => {
        (primitive.appearance.material as PanoramaTileMaterial).overlay = value;
      });
      this.overlayChanged.raiseEvent(value);
    }
  }

  get overlayOpacity(): number {
    return this._overlayOpacity;
  }

  set overlayOpacity(value: number) {
    if (this._overlayOpacity !== value) {
      this._overlayOpacity = value;
      this._primitives.forEach((primitive) => {
        (primitive.appearance.material as PanoramaTileMaterial).overlayOpacity =
          value;
      });
    }
  }

  get overlayNaNColor(): Color {
    return this._overlayNaNColor;
  }

  set overlayNaNColor(value: Color) {
    if (!this._overlayNaNColor.equals(value)) {
      this._overlayNaNColor = value;
      this._primitives.forEach((primitive) => {
        (
          primitive.appearance.material as PanoramaTileMaterial
        ).overlayNaNColor = value;
      });
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

  get contrast(): number {
    return this._contrast;
  }

  set contrast(value: number) {
    if (this._contrast !== value) {
      this._contrast = value;
      this._primitives.forEach((primitive) => {
        (primitive.appearance.material as PanoramaTileMaterial).contrast =
          value;
      });
    }
  }

  get brightness(): number {
    return this._brightness;
  }

  set brightness(value: number) {
    if (this._brightness !== value) {
      this._brightness = value;
      this._primitives.forEach((primitive) => {
        (primitive.appearance.material as PanoramaTileMaterial).brightness =
          value;
      });
    }
  }

  get cursorPosition(): Cartesian3 {
    return this._cursorPosition;
  }

  set cursorPosition(value: Cartesian3) {
    if (
      !Cartesian3.equalsEpsilon(
        this._cursorPosition,
        value,
        CesiumMath.EPSILON8,
      )
    ) {
      this._cursorPosition = value;
      this._primitives.forEach((primitive) => {
        (primitive.appearance.material as PanoramaTileMaterial).cursorPosition =
          value;
      });
    }
  }

  get cursorColor(): Color {
    return this._cursorColor;
  }

  set cursorColor(value: Color) {
    if (!this._cursorColor.equals(value)) {
      this._cursorColor = value;
      this._primitives.forEach((primitive) => {
        (primitive.appearance.material as PanoramaTileMaterial).cursorColor =
          value;
      });
    }
  }

  add(primitive: Primitive, index?: number): Primitive {
    const { material } = primitive.appearance;

    if (!(material instanceof PanoramaTileMaterial)) {
      throw new Error('Material is not a PanoramaTileMaterial');
    }

    material.overlay = this.overlay;
    material.overlayOpacity = this.overlayOpacity;
    material.overlayNaNColor = this.overlayNaNColor;
    material.showDebug = this.showDebug;
    material.opacity = this.opacity;
    material.cursorPosition = this.cursorPosition;
    material.cursorColor = this.cursorColor;
    material.brightness = this.brightness;
    material.contrast = this.contrast;

    return super.add(primitive, index) as Primitive;
  }
}
