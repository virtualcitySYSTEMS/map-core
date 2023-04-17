import { check } from '@vcsuite/check';
import { Circle, Fill, Style, Stroke } from 'ol/style.js';
import { createSync } from '../../layer/vectorSymbols.js';
import { SessionType, setupInteractionChain } from './editorSessionHelpers.js';
import SelectSingleFeatureInteraction from './interactions/selectSingleFeatureInteraction.js';
import SelectMultiFeatureInteraction from './interactions/selectMultiFeatureInteraction.js';
import SelectFeatureMouseOverInteraction, { SelectionMode } from './interactions/selectFeatureMouseOverInteraction.js';
import VcsEvent from '../../vcsEvent.js';
import ObliqueMap from '../../map/obliqueMap.js';
import { vcsLayerName } from '../../layer/layerSymbols.js';

/**
 * @typedef {Object} SelectionHighlightManager
 * @property {Array<import("ol").Feature>} highlightedFeatures Currently highlighted features.
 * @property {function(Array<import("ol").Feature>):void} update Sets the new features to be highlighted. All currently highlighted features that are not part of the new features are unhighlighted. Features that are not on the highlight layer are ignored.
 * @property {function():void} destroy Stops all listeners, unhighlights all features.
 */

/**
 * Creates the selection highlight manager. By calling update features can be highlighted.
 * @param {import("@vcmap/core").VectorLayer} layer The layer of the features to be highlighted.
 * @param {import("ol/style").Style} highlightStyle Highlight style for the highlighted features.
 * @returns {SelectionHighlightManager} Object that manages highlighting and allowPicking property of features. Has own state for selected features.
 */
function createHighlightManager(layer, highlightStyle) {
  const currentFeaturesMap = new Map();

  /**
   * Sets the new features to be highlighted. All currently highlighted features that are not part of the new features are unhighlighted.
   * @param {Array<import("ol").Feature>} newFeatures Features to be highlighted.
   */
  const update = (newFeatures) => {
    const newIds = new Set(newFeatures.map((f) => {
      f[createSync] = true;
      return f.getId();
    }));
    const idsToHighlight = [];
    newIds.forEach((id) => {
      if (!currentFeaturesMap.has(id)) {
        idsToHighlight.push(id);
      }
    });

    const idsToUnHighlight = [];
    currentFeaturesMap.forEach((feature, id) => {
      if (!newIds.has(id)) {
        idsToUnHighlight.push(id);
      }
    });

    layer.featureVisibility.unHighlight(idsToUnHighlight);
    layer.featureVisibility.highlight(Object.fromEntries(idsToHighlight.map(id => [id, highlightStyle])));
    layer.getFeaturesById(idsToUnHighlight).forEach(feature => delete feature[createSync]);

    currentFeaturesMap.clear();
    newFeatures.forEach(feature => currentFeaturesMap.set(feature.getId(), feature));
  };

  return {
    get highlightedFeatures() {
      return [...currentFeaturesMap.values()];
    },
    update(newFeatures) {
      const featuresOnHighlightLayer = newFeatures.filter(feature => feature[vcsLayerName] === layer.name);
      update(featuresOnHighlightLayer);
    },
    destroy() {
      if (currentFeaturesMap.size > 0) {
        const idsToUnHighlight = [...currentFeaturesMap.keys()];
        layer.featureVisibility.unHighlight(idsToUnHighlight);
        layer.getFeaturesById(idsToUnHighlight).forEach(feature => delete feature[createSync]);
        currentFeaturesMap.clear();
      }
    },
  };
}

/**
 * @returns {import("ol/style").Style}
 */
