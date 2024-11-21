import { getLogger } from '@vcsuite/logger';
import { unByKey } from 'ol/Observable.js';
import type VectorSource from 'ol/source/Vector.js';
import type { Feature } from 'ol';
import { StyleLike } from 'ol/style/Style.js';
import type { Scene } from '@vcmap-cesium/engine';
import type VectorContext from './vectorContext.js';
import type ClusterContext from './clusterContext.js';
import VectorProperties from '../vectorProperties.js';

export type SourceVectorContextSync = {
  readonly active: boolean;
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
 * @param vectorProperties
 */
export function createSourceVectorContextSync(
  source: VectorSource,
  context: VectorContext | ClusterContext,
  scene: Scene,
  style: StyleLike,
  vectorProperties: VectorProperties,
): SourceVectorContextSync {
  const featureToAdd = new Set<Feature>();
  let active = false;
  const addFeature = async (feature: Feature): Promise<void> => {
    if (active) {
      // XXX cluster check here? or on init?
      await context.addFeature(feature, style, vectorProperties, scene);
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

  const refresh = (): void => {
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

  const removeVectorPropertiesChangeHandler =
    vectorProperties.propertyChanged.addEventListener(refresh);

  addFeatures(source.getFeatures());

  return {
    get active(): boolean {
      return active;
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
      removeVectorPropertiesChangeHandler();
    },
  };
}
