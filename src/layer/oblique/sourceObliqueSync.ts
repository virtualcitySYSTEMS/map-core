import { getLogger } from '@vcsuite/logger';
import VectorSource from 'ol/source/Vector.js';
import { unByKey } from 'ol/Observable.js';
import { Feature } from 'ol';
import type { Extent as OLExtent } from 'ol/extent.js';
import type { Geometry } from 'ol/geom.js';
import type { EventsKey } from 'ol/events.js';
import type ObliqueMap from '../../map/obliqueMap.js';
import {
  actuallyIsCircle,
  alreadyTransformedToImage,
  doNotTransform,
  obliqueGeometry,
  originalFeatureSymbol,
} from '../vectorSymbols.js';
import {
  getPolygonizedGeometry,
  imageGeometryToMercatorGeometry,
  mercatorGeometryToImageGeometry,
  setNewGeometry,
} from './obliqueHelpers.js';
import type ObliqueImage from '../../oblique/obliqueImage.js';
import { mercatorProjection } from '../../util/projection.js';

export type SourceObliqueSync = {
  readonly active: boolean;
  readonly obliqueSource: VectorSource;
  activate(): void;
  deactivate(): void;
  destroy(): void;
};

type UpdatingTimeouts = Record<
  string | number,
  number | boolean | null | NodeJS.Timeout
>;

type FeatureListeners = {
  originalFeatureGeometryChanged: EventsKey;
  originalFeatureChanged: EventsKey;
  originalGeometryChanged: EventsKey;
  obliqueGeometryChanged: EventsKey;
};

function featureInExtent(feature: Feature, extent?: OLExtent): boolean {
  if (extent) {
    const geometry = feature.getGeometry();
    if (geometry) {
      return (
        geometry[alreadyTransformedToImage] || geometry.intersectsExtent(extent)
      );
    }
  }
  return false;
}

function createFeatureListener(
  originalFeature: Feature,
  obliqueFeature: Feature,
  updatingMercator: UpdatingTimeouts,
  updateObliqueGeometry: (
    originalFeature: Feature,
    obliqueFeature: Feature,
  ) => void,
  updateMercatorGeometry: (
    originalFeature: Feature,
    obliqueFeature: Feature,
  ) => void,
): () => void {
  const featureId = obliqueFeature.getId() as string | number;

  const originalGeometryChanged = (listeners: FeatureListeners): void => {
    unByKey(listeners.originalGeometryChanged);
    unByKey(listeners.obliqueGeometryChanged);
    setNewGeometry(originalFeature, obliqueFeature);
    updateObliqueGeometry(originalFeature, obliqueFeature);
    listeners.originalGeometryChanged = originalFeature
      .getGeometry()!
      .on('change', () => {
        updateObliqueGeometry(originalFeature, obliqueFeature);
      });
    listeners.obliqueGeometryChanged = obliqueFeature
      .getGeometry()!
      .on('change', () => {
        updateMercatorGeometry(originalFeature, obliqueFeature);
      });
  };

  const listeners: FeatureListeners = {
    originalFeatureGeometryChanged: originalFeature.on(
      'change:geometry',
      () => {
        const originalGeometry = originalFeature.getGeometry() as Geometry;
        if (originalGeometry[actuallyIsCircle]) {
          unByKey(listeners.originalGeometryChanged);
          listeners.originalGeometryChanged = originalFeature
            .getGeometry()!
            .on('change', () => {
              if (updatingMercator[featureId]) {
                return;
              }
              delete originalGeometry[actuallyIsCircle];
              originalGeometryChanged(listeners);
            });
          return;
        }
        originalGeometryChanged(listeners);
      },
    ),
    originalFeatureChanged: originalFeature.on('change', () => {
      obliqueFeature.setStyle(originalFeature.getStyle());
    }),
    originalGeometryChanged: originalFeature.getGeometry()!.on('change', () => {
      updateObliqueGeometry(originalFeature, obliqueFeature);
    }),
    obliqueGeometryChanged: obliqueFeature.getGeometry()!.on('change', () => {
      updateMercatorGeometry(originalFeature, obliqueFeature);
    }),
  };

  return () => {
    unByKey(Object.values(listeners));
  };
}

function clearUpdatingTimeouts(timeouts: UpdatingTimeouts): void {
  Object.values(timeouts).forEach((timeout) => {
    if (typeof timeout !== 'boolean') {
      clearTimeout(timeout as number);
    }
  });
}

