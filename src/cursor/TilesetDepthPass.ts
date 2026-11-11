import type {
  Cartesian2,
  Cesium3DTileset,
  DrawCommand,
  PerspectiveFrustum,
  Scene,
} from '@vcmap-cesium/engine';
import {
  BoundingRectangle,
  Cartesian3,
  Cartesian4,
  Cesium3DTilePassState,
  ClearCommand,
  DerivedCommand,
  Framebuffer,
  Math as CesiumMath,
  Matrix4,
  Pass,
  PassState,
  PixelDatatype,
  PixelFormat,
  Texture,
} from '@vcmap-cesium/engine';
import pickSource from './tilesetDepthPickFS.shader.js';

type DepthOnlyDerivedCommand = {
  depthOnlyCommand: DrawCommand & { framebuffer: Framebuffer | undefined };
};

const scratchClip = new Cartesian4();
const scratchEye = new Cartesian3();

const MIN_DEPTH_DOWNSCALE_FACTOR = 2;
const MAX_DEPTH_DOWNSCALE_FACTOR = 4;
const REFERENCE_FOV = CesiumMath.PI_OVER_TWO;
/**
 * Avoids recreating the texture for tiny fov changes while zooming.
 */
const DEPTH_DOWNSCALE_STEP = 0.25;

/**
 * Narrower fovs get a coarser texture, wider fovs never get a finer one than at the reference fov.
 */
function getDownscaleFactor(fov: number | undefined): number {
  if (!fov) {
    return MIN_DEPTH_DOWNSCALE_FACTOR;
  }
  const factor = CesiumMath.clamp(
    (MIN_DEPTH_DOWNSCALE_FACTOR * REFERENCE_FOV) / fov,
    MIN_DEPTH_DOWNSCALE_FACTOR,
    MAX_DEPTH_DOWNSCALE_FACTOR,
  );
  return Math.round(factor / DEPTH_DOWNSCALE_STEP) * DEPTH_DOWNSCALE_STEP;
}

/**
 * Cesium3DTilePass.SHADOW, which is not exported. Unlike the preload pass, it requests the selected tiles
 * and creates their commands.
 */
const SHADOW_TILE_PASS = 2;
/**
 * Minimum time between two passes. The depth texture may lag the currently
 * rendered frame by up to this much.
 */
const MIN_PASS_INTERVAL = 500;

type DepthPassTileset = {
  tilePass: Cesium3DTilePassState;
  preloadWhenHidden: boolean;
};

/**
 * Renders the depth of all added tilesets into one shared depth texture. Depth testing makes the nearest surface win.
 */
class TilesetDepthPass {
  private _scene: Scene;
  private _tilesets = new Map<Cesium3DTileset, DepthPassTileset>();
  private _fbo: Framebuffer | undefined;
  depthTexture: Texture | undefined;
  private _passState: PassState | undefined;
  private _derivedCommands: WeakMap<DrawCommand, DepthOnlyDerivedCommand>;
  private _clearCommand: ClearCommand;
  private _viewport = new BoundingRectangle();
  private _lastPass = 0;
  private _removeListeners: () => void;
  private _destroyed = false;

  private _pickFbo: Framebuffer | undefined;
  private _pickTexture: Texture | undefined;
  private _pickCommand: DrawCommand | undefined;
  private _pickPassState: PassState | undefined;
  private _pickViewport = new BoundingRectangle();
  /**
   * The packed depth of the whole texture, read back once per pass on the first pick.
   */
  private _pickedDepth: Uint8Array | undefined;
  private _pickedPass = -1;

  private _inverseProjection = new Matrix4();
  private _inverseView = new Matrix4();
  private _passCount = 0;

  private _lastViewMatrix = new Matrix4();
  private _lastProjectionMatrix = new Matrix4();
  /**
   * Forces a tile update on the next frame, even if the camera did not change.
   */
  private _tilesDirty = true;

