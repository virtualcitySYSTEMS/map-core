import { PrimitiveCollection, type SplitDirection } from '@vcmap-cesium/engine';
import VectorSource from 'ol/source/Vector.js';
import { unByKey } from 'ol/Observable.js';
import type { Feature } from 'ol/index.js';
import { vcsLayerName } from '../layerSymbols.js';
import LayerImplementation from '../layerImplementation.js';
import { synchronizeFeatureVisibilityWithSource } from '../vectorHelpers.js';
import type { FeatureLayerImplementation } from '../featureLayer.js';
import type { VectorImplementationOptions } from '../vectorLayer.js';
import type VectorProperties from '../vectorProperties.js';
import type StyleItem from '../../style/styleItem.js';
import type FeatureVisibility from '../featureVisibility.js';
import type GlobalHider from '../globalHider.js';
import VectorContext from '../cesium/vectorContext.js';
import {
  createSourceVectorContextSync,
  type SourceVectorContextSync,
} from '../cesium/sourceVectorContextSync.js';
import type PanoramaMap from '../../map/panoramaMap.js';
import type { PanoramaImage } from '../../panorama/panoramaImage.js';
import { cartesianToMercator } from '../../util/math.js';

type PanoramaSourceSync = {
  paused: boolean;
  destroy: () => void;
};

function getImageExtent(
  image: PanoramaImage,
): [number, number, number, number] {
  const center = cartesianToMercator(image.position);
  const depth = image.maxDepth ?? 50;
  return [
    center[0] - depth,
    center[1] - depth,
    center[0] + depth,
    center[1] + depth,
  ];
}

function featureWithinImage(feature?: Feature, image?: PanoramaImage): boolean {
  if (feature && image) {
    const extent = getImageExtent(image);
    return feature.getGeometry()?.intersectsExtent(extent) ?? false;
  }
  return false;
}

function setupMapSourceListeners(
  map: PanoramaMap,
  originalSource: VectorSource,
  panoramaSource: VectorSource,
): PanoramaSourceSync {
  let paused = false;
  const sourceListeners = [
    originalSource.on('addfeature', (event) => {
      if (
        !paused &&
        featureWithinImage(event.feature, map.currentPanoramaImage)
      ) {
        panoramaSource.addFeature(event.feature as Feature);
      }
    }),
    originalSource.on('removefeature', (event) => {
      panoramaSource.removeFeature(event.feature as Feature);
    }),
  ];

  const setFeatures = (): void => {
    panoramaSource.clear();
    if (map.currentPanoramaImage) {
      const extent = getImageExtent(map.currentPanoramaImage);
      originalSource.getFeaturesInExtent(extent).forEach((f) => {
        panoramaSource.addFeature(f);
      });
    }
  };
  const panoramaImageListener =
    map.currentImageChanged.addEventListener(setFeatures);

  return {
    get paused(): boolean {
      return paused;
    },
    set paused(p: boolean) {
      paused = p;
      if (!paused) {
        setFeatures();
      }
    },
    destroy: (): void => {
      unByKey(sourceListeners);
      panoramaImageListener();
    },
  };
}

/**
 * represents a specific vector layer for cesium.
 */
export default class VectorPanoramaImpl
  extends LayerImplementation<PanoramaMap>
  implements FeatureLayerImplementation
{
  static get className(): string {
    return 'VectorPanoramaImpl';
  }

  vectorProperties: VectorProperties;

  source: VectorSource;

  splitDirection: SplitDirection;

  style: StyleItem;

  featureVisibility: FeatureVisibility;

  private _featureVisibilityListeners: (() => void)[] = [];

  private _rootCollection: PrimitiveCollection;

  private _context: VectorContext | null = null;

  private _sourceVectorContextSync: SourceVectorContextSync | undefined;

  private _sourceSync: PanoramaSourceSync;

  globalHider: GlobalHider | undefined;

  constructor(map: PanoramaMap, options: VectorImplementationOptions) {
    super(map, options);

    this.vectorProperties = options.vectorProperties;
    this.source = new VectorSource();

    this.splitDirection = options.splitDirection;
    this.style = options.style;
    this.featureVisibility = options.featureVisibility;

    this._rootCollection = new PrimitiveCollection();
    this._rootCollection[vcsLayerName] = options.name;
    this.globalHider = options.globalHider;
    this._sourceSync = setupMapSourceListeners(
      map,
      options.source,
      this.source,
    );
    this._sourceSync.paused = true;
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      this._context = new VectorContext(
        this.map,
        this._rootCollection,
        this.splitDirection,
      );
      this.map.addPrimitiveCollection(this._rootCollection);
      this._sourceVectorContextSync = createSourceVectorContextSync(
        this.source,
        this._context,
        this.map.getCesiumWidget().scene,
        this.style.style,
        this.vectorProperties,
      );
    }
    await super.initialize();
    if (this.splitDirection) {
      this.updateSplitDirection(this.splitDirection);
    }
  }

  /**
   * Forces a complete re-render of all features.
   */
  refresh(): void {
    this._sourceVectorContextSync?.refresh();
  }

  async activate(): Promise<void> {
    if (!this.active) {
      await super.activate();
      if (this.active) {
        this._sourceVectorContextSync?.activate();
        this._rootCollection.show = true;
        if (this._featureVisibilityListeners.length === 0) {
          this._featureVisibilityListeners =
            synchronizeFeatureVisibilityWithSource(
              this.featureVisibility,
              this.source,
              this.globalHider as GlobalHider,
            );
        }
        this._sourceSync.paused = false;
      }
    }
  }

  deactivate(): void {
    super.deactivate();
    this._sourceVectorContextSync?.deactivate();
    this._rootCollection.show = false;
    this._featureVisibilityListeners.forEach((cb) => {
      cb();
    });
    this._featureVisibilityListeners = [];
    this._sourceSync.paused = true;
  }

  updateStyle(style: StyleItem, silent?: boolean): void {
    this.style = style;
    this._sourceVectorContextSync?.setStyle(style.style, silent);
  }

  updateSplitDirection(splitDirection: SplitDirection): void {
    this.splitDirection = splitDirection;
    if (this.initialized) {
      this._context?.updateSplitDirection(splitDirection);
    }
  }

  destroy(): void {
    if (this.initialized) {
      this._sourceVectorContextSync?.destroy();
      this._context?.destroy();
      this.map.removePrimitiveCollection(this._rootCollection);
      this._rootCollection.destroy();
    }
    this._context = null;
    this._featureVisibilityListeners.forEach((cb) => {
      cb();
    });
    this._featureVisibilityListeners = [];
    this._sourceSync.destroy();
    super.destroy();
  }
}
