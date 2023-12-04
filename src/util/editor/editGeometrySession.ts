import { getLogger } from '@vcsuite/logger';
import { unByKey } from 'ol/Observable.js';
import type { Feature } from 'ol/index.js';
import type {
  LineString,
  Circle,
  Polygon,
  Point,
  LinearRing,
  Geometry,
} from 'ol/geom.js';
import { EventsKey } from 'ol/events.js';
import {
  EditorSession,
  GeometryType,
  SessionType,
  setupInteractionChain,
  setupScratchLayer,
} from './editorSessionHelpers.js';
import InteractionChain from '../../interaction/interactionChain.js';
import VcsEvent from '../../vcsEvent.js';
import TranslateVertexInteraction from './interactions/translateVertexInteraction.js';
import RemoveVertexInteraction from './interactions/removeVertexInteraction.js';
import { createVertex, geometryChangeKeys } from './editorHelpers.js';
import InsertVertexInteraction from './interactions/insertVertexInteraction.js';
import EditGeometryMouseOverInteraction from './interactions/editGeometryMouseOverInteraction.js';
import { cartesian2DDistance, modulo } from '../math.js';
import { createSync, obliqueGeometry } from '../../layer/vectorSymbols.js';
import geometryIsValid from './validateGeoemetry.js';
import MapInteractionController from './interactions/mapInteractionController.js';
import type VectorLayer from '../../layer/vectorLayer.js';
import type VcsApp from '../../vcsApp.js';

export type EditGeometrySession = EditorSession<SessionType.EDIT_GEOMETRY> & {
  setFeature(feature: Feature): void;
  feature: Feature | null;
};

type EditGeometryInteraction = {
  interactionChain: InteractionChain;
  destroy(): void;
};

/**
 * Create the editing interaction for a feature with a line geometry
 * @param  feature
 * @param  scratchLayer
 * @group Editor
 */
function createEditLineStringGeometryInteraction(
  feature: Feature<LineString>,
  scratchLayer: VectorLayer,
): EditGeometryInteraction {
  const geometry =
    feature[obliqueGeometry] ?? (feature.getGeometry() as LineString);
  const vertices = geometry.getCoordinates().map(createVertex);
  scratchLayer.addFeatures(vertices);
  const resetGeometry = (): void => {
    geometry.setCoordinates(
      vertices.map((f) => f.getGeometry()!.getCoordinates()),
    );
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
    scratchLayer.removeFeaturesById([vertex.getId() as string]);
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
    destroy: (): void => {
      scratchLayer.removeFeaturesById(
        vertices.map((v) => v.getId()) as string[],
      );
      interactionChain.destroy();
    },
  };
}

function createEditCircleGeometryInteraction(
  feature: Feature<Circle>,
  scratchLayer: VectorLayer,
): EditGeometryInteraction {
  const geometry =
    feature[obliqueGeometry] ?? (feature.getGeometry() as Circle);
  const vertices = geometry.getCoordinates().map(createVertex);
  scratchLayer.addFeatures(vertices);

  const translateVertex = new TranslateVertexInteraction();
  let suspend = false;
  translateVertex.vertexChanged.addEventListener((vertex) => {
    suspend = true;
    if (vertices.indexOf(vertex) === 1) {
      const coords = geometry.getCoordinates();
      coords[1] = vertex.getGeometry()!.getCoordinates();
      const newRadius = cartesian2DDistance(coords[0], coords[1]);
      geometry.setRadius(newRadius);
    } else {
      geometry.setCenter(vertex.getGeometry()!.getCoordinates());
      vertices[1].getGeometry()!.setCoordinates(geometry.getCoordinates()[1]);
    }
    suspend = false;
  });

  const geometryListener = geometry.on('change', () => {
    if (!suspend) {
      geometry.getCoordinates().forEach((c, index) => {
        vertices[index].getGeometry()!.setCoordinates(c);
      });
    }
  });

  const interactionChain = new InteractionChain([translateVertex]);

  return {
    interactionChain,
    destroy: (): void => {
      scratchLayer.removeFeaturesById(
        vertices.map((v) => v.getId()) as string[],
      );
      interactionChain.destroy();
      unByKey(geometryListener);
    },
  };
}

