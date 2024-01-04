import VectorSource from 'ol/source/Vector.js';
import OLVectorLayer from 'ol/layer/Vector.js';
import { unByKey } from 'ol/Observable.js';
import Feature from 'ol/Feature.js';
import type { EventsKey } from 'ol/events.js';
import type { Extent } from 'ol/extent.js';
import type { SplitDirection } from '@vcmap-cesium/engine';
import type { Geometry } from 'ol/geom.js';

import { mercatorProjection } from '../../util/projection.js';
import {
  mercatorGeometryToImageGeometry,
  imageGeometryToMercatorGeometry,
  getPolygonizedGeometry,
  setNewGeometry,
} from './obliqueHelpers.js';
import {
  actuallyIsCircle,
  alreadyTransformedToImage,
  doNotTransform,
  obliqueGeometry,
  originalFeatureSymbol,
} from '../vectorSymbols.js';
import LayerObliqueImpl from './layerObliqueImpl.js';
import { synchronizeFeatureVisibilityWithSource } from '../vectorHelpers.js';
import { FeatureLayerImplementation } from '../featureLayer.js';
import type { VectorImplementationOptions } from '../vectorLayer.js';
import type ObliqueMap from '../../map/obliqueMap.js';
import type GlobalHider from '../globalHider.js';
import type StyleItem from '../../style/styleItem.js';
import type FeatureVisibility from '../featureVisibility.js';
import type ObliqueImage from '../../oblique/obliqueImage.js';

/**
 * represents a specific vector layer for oblique.
 */
