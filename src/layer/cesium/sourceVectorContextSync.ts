import { getLogger } from '@vcsuite/logger';
import { unByKey } from 'ol/Observable.js';
import type VectorSource from 'ol/source/Vector.js';
import type { Feature } from 'ol';
import { StyleLike } from 'ol/style/Style.js';
import type { Scene } from '@vcmap-cesium/engine';
import type VectorContext from './vectorContext.js';
import type VectorClusterCesiumContext from '../../vectorCluster/vectorClusterCesiumContext.js';
import VectorProperties from '../vectorProperties.js';

export type SourceVectorContextSync = {
  readonly active: boolean;
  /**
   * The style used for the features in the source that do not have their own style.
   */
  readonly style: StyleLike;
  /**
   * Sets the style for the context.
   * Setting this will trigger a refresh of the context unless silent is set to true.
   * @param style
   * @param silent - optional flag to not trigger a refresh
   */
  setStyle(style: StyleLike, silent?: boolean): void;
  activate(): void;
  deactivate(): void;
  /**
   * Clears the context and adds all features from the source.
   */
  refresh(): void;
  destroy(): void;
};

/**
 * Creates a SourceVectorContextSync. This ensures that the features in the source are synced to the context.
 * Adding, removing and changing features in the source will be reflected in the context.
 * @param source
 * @param context
 * @param scene
 * @param style
 * @param vectorProperties - the vector properties or a function returning vector properties for a feature
 */
export function createSourceVectorContextSync(
  source: VectorSource,
  context: VectorContext | VectorClusterCesiumContext,
  scene: Scene,
  style: StyleLike,
  vectorProperties: VectorProperties | ((f: Feature) => VectorProperties),
): SourceVectorContextSync {
  const featureToAdd = new Set<Feature>();
  let active = false;
  let layerStyle = style;
  const vectorPropertiesChanged = new Map<VectorProperties, () => void>();
  const getVectorProperties =
    typeof vectorProperties === 'function'
      ? vectorProperties
      : (): VectorProperties => vectorProperties;

  let refresh: () => void;
  const addFeature = async (feature: Feature): Promise<void> => {
    const featureVectorProperties = getVectorProperties(feature);
    if (!vectorPropertiesChanged.has(featureVectorProperties)) {
      vectorPropertiesChanged.set(
        featureVectorProperties,
        featureVectorProperties.propertyChanged.addEventListener(refresh),
      );
    }

    if (active) {
      await context.addFeature(
        feature,
        layerStyle,
        featureVectorProperties,
        scene,
      );
    } else {
      featureToAdd.add(feature);
    }
  };

  const removeFeature = (feature: Feature): void => {
    context.removeFeature(feature);
    featureToAdd.delete(feature);
  };

  const featureChanged = async (feature: Feature): Promise<void> => {
    featureToAdd.delete(feature);
    await addFeature(feature);
  };

  const addFeatures = (features: Feature[]): void => {
    // TODO we should make this non-blocking to better handle larger data sets check in RIWA Impl
    features.forEach((f) => {
      addFeature(f).catch((err) => {
        getLogger('SourceVectorContextSync').error(
          'failed to convert feature',
          f,
          err,
        );
      });
    });
  };

  const addCachedFeatures = (): void => {
    addFeatures([...featureToAdd]);
    featureToAdd.clear();
  };

  refresh = (): void => {
    context.clear();
    addFeatures(source.getFeatures());
  };

  const olListeners = [
    source.on('addfeature', (event) => {
      addFeature(event.feature as Feature).catch(() => {
        getLogger().error('failed to convert feature');
      });
    }),
    source.on('removefeature', (event) => {
      removeFeature(event.feature as Feature);
    }),
    source.on('changefeature', (event) => {
      featureChanged(event.feature as Feature).catch((_e) => {
        getLogger().error('failed to convert feature');
      });
    }),
  ];

  addFeatures(source.getFeatures());

  return {
    get active(): boolean {
      return active;
    },
    get style(): StyleLike {
      return layerStyle;
    },
    setStyle(newStyle: StyleLike, silent?: boolean): void {
      if (newStyle !== layerStyle) {
        layerStyle = newStyle;
        if (!silent) {
          refresh();
        }
      }
    },
    activate(): void {
      active = true;
      addCachedFeatures();
    },
    deactivate(): void {
      active = false;
    },
    refresh,
    destroy(): void {
      unByKey(olListeners);
      vectorPropertiesChanged.forEach((removeListener) => {
        removeListener();
      });
      vectorPropertiesChanged.clear();
    },
  };
}