/**
 * Creates a SourceObliqueSync. This ensures that the features in the source are synced to the oblique source.
 * Adding, removing and changing features in the source will be reflected in the oblique source. Changing the oblique geometry will
 * be synced back onto the original geometry. Changing the geometry will create a new oblique geometry on the same feature.
 * Feature changes will lead to an update of style.
 * @param source
 * @param map
 */
export function createSourceObliqueSync(
  source: VectorSource,
  map: ObliqueMap,
): SourceObliqueSync {
  const obliqueSource = new VectorSource();
  let active = false;
  let sourceListeners = (): void => {};
  let imageChangedListener: (() => void) | undefined;
  const featureListeners = new Map<string | number, () => void>();

  let updatingMercator: UpdatingTimeouts = {};
  let updatingOblique: UpdatingTimeouts = {};

  // the extent of the current image
  let currentExtent: OLExtent | undefined;

  let currentImageName: string | undefined;

  const convertToOblique = async (
    originalFeature: Feature,
    obliqueFeature: Feature,
  ): Promise<void> => {
    const id = originalFeature.getId()!;
    const vectorGeometry = originalFeature.getGeometry() as Geometry;
    const imageGeometry = obliqueFeature.getGeometry() as Geometry;
    updatingOblique[id] = true;
    let promise: Promise<unknown>;
    if (!vectorGeometry[alreadyTransformedToImage]) {
      promise = mercatorGeometryToImageGeometry(
        vectorGeometry,
        imageGeometry,
        map.currentImage as ObliqueImage,
      );
    } else {
      obliqueFeature
        .getGeometry()!
        .setCoordinates(vectorGeometry.getCoordinates());
      // we MUST wait for a promise, otherwise this is sync and you can add a feature twice
      promise = Promise.resolve();
    }
    await promise;
    updatingOblique[id] = null;
  };

  const updateObliqueGeometry = (
    originalFeature: Feature,
    obliqueFeature: Feature,
  ): void => {
    const id = originalFeature.getId()!;
    if (updatingMercator[id]) {
      return;
    }
    if (updatingOblique[id] != null) {
      clearTimeout(updatingOblique[id] as number);
    }
    if (originalFeature.getGeometry()?.[alreadyTransformedToImage]) {
      convertToOblique(originalFeature, obliqueFeature)
        .catch(() => {
          getLogger('SourceObliqueSync').warning(
            `Failed to convert feature with id ${id} to oblique`,
          );
        })
        .finally(() => {
          updatingOblique[id] = null;
        });
    } else {
      updatingOblique[id] = setTimeout(() => {
        convertToOblique(originalFeature, obliqueFeature)
          .catch(() => {
            getLogger('SourceObliqueSync').warning(
              `Failed to convert feature with id ${id} to oblique`,
            );
          })
          .finally(() => {
            updatingOblique[id] = null;
          });
      }, 200);
    }
  };

  const updateMercatorGeometry = (
    originalFeature: Feature,
    obliqueFeature: Feature,
  ): void => {
    const id = originalFeature.getId() as string | number;
    if (updatingOblique[id]) {
      return;
    }
    if (updatingMercator[id] != null) {
      clearTimeout(updatingMercator[id] as number);
    }
    const imageName = currentImageName;
    updatingMercator[id] = setTimeout(() => {
      const originalGeometry = getPolygonizedGeometry(originalFeature, false);
      if (originalGeometry[actuallyIsCircle]) {
        originalFeature.setGeometry(originalGeometry);
      }
      const imageGeometry = getPolygonizedGeometry(obliqueFeature, true);
      updatingMercator[id] = true;
      imageGeometryToMercatorGeometry(
        imageGeometry,
        originalGeometry,
        map.collection!.getImageByName(imageName as string) as ObliqueImage,
      )
        .catch(() => {
          getLogger('SourceObliqueSync').warning(
            `Failed to update feature with id ${id} mercator geometry`,
          );
        })
        .finally(() => {
          updatingMercator[id] = null;
        });
    }, 200);
  };

  const addFeature = async (originalFeature: Feature): Promise<void> => {
    if (!active) {
      currentImageName = undefined;
    } else if (currentExtent) {
      const id = originalFeature.getId()!;
      const originalGeometry = originalFeature.getGeometry();
      if (originalFeature[doNotTransform]) {
        if (originalGeometry && !obliqueSource.getFeatureById(id)) {
          obliqueSource.addFeature(originalFeature);
        }
        return;
      }

      if (obliqueSource.getFeatureById(id) || updatingOblique[id] != null) {
        return;
      }
      const obliqueFeature = new Feature({});
      obliqueFeature.setId(id);
      obliqueFeature[originalFeatureSymbol] = originalFeature;
      setNewGeometry(originalFeature, obliqueFeature);
      obliqueFeature.setStyle(originalFeature.getStyle());

      const featureListener = createFeatureListener(
        originalFeature,
        obliqueFeature,
        updatingMercator,
        updateObliqueGeometry,
        updateMercatorGeometry,
      );

      await convertToOblique(originalFeature, obliqueFeature);
      if (source.hasFeature(originalFeature)) {
        // if not in source, feature has been removed in between.
        obliqueSource.addFeature(obliqueFeature);
        featureListeners.set(id, featureListener);
      } else {
        featureListener();
      }
    }
  };

  const removeFeature = (feature: Feature): void => {
    const id = feature.getId()!;
    const feat = obliqueSource.getFeatureById(id);
    if (updatingOblique[id] != null) {
      clearTimeout(updatingOblique[id] as number);
      updatingOblique[id] = null;
    }
    if (feat) {
      featureListeners.get(id)?.();
      featureListeners.delete(id);
      obliqueSource.removeFeature(feat);
    }
  };

  const setSourceListeners = (): void => {
    sourceListeners();
    const listeners = [
      source.on('addfeature', (event) => {
        const f = event.feature as Feature;
        if (featureInExtent(f, currentExtent)) {
          addFeature(f).catch(() => {
            getLogger('SourceObliqueSync').warning(
              `Failed to add feature with id ${f.getId()!} to oblique source`,
            );
          });
        }
      }),
      source.on('removefeature', (event) => {
        removeFeature(event.feature as Feature);
      }),
      source.on('changefeature', (event) => {
        const f = event.feature as Feature;
        const newFeatureId = f.getId()!;
        if (
          !featureListeners.has(newFeatureId) &&
          featureInExtent(f, currentExtent)
        ) {
          addFeature(f).catch(() => {
            getLogger('SourceObliqueSync').warning(
              `Failed to add feature with id ${newFeatureId} to oblique source`,
            );
          });
        }
      }),
    ];
    sourceListeners = (): void => {
      unByKey(listeners);
    };
  };

  const fetchFeaturesInView = (): void => {
    if (
      active &&
      map.currentImage &&
      currentImageName !== map.currentImage.name
    ) {
      currentExtent = map
        .getExtentOfCurrentImage()
        .getCoordinatesInProjection(mercatorProjection);
      source.forEachFeatureInExtent(currentExtent, (feature) => {
        addFeature(feature).catch(() => {
          getLogger('SourceObliqueSync').warning(
            `Failed to add feature with id ${feature.getId()!} to oblique source`,
          );
        });
      });
      source.forEachFeature((feature) => {
        if (feature.getGeometry()?.[alreadyTransformedToImage]) {
          addFeature(feature).catch(() => {
            getLogger('SourceObliqueSync').warning(
              `Failed to add feature with id ${feature.getId()!} to oblique source`,
            );
          });
        }
      });
      currentImageName = map.currentImage.name;
    }
  };

  const clearCurrentImage = (): void => {
    featureListeners.forEach((listener): void => {
      listener();
    });
    featureListeners.clear();
    clearUpdatingTimeouts(updatingOblique);
    clearUpdatingTimeouts(updatingMercator);
    updatingOblique = {};
    updatingMercator = {};
    obliqueSource.getFeatures().forEach((f) => {
      const original = f[originalFeatureSymbol];
      if (original) {
        delete original[obliqueGeometry];
        const originalGeometry = original.getGeometry();
        if (originalGeometry?.[alreadyTransformedToImage]) {
          updateMercatorGeometry(original, f);
        }
        delete originalGeometry?.[alreadyTransformedToImage];
      }
    });
    obliqueSource.clear(true);
    currentImageName = undefined;
    currentExtent = undefined;
  };

  const activate = (): void => {
    active = true;
    setSourceListeners();
    imageChangedListener = map.imageChanged?.addEventListener(() => {
      clearCurrentImage();
      fetchFeaturesInView();
    });
    fetchFeaturesInView();
  };

  const deactivate = (): void => {
    active = false;
    imageChangedListener?.();
    sourceListeners();
    clearCurrentImage();
  };

  const destroy = (): void => {
    obliqueSource.clear(true);
    obliqueSource.dispose();
    clearCurrentImage();
  };

  return {
    get active(): boolean {
      return active;
    },
    get obliqueSource(): VectorSource {
      return obliqueSource;
    },
    activate,
    deactivate,
    destroy,
  };
}