  /**
   * While suspended, the pass neither selects tiles (and thus requests none) nor renders. The depth texture keeps
   * the last rendered pass and may lag the camera until the pass resumes.
   * Rendering is skipped as well, because the command list of the last tile update is not safe to execute:
   * the hidden tilesets keep running their cache in postPassesUpdate, which may unload the tiles (and destroy the
   * resources) these commands refer to.
   * Since no tiles are touched while suspended, Cesium also cancels the depth pass tile requests
   * already in flight (shown as NS_BINDING_ABORTED in Firefox). This is intended: it frees the
   * connections for the image tiles, and the tiles are requested again once the pass resumes.
   */
  private _suspensions = 0;

  private _enabled = true;

  constructor(scene: Scene) {
    this._scene = scene;

    this._derivedCommands = new WeakMap();
    this._clearCommand = new ClearCommand({ depth: 1.0 });

    const removePreRender = scene.preRender.addEventListener(() => {
      if (this._destroyed || !this._enabled) {
        return;
      }
      this._removeDestroyedTilesets();
      if (this.suspended) {
        return;
      }
      const renderDue = performance.now() - this._lastPass >= MIN_PASS_INTERVAL;
      if (renderDue || this._tilesNeedUpdate()) {
        this._updateTiles();
      }
      if (renderDue) {
        this._render();
      }
    });

    this._removeListeners = removePreRender;
  }

  /**
   * A disabled pass neither loads tiles nor renders. In flight tile requests are cancelled on the next frame.
   */
  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(enabled: boolean) {
    if (this._enabled !== enabled) {
      this._enabled = enabled;
      // render as soon as the pass is enabled again
      this._tilesDirty = true;
      this._lastPass = 0;
    }
  }

  /**
   * Whether tile loading is currently suspended.
   */
  get suspended(): boolean {
    return this._suspensions > 0;
  }

  /**
   * Suspends tile loading and rendering until the returned function is called. The pass resumes once all suspensions
   * are released and then renders on the next frame.
   * Since tiles are no longer selected, cesium cancels their in flight requests on the next frame. Use it
   * to free the connections for requests which must not wait behind the depth pass tiles.
   * @returns a function to release the suspension. Calling it more than once has no effect.
   */
  suspend(): () => void {
    this._suspensions += 1;
    let released = false;
    return (): void => {
      if (!released) {
        released = true;
        this._suspensions -= 1;
        this._tilesDirty = true;
        // render as soon as the pass resumes, the depth texture may be outdated
        this._lastPass = 0;
      }
    };
  }

  /**
   * Suspends tile loading until the promise settles, e.g. while the metadata of a new panorama image loads.
   */
  async suspendWhile<T>(promise: Promise<T>): Promise<T> {
    const release = this.suspend();
    try {
      return await promise;
    } finally {
      release();
    }
  }

  /**
   * The number of tilesets rendered by this pass.
   */
  get size(): number {
    return this._tilesets.size;
  }

  /**
   * Adds a tileset to the depth pass. The tileset is expected to be hidden, the pass renders it on its own.
   * @returns a function to remove the tileset again
   */
  addTileset(tileset: Cesium3DTileset): () => void {
    if (!this._tilesets.has(tileset)) {
      const tilePass = new Cesium3DTilePassState({
        pass: SHADOW_TILE_PASS,
      });
      tilePass.commandList = [];
      this._tilesets.set(tileset, {
        tilePass,
        preloadWhenHidden: tileset.preloadWhenHidden,
      });
      // the depth pass requests the tiles itself. cesiums preload pass would select and update them a second time.
      tileset.preloadWhenHidden = false;
      this._tilesDirty = true;
    }

    return (): void => {
      this.removeTileset(tileset);
    };
  }

  removeTileset(tileset: Cesium3DTileset): void {
    const entry = this._tilesets.get(tileset);
    if (entry) {
      this._tilesets.delete(tileset);
      if (!tileset.isDestroyed()) {
        tileset.preloadWhenHidden = entry.preloadWhenHidden;
      }
    }
  }

  private _removeDestroyedTilesets(): void {
    [...this._tilesets.keys()].forEach((tileset) => {
      if (tileset.isDestroyed()) {
        this._tilesets.delete(tileset);
      }
    });
  }

