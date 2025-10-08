import { check, ofEnum } from '@vcsuite/check';
import { Circle, Style, Stroke } from 'ol/style.js';
import type { Feature } from 'ol/index.js';
import { createSync } from '../../layer/vectorSymbols.js';
import type { EditorSession } from './editorSessionHelpers.js';
import { SessionType, setupInteractionChain } from './editorSessionHelpers.js';
import SelectSingleFeatureInteraction from './interactions/selectSingleFeatureInteraction.js';
import SelectMultiFeatureInteraction from './interactions/selectMultiFeatureInteraction.js';
import SelectFeatureMouseOverInteraction, {
  SelectionMode,
} from './interactions/selectFeatureMouseOverInteraction.js';
import VcsEvent from '../../vcsEvent.js';
import ObliqueMap from '../../map/obliqueMap.js';
import { vcsLayerName } from '../../layer/layerSymbols.js';
import type VectorLayer from '../../layer/vectorLayer.js';
import type VcsApp from '../../vcsApp.js';
import type VcsMap from '../../map/vcsMap.js';
import { type HighlightStyleType } from '../../layer/featureVisibility.js';
import ModelFill from '../../style/modelFill.js';

type SelectionHighlightManager = {
  highlightedFeatures: Feature[];
  /**
   * Sets the new features to be highlighted. All currently highlighted features that are not part of the new features are unhighlighted. Features that are not on the highlight layer are ignored.
   */
  update(feature: Feature[]): void;
  destroy(): void;
};

/**
 * Creates the selection highlight manager. By calling update features can be highlighted.
 * @param  layer The layer of the features to be highlighted.
 * @param  highlightStyle Highlight style for the highlighted features.
 * @returns  Object that manages highlighting and allowPicking property of features. Has own state for selected features.
 */
function createHighlightManager(
  layer: VectorLayer,
  highlightStyle: HighlightStyleType,
): SelectionHighlightManager {
  const currentFeaturesMap = new Map<string | number, Feature>();

  /**
   * Sets the new features to be highlighted. All currently highlighted features that are not part of the new features are unhighlighted.
   * @param newFeatures Features to be highlighted.
   */
  const update = (newFeatures: Feature[]): void => {
    const newIds = new Set(
      newFeatures.map((f) => {
        f[createSync] = true;
        return f.getId() as string | number;
      }),
    );
    const idsToHighlight: (string | number)[] = [];
    newIds.forEach((id) => {
      if (!currentFeaturesMap.has(id)) {
        idsToHighlight.push(id);
      }
    });

    const idsToUnHighlight: (string | number)[] = [];
    currentFeaturesMap.forEach((_feature, id) => {
      if (!newIds.has(id)) {
        idsToUnHighlight.push(id);
      }
    });

    layer.featureVisibility.unHighlight(idsToUnHighlight);
    layer.featureVisibility.highlight(
      Object.fromEntries(idsToHighlight.map((id) => [id, highlightStyle])),
    );
    layer
      .getFeaturesById(idsToUnHighlight)
      .forEach((feature) => delete feature[createSync]);

    currentFeaturesMap.clear();
    newFeatures.forEach((feature) =>
      currentFeaturesMap.set(feature.getId() as string | number, feature),
    );
  };

  return {
    get highlightedFeatures(): Feature[] {
      return [...currentFeaturesMap.values()];
    },
    update(newFeatures): void {
      const featuresOnHighlightLayer = newFeatures.filter(
        (feature) => feature[vcsLayerName] === layer.name,
      );
      update(featuresOnHighlightLayer);
    },
    destroy(): void {
      if (currentFeaturesMap.size > 0) {
        const idsToUnHighlight = [...currentFeaturesMap.keys()];
        layer.featureVisibility.unHighlight(idsToUnHighlight);
        layer
          .getFeaturesById(idsToUnHighlight)
          .forEach((feature) => delete feature[createSync]);
        currentFeaturesMap.clear();
      }
    },
  };
}