function createEditBBoxGeometryInteraction(
  feature: Feature<Polygon>,
  scratchLayer: VectorLayer,
): EditGeometryInteraction {
  const geometry =
    feature[obliqueGeometry] ?? (feature.getGeometry() as Polygon);
  const vertices = geometry.getCoordinates()[0].map(createVertex);
  scratchLayer.addFeatures(vertices);
  let suspend = false;
  const translateVertex = new TranslateVertexInteraction();
  translateVertex.vertexChanged.addEventListener((vertex) => {
    const vertexIndex = vertices.indexOf(vertex);
    const originIndex = modulo(vertexIndex + 2, 4);
    const rightOfIndex = modulo(vertexIndex + 1, 4);
    const leftOfIndex = modulo(vertexIndex - 1, 4);

    const originCoords = vertices[originIndex].getGeometry()!.getCoordinates();
    const vertexCoords = vertex.getGeometry()!.getCoordinates();
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
      vertex.getGeometry()!.setCoordinates(vertexCoords);
    }
    const updateOtherVertex = (otherVertexIndex: number): void => {
      const otherVertexGeometry = vertices[
        otherVertexIndex
      ].getGeometry() as Point;
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
    geometry.setCoordinates([
      vertices.map((f) => f.getGeometry()!.getCoordinates()),
    ]);
    suspend = false;
  });

  const geometryListener = geometry.on('change', () => {
    if (!suspend) {
      geometry.getCoordinates()[0].forEach((c, index) => {
        vertices[index].getGeometry()!.setCoordinates(c);
      });
    }
  });
  const interactionChain = new InteractionChain([translateVertex]);

  return {
    interactionChain,
    destroy: (): void => {
      scratchLayer.removeFeaturesById(
        vertices.map((v) => v.getId()) as string[],
      );
      interactionChain.destroy();
      unByKey(geometryListener);
    },
  };
}

function createEditSimplePolygonInteraction(
  feature: Feature<Polygon>,
  scratchLayer: VectorLayer,
): EditGeometryInteraction {
  const geometry =
    feature[obliqueGeometry] ?? (feature.getGeometry() as Polygon);
  const linearRing = geometry.getLinearRing(0) as LinearRing;
  const vertices = linearRing.getCoordinates().map(createVertex);
  scratchLayer.addFeatures(vertices);
  const resetGeometry = (): void => {
    const coordinates = vertices.map((f) => f.getGeometry()!.getCoordinates());
    linearRing.setCoordinates(coordinates); // update linear ring for proper vertex insertion
    geometry.setCoordinates([
      vertices.map((f) => f.getGeometry()!.getCoordinates()),
    ]); // update actual geometry, since linear ring is a clone and not a ref
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
    scratchLayer.removeFeaturesById([vertex.getId() as string]);
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
    destroy: (): void => {
      scratchLayer.removeFeaturesById(
        vertices.map((v) => v.getId()) as string[],
      );
      interactionChain.destroy();
    },
  };
}

function createEditPointInteraction(
  feature: Feature<Point>,
  scratchLayer: VectorLayer,
  layer: VectorLayer,
): EditGeometryInteraction {
  const geometry = feature[obliqueGeometry] ?? (feature.getGeometry() as Point);
  const vertex = createVertex(geometry.getCoordinates());
  const featureIdArray = [feature.getId() as string];
  layer.featureVisibility.hideObjects(featureIdArray);
  vertex[createSync] = true;
  scratchLayer.addFeatures([vertex]);
  const translateVertex = new TranslateVertexInteraction();
  let suspend = false;
  translateVertex.vertexChanged.addEventListener(() => {
    suspend = true;
    feature
      .getGeometry()!
      .setCoordinates(vertex.getGeometry()!.getCoordinates());
    suspend = false;
  });

  const geometryListener = geometry.on('change', () => {
    if (!suspend) {
      vertex.getGeometry()!.setCoordinates(geometry.getCoordinates());
    }
  });

  const interactionChain = new InteractionChain([translateVertex]);

  return {
    interactionChain,
    destroy: (): void => {
      interactionChain.destroy();
      scratchLayer.removeFeaturesById([vertex.getId() as string]);
      layer.featureVisibility.showObjects(featureIdArray);
      unByKey(geometryListener);
    },
  };
}

