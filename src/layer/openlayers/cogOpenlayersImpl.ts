import type GeoTIFFSource from 'ol/source/GeoTIFF.js';
import WebGLTile from 'ol/layer/WebGLTile.js';
import { getRenderPixel } from 'ol/render.js';
import type RenderEvent from 'ol/render/Event.js';
import { SplitDirection } from '@vcmap-cesium/engine';
import RasterLayerOpenlayersImpl from './rasterLayerOpenlayersImpl.js';
import type { COGLayerImplementationOptions } from '../cogLayer.js';
import type OpenlayersMap from '../../map/openlayersMap.js';

const vcsCleared = Symbol('vcsCleared');

declare global {
  interface WebGL2RenderingContext {
    [vcsCleared]: number;
  }
}

/**
 * COGLayer implementation for {@link OpenlayersMap}.
 */
class COGOpenlayersImpl extends RasterLayerOpenlayersImpl {
  static get className(): string {
    return 'COGOpenlayersImpl';
  }

  private _source: GeoTIFFSource;

  constructor(map: OpenlayersMap, options: COGLayerImplementationOptions) {
    super(map, options);
    this._source = options.source;
  }

  getOLLayer(): WebGLTile {
    return new WebGLTile({
      source: this._source,
      opacity: this.opacity,
      minZoom: this.minRenderingLevel,
      maxZoom: this.maxRenderingLevel,
    });
  }

  protected override _splitPreRender(event: RenderEvent): void {
    const gl = event.context as WebGL2RenderingContext;
    if (gl[vcsCleared] !== event.frameState?.time) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    }
    gl.enable(gl.SCISSOR_TEST);

    const mapSize = this.map.olMap?.getSize();
    if (!mapSize) {
      throw new Error('Map size is not available for scissor test');
    }

    const bottomLeft = getRenderPixel(event, [0, mapSize[1]]);
    const topRight = getRenderPixel(event, [mapSize[0], 0]);

    const width = Math.round(
      (topRight[0] - bottomLeft[0]) * this.map.splitPosition,
    );
    const height = topRight[1] - bottomLeft[1];
    if (this.splitDirection === SplitDirection.LEFT) {
      gl.scissor(bottomLeft[0], bottomLeft[1], width, height);
    } else {
      gl.scissor(bottomLeft[0] + width, bottomLeft[1], topRight[0], height);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  protected override _splitPostReder(event: RenderEvent): void {
    const gl = event.context as WebGL2RenderingContext;
    gl.disable(gl.SCISSOR_TEST);
  }
}

export default COGOpenlayersImpl;
