import { getLogger } from '@vcsuite/logger';
import { unByKey } from 'ol/Observable.js';
import type { Feature } from 'ol/index.js';
import type {
  Circle,
  Geometry,
  LinearRing,
  LineString,
  Point,
  Polygon,
} from 'ol/geom.js';
import { EventsKey } from 'ol/events.js';
import {
  setupPickingBehavior,
  EditorSession,
  GeometryType,
  SessionType,
  setupInteractionChain,
  setupScratchLayer,
} from './editorSessionHelpers.js';
import InteractionChain from '../../interaction/interactionChain.js';
import type AbstractInteraction from '../../interaction/abstractInteraction.js';
import VcsEvent from '../../vcsEvent.js';
import TranslateVertexInteraction from './interactions/translateVertexInteraction.js';
import RemoveVertexInteraction from './interactions/removeVertexInteraction.js';
import {
  createVertex,
  geometryChangeKeys,
  getCoordinatesAndLayoutFromVertices,
  getOlcsPropsFromFeature,
  syncScratchLayerVectorProperties,
} from './editorHelpers.js';
import InsertVertexInteraction from './interactions/insertVertexInteraction.js';
import EditGeometryMouseOverInteraction from './interactions/editGeometryMouseOverInteraction.js';
import { cartesian2DDistance, modulo } from '../math.js';
import { createSync, obliqueGeometry } from '../../layer/vectorSymbols.js';
import geometryIsValid from './validateGeoemetry.js';
import MapInteractionController from './interactions/mapInteractionController.js';
import type VectorLayer from '../../layer/vectorLayer.js';
import type VcsApp from '../../vcsApp.js';
// eslint-disable-next-line import/no-named-default
import type { default as VectorProperties } from '../../layer/vectorProperties.js';
import TranslationSnapping from './interactions/translationSnapping.js';
import { vertexIndexSymbol } from './editorSymbols.js';
import LayerSnapping from './interactions/layerSnapping.js';
import { EventType } from '../../interaction/interactionType.js';
import { SnapType, snapTypes } from './snappingHelpers.js';
import SegmentLengthInteraction from './interactions/segmentLengthInteraction.js';

export type EditGeometrySession = EditorSession<SessionType.EDIT_GEOMETRY> & {
  setFeature(feature?: Feature): void;
  feature: Feature | null;
  snapTo: SnapType[];
  snapToLayers: VectorLayer[];
};

type EditGeometryInteraction = {
  interactionChain: InteractionChain;
  setSnapTo?: (snapTo: SnapType[]) => void;
  destroy(): void;
};

export type EditGeometrySessionOptions = {
  denyInsertion?: boolean;
  denyRemoval?: boolean;
  initialSnapToLayers?: VectorLayer[];
  snapTo?: SnapType[];
  hideSegmentLength?: boolean;
};

