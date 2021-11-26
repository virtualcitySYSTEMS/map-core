/**
 * Tracks layer exclusivity, added to every {@link LayerCollection}.
 * @class
 * @api
 */
class ExclusiveManager {
  constructor() {
    /**
     * The layers managed by this manager. The key is the group.
     * @type {Map<(string|symbol), Set<import("@vcmap/core").Layer>>}
     * @api
     */
    this.layers = new Map();
  }

  /**
   * registers a Layer as Exclusive, the activation of a layer triggers the deactivation of all other exclusive Layers.
   * The layer collection adds exclusive layers to the manager on adding the layer to the collection.
   * @param {import("@vcmap/core").Layer} layer - layer to register
   * @api
   */
  registerLayer(layer) {
    const { exclusiveGroups } = layer;
    if (exclusiveGroups.length > 0) {
      exclusiveGroups.forEach((group) => {
        if (!this.layers.has(group)) {
          this.layers.set(group, new Set());
        }
        const groupSet = this.layers.get(group);
        groupSet.add(layer);
      });

      if (layer.active) {
        this.handleLayerActivated(layer);
      }
    }
  }

  /**
   * Removes a layer from tracking. Layer collections remove the layer once they are removed from them.
   * @param {import("@vcmap/core").Layer} layer - layer to unregister
   * @api
   */
  unregisterLayer(layer) {
    const { exclusiveGroups } = layer;
    if (exclusiveGroups.length > 0) {
      exclusiveGroups.forEach((group) => {
        this.layers.get(group).delete(layer);
      });
    }
  }

  /**
   * @param {import("@vcmap/core").Layer} layer
   */
  handleSplitDirectionChanged(layer) {
    if (layer.active) {
      this.handleLayerActivated(layer);
    }
  }

  /**
   * handles the changing of a layer
   * @param {import("@vcmap/core").Layer} layer
   */
  handleLayerActivated(layer) {
    const { exclusiveGroups } = layer;
    if (exclusiveGroups.length > 0) {
      const splitDirection = /** @type {SplitLayer} */ (layer).splitDirection || 0;
      exclusiveGroups.forEach((group) => {
        if (this.layers.has(group)) {
          this.layers.get(group).forEach((groupLayer) => {
            if (
              groupLayer !== layer && !(
                splitDirection &&
                /** @type {SplitLayer} */ (groupLayer).splitDirection &&
                /** @type {SplitLayer} */ (groupLayer).splitDirection !== splitDirection
              )
            ) {
              groupLayer.deactivate();
            }
          });
        }
      });
    }
  }

  /**
   * @param {import("@vcmap/core").Layer} layer
   */
  handleExclusiveGroupsChanged(layer) {
    [...this.layers.values()].forEach((set) => {
      set.delete(layer);
    });
    this.registerLayer(layer);
  }

  /**
   * Gets all layers in the given group
   * @param {string} group
   * @returns {Array<import("@vcmap/core").Layer>}
   * @api
   */
  getActiveLayersForGroup(group) {
    const layerGroup = this.layers.get(group);
    if (layerGroup) {
      const activeLayers = [];
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
   * @api
   */
  clear() {
    this.layers.clear();
  }

  /**
   * Destroys the ExclusiveManager
   * @api
   */
  destroy() {
    this.clear();
  }
}

export default ExclusiveManager;
