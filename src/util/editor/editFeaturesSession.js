import { Circle, Fill, Style, Stroke } from 'ol/style.js';
import { getLogger } from '@vcsuite/logger';

import VcsEvent from '../../vcsEvent.js';
import { SessionType, setupInteractionChain, setupScratchLayer } from './editorSessionHelpers.js';
import SelectMultiFeatureInteraction from './interactions/selectMultiFeatureInteraction.js';
import EditFeaturesMouseOverInteraction from './interactions/editFeaturesMouseOverInteraction.js';
import createTransformationHandler from './transformation/transformationHandler.js';
import { TransformationMode } from './transformation/transformationTypes.js';
import MapInteractionController from './interactions/mapInteractionController.js';
import TranslateInteraction from './transformation/translateInteraction.js';
import RotateInteraction from './transformation/rotateInteraction.js';
import ScaleInteraction from './transformation/scaleInteraction.js';
import { createSync, obliqueGeometry } from '../../layer/vectorSymbols.js';
import ExtrudeInteraction from './transformation/extrudeInteraction.js';
import { ModificationKeyType } from '../../interaction/interactionType.js';
import ObliqueMap from '../../map/obliqueMap.js';
import { ensureFeatureAbsolute } from './editorHelpers.js';
import CesiumMap from '../../map/cesiumMap.js';
import EnsureHandlerSelectionInteraction from './interactions/ensureHandlerSelectionInteraction.js';

/**
 * @typedef {EditorSession} EditFeaturesSession
 * @property {SelectMultiFeatureInteraction} featureSelection
 * @property {TransformationMode} mode - read only access to the current mode
 * @property {function(TransformationMode):void} setMode
 * @property {import("@vcmap/core").VcsEvent<TransformationMode>} modeChanged
 */

/**
 * Creates a selection set from the selected features. This maintains `createSync` symbol, highlight and allow picking on
 * currently selected features and listens to changes until stopped.
 * @param {import("@vcmap/core").VectorLayer} layer
 * @param {SelectMultiFeatureInteraction} selectFeatureInteraction
 * @param {import("ol/style").Style} highlightStyle
 * @param {import("@vcmap/core").EventHandler} eventHandler
 * @returns {function():void} un-highlight all and stop listening to changes
 */
function createSelectionSet(layer, selectFeatureInteraction, highlightStyle, eventHandler) {
  let currentIds = new Set();
  /** @type {Map<string|number, boolean|undefined>} */
  const allowPickingMap = new Map();
  const modifierChangedListener = eventHandler.modifierChanged.addEventListener((mod) => { // CTRL is used to modify the current selection set, we must allow picking again so you can deselect a feature
    const allowPicking = mod === ModificationKeyType.CTRL;
    selectFeatureInteraction.selectedFeatures.forEach((f) => { f.set('olcs_allowPicking', allowPicking); });
  });

  const clearFeature = (f) => {
    delete f[createSync];
    const allowPicking = allowPickingMap.get(f.getId());
    if (allowPicking != null) {
      f.set('olcs_allowPicking', allowPicking);
    } else {
      f.unset('olcs_allowPicking');
    }
  };

  const featureChangedListener = selectFeatureInteraction.featuresChanged.addEventListener((newFeatures) => {
    const newIds = new Set(newFeatures.map((f) => {
      const id = f.getId();
      if (!allowPickingMap.has(id)) {
        allowPickingMap.set(id, f.get('olcs_allowPicking'));
      }
      f[createSync] = true;
      f.set('olcs_allowPicking', false);
      return id;
    }));
    const idsToHighlight = [];
    newIds.forEach((id) => {
      if (!currentIds.has(id)) {
        idsToHighlight.push(id);
      }
    });

    const idsToUnHighlight = [];
    currentIds.forEach((id) => {
      if (!newIds.has(id)) {
        idsToUnHighlight.push(id);
      }
    });

    layer.featureVisibility.unHighlight(idsToUnHighlight);
    layer.featureVisibility.highlight(Object.fromEntries(idsToHighlight.map(id => [id, highlightStyle])));
    layer.getFeaturesById(idsToUnHighlight)
      .forEach(clearFeature);

    currentIds = newIds;
  });

  return () => {
    modifierChangedListener();
    featureChangedListener();
    if (currentIds.size > 0) {
      const idsToUnHighlight = [...currentIds];
      layer.getFeaturesById(idsToUnHighlight)
        .forEach(clearFeature);
      layer.featureVisibility.unHighlight(idsToUnHighlight);
    }
  };
}

/**
 * @returns {import("ol/style").Style}
 */
function getDefaultHighlightStyle() {
  const fill = new Fill({ color: 'rgba(76,175,80,0.2)' });
  const stroke = new Stroke({ color: '#4CAF50', width: 2 });

  return new Style({
    fill,
    stroke,
    image: new Circle({
      fill,
      stroke,
      radius: 14,
    }),
  });
}

/**
 * Creates an editor session to select, translate, rotate & scale the feature on a given layer
 * @param {import("@vcmap/core").VcsApp} app
 * @param {import("@vcmap/core").VectorLayer} layer
 * @param {TransformationMode=} [initialMode=TransformationMode.TRANSLATE]
 * @param {import("ol/style").Style=} [highlightStyle]
 * @returns {EditFeaturesSession}
 */