function createEditLineStringGeometryInteraction(
  feature: Feature<LineString>,
  scratchLayer: VectorLayer,
  vectorProperties: VectorProperties,
  options: EditGeometrySessionOptions,
  snapTo: SnapType[],
): EditGeometryInteraction {
  const geometry =
    feature[obliqueGeometry] ?? (feature.getGeometry() as LineString);
  const olcsProps = getOlcsPropsFromFeature(feature);
  const vertices = geometry
    .getCoordinates()
    .map((c, i) => createVertex(c, olcsProps, i));
  scratchLayer.addFeatures(vertices);
  const resetGeometry = (): void => {
    const { coordinates, layout } =
      getCoordinatesAndLayoutFromVertices(vertices);
    geometry.setCoordinates(coordinates, layout);
  };
  const translateVertex = new TranslateVertexInteraction();
  translateVertex.vertexChanged.addEventListener(resetGeometry);

  const translationSnapping = new TranslationSnapping(
    scratchLayer,
    geometry,
    snapTo,
  );
  const interactions: AbstractInteraction[] = [
    translationSnapping,
    translateVertex,
  ];

  if (!options.hideSegmentLength) {
    const segmentLength = new SegmentLengthInteraction(scratchLayer, false);
    segmentLength.setGeometry(geometry);
    interactions.push(segmentLength);
  }

  if (!options.denyInsertion) {
    const insertVertex = new InsertVertexInteraction(
      feature,
      geometry,
      vectorProperties,
    );
    insertVertex.vertexInserted.addEventListener(({ vertex, index }) => {
      scratchLayer.addFeatures([vertex]);
      vertices.splice(index, 0, vertex);
      vertices.forEach((v, i) => {
        v[vertexIndexSymbol] = i;
      });
      resetGeometry();
    });
    interactions.push(insertVertex);
  }

  if (!options.denyRemoval) {
    const removeVertex = new RemoveVertexInteraction();
    removeVertex.vertexRemoved.addEventListener((vertex) => {
      scratchLayer.removeFeaturesById([vertex.getId() as string]);
      const index = vertices.indexOf(vertex);
      if (index > -1) {
        vertices.splice(index, 1);
        resetGeometry();
      }
    });
    interactions.push(removeVertex);
  }

  const interactionChain = new InteractionChain(interactions);

  return {
    interactionChain,
    setSnapTo(newSnapTo): void {
      translationSnapping.snapTo = newSnapTo;
    },
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
  options: EditGeometrySessionOptions,
): EditGeometryInteraction {
  const geometry =
    feature[obliqueGeometry] ?? (feature.getGeometry() as Circle);
  const olcsProps = getOlcsPropsFromFeature(feature);
  const vertices = geometry
    .getCoordinates()
    .map((c, i) => createVertex(c, olcsProps, i));
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
      const { coordinates, layout } = getCoordinatesAndLayoutFromVertices([
        vertex,
      ]);
      geometry.setCenterAndRadius(coordinates[0], geometry.getRadius(), layout);
      vertices[1]
        .getGeometry()!
        .setCoordinates(geometry.getCoordinates()[1], layout);
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

  const interactions: AbstractInteraction[] = [translateVertex];
  if (!options.hideSegmentLength) {
    const segmentLength = new SegmentLengthInteraction(scratchLayer, false);
    segmentLength.setGeometry(geometry);
    interactions.push(segmentLength);
  }

  const interactionChain = new InteractionChain(interactions);

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
  options: EditGeometrySessionOptions,
): EditGeometryInteraction {
  const geometry =
    feature[obliqueGeometry] ?? (feature.getGeometry() as Polygon);
  const olcsProps = getOlcsPropsFromFeature(feature);
  const vertices = geometry
    .getCoordinates()[0]
    .map((c, i) => createVertex(c, olcsProps, i));

  scratchLayer.addFeatures(vertices);
  let suspend = false;
  const translateVertex = new TranslateVertexInteraction();
  translateVertex.vertexChanged.addEventListener((vertex) => {
    const index = vertices.indexOf(vertex);
    const originIndex = modulo(index + 2, 4);
    const rightOfIndex = modulo(index + 1, 4);
    const leftOfIndex = modulo(index - 1, 4);

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
    const { coordinates, layout } =
      getCoordinatesAndLayoutFromVertices(vertices);
    geometry.setCoordinates([coordinates], layout);
    suspend = false;
  });

  const geometryListener = geometry.on('change', () => {
    if (!suspend) {
      const layout = geometry.getLayout();
      geometry.getCoordinates()[0].forEach((c, index) => {
        vertices[index].getGeometry()!.setCoordinates(c, layout);
      });
    }
  });

  const interactions: AbstractInteraction[] = [translateVertex];

  if (!options.hideSegmentLength) {
    const segmentLength = new SegmentLengthInteraction(scratchLayer, false);
    segmentLength.setGeometry(geometry);
    interactions.push(segmentLength);
  }

  const interactionChain = new InteractionChain(interactions);

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
  vectorProperties: VectorProperties,
  options: EditGeometrySessionOptions,
  snapTo: SnapType[],
): EditGeometryInteraction {
  const geometry =
    feature[obliqueGeometry] ?? (feature.getGeometry() as Polygon);
  const linearRing = geometry.getLinearRing(0) as LinearRing;
  const olcsProps = getOlcsPropsFromFeature(feature);

  const vertices = linearRing
    .getCoordinates()
    .map((c, i) => createVertex(c, olcsProps, i));
  scratchLayer.addFeatures(vertices);
  const resetGeometry = (): void => {
    const { coordinates, layout } =
      getCoordinatesAndLayoutFromVertices(vertices);
    linearRing.setCoordinates(coordinates, layout); // update linear ring for proper vertex insertion
    geometry.setCoordinates([coordinates], layout); // update actual geometry, since linear ring is a clone and not a ref
  };

  const translateVertex = new TranslateVertexInteraction();
  translateVertex.vertexChanged.addEventListener(resetGeometry);

  const translationSnapping = new TranslationSnapping(
    scratchLayer,
    geometry,
    snapTo,
  );
  const interactions: AbstractInteraction[] = [
    translationSnapping,
    translateVertex,
  ];

  if (!options.hideSegmentLength) {
    const segmentLength = new SegmentLengthInteraction(scratchLayer, false);
    segmentLength.setGeometry(geometry);
    interactions.push(segmentLength);
  }

  if (!options.denyInsertion) {
    const insertVertex = new InsertVertexInteraction(
      feature,
      linearRing,
      vectorProperties,
    );
    insertVertex.vertexInserted.addEventListener(({ vertex, index }) => {
      scratchLayer.addFeatures([vertex]);
      vertices.splice(index, 0, vertex);
      vertices.forEach((v, i) => {
        v[vertexIndexSymbol] = i;
      });
      resetGeometry();
    });
    interactions.push(insertVertex);
  }

  if (!options.denyRemoval) {
    const removeVertex = new RemoveVertexInteraction();
    removeVertex.vertexRemoved.addEventListener((vertex) => {
      scratchLayer.removeFeaturesById([vertex.getId() as string]);
      const index = vertices.indexOf(vertex);
      if (index > -1) {
        vertices.splice(index, 1);
        resetGeometry();
      }
    });
    interactions.push(removeVertex);
  }

  const interactionChain = new InteractionChain(interactions);

  return {
    interactionChain,
    setSnapTo(newSnapTo): void {
      translationSnapping.snapTo = newSnapTo;
    },
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
  const olcsProps = getOlcsPropsFromFeature(feature);

  const vertex = createVertex(geometry.getCoordinates(), olcsProps, 0);
  const featureIdArray = [feature.getId() as string];
  layer.featureVisibility.hideObjects(featureIdArray);
  vertex[createSync] = true;
  scratchLayer.addFeatures([vertex]);
  const translateVertex = new TranslateVertexInteraction();
  let suspend = false;
  translateVertex.vertexChanged.addEventListener(() => {
    suspend = true;
    const { coordinates, layout } = getCoordinatesAndLayoutFromVertices([
      vertex,
    ]);
    geometry.setCoordinates(coordinates[0], layout);
    suspend = false;
  });

  const geometryListener = geometry.on('change', () => {
    if (!suspend) {
      vertex
        .getGeometry()!
        .setCoordinates(geometry.getCoordinates(), geometry.getLayout());
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
 * @param  [interactionId] id for registering multiple exclusive interaction. Needed to run a selection session at the same time as a edit features session.
 * @param  [editVertexOptions={}]
 */
function startEditGeometrySession(
  app: VcsApp,
  layer: VectorLayer,
  interactionId?: string,
  editVertexOptions: EditGeometrySessionOptions = {},
): EditGeometrySession {
  const {
    interactionChain,
    removed: interactionRemoved,
    destroy: destroyInteractionChain,
  } = setupInteractionChain(app.maps.eventHandler, interactionId);

  const { layer: scratchLayer, destroy: destroyScratchLayer } =
    setupScratchLayer(app.layers, app.maps.eventHandler.featureInteraction);

  const mapInteractionController = new MapInteractionController();
  interactionChain.addInteraction(mapInteractionController);

  const mouseOverInteraction = new EditGeometryMouseOverInteraction(
    editVertexOptions.denyRemoval,
  );
  interactionChain.addInteraction(mouseOverInteraction);

  const stopped = new VcsEvent<void>();
  let currentInteractionSet: EditGeometryInteraction | null = null;
  /**
   * The feature that is set for the edit session.
   */
  let currentFeature: Feature | null = null;
  let layerSnappingInteraction: LayerSnapping | null = null;
  let snapToLayers: VectorLayer[] =
    editVertexOptions?.initialSnapToLayers?.slice() ?? [layer];

  let snapTo = editVertexOptions?.snapTo?.slice() ?? [...snapTypes];

  const resetPickingBehavior = setupPickingBehavior(app);
  const altitudeModeChanged = (): void => {
    scratchLayer.vectorProperties.altitudeMode = currentFeature
      ? layer.vectorProperties.getAltitudeMode(currentFeature)
      : layer.vectorProperties.altitudeMode;
  };
  altitudeModeChanged();

  const vectorPropertiesChangedListener = syncScratchLayerVectorProperties(
    scratchLayer,
    layer,
    altitudeModeChanged,
  );

  const destroyCurrentInteractionSet = (): void => {
    if (currentInteractionSet) {
      interactionChain.removeInteraction(
        currentInteractionSet.interactionChain,
      );
      currentInteractionSet.destroy();
      currentInteractionSet = null;
      layerSnappingInteraction = null; // destroyed in current interaction set
    }

    if (currentFeature) {
      delete currentFeature[createSync];
      if (!geometryIsValid(currentFeature.getGeometry())) {
        layer.removeFeaturesById([currentFeature.getId() as string | number]);
      }
    }
    currentFeature = null;
    altitudeModeChanged();
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
      app.maps.eventHandler.featureInteraction.excludeFromPickPosition(feature);
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
            editVertexOptions,
          );
        } else if ((geometry as Polygon).getLinearRingCount() === 1) {
          currentInteractionSet = createEditSimplePolygonInteraction(
            feature as Feature<Polygon>,
            scratchLayer,
            layer.vectorProperties,
            editVertexOptions,
            snapTo,
          );
        }
      } else if (geometryType === GeometryType.LineString) {
        currentInteractionSet = createEditLineStringGeometryInteraction(
          feature as Feature<LineString>,
          scratchLayer,
          layer.vectorProperties,
          editVertexOptions,
          snapTo,
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
          editVertexOptions,
        );
      }

      if (currentInteractionSet) {
        layerSnappingInteraction = new LayerSnapping(
          snapToLayers,
          scratchLayer,
          (f) => f !== feature,
          snapTo,
          EventType.DRAGEVENTS,
        );
        currentInteractionSet.interactionChain.addInteraction(
          layerSnappingInteraction,
          0,
        );
        interactionChain.addInteraction(currentInteractionSet.interactionChain);
        altitudeModeChanged();
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
    if (currentFeature) {
      app.maps.eventHandler.featureInteraction.includeInPickPosition(
        currentFeature,
      );
    }
    destroyScratchLayer();
    if (featureListener) {
      unByKey(featureListener);
    }
    mapActivatedListener();
    mapInteractionController.reset();
    mouseOverInteraction.reset();
    destroyCurrentInteractionSet();
    destroyInteractionChain();
    vectorPropertiesChangedListener();
    resetPickingBehavior();
    stopped.raiseEvent();
    stopped.destroy();
  };
  interactionRemoved.addEventListener(stop);

  return {
    type: SessionType.EDIT_GEOMETRY,
    stopped,
    stop,
    setFeature(feature?: Feature): void {
      createCurrentInteractionSet(feature);
    },
    get feature(): Feature | null {
      return currentFeature;
    },
    get snapTo(): SnapType[] {
      return snapTo.slice();
    },
    set snapTo(newSnaps: SnapType[]) {
      snapTo = newSnaps.slice();
      if (layerSnappingInteraction) {
        layerSnappingInteraction.snapTo = snapTo;
      }
      currentInteractionSet?.setSnapTo?.(snapTo);
    },
    get snapToLayers(): VectorLayer[] {
      return snapToLayers.slice();
    },
    set snapToLayers(layers: VectorLayer[]) {
      snapToLayers = layers.slice();
      if (layerSnappingInteraction) {
        layerSnappingInteraction.layers = snapToLayers;
      }
    },
  };
}

export default startEditGeometrySession;