class VectorObliqueImpl
  extends LayerObliqueImpl
  implements FeatureLayerImplementation
{
  static get className(): string {
    return 'VectorObliqueImpl';
  }

  obliqueSource = new VectorSource({});

  private _featureListeners: Record<string, Record<string, EventsKey>> = {};

  private _sourceListener: EventsKey[] = [];

  /**
   * The extent of the current image for which features where fetched
   */
  currentExtent: Extent | null = null;

  /**
   * The image name for which the current features where fetched
   */
  fetchedFeaturesForImageName: string | null = null;

  private _updatingMercator: Record<
    string,
    number | boolean | null | NodeJS.Timeout
  > = {};

  private _updatingOblique: Record<
    string,
    number | boolean | null | NodeJS.Timeout
  > = {};

  private _featureVisibilityListeners: (() => void)[] = [];

  globalHider: GlobalHider;

  source: VectorSource;

  style: StyleItem;

  featureVisibility: FeatureVisibility;

  olLayer: OLVectorLayer<VectorSource> | null = null;

  private _imageChangedListener: (() => void) | null | undefined = null;

  constructor(map: ObliqueMap, options: VectorImplementationOptions) {
    super(map, options);

    this.globalHider = options.globalHider as GlobalHider;
    this.source = options.source;
    this.style = options.style;
    this.featureVisibility = options.featureVisibility;
  }

  getOLLayer(): OLVectorLayer<VectorSource> {
    return new OLVectorLayer({
      visible: false,
      source: this.obliqueSource,
      style: this.style.style,
    });
  }

  // eslint-disable-next-line no-unused-vars
  updateStyle(style: StyleItem, _silent?: boolean): void {
    this.style = style;
    if (this.initialized && this.olLayer) {
      this.olLayer.setStyle(this.style.style);
    }
  }

  // eslint-disable-next-line class-methods-use-this,no-unused-vars
  updateSplitDirection(_splitDirection: SplitDirection): void {}

  /**
   * clears the current image and fetches features for the next
   */
  private _onObliqueImageChanged(): void {
    this._clearCurrentImage();
    this._fetchFeaturesInView();
  }

  private _featureInExtent(feature: Feature): boolean {
    if (this.currentExtent) {
      const geometry = feature.getGeometry();
      if (geometry) {
        return (
          geometry[alreadyTransformedToImage] ||
          geometry.intersectsExtent(this.currentExtent)
        );
      }
    }
    return false;
  }

  protected _addSourceListeners(): void {
    this._sourceListener.push(
      this.source.on('addfeature', (event) => {
        const f = event.feature as Feature;
        if (this._featureInExtent(f)) {
          // eslint-disable-next-line no-void
          void this.addFeature(f);
        }
      }),
    );

    this._sourceListener.push(
      this.source.on('removefeature', (event) => {
        this.removeFeature(event.feature as Feature);
      }),
    );

    this._sourceListener.push(
      this.source.on('changefeature', (event) => {
        const f = event.feature as Feature;
        const newFeatureId = f.getId() as string | number;
        if (!this._featureListeners[newFeatureId] && this._featureInExtent(f)) {
          // eslint-disable-next-line no-void
          void this.addFeature(f);
        }
      }),
    );
  }

  async activate(): Promise<void> {
    if (!this.active) {
      await super.activate();
      if (this.active) {
        this.olLayer!.setVisible(true);
        if (this._featureVisibilityListeners.length === 0) {
          this._featureVisibilityListeners =
            synchronizeFeatureVisibilityWithSource(
              this.featureVisibility,
              this.source,
              this.globalHider,
            );
        }
        this._addSourceListeners();
        this._imageChangedListener = this.map.imageChanged?.addEventListener(
          this._onObliqueImageChanged.bind(this),
        );
        this._fetchFeaturesInView();
      }
    }
  }

  private async addFeature(originalFeature: Feature): Promise<void> {
    if (!this.active) {
      this.fetchedFeaturesForImageName = null;
    }
    if (this.active && this.currentExtent) {
      const id = originalFeature.getId() as string | number;
      const originalGeometry = originalFeature.getGeometry();
      if (originalFeature[doNotTransform]) {
        if (originalGeometry && !this.obliqueSource.getFeatureById(id)) {
          this.obliqueSource.addFeature(originalFeature);
        }
        return Promise.resolve();
      }

      if (this.obliqueSource.getFeatureById(id) || this._updatingOblique[id]) {
        return Promise.resolve();
      }
      const obliqueFeature = new Feature({});
      obliqueFeature.setId(id);
      obliqueFeature[originalFeatureSymbol] = originalFeature;
      setNewGeometry(originalFeature, obliqueFeature);
      obliqueFeature.setStyle(originalFeature.getStyle());

      this._setFeatureListeners(originalFeature, obliqueFeature);

      await this._convertToOblique(originalFeature, obliqueFeature);
      this.obliqueSource.addFeature(obliqueFeature);
    }
    return Promise.resolve();
  }

  private _originalGeometryChanged(
    listeners: Record<string, EventsKey>,
    originalFeature: Feature,
    obliqueFeature: Feature,
  ): void {
    unByKey(listeners.originalGeometryChanged);
    unByKey(listeners.obliqueGeometryChanged);
    setNewGeometry(originalFeature, obliqueFeature);
    this.updateObliqueGeometry(originalFeature, obliqueFeature);
    listeners.originalGeometryChanged = originalFeature
      .getGeometry()!
      .on(
        'change',
        this.updateObliqueGeometry.bind(this, originalFeature, obliqueFeature),
      );
    listeners.obliqueGeometryChanged = obliqueFeature
      .getGeometry()!
      .on(
        'change',
        this.updateMercatorGeometry.bind(this, originalFeature, obliqueFeature),
      );
  }

  private _setFeatureListeners(
    originalFeature: Feature,
    obliqueFeature: Feature,
  ): void {
    const featureId = obliqueFeature.getId() as string | number;
    const listeners = {
      originalFeatureGeometryChanged: originalFeature.on(
        'change:geometry',
        () => {
          const originalGeometry = originalFeature.getGeometry() as Geometry;
          if (originalGeometry[actuallyIsCircle]) {
            unByKey(listeners.originalGeometryChanged);
            listeners.originalGeometryChanged = originalFeature
              .getGeometry()!
              .on('change', () => {
                if (this._updatingMercator[featureId]) {
                  return;
                }
                delete originalGeometry[actuallyIsCircle];
                this._originalGeometryChanged(
                  listeners,
                  originalFeature,
                  obliqueFeature,
                );
              });
            return;
          }
          this._originalGeometryChanged(
            listeners,
            originalFeature,
            obliqueFeature,
          );
        },
      ),
      originalFeatureChanged: originalFeature.on('change', () => {
        obliqueFeature.setStyle(originalFeature.getStyle());
      }),
      originalGeometryChanged: originalFeature
        .getGeometry()!
        .on(
          'change',
          this.updateObliqueGeometry.bind(
            this,
            originalFeature,
            obliqueFeature,
          ),
        ),
      obliqueGeometryChanged: obliqueFeature
        .getGeometry()!
        .on(
          'change',
          this.updateMercatorGeometry.bind(
            this,
            originalFeature,
            obliqueFeature,
          ),
        ),
    };
    this._featureListeners[featureId] = listeners;
  }

  private async _convertToOblique(
    originalFeature: Feature,
    obliqueFeature: Feature,
  ): Promise<void> {
    const id = originalFeature.getId() as string | number;
    const vectorGeometry = originalFeature.getGeometry() as Geometry;
    const imageGeometry = obliqueFeature.getGeometry() as Geometry;
    this._updatingOblique[id] = true;
    let promise: Promise<unknown>;
    if (!vectorGeometry[alreadyTransformedToImage]) {
      promise = mercatorGeometryToImageGeometry(
        vectorGeometry,
        imageGeometry,
        this.map.currentImage as ObliqueImage,
      );
    } else {
      obliqueFeature
        .getGeometry()!
        .setCoordinates(vectorGeometry.getCoordinates());
      // we MUST wait for a promise, otherwise this is sync and you can add a feature twice
      promise = Promise.resolve();
    }
    await promise;
    this._updatingOblique[id] = null;
  }

  updateObliqueGeometry(
    originalFeature: Feature,
    obliqueFeature: Feature,
  ): void {
    const id = originalFeature.getId() as string | number;
    if (this._updatingMercator[id]) {
      return;
    }
    if (this._updatingOblique[id] != null) {
      clearTimeout(this._updatingOblique[id] as number);
    }
    if (originalFeature.getGeometry()?.[alreadyTransformedToImage]) {
      // eslint-disable-next-line no-void
      void this._convertToOblique(originalFeature, obliqueFeature);
    } else {
      this._updatingOblique[id] = setTimeout(() => {
        // eslint-disable-next-line no-void
        void this._convertToOblique(originalFeature, obliqueFeature);
      }, 200);
    }
  }

  updateMercatorGeometry(
    originalFeature: Feature,
    obliqueFeature: Feature,
  ): void {
    const id = originalFeature.getId() as string | number;
    if (this._updatingOblique[id]) {
      return;
    }
    if (this._updatingMercator[id] != null) {
      clearTimeout(this._updatingMercator[id] as number);
    }
    const imageName = this.fetchedFeaturesForImageName;
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this._updatingMercator[id] = setTimeout(async () => {
      const originalGeometry = getPolygonizedGeometry(originalFeature, false);
      if (originalGeometry[actuallyIsCircle]) {
        originalFeature.setGeometry(originalGeometry);
      }
      const imageGeometry = getPolygonizedGeometry(obliqueFeature, true);
      this._updatingMercator[id] = true;
      await imageGeometryToMercatorGeometry(
        imageGeometry,
        originalGeometry,
        this.map.collection!.getImageByName(
          imageName as string,
        ) as ObliqueImage,
      );
      this._updatingMercator[id] = null;
    }, 200);
  }

  /**
   * Synchronizes image Features if the geometry has been changed.
   * also clears source and featureListeners
   */
  private _clearCurrentImage(): void {
    Object.values(this._featureListeners).forEach((listeners) => {
      unByKey(Object.values(listeners));
    });
    this._featureListeners = {};
    this._updatingOblique = {};
    this._updatingMercator = {};
    this.obliqueSource.getFeatures().forEach((f) => {
      const original = f[originalFeatureSymbol];
      if (original) {
        delete original[obliqueGeometry];
        const originalGeometry = original.getGeometry();
        if (originalGeometry?.[alreadyTransformedToImage]) {
          this.updateMercatorGeometry(original, f);
        }
        delete originalGeometry?.[alreadyTransformedToImage];
      }
    });
    this.obliqueSource.clear(true);
    this.fetchedFeaturesForImageName = null;
  }

  /**
   * Fetches the features within the extent of the current image
   * @private
   */
  private _fetchFeaturesInView(): void {
    if (
      this.active &&
      this.map.currentImage &&
      this.fetchedFeaturesForImageName !== this.map.currentImage.name
    ) {
      this.currentExtent = this.map
        .getExtentOfCurrentImage()
        .getCoordinatesInProjection(mercatorProjection);
      this.source.forEachFeatureInExtent(this.currentExtent, (feature) => {
        // eslint-disable-next-line no-void
        void this.addFeature(feature);
      });
      this.source.forEachFeature((feature) => {
        if (feature.getGeometry()?.[alreadyTransformedToImage]) {
          // eslint-disable-next-line no-void
          void this.addFeature(feature);
        }
      });
      this.fetchedFeaturesForImageName = this.map.currentImage.name;
    }
  }

  private removeFeature(feature: Feature): void {
    const feat = this.obliqueSource.getFeatureById(
      feature.getId() as number | string,
    );
    if (feat) {
      const id = feat.getId() as string;
      const listeners = this._featureListeners[id];
      if (listeners) {
        unByKey(Object.values(listeners));
        delete this._featureListeners[id];
      }
      this.obliqueSource.removeFeature(feat);
    }
  }

  deactivate(): void {
    super.deactivate();
    if (this.olLayer) {
      this.olLayer.setVisible(false);
    }

    this._featureVisibilityListeners.forEach((cb) => {
      cb();
    });
    this._featureVisibilityListeners = [];

    unByKey(this._sourceListener);
    this._sourceListener = [];

    if (this._imageChangedListener) {
      this._imageChangedListener();
      this._imageChangedListener = null;
    }

    this._clearCurrentImage();
  }

  destroy(): void {
    if (this.olLayer) {
      this.map.removeOLLayer(this.olLayer);
    }
    this.olLayer = null;

    unByKey(this._sourceListener);
    this._sourceListener = [];

    if (this._imageChangedListener) {
      this._imageChangedListener();
      this._imageChangedListener = null;
    }
    this.obliqueSource.clear(true);
    Object.values(this._updatingOblique).forEach((timer) => {
      if (timer != null) {
        clearTimeout(timer as number);
      }
    });
    Object.values(this._updatingMercator).forEach((timer) => {
      if (timer != null) {
        clearTimeout(timer as number);
      }
    });
    this._clearCurrentImage();
    super.destroy();
  }
}

export default VectorObliqueImpl;
