import {
  extend as extendExtent,
  createEmpty as createEmptyExtent,
  getCenter,
  isEmpty,
} from 'ol/extent.js';
import type { Feature } from 'ol/index.js';
import { getLogger } from '@vcsuite/logger';

import VcsEvent from '../../vcsEvent.js';
import {
  setupInteractionChain,
  SessionType,
  setupScratchLayer,
  EditorSession,
} from './editorSessionHelpers.js';
import createTransformationHandler from './transformation/transformationHandler.js';
import {
  TransformationHandler,
  TransformationMode,
} from './transformation/transformationTypes.js';
import MapInteractionController from './interactions/mapInteractionController.js';
import TranslateInteraction from './transformation/translateInteraction.js';
import RotateInteraction from './transformation/rotateInteraction.js';
import ScaleInteraction from './transformation/scaleInteraction.js';
import { obliqueGeometry } from '../../layer/vectorSymbols.js';
import ExtrudeInteraction from './transformation/extrudeInteraction.js';
import ObliqueMap from '../../map/obliqueMap.js';
import { ensureFeatureAbsolute } from './editorHelpers.js';
import CesiumMap from '../../map/cesiumMap.js';
import EnsureHandlerSelectionInteraction from './interactions/ensureHandlerSelectionInteraction.js';
import EditFeaturesMouseOverInteraction from './interactions/editFeaturesMouseOverInteraction.js';
import { ModificationKeyType } from '../../interaction/interactionType.js';
import type VcsApp from '../../vcsApp.js';
import type VectorLayer from '../../layer/vectorLayer.js';
import type VcsMap from '../../map/vcsMap.js';

/**
 * Saves the original allowPicking settings and sets them to false if CTRL is not pressed.
 * @param  feature
 * @param  allowPickingMap A map containing the original allowPicking settings for the features. Id is key, setting is value.
 * @param  currentModificationKey The modification key that is currently pressed.
 */
function setAllowPicking(
  feature: Feature,
  allowPickingMap: Map<string | number, boolean | undefined>,
  currentModificationKey: ModificationKeyType,
): void {
  const id = feature.getId() as string | number;
  if (!allowPickingMap.has(id)) {
    allowPickingMap.set(
      id,
      feature.get('olcs_allowPicking') as boolean | undefined,
    );
  }
  if (currentModificationKey !== ModificationKeyType.CTRL) {
    feature.set('olcs_allowPicking', false);
  }
}

/**
 * Restores the original allowPicking settings for the feature.
 * @param  feature
 * @param  allowPickingMap A map containing the original allowPicking settings for the features. Id is key, setting is value.
 */
function clearAllowPicking(
  feature: Feature,
  allowPickingMap: Map<string | number, boolean | undefined>,
): void {
  const allowPicking = allowPickingMap.get(feature.getId() as string | number);
  if (allowPicking != null) {
    feature.set('olcs_allowPicking', allowPicking);
  } else {
    feature.unset('olcs_allowPicking');
  }
}

export type EditFeaturesSession = EditorSession & {
  readonly mode: TransformationMode;
  /**
   * Function for rotating features. Takes angle in radians as parameter.
   * @param angle - in radians
   */
  rotate(angle: number): void;
  translate(dx: number, dy: number, dz: number): void;
  scale(sx: number, sy: number): void;
  setMode(mode: TransformationMode): void;
  modeChanged: VcsEvent<TransformationMode>;
  setFeatures(features: Feature[]): void;
  features: Feature[];
};

/**
 * Creates an editor session to select, translate, rotate & scale the feature on a given layer
 * @param  app
 * @param  layer
 * @param  [interactionId] id for registering mutliple exclusive interaction. Needed to run a selection session at the same time as a edit features session.
 * @param  [initialMode=TransformationMode.TRANSLATE]
 */