function startEditFeaturesSession(
  app,
  layer,
  initialMode = TransformationMode.TRANSLATE,
  highlightStyle = getDefaultHighlightStyle(),
) {
  const scratchLayer = setupScratchLayer(app.layers);
  /** @type {VcsEvent<void>} */
  const stopped = new VcsEvent();
  const {
    interactionChain,
    removed: interactionRemoved,
    destroy: destroyInteractionChain,
  } = setupInteractionChain(app.maps.eventHandler);
  const selectFeatureInteraction = new SelectMultiFeatureInteraction(layer);
  const destroySelectionSet = createSelectionSet(
    layer,
    selectFeatureInteraction,
    highlightStyle,
    app.maps.eventHandler,
  );
  interactionChain.addInteraction(selectFeatureInteraction);
  interactionChain.addInteraction(new EnsureHandlerSelectionInteraction(selectFeatureInteraction));

  const mapInteractionController = new MapInteractionController();
  interactionChain.addInteraction(mapInteractionController);

  const mouseOverInteraction = new EditFeaturesMouseOverInteraction(
    layer.name,
    selectFeatureInteraction,
  );
  interactionChain.addInteraction(mouseOverInteraction);

  let mode = initialMode;
  let destroyTransformation = () => {};
  const createTransformations = () => {
    destroyTransformation();
    const transformationHandler = createTransformationHandler(
      app.maps.activeMap,
      layer,
      selectFeatureInteraction,
      scratchLayer,
      mode,
    );

    let interaction;
    if (mode === TransformationMode.TRANSLATE) {
      interaction = new TranslateInteraction(transformationHandler);
      interaction.translated.addEventListener(([dx, dy, dz]) => {
        transformationHandler.translate(dx, dy, dz);
        selectFeatureInteraction.selectedFeatures.forEach((f) => {
          const geometry = f[obliqueGeometry] ?? f.getGeometry();
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
      });
    } else if (mode === TransformationMode.EXTRUDE) {
      interaction = new ExtrudeInteraction(transformationHandler);
      interaction.extruded.addEventListener((dz) => {
        selectFeatureInteraction.selectedFeatures.forEach((f) => {
          ensureFeatureAbsolute(f, layer, app.maps.activeMap);
          let extrudedHeight = f.get('olcs_extrudedHeight') ?? 0;
          extrudedHeight += dz;
          f.set('olcs_extrudedHeight', extrudedHeight);
        });
      });
    } else if (mode === TransformationMode.ROTATE) {
      interaction = new RotateInteraction(transformationHandler);
      interaction.rotated.addEventListener(({ angle }) => {
        const { center } = transformationHandler;
        selectFeatureInteraction.selectedFeatures.forEach((f) => {
          const geometry = f[obliqueGeometry] ?? f.getGeometry();
          geometry.rotate(angle, center);
        });
      });
    } else if (mode === TransformationMode.SCALE) {
      interaction = new ScaleInteraction(transformationHandler);
      interaction.scaled.addEventListener(([sx, sy]) => {
        const { center } = transformationHandler;
        selectFeatureInteraction.selectedFeatures.forEach((f) => {
          const geometry = f[obliqueGeometry] ?? f.getGeometry();
          geometry.scale(sx, sy, center);
        });
      });
    } else {
      throw new Error(`Unknown transformation mode ${mode}`);
    }

    interactionChain.addInteraction(interaction);

    destroyTransformation = () => {
      interactionChain.removeInteraction(interaction);
      interaction.destroy();
      transformationHandler.destroy();
    };
  };

  /**
   * @type {VcsEvent<TransformationMode>}
   */
  const modeChanged = new VcsEvent();
  const setMode = (newMode) => {
    if (newMode !== mode) {
      if (newMode === TransformationMode.EXTRUDE && !(app.maps.activeMap instanceof CesiumMap)) {
        getLogger('EditFeaturesSession').warning('Cannot set extrude mode if map is not a CesiumMap');
      } else {
        mode = newMode;
        createTransformations();
        modeChanged.raiseEvent(mode);
      }
    }
  };
  /**
   * @type {ObliqueMap|null}
   */
  let obliqueMap = null;
  /**
   * @type {function():void}
   */
  let obliqueImageChangedListener = () => {};
  const mapChanged = (map) => {
    obliqueImageChangedListener();
    if (map instanceof ObliqueMap) {
      selectFeatureInteraction.clear();
      obliqueImageChangedListener = map.imageChanged.addEventListener(() => {
        selectFeatureInteraction.clear();
        createTransformations();
      });
      obliqueMap = map;
    } else {
      if (obliqueMap) {
        selectFeatureInteraction.clear();
      }
      obliqueMap = null;
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

  selectFeatureInteraction.featuresChanged.addEventListener((selectedFeatures) => {
    if (obliqueMap) {
      obliqueMap.switchEnabled = selectedFeatures.length === 0;
    }
  });

  const stop = () => {
    obliqueImageChangedListener();
    if (obliqueMap) {
      obliqueMap.switchEnabled = true;
    }
    mapChangedListener();
    destroyTransformation();
    destroySelectionSet();
    app.layers.remove(scratchLayer);
    destroyInteractionChain();
    stopped.raiseEvent();
    stopped.destroy();
    modeChanged.destroy();
  };
  interactionRemoved.addEventListener(stop);

  return {
    type: SessionType.EDIT_FEATURES,
    featureSelection: selectFeatureInteraction,
    stopped,
    stop,
    get mode() {
      return mode;
    },
    modeChanged,
    setMode,
  };
}

export default startEditFeaturesSession;