export function getDefaultHighlightStyle(): Style {
  const fill = new ModelFill({ color: 'rgba(76,175,80,0.2)' });
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

export type SelectFeaturesSession = EditorSession<SessionType.SELECT> & {
  currentFeatures: Feature[];
  firstFeature: Feature | null;
  featuresChanged: VcsEvent<Feature[]>;
  mode: SelectionMode;
  /**
   * Sets the selection mode. Raises modeChanged event, throws error when invalid selection mode input.
   */
  setMode(mode: SelectionMode): void;
  modeChanged: VcsEvent<SelectionMode>;
  setCurrentFeatures(features: Feature[] | Feature): Promise<void>;
  clearSelection(): void;
};

/**
 * @param  app
 * @param  layer
 * @param  [interactionId] id for registering multiple exclusive interaction.
 * @param  [initialMode=SelectionMode.MULTI]
 * @param  [highlightStyle]
 * @group Editor
 */
function startSelectFeaturesSession(
  app: VcsApp,
  layer: VectorLayer,
  interactionId?: string,
  initialMode = SelectionMode.MULTI,
  highlightStyle: HighlightStyleType = getDefaultHighlightStyle(),
): SelectFeaturesSession {
  const stopped = new VcsEvent<void>();
  const modeChanged = new VcsEvent<SelectionMode>();
  const featuresChanged = new VcsEvent<Feature[]>();
  let currentSelectInteraction:
    | SelectSingleFeatureInteraction
    | SelectMultiFeatureInteraction
    | null = null;
  let mouseOverInteraction: SelectFeatureMouseOverInteraction | null = null;
  let currentSelectionMode: SelectionMode;
  let obliqueMap: ObliqueMap | null = null;

  const {
    interactionChain,
    removed: interactionRemoved,
    destroy: destroyInteractionChain,
  } = setupInteractionChain(app.maps, interactionId);

  const highlightManager = createHighlightManager(layer, highlightStyle);

  let interactionListeners: (() => void)[] = [];
  function destroyCurrentSelectInteraction(): void {
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
    interactionListeners.forEach((cb) => {
      cb();
    });
    interactionListeners = [];
  }

  /**
   * Destroys current selection interaction and creates new one. Sets all highlighted features as selected. If previous mode was multi and new mode is single, only first feature is selected and highlighted.
   * @param newMode Either single or multi selection mode.
   */
  function createSelectInteraction(newMode: SelectionMode): void {
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
        currentSelectInteraction.featuresChanged.addEventListener(
          (features) => {
            highlightManager.update(features);
            featuresChanged.raiseEvent(features);
            if (obliqueMap) {
              obliqueMap.switchEnabled = features.length === 0;
            }
          },
        ),
      );
    } else {
      throw new Error(`Unknown selection mode ${String(newMode)}`);
    }

    const { highlightedFeatures } = highlightManager;
    if (highlightedFeatures) {
      // if single select interaction, only one features is set. This triggers the event listener which ensures that only this feature is highlighted.
      // eslint-disable-next-line no-void
      void currentSelectInteraction.setSelected(highlightedFeatures);
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

  let obliqueImageChangedListener = (): void => {};
  const mapChanged = (map: VcsMap): void => {
    obliqueImageChangedListener();
    if (map instanceof ObliqueMap) {
      currentSelectInteraction?.clear();
      obliqueImageChangedListener =
        map.imageChanged?.addEventListener(() => {
          currentSelectInteraction?.clear();
        }) ?? ((): void => {});
      obliqueMap = map;
    } else {
      if (obliqueMap) {
        currentSelectInteraction?.clear();
      }
      obliqueMap = null;
      obliqueImageChangedListener = (): void => {};
    }
  };
  const mapChangedListener = app.maps.mapActivated.addEventListener(mapChanged);
  mapChanged(app.maps.activeMap!);

  const stop = (): void => {
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
    setCurrentFeatures(features: Feature[] | Feature): Promise<void> {
      return (
        currentSelectInteraction?.setSelected(features) ?? Promise.resolve()
      );
    },
    get currentFeatures(): Feature[] {
      return currentSelectInteraction?.selected ?? [];
    },
    get firstFeature(): Feature | null {
      return currentSelectInteraction?.selected[0] ?? null;
    },
    get mode(): SelectionMode {
      return currentSelectionMode;
    },
    setMode(newMode: SelectionMode): void {
      check(newMode, ofEnum(SelectionMode));

      createSelectInteraction(newMode);
      modeChanged.raiseEvent(currentSelectionMode);
    },
    modeChanged,
    featuresChanged,
    clearSelection(): void {
      currentSelectInteraction?.clear();
    },
  };
}

export default startSelectFeaturesSession;
