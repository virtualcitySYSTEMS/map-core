import { getLogger as getLoggerByName } from '@vcs/logger';
import MapCollection from '../../../src/vcs/vcm/util/mapCollection.js';
import GlobalHider from '../../../src/vcs/vcm/layer/globalHider.js';
import { obliqueCollectionCollection, styleCollection } from '../../../src/vcs/vcm/globalCollections.js';

/**
 * @type {vcs.vcm.Framework}
 */
let instance;

/**
 * @returns {vcs-logger/Logger}
 */
function getLogger() {
  return getLoggerByName('vcs.vcm.Framework');
}

/**
 * The main Framework class This class is a Singleton, to get an instance call vcs.vcm.Framework.getInstance(); This class manages the following points
 * <ul>
 *  <li> loading of the config file </li>
 *  <li> creation and management of the map, layer, viewpoints and widget objects</li>
 *  <li> analysis of the URL parameter and forwarding to the widgets</li>
 *  <li> Message system (publish, subscribe)</li>
 * </ul>
 * The default way to initialize a map is by running:
 *     <pre><code>
 *         vcs.vcm.Framework.getInstance();
 *         vcs.vcm.Framework.loadConfig("http://www.location.to/config.json");
 *     </code></pre>
 * The structure of the config json is presented under the {@link vcs.vcm.Framework.init} method
 *
 * @api stable
 * @class
 * @export
 * @memberOf vcs.vcm
 */
class Framework {
  constructor() {
    /**
     * @type {HTMLElement}
     * @private
     */
    this._mapcontainer = null;
    /**
     * Framework wide map collection. All configured maps will be added to this collection.
     * @type {vcs.vcm.util.MapCollection}
     */
    this.mapCollection = new MapCollection();
  }

  /**
   * @returns {HTMLElement}
   */
  get mapcontainer() {
    return this._mapcontainer;
  }

  /**
   * @param {HTMLElement} container
   */
  set mapcontainer(container) {
    this._mapcontainer = container;
    this.mapCollection.setTarget(container);
  }

  /**
   * framework wide collection of layers, layers will be rendered if supported on the configured main maps.
   * Layers configured in the `layers` section of the config.json will end up in this collection.
   * @type {vcs.vcm.util.LayerCollection}
   * @api
   * @readonly
   */
  get layerCollection() {
    return this.mapCollection.layerCollection;
  }

  /**
   * adds a map to the framework.
   * If the startingmap config value is set to true the activate function of the map is called.
   * @param {vcs.vcm.maps.VcsMap} map
   * @returns {boolean} true/false if the map has been added.
   * @api stable
   */
  addMap(map) {
    const added = this.mapCollection.add(map);
    if (added === null) {
      getLogger().warning(`The map ${map.name} already exist.`);
      return false;
    }
    return true;
  }

  /**
   * Deactivates the current active map, and activates the map with the given name.
   * The new map uses the current viewpoint of the currently active map or -if specified- uses the opt_viewpoint
   * @param {string} name
   * @returns {Promise<void>}
   * @api stable
   */
  async activateMap(name) {
    await this.mapCollection.setActiveMap(name);
  }

  /**
   * Adds a Layer to the Frameworks layerCollection
   * @param {vcs.vcm.layer.Layer} layer
   * @returns {boolean} returns true if the layer has been added, false otherwise, check the logs for the cause
   * @api stable
   */
  addLayer(layer) {
    const index = this.layerCollection.add(layer);
    if (index == null) {
      getLogger().warning('Could not add Layer with same name twice, make sure the LayerName is unique');
      return false;
    }
    return true;
  }

  /**
   * Removes a Layer to the Frameworks layerCollection
   * @param {vcs.vcm.layer.Layer} layer
   * @api
   */
  removeLayer(layer) {
    this.layerCollection.remove(layer);
  }

  /**
   * returns the Mapcontainer, here the different maps add themselves as children.
   * @returns {HTMLElement}
   * @api stable
   */
  getMapContainer() {
    return this.mapcontainer;
  }

  /**
   * destroys the framework instance framework</br>
   * @api
   */
  destroy() {
    if (instance) {
      const maps = [...this.mapCollection];
      this.mapCollection.destroy();
      maps.forEach((m) => { m.destroy(); });
      instance = undefined;
      if (this.mapcontainer) {
        this.mapcontainer.classList.remove('vcs_map_container');
        this.mapcontainer.classList.remove('vcm-font-default');
        while (this.mapcontainer.firstChild) {
          this.mapcontainer.removeChild(this.mapcontainer.firstChild);
        }
        this.mapcontainer = null;
      }
    }
  }
}

export default Framework;

/**
 * Singleton getter for Framework
 * @returns {vcs.vcm.Framework}
 */
export function getFramework() {
  if (!instance) {
    instance = new Framework();
  }
  return instance;
}

/**
 * disposes of the Framework
 * @api stable
 * @export
 * @memberOf vcs.vcm.Framework
 */
export function destroy() {
  GlobalHider.destroy();
  if (instance) {
    instance.destroy();
  }
  obliqueCollectionCollection.destroy();
  styleCollection.destroy();
}
