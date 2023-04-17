import { getLogger } from '@vcsuite/logger';
import { unByKey } from 'ol/Observable.js';
import { GeometryType, SessionType, setupInteractionChain, setupScratchLayer } from './editorSessionHelpers.js';
import InteractionChain from '../../interaction/interactionChain.js';
import VcsEvent from '../../vcsEvent.js';
import TranslateVertexInteraction from './interactions/translateVertexInteraction.js';
import RemoveVertexInteraction from './interactions/removeVertexInteraction.js';
import { createVertex } from './editorHelpers.js';
import InsertVertexInteraction from './interactions/insertVertexInteraction.js';
import EditGeometryMouseOverInteraction from './interactions/editGeometryMouseOverInteraction.js';
import { cartesian2DDistance, modulo } from '../math.js';
import { createSync, obliqueGeometry } from '../../layer/vectorSymbols.js';
import geometryIsValid from './validateGeoemetry.js';
import MapInteractionController from './interactions/mapInteractionController.js';

/**
 * @typedef {EditorSession} EditGeometrySession
 * @property {function(import("ol").Feature):void} setFeature - Sets the feature for the edit session.
 * @property {import("ol").Feature | null} feature - Gets the current feature of the edit session.
 */

/**
 * @typedef {Object} EditGeometryInteraction
 * @property {InteractionChain} interactionChain
 * @property {function():void} destroy
 * @private
 */

/**
 * Create the editing interaction for a feature with a line geometry
 * @param {import("ol").Feature<import("ol/geom").LineString>} feature
 * @param {import("@vcmap/core").VectorLayer} scratchLayer
 * @returns {EditGeometryInteraction}
 */
function createEditLineStringGeometryInteraction(feature, scratchLayer) {
  const geometry = feature[obliqueGeometry] ?? feature.getGeometry();
  const vertices = geometry.getCoordinates().map(createVertex);
  scratchLayer.addFeatures(vertices);
  const resetGeometry = () => {
    geometry.setCoordinates(vertices.map(f => f.getGeometry().getCoordinates()));
  };
  const translateVertex = new TranslateVertexInteraction();
  translateVertex.vertexChanged.addEventListener(resetGeometry);

  const insertVertex = new InsertVertexInteraction(feature, geometry);
  insertVertex.vertexInserted.addEventListener(({ vertex, index }) => {
    scratchLayer.addFeatures([vertex]);
    vertices.splice(index, 0, vertex);
    resetGeometry();
  });

  const removeVertex = new RemoveVertexInteraction();
  removeVertex.vertexRemoved.addEventListener((vertex) => {
    scratchLayer.removeFeaturesById([vertex.getId()]);
    const index = vertices.indexOf(vertex);
    if (index > -1) {
      vertices.splice(index, 1);
      resetGeometry();
    }
  });

  const interactionChain = new InteractionChain([
    translateVertex,
    insertVertex,
    removeVertex,
  ]);

  return {
    interactionChain,
    destroy: () => {
      scratchLayer.removeFeaturesById(vertices.map(v => v.getId()));
      interactionChain.destroy();
    },
  };
}

/**
 * @param {import("ol").Feature<import("ol/geom").Circle>} feature
 * @param {import("@vcmap/core").VectorLayer} scratchLayer
 * @returns {EditGeometryInteraction}
 */