function startEditFeaturesSession(
  app: VcsApp,
  layer: VectorLayer,
  interactionId?: string,
  initialMode = TransformationMode.TRANSLATE,
): EditFeaturesSession {
  const stopped = new VcsEvent<void>();

  /**
   * The features that are set for the edit session.
   */
  const currentFeatures: Feature[] = [];

  // The allow picking prop needs to be set false for the selected features to make sure that the transformation handler can always be selected.
  const allowPickingMap: Map<string | number, boolean | undefined> = new Map();
  let modificationKey: ModificationKeyType;
  /** Callback to remove the modifier changed listener. */
  const modifierChangedListener =
    app.maps.eventHandler.modifierChanged.addEventListener((mod) => {
      // CTRL is used to modify the current selection set, we must allow picking again so you can deselect a feature
      modificationKey = mod;
      const allowPicking = modificationKey === ModificationKeyType.CTRL;
      currentFeatures.forEach((feature) => {
        feature.set('olcs_allowPicking', allowPicking);
      });
    });

  const scratchLayer = setupScratchLayer(app.layers);

  const {
    interactionChain,
    removed: interactionRemoved,
    destroy: destroyInteractionChain,
  } = setupInteractionChain(app.maps.eventHandler, interactionId);

  const mouseOverInteraction = new EditFeaturesMouseOverInteraction();
  interactionChain.addInteraction(mouseOverInteraction);

  interactionChain.addInteraction(
    new EnsureHandlerSelectionInteraction(currentFeatures),
  );

  const mapInteractionController = new MapInteractionController();
  interactionChain.addInteraction(mapInteractionController);

  let mode = initialMode;
  let destroyTransformation = (): void => {};
  let transformationHandler: TransformationHandler | undefined;
  const translate = (dx: number, dy: number, dz: number): void => {
    transformationHandler?.translate?.(dx, dy, dz);
    currentFeatures.forEach((f) => {
      const geometry = f[obliqueGeometry] ?? f.getGeometry(); // XXX wont work in oblqiue
      geometry!.applyTransform(
        (input: number[], output: number[] | undefined): number[] => {
          const inputLength = input.length;
          for (let i = 0; i < inputLength; i += 3) {
            output![i] = input[i] + dx;
            output![i + 1] = input[i + 1] + dy;
            output![i + 2] = input[i + 2] + dz;
          }
          return output!;
        },
      );
    });
  };

  const rotate = (angle: number): void => {
    let center = transformationHandler?.center;
    if (!center) {
      const extent = createEmptyExtent();
      currentFeatures.forEach((f) => {
        extendExtent(extent, f.getGeometry()!.getExtent()); // XXX wont work in oblqiue
      });
      if (!isEmpty(extent)) {
        center = getCenter(extent);
      }
    }
    currentFeatures.forEach((f) => {
      const geometry = f[obliqueGeometry] ?? f.getGeometry(); // XXX wont work in oblqiue
      geometry!.rotate(angle, center!);
    });
  };

  const scale = (sx: number, sy: number): void => {
    let center = transformationHandler?.center;
    if (!center) {
      // XXX copy paste
      const extent = createEmptyExtent();
      currentFeatures.forEach((f) => {
        extendExtent(extent, f.getGeometry()!.getExtent());
      });
      if (!isEmpty(extent)) {
        center = getCenter(extent);
      }
    }
    currentFeatures.forEach((f) => {
      const geometry = f[obliqueGeometry] ?? f.getGeometry();
      geometry!.scale(sx, sy, center);
    });
  };

  const createTransformations = (): void => {
    destroyTransformation();

    transformationHandler = createTransformationHandler(
      app.maps.activeMap!,
      layer,
      scratchLayer,
      mode,
    );
    transformationHandler.setFeatures(currentFeatures);

    let interaction:
      | TranslateInteraction
      | ExtrudeInteraction
      | RotateInteraction
      | ScaleInteraction;
    if (mode === TransformationMode.TRANSLATE) {
      interaction = new TranslateInteraction(transformationHandler);
      interaction.translated.addEventListener(([dx, dy, dz]) => {
        translate(dx, dy, dz);
      });
    } else if (mode === TransformationMode.EXTRUDE) {
      interaction = new ExtrudeInteraction(transformationHandler);
      interaction.extruded.addEventListener((dz) => {
        currentFeatures.forEach((f) => {
          // eslint-disable-next-line no-void
          void ensureFeatureAbsolute(f, layer, app.maps.activeMap as CesiumMap);
          let extrudedHeight =
            (f.get('olcs_extrudedHeight') as number | undefined) ?? 0;
          extrudedHeight += dz;
          f.set('olcs_extrudedHeight', extrudedHeight);
        });
      });
    } else if (mode === TransformationMode.ROTATE) {
      interaction = new RotateInteraction(transformationHandler);
      interaction.rotated.addEventListener(({ angle }) => {
        rotate(angle);
      });
    } else if (mode === TransformationMode.SCALE) {
      interaction = new ScaleInteraction(transformationHandler);
      interaction.scaled.addEventListener(([sx, sy]) => {
        scale(sx, sy);
      });
    } else {
      throw new Error(`Unknown transformation mode ${String(mode)}`);
    }

    interactionChain.addInteraction(interaction);

    destroyTransformation = (): void => {
      interactionChain.removeInteraction(interaction);
      interaction.destroy();
      transformationHandler?.destroy();
      transformationHandler = undefined;
    };
  };

  const modeChanged = new VcsEvent<TransformationMode>();
  const setMode = (newMode: TransformationMode): void => {
    if (newMode !== mode) {
      if (
        newMode === TransformationMode.EXTRUDE &&
        !(app.maps.activeMap instanceof CesiumMap)
      ) {
        getLogger('EditFeaturesSession').warning(
          'Cannot set extrude mode if map is not a CesiumMap',
        );
      } else {
        mode = newMode;
        createTransformations();
        modeChanged.raiseEvent(mode);
      }
    }
  };

  let obliqueImageChangedListener = (): void => {};
  const mapChanged = (map: VcsMap): void => {
    obliqueImageChangedListener();
    if (map instanceof ObliqueMap) {
      obliqueImageChangedListener =
        map.imageChanged?.addEventListener(() => {
          createTransformations();
        }) ?? ((): void => {});
    } else {
      obliqueImageChangedListener = (): void => {};
    }
    if (mode === TransformationMode.EXTRUDE && !(map instanceof CesiumMap)) {
      setMode(TransformationMode.TRANSLATE);
    } else {
      createTransformations();
    }
  };
  const mapChangedListener = app.maps.mapActivated.addEventListener(mapChanged);
  mapChanged(app.maps.activeMap!);

  const stop = (): void => {
    destroyTransformation();
    destroyInteractionChain();
    obliqueImageChangedListener();
    mapChangedListener();
    modifierChangedListener();
    currentFeatures.forEach((feature) =>
      clearAllowPicking(feature, allowPickingMap),
    );
    allowPickingMap.clear();
    app.layers.remove(scratchLayer);
    modeChanged.destroy();
    stopped.raiseEvent();
    stopped.destroy();
  };

  interactionRemoved.addEventListener(stop);

  return {
    type: SessionType.EDIT_FEATURES,
    stopped,
    stop,
    get mode(): TransformationMode {
      return mode;
    },
    modeChanged,
    setMode,
    rotate,
    translate,
    scale,
    setFeatures(features: Feature[]): void {
      currentFeatures.forEach((feature) =>
        clearAllowPicking(feature, allowPickingMap),
      );
      currentFeatures.length = 0;
      currentFeatures.push(...features);
      currentFeatures.forEach((feature) =>
        setAllowPicking(feature, allowPickingMap, modificationKey),
      );
      transformationHandler?.setFeatures(features);
    },
    get features(): Feature[] {
      return currentFeatures;
    },
  };
}

export default startEditFeaturesSession;