/**
 * Creates the edit geometry session.
 * @param  app
 * @param  layer
 * @param  [interactionId] id for registering mutliple exclusive interaction. Needed to run a selection session at the same time as a edit features session.
 */
function startEditGeometrySession(
  app: VcsApp,
  layer: VectorLayer,
  interactionId?: string,
): EditGeometrySession {
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

  const stopped = new VcsEvent<void>();
  let currentInteractionSet: EditGeometryInteraction | null = null;
  /**
   * The feature that is set for the edit session.
   */
  let currentFeature: Feature | null = null;

  const destroyCurrentInteractionSet = (): void => {
    if (currentInteractionSet) {
      interactionChain.removeInteraction(
        currentInteractionSet.interactionChain,
      );
      currentInteractionSet.destroy();
      currentInteractionSet = null;
    }

    if (currentFeature) {
      delete currentFeature[createSync];
      if (!geometryIsValid(currentFeature.getGeometry())) {
        layer.removeFeaturesById([currentFeature.getId() as string | number]);
      }
    }
    currentFeature = null;
  };

  let featureListener: EventsKey | undefined;

  /**
   * Creates an interaction set from an edit geometry interaction. If the geometry of the feature is not supported a message is logged.
   * @param {Feature} feature The feature to be edited.
   */
  function createCurrentInteractionSet(feature?: Feature): void {
    destroyCurrentInteractionSet();
    if (featureListener) {
      unByKey(featureListener);
    }
    if (feature) {
      featureListener = feature.on('propertychange', ({ key }) => {
        if (geometryChangeKeys.includes(key)) {
          createCurrentInteractionSet(feature);
        }
      });
      currentFeature = feature;
      currentFeature[createSync] = true;
      const geometry =
        feature[obliqueGeometry] ?? (feature.getGeometry() as Geometry);
      const geometryType = geometry.getType();
      scratchLayer.vectorProperties.altitudeMode =
        layer.vectorProperties.getAltitudeMode(feature);
      if (geometryType === GeometryType.Polygon) {
        if (geometry.get('_vcsGeomType') === GeometryType.BBox) {
          currentInteractionSet = createEditBBoxGeometryInteraction(
            feature as Feature<Polygon>,
            scratchLayer,
          );
        } else if ((geometry as Polygon).getLinearRingCount() === 1) {
          currentInteractionSet = createEditSimplePolygonInteraction(
            feature as Feature<Polygon>,
            scratchLayer,
          );
        }
      } else if (geometryType === GeometryType.LineString) {
        currentInteractionSet = createEditLineStringGeometryInteraction(
          feature as Feature<LineString>,
          scratchLayer,
        );
      } else if (geometryType === GeometryType.Point) {
        currentInteractionSet = createEditPointInteraction(
          feature as Feature<Point>,
          scratchLayer,
          layer,
        );
      } else if (geometryType === GeometryType.Circle) {
        currentInteractionSet = createEditCircleGeometryInteraction(
          feature as Feature<Circle>,
          scratchLayer,
        );
      }

      if (currentInteractionSet) {
        interactionChain.addInteraction(currentInteractionSet.interactionChain);
      } else {
        getLogger('EditGeometrySession').warning(
          `Geometry of type ${geometryType} is currently not supported`,
        );
        currentFeature[createSync] = false;
        currentFeature = null;
      }
    }
  }

  const setupActiveMap = (): void => {
    mapInteractionController.reset();
    mouseOverInteraction.reset();
    createCurrentInteractionSet();
  };
  const mapActivatedListener =
    app.maps.mapActivated.addEventListener(setupActiveMap);
  setupActiveMap();

  const stop = (): void => {
    app.layers.remove(scratchLayer);
    if (featureListener) {
      unByKey(featureListener);
    }
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
    setFeature(feature: Feature): void {
      createCurrentInteractionSet(feature);
    },
    get feature(): Feature | null {
      return currentFeature;
    },
  };
}

export default startEditGeometrySession;