function createEditCircleGeometryInteraction(feature, scratchLayer) {
  /** @type {import("ol/geom").Circle} */
  const geometry = feature[obliqueGeometry] ?? feature.getGeometry();
  const vertices = geometry.getCoordinates().map(createVertex);
  scratchLayer.addFeatures(vertices);

  const translateVertex = new TranslateVertexInteraction();
  let suspend;
  translateVertex.vertexChanged.addEventListener((vertex) => {
    suspend = true;
    if (vertices.indexOf(vertex) === 1) {
      const coords = geometry.getCoordinates();
      coords[1] = vertex.getGeometry().getCoordinates();
      const newRadius = cartesian2DDistance(coords[0], coords[1]);
      geometry.setRadius(newRadius);
    } else {
      geometry.setCenter(vertex.getGeometry().getCoordinates());
      vertices[1].getGeometry().setCoordinates(geometry.getCoordinates()[1]);
    }
    suspend = false;
  });

  const geometryListener = geometry.on('change', () => {
    if (!suspend) {
      geometry.getCoordinates()
        .forEach((c, index) => {
          vertices[index].getGeometry().setCoordinates(c);
        });
    }
  });

  const interactionChain = new InteractionChain([translateVertex]);

  return {
    interactionChain,
    destroy: () => {
      scratchLayer.removeFeaturesById(vertices.map(v => v.getId()));
      interactionChain.destroy();
      unByKey(geometryListener);
    },
  };
}

/**
 * @param {import("ol").Feature<import("ol/geom").Polygon>} feature
 * @param {import("@vcmap/core").VectorLayer} scratchLayer
 * @returns {EditGeometryInteraction}
 */
function createEditBBoxGeometryInteraction(feature, scratchLayer) {
  const geometry = feature[obliqueGeometry] ?? feature.getGeometry();
  const vertices = geometry.getCoordinates()[0].map(createVertex);
  scratchLayer.addFeatures(vertices);
  let suspend = false;
  const translateVertex = new TranslateVertexInteraction();
  translateVertex.vertexChanged.addEventListener((vertex) => {
    const vertexIndex = vertices.indexOf(vertex);
    const originIndex = modulo(vertexIndex + 2, 4);
    const rightOfIndex = modulo(vertexIndex + 1, 4);
    const leftOfIndex = modulo(vertexIndex - 1, 4);

    const originCoords = vertices[originIndex].getGeometry().getCoordinates();
    const vertexCoords = vertex.getGeometry().getCoordinates();
    let preventCollapse = false;
    if (originCoords[0] === vertexCoords[0]) {
      vertexCoords[0] += 1e-8;
      preventCollapse = true;
    }
    if (originCoords[1] === vertexCoords[1]) {
      vertexCoords[1] += 1e-8;
      preventCollapse = true;
    }

    if (preventCollapse) {
      vertex.getGeometry().setCoordinates(vertexCoords);
    }
    const updateOtherVertex = (otherVertexIndex) => {
      const otherVertexGeometry = vertices[otherVertexIndex].getGeometry();
      const otherVertexCoords = otherVertexGeometry.getCoordinates();
      if (otherVertexCoords[0] === originCoords[0]) {
        otherVertexCoords[1] = vertexCoords[1];
      } else {
        otherVertexCoords[0] = vertexCoords[0];
      }
      otherVertexGeometry.setCoordinates(otherVertexCoords);
    };

    updateOtherVertex(rightOfIndex);
    updateOtherVertex(leftOfIndex);

    suspend = true;
    geometry.setCoordinates([vertices.map(f => f.getGeometry().getCoordinates())]);
    suspend = false;
  });

  const geometryListener = geometry.on('change', () => {
    if (!suspend) {
      geometry.getCoordinates()[0]
        .forEach((c, index) => {
          vertices[index].getGeometry().setCoordinates(c);
        });
    }
  });
  const interactionChain = new InteractionChain([translateVertex]);

  return {
    interactionChain,
    destroy: () => {
      scratchLayer.removeFeaturesById(vertices.map(v => v.getId()));
      interactionChain.destroy();
      unByKey(geometryListener);
    },
  };
}

/**
 * @param {import("ol").Feature<import("ol/geom").Polygon>} feature
 * @param {import("@vcmap/core").VectorLayer} scratchLayer
 * @returns {EditGeometryInteraction}
 */
