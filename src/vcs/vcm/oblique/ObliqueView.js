import { v4 as uuidv4 } from 'uuid';
import OLProjection from 'ol/proj/Projection.js';
import View from 'ol/View.js';
import TileGrid from 'ol/tilegrid/TileGrid.js';
import TileImage from 'ol/source/TileImage.js';
import Tile from 'ol/layer/Tile.js';
import { hasSameOrigin } from './helpers.js';

/** @type {string} */
let defaultImage = '';

/**
 * @returns {string}
 */
function getDefaultImage() {
  if (!defaultImage) {
    const canvas = document.createElement('canvas');
    canvas.height = 512;
    canvas.width = 512;
    const context = canvas.getContext('2d');
    context.fillStyle = '#409D76';
    context.fillRect(0, 0, 512, 512);
    context.font = 'bold 46px Monospace, Courier New';
    context.fillStyle = '#424242';
    context.textAlign = 'center';
    context.fillText('No Image', 256, 256);
    defaultImage = canvas.toDataURL('png');
  }
  return defaultImage;
}

/**
 * @typedef {Object} ObliqueViewOptions
 * @property {number} minZoom
 * @property {number} maxZoom
 * @property {number} scaleFactor
 * @property {number} hideLevels
 * @api
 */

/**
 * @class
 * @export
 */
class ObliqueView {
  /**
   * @param {import("@vcmap/core").ObliqueImageMeta} imageMeta
   * @param {ObliqueViewOptions} options
   */
  constructor(imageMeta, options) {
    /** @type {string} */
    this.id = uuidv4();
    /** @type {import("ol/size").Size} */
    this.size = imageMeta.size;
    /** @type {string} */
    this.url = imageMeta.url;
    /** @type {import("ol/size").Size} */
    this.tileSize = imageMeta.tileSize;
    /** @type {string} */
    this.format = imageMeta.format;
    /** @type {number} */
    this.minZoom = options.minZoom;
    /** @type {number} */
    this.maxZoom = options.maxZoom;
    /** @type {number} */
    this.scaleFactor = options.scaleFactor;
    const { tileResolution } = imageMeta;
    /** @type {Array<number>} */
    this.tileResolution = tileResolution.slice(0, tileResolution.length - options.hideLevels);
    this._createViewAndLayer();
  }

  _createViewAndLayer() {
    const extent = /** @type {import("ol/extent").Extent} */ ([0, 0, ...this.size]);
    const zoomifyProjection = new OLProjection({
      code: 'ZOOMIFY',
      units: 'pixels',
      extent,
    });

    const maxZoom = this.maxZoom > 0 ? this.maxZoom : this.tileResolution.length + 4;
    const zoomMultiplier = Math.log(2) / Math.log(this.scaleFactor);

    /**
     * The view for these oblique images.
     * @type {import("ol/View").default}
     * @api
     */
    this.view = new View({
      projection: zoomifyProjection,
      center: [this.size[0] / 2, this.size[1] / 2],
      constrainOnlyCenter: true,
      minZoom: this.minZoom * zoomMultiplier,
      maxZoom: maxZoom * zoomMultiplier,
      extent: /** @type {import("ol/extent").Extent} */ ([
        -2000,
        -2000,
        this.size[0] + 2000,
        this.size[1] + 2000,
      ]),
      zoom: this.minZoom * zoomMultiplier,
      zoomFactor: this.scaleFactor,
    });

    const tileImageOptions = {
      projection: zoomifyProjection,
      tileGrid: new TileGrid({
        origin: [0, 0],
        extent,
        resolutions: this.tileResolution,
        tileSize: this.tileSize,
      }),
    };
    if (!hasSameOrigin(this.url)) {
      tileImageOptions.crossOrigin = 'anonymous';
    }
    /** @type {import("ol/source/TileImage").default} */
    this.tileImageSource = new TileImage(tileImageOptions);

    /**
     * The layer of these images.
     * @type {import("ol/layer/Tile").default<import("ol/source/TileImage").default>}
     * @api
     */
    this.layer = new Tile({
      source: this.tileImageSource,
      extent,
    });
  }

  /**
   * Sets the layers source to request data for this image
   * @param {string} name
   * @param {boolean} [isDefaultImage=false]
   * @api
   */
  setImageName(name, isDefaultImage = false) {
    if (isDefaultImage) {
      this.tileImageSource.setTileLoadFunction(/** @param {import("ol").ImageTile} tile */ (tile) => {
        /** @type {HTMLImageElement} */ (tile.getImage()).src = getDefaultImage();
        tile.load();
      });
    }
    this.tileImageSource.setTileUrlFunction((coords) => {
      const [z, x, yInverted] = coords;
      const y = -yInverted - 1;
      return `${this.url}/${name}/${z}/${x}/${y}.${this.format}`;
    });
    this.tileImageSource.refresh();
  }

  destroy() {
    this.view = null;
    this.layer = null;
    this.tileImageSource.clear();
    this.tileImageSource = null;
  }
}

export default ObliqueView;
