// eslint-disable-next-line import/no-named-default
import type { default as Layer, SplitLayer } from '../layer/layer.js';

/**
 * Tracks layer exclusivity, added to every {@link LayerCollection}.
 */
class ExclusiveManager {
  layers = new Map<string | symbol, Set<Layer>>();

  /**
   * registers a Layer as Exclusive, the activation of a layer triggers the deactivation of all other exclusive Layers.
   * The layer collection adds exclusive layers to the manager on adding the layer to the collection.
   * @param  layer - layer to register
   */
  registerLayer(layer: Layer): void {
    const { exclusiveGroups } = layer;
    if (exclusiveGroups.length > 0) {
      exclusiveGroups.forEach((group) => {
        if (!this.layers.has(group)) {
          this.layers.set(group, new Set());
        }
        const groupSet = this.layers.get(group)!;
        groupSet.add(layer);
      });

      if (layer.active) {
        this.handleLayerActivated(layer);
      }
    }
  }

  /**
   * Removes a layer from tracking. Layer collections remove the layer once they are removed from them.
   * @param  layer - layer to unregister
   */
  unregisterLayer(layer: Layer): void {
    const { exclusiveGroups } = layer;
    if (exclusiveGroups.length > 0) {
      exclusiveGroups.forEach((group) => {
        this.layers.get(group)!.delete(layer);
      });
    }
  }

  handleSplitDirectionChanged(layer: Layer): void {
    if (layer.active) {
      this.handleLayerActivated(layer);
    }
  }

  /**
   * handles the changing of a layer
   * @param  layer
   */
  handleLayerActivated(layer: Layer): void {
    const { exclusiveGroups } = layer;
    if (exclusiveGroups.length > 0) {
      const splitDirection = (layer as Layer & SplitLayer).splitDirection || 0;
      exclusiveGroups.forEach((group) => {
        if (this.layers.has(group)) {
          this.layers.get(group)!.forEach((groupLayer) => {
            if (
              groupLayer !== layer &&
              !(
                splitDirection &&
                (groupLayer as Layer & SplitLayer).splitDirection &&
                (groupLayer as Layer & SplitLayer).splitDirection !==
                  splitDirection
              )
            ) {
              groupLayer.deactivate();
            }
          });
        }
      });
    }
  }

  handleExclusiveGroupsChanged(layer: Layer): void {
    [...this.layers.values()].forEach((set) => {
      set.delete(layer);
    });
    this.registerLayer(layer);
  }

  /**
   * Gets all layers in the given group
   * @param  group
   */
  getActiveLayersForGroup(group: string): Layer[] {
    const layerGroup = this.layers.get(group);
    if (layerGroup) {
      const activeLayers: Layer[] = [];
      layerGroup.forEach((groupLayer) => {
        if (groupLayer.active) {
          activeLayers.push(groupLayer);
        }
      });
      return activeLayers;
    }
    return [];
  }

  /**
   * Clears all layer groups
   */
  clear(): void {
    this.layers.clear();
  }

  /**
   * Destroys the ExclusiveManager
   */
  destroy(): void {
    this.clear();
  }
}

export default ExclusiveManager;
