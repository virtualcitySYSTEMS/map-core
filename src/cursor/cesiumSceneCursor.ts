import {
  Cartesian2,
  Color,
  PostProcessStage,
  type PostProcessStageCollection,
  type Scene,
  type Texture,
} from '@vcmap-cesium/engine';
import type BaseCesiumMap from '../map/baseCesiumMap.js';
import { DEFAULT_MAX_DEPTH } from '../panorama/panoramaTileProvider.js';

import source from './cesiumSceneCursorFS.shader.js';

type CursorUniforms = {
  u_cursorCenter: Cartesian2;
  u_cursorColor: Color;
  u_cursorRadius: number;
  u_maxCursorDistance: number;
};

export default class CesiumSceneCursor {
  private readonly _stage: PostProcessStage;
  private readonly _collection: PostProcessStageCollection;
  private readonly _canvas: HTMLCanvasElement;
  private _scratchCenter = new Cartesian2();

  private get _uniforms(): CursorUniforms {
    return this._stage.uniforms as CursorUniforms;
  }

  constructor(scene: Scene, map: BaseCesiumMap) {
    this._canvas = scene.canvas;
    this._collection = scene.postProcessStages;
    this._stage = new PostProcessStage({
      fragmentShader: source,
      uniforms: {
        u_cursorCenter: new Cartesian2(),
        u_cursorColor: Color.fromCssColorString('rgba(255, 206, 0, 0.8)'),
        u_cursorRadius: 0.5,
        u_maxCursorDistance: DEFAULT_MAX_DEPTH,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        u_tilesetDepth: (): Texture =>
          map.depthPass?.depthTexture ??
          (scene.context as unknown as { defaultTexture: Texture })
            .defaultTexture,
      },
    });
    this._stage.enabled = false;
    this._collection.add(this._stage);
  }

  get enabled(): boolean {
    return this._stage.enabled;
  }

  set enabled(value: boolean) {
    this._stage.enabled = value;
  }

  set center(value: Cartesian2) {
    this._uniforms.u_cursorCenter.x = value.x;
    this._uniforms.u_cursorCenter.y = value.y;
  }

  /**
   * Sets the cursor center from a canvas (window) position in pixels.
   */
  setWindowPosition(windowPosition: Cartesian2): void {
    this._scratchCenter.x = windowPosition.x / this._canvas.clientWidth;
    this._scratchCenter.y = 1.0 - windowPosition.y / this._canvas.clientHeight;
    this.center = this._scratchCenter;
  }

  get color(): Color {
    return this._uniforms.u_cursorColor;
  }

  set color(value: Color) {
    this._uniforms.u_cursorColor = value;
  }

  set radius(value: number) {
    this._uniforms.u_cursorRadius = value;
  }

  get radius(): number {
    return this._uniforms.u_cursorRadius;
  }

  set maxDistance(value: number) {
    this._uniforms.u_maxCursorDistance = value;
  }

  get maxDistance(): number {
    return this._uniforms.u_maxCursorDistance;
  }

  destroy(): void {
    if (!this._stage.isDestroyed()) {
      this._collection.remove(this._stage);
    }
  }
}