function createEditSimplePolygonInteraction(feature, scratchLayer) {
  const geometry = feature[obliqueGeometry] ?? feature.getGeometry();
  const linearRing = geometry.getLinearRing(0);
  const vertices = linearRing.getCoordinates().map(createVertex);
  scratchLayer.addFeatures(vertices);
  const resetGeometry = () => {
    const coordinates = vertices.map(f => f.getGeometry().getCoordinates());
    linearRing.setCoordinates(coordinates); // update linear ring for proper vertex insertion
    geometry.setCoordinates([vertices.map(f => f.getGeometry().getCoordinates())]); // update actual geometry, since linear ring is a clone and not a ref
  };

  const translateVertex = new TranslateVertexInteraction();
  translateVertex.vertexChanged.addEventListener(resetGeometry);

  const insertVertex = new InsertVertexInteraction(feature, linearRing);
  insertVertex.vertexInserted.addEventListener(({ vertex, index }) => {
    scratchLayer.addFeatures([vertex]);
    vertices.splice(index, 0, vertex);
    resetGeometry();
  });

  const removeVertex = new RemoveVertexInteraction();
  removeVertex.vertexRemoved.addEventListener((vertex) => {
    scratchLayer.removeFeaturesById([vertex.getId()]);
    const index = vertices.indexOf(vertex);
    if (index > -1) {
      vertices.splice(index, 1);
      resetGeometry();
    }
  });

  const interactionChain = new InteractionChain([
    translateVertex,
    insertVertex,
    removeVertex,
  ]);

  return {
    interactionChain,
    destroy: () => {
      scratchLayer.removeFeaturesById(vertices.map(v => v.getId()));
      interactionChain.destroy();
    },
  };
}

/**
 * @param {import("ol").Feature<import("ol/geom").Point>} feature
 * @param {import("@vcmap/core").VectorLayer} scratchLayer
 * @param {import("@vcmap/core").VectorLayer} layer
 * @returns {EditGeometryInteraction}
 */
function createEditPointInteraction(feature, scratchLayer, layer) {
  const geometry = feature[obliqueGeometry] ?? feature.getGeometry();
  const vertex = createVertex(geometry.getCoordinates());
  const featureIdArray = [feature.getId()];
  layer.featureVisibility.hideObjects(featureIdArray);
  vertex[createSync] = true;
  scratchLayer.addFeatures([vertex]);
  const translateVertex = new TranslateVertexInteraction();
  let suspend = false;
  translateVertex.vertexChanged.addEventListener(() => {
    suspend = true;
    feature.getGeometry().setCoordinates(vertex.getGeometry().getCoordinates());
    suspend = false;
  });

  const geometryListener = geometry.on('change', () => {
    if (!suspend) {
      vertex.getGeometry().setCoordinates(geometry.getCoordinates());
    }
  });

  const interactionChain = new InteractionChain([
    translateVertex,
  ]);

  return {
    interactionChain,
    destroy: () => {
      interactionChain.destroy();
      scratchLayer.removeFeaturesById([vertex.getId()]);
      layer.featureVisibility.showObjects(featureIdArray);
      unByKey(geometryListener);
    },
  };
}

/**
 * Creates the edit geometry session.
 * @param {import("@vcmap/core").VcsApp} app
 * @param {import("@vcmap/core").VectorLayer} layer
 * @param {string} [interactionId] id for registering mutliple exclusive interaction. Needed to run a selection session at the same time as a edit features session.
 * @returns {EditGeometrySession}
 */