export function getDefaultHighlightStyle() {
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
 * @typedef {EditorSession} SelectFeaturesSession
 * @property {Array<import("ol").Feature>} currentFeatures
 * @property {import("ol").Feature} firstFeature
 * @property {VcsEvent<Array<import("ol").Feature>>} featuresChanged
 * @property {SelectionMode} mode
 * @property {function(SelectionMode):void} setMode Sets the selection mode. Raises modeChanged event, throws error when invalid selection mode input.
 * @property {VcsEvent<SelectionMode>} modeChanged
 * @property {function(Array<import("ol").Feature>): Promise<void>} setCurrentFeatures Promise that resolves when features are set.
 * @property {function(): void} clearSelection Deselects all features.
 */

/**
 * @param {import("@vcmap/core").VcsApp} app
 * @param {import("@vcmap/core").VectorLayer} layer
 * @param {string=} [interactionId] id for registering mutliple exclusive interaction.
 * @param {SelectionMode=} [initialMode=SelectionMode.MULTI]
 * @param {import("ol/style").Style=} [highlightStyle]
 * @returns {SelectFeaturesSession}
 */
function startSelectFeaturesSession(
  app,
  layer,
  interactionId,
  initialMode = SelectionMode.MULTI,
  highlightStyle = getDefaultHighlightStyle(),
) {
  /** @type {VcsEvent<void>} */
  const stopped = new VcsEvent();
  /** @type {VcsEvent<SelectionMode>} */
  const modeChanged = new VcsEvent();
  /** @type {VcsEvent<Array<import("ol").Feature>>} */
  const featuresChanged = new VcsEvent();
  /** @type {SelectSingleFeatureInteraction | SelectMultiFeatureInteraction | null} */
  let currentSelectInteraction = null;
  /** @type {SelectFeatureMouseOverInteraction} */
  let mouseOverInteraction = null;
  /** @type {SelectionMode} */
  let currentSelectionMode = null;
  /** @type {ObliqueMap|null} */
  let obliqueMap = null;

  const {
    interactionChain,
    removed: interactionRemoved,
    destroy: destroyInteractionChain,
  } = setupInteractionChain(app.maps.eventHandler, interactionId);

  const highlightManager = createHighlightManager(
    layer, highlightStyle,
  );

  let interactionListeners = [];
  function destroyCurrentSelectInteraction() {
    if (currentSelectInteraction) {
      if (currentSelectInteraction) {
        interactionChain.removeInteraction(currentSelectInteraction);
        currentSelectInteraction.destroy();
        currentSelectInteraction = null;
      }
      if (mouseOverInteraction) {
        interactionChain.removeInteraction(mouseOverInteraction);
        mouseOverInteraction.destroy();
        mouseOverInteraction = null;
      }
    }
    interactionListeners.forEach((cb) => { cb(); });
    interactionListeners = [];
  }

  /**
   * Destroys current selection interaction and creates new one. Sets all highlighted features as selected. If previous mode was multi and new mode is single, only first feature is selected and highlighted.
   * @param {SelectionMode} newMode Either single or multi selection mode.
   * @returns {void}
   */
  function createSelectInteraction(newMode) {
    if (newMode === currentSelectionMode) {
      return;
    }

    destroyCurrentSelectInteraction();
    if (newMode === SelectionMode.SINGLE) {
      currentSelectInteraction = new SelectSingleFeatureInteraction(layer);

      interactionListeners.push(
        currentSelectInteraction.featureChanged.addEventListener((feature) => {
          const featureArray = feature ? [feature] : [];
          highlightManager.update(featureArray);
          featuresChanged.raiseEvent(featureArray);
          if (obliqueMap) {
            obliqueMap.switchEnabled = !feature;
          }
        }),
      );
    } else if (newMode === SelectionMode.MULTI) {
      currentSelectInteraction = new SelectMultiFeatureInteraction(layer);
      interactionListeners.push(
        currentSelectInteraction.featuresChanged.addEventListener((features) => {
          highlightManager.update(features);
          featuresChanged.raiseEvent(features);
          if (obliqueMap) {
            obliqueMap.switchEnabled = features.length === 0;
          }
        }),
      );
    }
    const { highlightedFeatures } = highlightManager;
    if (highlightedFeatures) {
      // if single select interaction, only one features is set. This triggers the event listener which ensures that only this feature is highlighted.
      currentSelectInteraction.setSelected(highlightedFeatures);
    }
    currentSelectionMode = newMode;
    interactionChain.addInteraction(currentSelectInteraction);
    mouseOverInteraction = new SelectFeatureMouseOverInteraction(
      layer.name,
      currentSelectInteraction,
    );
    interactionChain.addInteraction(mouseOverInteraction);
  }

  createSelectInteraction(initialMode);

  /**
   * @type {function():void}
   */
  let obliqueImageChangedListener = () => {};
  const mapChanged = (map) => {
    obliqueImageChangedListener();
    if (map instanceof ObliqueMap) {
      currentSelectInteraction.clear();
      obliqueImageChangedListener = map.imageChanged.addEventListener(() => {
        currentSelectInteraction.clear();
      });
      obliqueMap = map;
    } else {
      if (obliqueMap) {
        currentSelectInteraction.clear();
      }
      obliqueMap = null;
      obliqueImageChangedListener = () => {};
    }
  };
  const mapChangedListener = app.maps.mapActivated.addEventListener(mapChanged);
  mapChanged(app.maps.activeMap);

  const stop = () => {
    destroyCurrentSelectInteraction();
    destroyInteractionChain();
    highlightManager.destroy();
    mapChangedListener();
    obliqueImageChangedListener();
    if (obliqueMap) {
      obliqueMap.switchEnabled = true;
    }
    stopped.raiseEvent();
    stopped.destroy();
    modeChanged.destroy();
    featuresChanged.destroy();
  };
  interactionRemoved.addEventListener(stop);

  return {
    type: SessionType.SELECT,
    stopped,
    stop,
    setCurrentFeatures(features) {
      return currentSelectInteraction.setSelected(features);
    },
    get currentFeatures() {
      return currentSelectInteraction.selected;
    },
    get firstFeature() {
      return currentSelectInteraction.selected[0] || null;
    },
    get mode() {
      return currentSelectionMode;
    },
    setMode(newMode) {
      check(newMode, Object.values(SelectionMode));

      createSelectInteraction(newMode);
      modeChanged.raiseEvent(currentSelectionMode);
    },
    modeChanged,
    featuresChanged,
    clearSelection() {
      currentSelectInteraction.clear();
    },
  };
}

export default startSelectFeaturesSession;
