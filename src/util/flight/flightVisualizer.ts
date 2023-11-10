import {
  PrimitiveCollection,
  Camera,
  Cartesian3,
  HeadingPitchRoll,
  Scene,
} from '@vcmap-cesium/engine';
import { createEmpty, isEmpty } from 'ol/extent.js';
import Feature from 'ol/Feature.js';
import { Point, LineString } from 'ol/geom.js';
import { check } from '@vcsuite/check';

import { mercatorToWgs84Transformer, wgs84Projection } from '../projection.js';
import VectorLayer from '../../layer/vectorLayer.js';
import Viewpoint from '../viewpoint.js';
import CesiumMap from '../../map/cesiumMap.js';
import VcsCameraPrimitive from '../../cesium/cesiumVcsCameraPrimitive.js';
import FlightInstance from './flightInstance.js';
import type VcsApp from '../../vcsApp.js';
import { getFlightPathCoordinatesFromInstance } from './flightHelpers.js';
import LayerState from '../../layer/layerState.js';
import VcsEvent from '../../vcsEvent.js';
import DeclarativeStyleItem from '../../style/declarativeStyleItem.js';
import { markVolatile } from '../../vcsModule.js';

export type FlightVisualization = {
  readonly state: LayerState;
  readonly stateChanged: VcsEvent<LayerState>;
  readonly destroyed: VcsEvent<void>;
  deactivate(): void;
  activate(): Promise<void>;
  destroy(): void;
  zoomToExtent(): Promise<void>;
};

const flightVisualizationSymbol = Symbol('flightVisualization');
export async function createFlightVisualization(
  instance: FlightInstance & {
    [flightVisualizationSymbol]?: FlightVisualization;
  },
  app: VcsApp,
): Promise<FlightVisualization> {
  check(instance, FlightInstance);
  if (instance[flightVisualizationSymbol]) {
    instance[flightVisualizationSymbol]?.destroy();
  }
  await instance.initialize();
  let extent = createEmpty();

  const primitives = new PrimitiveCollection();
  primitives.show = false;
  const layer = new VectorLayer({
    projection: wgs84Projection.toJSON(),
    name: `flightLayer-${instance.name}`,
    style: {
      type: DeclarativeStyleItem.className,
      declarativeStyle: {
        // eslint-disable-next-line no-template-curly-in-string
        labelText: '${title}',
        image: 'false',
        color: 'color("#333333")',
        strokeWidth: '2',
      },
    },
    vectorProperties: {
      altitudeMode: 'absolute',
    },
  });
  markVolatile(layer);

  let scene: Scene | undefined;
  const [cesiumMap] = app.maps.getByType(CesiumMap.className) as CesiumMap[];
  if (cesiumMap) {
    scene = cesiumMap.getScene();
    if (scene && !scene.primitives.contains(primitives)) {
      scene.primitives.add(primitives);
    }
  }

  app.layers.add(layer);
  const setFeatures = (): void => {
    layer.removeAllFeatures();
    primitives.removeAll();
    if (!instance.isValid()) {
      return;
    }

    const features: Feature<Point | LineString>[] = [];
    for (const anchor of instance.anchors) {
      if (scene) {
        const camera = new Camera(scene);
        camera.frustum.far = 200;
        camera.frustum.near = 10;
        camera.setView({
          destination: Cartesian3.fromDegrees(
            anchor.coordinate[0],
            anchor.coordinate[1],
            anchor.coordinate[2],
          ),
          orientation: HeadingPitchRoll.fromDegrees(
            anchor.heading,
            anchor.pitch,
            anchor.roll,
          ),
        });
        primitives.add(new VcsCameraPrimitive({ camera, allowPicking: false }));
      }

      features.push(
        new Feature({
          geometry: new Point(anchor.coordinate, 'XYZ'),
          title: anchor.title ?? anchor.name,
          duration: anchor.duration,
        }),
      );
    }

    const pathCoordinates = getFlightPathCoordinatesFromInstance(instance);

    const flightPath = new Feature({
      geometry: new LineString(pathCoordinates, 'XYZ'),
    });
    flightPath.setId('flightPathGeom');

    features.push(flightPath);
    layer.addFeatures(features);
    const mercatorExtent = layer.getSource().getExtent();
    extent = mercatorToWgs84Transformer(mercatorExtent, mercatorExtent, 2);
  };
  setFeatures();

  const changeListeners = [
    instance.anchorsChanged.addEventListener(setFeatures),
    instance.propertyChanged.addEventListener((property) => {
      if (property === 'loop' || property === 'interpolation') {
        setFeatures();
      }
    }),
  ];

  const destroyed = new VcsEvent<void>();
  const destroy = (): void => {
    layer.deactivate();
    app.layers.remove(layer);
    layer.destroy();

    if (scene && scene.primitives.contains(primitives)) {
      scene.primitives.remove(primitives);
    }
    changeListeners.forEach((cb) => {
      cb();
    });
    destroyed.raiseEvent();
    destroyed.destroy();
    delete instance[flightVisualizationSymbol];
  };

  changeListeners.push(
    app.flights.removed.addEventListener((flight) => {
      if (flight === instance) {
        destroy();
      }
    }),
    app.flights.added.addEventListener((flight) => {
      if (flight.name === instance.name) {
        destroy();
      }
    }),
  );

  const visualization: FlightVisualization = {
    get state(): LayerState {
      return layer.state;
    },
    get stateChanged(): VcsEvent<LayerState> {
      return layer.stateChanged;
    },
    get destroyed(): VcsEvent<void> {
      return destroyed;
    },
    async activate(): Promise<void> {
      await layer.activate();
      primitives.show = true;
    },
    deactivate(): void {
      layer.deactivate();
      primitives.show = false;
    },
    destroy,
    async zoomToExtent(): Promise<void> {
      if (!instance.isValid() || isEmpty(extent)) {
        return;
      }
      const viewpoint = Viewpoint.createViewpointFromExtent(extent);
      if (viewpoint) {
        await app.maps.activeMap?.gotoViewpoint(viewpoint);
      }
    },
  };
  instance[flightVisualizationSymbol] = visualization;
  return visualization;
}