function startEditGeometrySession(app, layer, interactionId) {
  const {
    interactionChain,
    removed: interactionRemoved,
    destroy: destroyInteractionChain,
  } = setupInteractionChain(app.maps.eventHandler, interactionId);

  const scratchLayer = setupScratchLayer(app.layers);

  const mapInteractionController = new MapInteractionController();
  interactionChain.addInteraction(mapInteractionController);

  const mouseOverInteraction = new EditGeometryMouseOverInteraction();
  interactionChain.addInteraction(mouseOverInteraction);

  /**
   * @type {VcsEvent<void>}
   */
  const stopped = new VcsEvent();

  /**
   * @type {EditGeometryInteraction|null}
   */
  let currentInteractionSet = null;
  /**
   * The feature that is set for the edit session.
   * @type {import("ol").Feature}
   */
  let currentFeature = null;


  const destroyCurrentInteractionSet = () => {
    if (currentInteractionSet) {
      interactionChain.removeInteraction(currentInteractionSet.interactionChain);
      currentInteractionSet.destroy();
      currentInteractionSet = null;
    }

    if (currentFeature) {
      delete currentFeature[createSync];
      if (!geometryIsValid(currentFeature.getGeometry())) {
        layer.removeFeaturesById([currentFeature.getId()]);
      }
    }
    currentFeature = null;
  };

  /**
   * Creates an interaction set from an edit geometry interaction. If the geometry of the feature is not supported a message is logged.
   * @param {import("ol").Feature} feature The feature to be edited.
   */
  function createCurrentInteractionSet(feature) {
    destroyCurrentInteractionSet();
    if (feature) {
      currentFeature = feature;
      currentFeature[createSync] = true;
      const geometry = feature[obliqueGeometry] ?? feature.getGeometry();
      const geometryType = geometry.getType();
      if (geometryType === GeometryType.Polygon) {
        if (geometry.get('_vcsGeomType') === GeometryType.BBox) {
          currentInteractionSet = createEditBBoxGeometryInteraction(
            /** @type {import("ol").Feature<import("ol/geom").Polygon>} */ (feature),
            scratchLayer,
          );
        } else if (/** @type {import("ol/geom").Polygon} */ (geometry).getLinearRingCount() === 1) {
          currentInteractionSet = createEditSimplePolygonInteraction(
            /** @type {import("ol").Feature<import("ol/geom").Polygon>} */ (feature),
            scratchLayer,
          );
        }
      } else if (geometryType === GeometryType.LineString) {
        currentInteractionSet = createEditLineStringGeometryInteraction(
          /** @type {import("ol").Feature<import("ol/geom").LineString>} */ (feature),
          scratchLayer,
        );
      } else if (geometryType === GeometryType.Point) {
        currentInteractionSet = createEditPointInteraction(
          /** @type {import("ol").Feature<import("ol/geom").Point>} */ (feature),
          scratchLayer,
          layer,
        );
      } else if (geometryType === GeometryType.Circle) {
        currentInteractionSet = createEditCircleGeometryInteraction(
          /** @type {import("ol").Feature<import("ol/geom").Circle>} */ (feature),
          scratchLayer,
        );
      }

      if (currentInteractionSet) {
        interactionChain.addInteraction(currentInteractionSet.interactionChain);
      } else {
        getLogger('EditGeometrySession').warning(`Geometry of type ${geometryType} is currently not supported`);
        currentFeature[createSync] = false;
        currentFeature = null;
      }
    }
  }

  const setupActiveMap = () => {
    mapInteractionController.reset();
    mouseOverInteraction.reset();
    createCurrentInteractionSet(null);
  };
  const mapActivatedListener = app.maps.mapActivated.addEventListener(setupActiveMap);
  setupActiveMap();

  const stop = () => {
    app.layers.remove(scratchLayer);
    mapActivatedListener();
    mapInteractionController.reset();
    mouseOverInteraction.reset();
    destroyCurrentInteractionSet();
    destroyInteractionChain();
    stopped.raiseEvent();
    stopped.destroy();
  };
  interactionRemoved.addEventListener(stop);

  return {
    type: SessionType.EDIT_GEOMETRY,
    stopped,
    stop,
    setFeature(feature) {
      createCurrentInteractionSet(feature);
    },
    get feature() {
      return currentFeature;
    },
  };
}

export default startEditGeometrySession;