  /**
   * The position of the depth texel at the given uv.
   */
  getPositionAtUv(uv: Cartesian2, result?: Cartesian3): Cartesian3 | undefined {
    const depth = this._readDepth(uv);
    if (depth == null || depth <= 0 || depth >= 1) {
      return undefined;
    }

    scratchClip.x = uv.x * 2 - 1;
    scratchClip.y = uv.y * 2 - 1;
    scratchClip.z = depth * 2 - 1;
    scratchClip.w = 1;

    Matrix4.multiplyByVector(this._inverseProjection, scratchClip, scratchClip);
    scratchEye.x = scratchClip.x / scratchClip.w;
    scratchEye.y = scratchClip.y / scratchClip.w;
    scratchEye.z = scratchClip.z / scratchClip.w;

    return Matrix4.multiplyByPoint(
      this._inverseView,
      scratchEye,
      result ?? new Cartesian3(),
    );
  }

  private _readDepth(uv: Cartesian2): number | undefined {
    const { depthTexture } = this;
    if (!depthTexture || this._passCount === 0) {
      return undefined;
    }

    const { width, height } = depthTexture;
    const x = Math.floor(uv.x * width);
    const y = Math.floor(uv.y * height);
    if (x < 0 || y < 0 || x >= width || y >= height) {
      return undefined;
    }

    if (!this._pickedDepth || this._pickedPass !== this._passCount) {
      this._pickedDepth = this._readPackedDepth(width, height);
      this._pickedPass = this._passCount;
    }

    const i = (y * width + x) * 4;
    const depth = this._pickedDepth;
    // inverse of czm_packDepth
    return (
      (depth[i] +
        depth[i + 1] / 255 +
        depth[i + 2] / 65025 +
        depth[i + 3] / 16581375) /
      255
    );
  }

  /**
   * Packs the whole depth texture into rgba and reads it back. A single sync read per pass
   * instead of one per pick, since the GPU stall dominates the cost of a read.
   */
  private _readPackedDepth(width: number, height: number): Uint8Array {
    const { context } = this._scene;

    if (
      !this._pickTexture ||
      this._pickTexture.width !== width ||
      this._pickTexture.height !== height
    ) {
      this._destroyPickResources();
      this._pickTexture = new Texture({
        context,
        width,
        height,
        pixelFormat: PixelFormat.RGBA,
        pixelDatatype: PixelDatatype.UNSIGNED_BYTE,
      });

      this._pickFbo = new Framebuffer({
        context,
        colorTextures: [this._pickTexture],
        destroyAttachments: false,
      });
    }

    this._pickViewport.width = width;
    this._pickViewport.height = height;
    if (!this._pickPassState) {
      this._pickPassState = new PassState(context);
      this._pickPassState.viewport = this._pickViewport;
    }
    this._pickPassState.framebuffer = this._pickFbo;

    // without a framebuffer override, the command draws into the framebuffer of the pass state
    this._pickCommand ??= context.createViewportQuadCommand(pickSource, {
      uniformMap: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        u_tilesetDepth: (): Texture | undefined => this.depthTexture,
      },
    });
    this._pickCommand.execute(context, this._pickPassState);

