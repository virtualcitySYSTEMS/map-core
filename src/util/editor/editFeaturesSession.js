import {
  extend as extendExtent,
  createEmpty as createEmptyExtent,
  getCenter,
  isEmpty,
} from 'ol/extent.js';
import { getLogger } from '@vcsuite/logger';

import VcsEvent from '../../vcsEvent.js';
import {
  setupInteractionChain,
  SessionType,
  setupScratchLayer,
} from './editorSessionHelpers.js';
import createTransformationHandler from './transformation/transformationHandler.js';
import { TransformationMode } from './transformation/transformationTypes.js';
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

/**
 * Saves the original allowPicking settings and sets them to false if CTRL is not pressed.
 * @param {import("ol").Feature} feature
 * @param {Map<string|number, boolean|undefined>} allowPickingMap A map containing the original allowPicking settings for the features. Id is key, setting is value.
 * @param {ModificationKeyType} currentModificationKey The modification key that is currently pressed.
 */
function setAllowPicking(feature, allowPickingMap, currentModificationKey) {
  if (!allowPickingMap.has(feature.getId())) {
    allowPickingMap.set(feature.getId(), feature.get('olcs_allowPicking'));
  }
  if (currentModificationKey !== ModificationKeyType.CTRL) {
    feature.set('olcs_allowPicking', false);
  }
}

/**
 * Restores the original allowPicking settings for the feature.
 * @param {import("ol").Feature} feature
 * @param {Map<string|number, boolean|undefined>} allowPickingMap A map containing the original allowPicking settings for the features. Id is key, setting is value.
 */
function clearAllowPicking(feature, allowPickingMap) {
  const allowPicking = allowPickingMap.get(feature.getId());
  if (allowPicking != null) {
    feature.set('olcs_allowPicking', allowPicking);
  } else {
    feature.unset('olcs_allowPicking');
  }
}

/**
 * @typedef {EditorSession} EditFeaturesSession
 * @property {TransformationMode} mode - read only access to the current mode
 * @property {function(number):void} rotate - Function for rotating features. Takes angle in radians as parameter.
 * @property {function(number, number, number):void} translate - Function for translating features. Takes Δx, Δy, Δz as parameters.
 * @property {function(number, number):void} scale - Function for scaling features. Takes sx, sy as parameters.
 * @property {function(TransformationMode):void} setMode
 * @property {import("@vcmap/core").VcsEvent<TransformationMode>} modeChanged
 * @property {function(Array<import("ol").Feature>):void} setFeatures - Sets the features for the edit session.
 * @property {Array<import("ol").Feature>} features - Gets the features of the edit session.
 */

/**
 * Creates an editor session to select, translate, rotate & scale the feature on a given layer
 * @param {import("@vcmap/core").VcsApp} app
 * @param {import("@vcmap/core").VectorLayer} layer
 * @param {string} [interactionId] id for registering mutliple exclusive interaction. Needed to run a selection session at the same time as a edit features session.
 * @param {TransformationMode=} [initialMode=TransformationMode.TRANSLATE]
 * @returns {EditFeaturesSession}
 */
function startEditFeaturesSession(
  app,
  layer,
  interactionId,
  initialMode = TransformationMode.TRANSLATE,
) {
  /**
   * @type {VcsEvent<void>}
   */
  const stopped = new VcsEvent();

  /**
   * The features that are set for the edit session.
   * @type {Array<import("ol").Feature>}
   */
  const currentFeatures = [];

  // The allow picking prop needs to be set false for the selected features to make sure that the transformation handler can always be selected.
  /**
   * @type {Map<string|number, boolean|undefined>}
   */
  const allowPickingMap = new Map();
  let modificationKey;
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
  let destroyTransformation = () => {};
  let transformationHandler;
  const translate = (dx, dy, dz) => {
    transformationHandler?.translate?.(dx, dy, dz);
    currentFeatures.forEach((f) => {
      const geometry = f[obliqueGeometry] ?? f.getGeometry(); // XXX wont work in oblqiue
      geometry.applyTransform((input, output) => {
        const inputLength = input.length;
        for (let i = 0; i < inputLength; i += 3) {
          output[i] = input[i] + dx;
          output[i + 1] = input[i + 1] + dy;
          output[i + 2] = input[i + 2] + dz;
        }
        return output;
      });
    });
  };

  const rotate = (angle) => {
    let center = transformationHandler?.center;
    if (!center) {
      const extent = createEmptyExtent();
      currentFeatures.forEach((f) => {
        extendExtent(extent, f.getGeometry().getExtent()); // XXX wont work in oblqiue
      });
      if (!isEmpty(extent)) {
        center = getCenter(extent);
      }
    }
    currentFeatures.forEach((f) => {
      const geometry = f[obliqueGeometry] ?? f.getGeometry(); // XXX wont work in oblqiue
      geometry.rotate(angle, center);
    });
  };

  const scale = (sx, sy) => {
    let center = transformationHandler?.center;
    if (!center) {
      // XXX copy paste
      const extent = createEmptyExtent();
      currentFeatures.forEach((f) => {
        extendExtent(extent, f.getGeometry().getExtent());
      });
      if (!isEmpty(extent)) {
        center = getCenter(extent);
      }
    }
    currentFeatures.forEach((f) => {
      const geometry = f[obliqueGeometry] ?? f.getGeometry();
      geometry.scale(sx, sy, center);
    });
  };

  const createTransformations = () => {
    destroyTransformation();

    transformationHandler = createTransformationHandler(
      app.maps.activeMap,
      layer,
      scratchLayer,
      mode,
    );
    transformationHandler.setFeatures(currentFeatures);

    let interaction;
    if (mode === TransformationMode.TRANSLATE) {
      interaction = new TranslateInteraction(transformationHandler);
      interaction.translated.addEventListener(([dx, dy, dz]) => {
        translate(dx, dy, dz);
      });
    } else if (mode === TransformationMode.EXTRUDE) {
      interaction = new ExtrudeInteraction(transformationHandler);
      interaction.extruded.addEventListener((dz) => {
        currentFeatures.forEach((f) => {
          ensureFeatureAbsolute(f, layer, app.maps.activeMap);
          let extrudedHeight = f.get('olcs_extrudedHeight') ?? 0;
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
      throw new Error(`Unknown transformation mode ${mode}`);
    }

    interactionChain.addInteraction(interaction);

    destroyTransformation = () => {
      interactionChain.removeInteraction(interaction);
      interaction.destroy();
      transformationHandler?.destroy();
      transformationHandler = null;
    };
  };

  /**
   * @type {VcsEvent<TransformationMode>}
   */
  const modeChanged = new VcsEvent();
  const setMode = (newMode) => {
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
  /**
   * @type {function():void}
   */
  let obliqueImageChangedListener = () => {};
  const mapChanged = (map) => {
    obliqueImageChangedListener();
    if (map instanceof ObliqueMap) {
      obliqueImageChangedListener = map.imageChanged.addEventListener(() => {
        createTransformations();
      });
    } else {
      obliqueImageChangedListener = () => {};
    }
    if (mode === TransformationMode.EXTRUDE && !(map instanceof CesiumMap)) {
      setMode(TransformationMode.TRANSLATE);
    } else {
      createTransformations();
    }
  };
  const mapChangedListener = app.maps.mapActivated.addEventListener(mapChanged);
  mapChanged(app.maps.activeMap);

  const stop = () => {
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
    get mode() {
      return mode;
    },
    modeChanged,
    setMode,
    rotate,
    translate,
    scale,
    setFeatures(features) {
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
    get features() {
      return currentFeatures;
    },
  };
}

export default startEditFeaturesSession;