    return context.readPixels({
      x: 0,
      y: 0,
      width,
      height,
      framebuffer: this._pickFbo,
    });
  }

  /**
   * Tiles must be selected each frame while the camera moves or tiles load, cesium cancels
   * requests of tiles which were not selected in the current frame.
   */
  private _tilesNeedUpdate(): boolean {
    const { camera } = this._scene;
    return (
      this._tilesDirty ||
      !Matrix4.equals(camera.viewMatrix, this._lastViewMatrix) ||
      !Matrix4.equals(
        camera.frustum.projectionMatrix,
        this._lastProjectionMatrix,
      ) ||
      [...this._tilesets.keys()].some((tileset) => !tileset.tilesLoaded)
    );
  }

  private _updateTiles(): void {
    const { frameState, camera } = this._scene;
    this._tilesDirty = false;
    Matrix4.clone(camera.viewMatrix, this._lastViewMatrix);
    Matrix4.clone(camera.frustum.projectionMatrix, this._lastProjectionMatrix);
    const cullingVolume = camera.frustum.computeCullingVolume(
      camera.positionWC,
      camera.directionWC,
      camera.upWC,
    );

    this._tilesets.forEach(({ tilePass }, tileset) => {
      tilePass.commandList.length = 0;
      tilePass.camera = camera;
      tilePass.cullingVolume = cullingVolume;

      const { show } = tileset;
      tileset.show = true;
      try {
        tileset.updateForPass(frameState, tilePass);
      } finally {
        tileset.show = show;
      }
    });
  }

  private _render(): void {
    this._lastPass = performance.now();
    const { context } = this._scene;
    const { uniformState, drawingBufferWidth, drawingBufferHeight } = context;
    if (
      !uniformState ||
      drawingBufferWidth == null ||
      drawingBufferHeight == null
    ) {
      return;
    }

    Matrix4.clone(uniformState.inverseProjection, this._inverseProjection);
    Matrix4.clone(uniformState.inverseView, this._inverseView);
    this._passCount += 1;

    const downscaleFactor = getDownscaleFactor(
      (this._scene.camera.frustum as PerspectiveFrustum).fov,
    );
    const width = Math.max(1, Math.floor(drawingBufferWidth / downscaleFactor));
    const height = Math.max(
      1,
      Math.floor(drawingBufferHeight / downscaleFactor),
    );

    if (
      !this._passState ||
      !this.depthTexture ||
      this.depthTexture.width !== width ||
      this.depthTexture.height !== height
    ) {
      this._destroyResources();

      this.depthTexture = new Texture({
        context,
        width,
        height,
        pixelFormat: PixelFormat.DEPTH_COMPONENT,
        pixelDatatype: PixelDatatype.UNSIGNED_INT,
      });

      this._fbo = new Framebuffer({
        context,
        depthTexture: this.depthTexture,
        destroyAttachments: false,
      });

      this._viewport.width = width;
      this._viewport.height = height;
      this._passState = new PassState(context);
      this._passState.framebuffer = this._fbo;
      this._passState.viewport = this._viewport;
    }

    const passState = this._passState;
    this._clearCommand.execute(context, passState);
    uniformState.updatePass(Pass.CESIUM_3D_TILE);

    this._tilesets.forEach(({ tilePass }) => {
      tilePass.commandList.forEach((command) => {
        if (!command.renderState) {
          return;
        }

        const result = DerivedCommand.createDepthOnlyDerivedCommand(
          this._scene,
          command,
          context,
          this._derivedCommands.get(command),
        ) as DepthOnlyDerivedCommand;

        this._derivedCommands.set(command, result);

        const depthCommand = result.depthOnlyCommand;
        depthCommand.framebuffer = this._fbo;
        depthCommand.execute(context, passState);
      });
    });
  }

  private _destroyResources(): void {
    if (this._fbo) {
      this._fbo.destroy();
      this._fbo = undefined;
    }

    if (this.depthTexture) {
      this.depthTexture.destroy();
      this.depthTexture = undefined;
    }

    this._passState = undefined;
    this._derivedCommands = new WeakMap();
  }

  private _destroyPickResources(): void {
    if (this._pickFbo) {
      this._pickFbo.destroy();
      this._pickFbo = undefined;
    }
    if (this._pickTexture) {
      this._pickTexture.destroy();
      this._pickTexture = undefined;
    }
    this._pickedDepth = undefined;
  }

  isDestroyed(): boolean {
    return this._destroyed;
  }

  destroy(): void {
    this._removeListeners();
    [...this._tilesets.keys()].forEach((tileset) => {
      this.removeTileset(tileset);
    });
    this._destroyResources();
    this._destroyPickResources();
    this._pickCommand = undefined;
    this._pickPassState = undefined;
    this._destroyed = true;
  }
}

export default TilesetDepthPass;
