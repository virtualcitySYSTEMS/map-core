import { v4 } from 'uuid';
import { Feature } from 'ol';
import { Cartesian3, IntersectionTests } from '@vcmap-cesium/engine';
import { Point } from 'ol/geom.js';
import sinon from 'sinon';
import {
  AxisAndPlanes,
  createTransformationHandler,
  handlerSymbol,
  mercatorProjection,
  TransformationHandler,
  TransformationMode,
  VcsApp,
  VcsMap,
  VectorLayer,
} from '../../../../../index.js';

export type TransformationSetup = {
  transformationHandler: TransformationHandler;
  app: VcsApp;
  layer: VectorLayer;
  scratchLayer: VectorLayer;
  destroy: () => void;
};

export async function setupTransformationHandler(
  map: VcsMap,
  mode: TransformationMode,
): Promise<TransformationSetup> {
  const app = new VcsApp();
  app.maps.add(map);
  const scratchLayer = new VectorLayer({
    projection: mercatorProjection.toJSON(),
  });
  const layer = new VectorLayer({
    projection: mercatorProjection.toJSON(),
  });
  app.layers.add(scratchLayer);
  app.layers.add(layer);

  await app.maps.setActiveMap(map.name);
  await layer.activate();
  await scratchLayer.activate();

  const transformationHandler = createTransformationHandler(
    map,
    layer,
    scratchLayer,
    mode,
  );
  return {
    transformationHandler,
    app,
    layer,
    scratchLayer,
    destroy(): void {
      transformationHandler.destroy();
      app.destroy();
    },
  };
}

export function createHandlerFeature(axis: AxisAndPlanes): Feature {
  const feature = new Feature();
  feature[handlerSymbol] = axis;
  return feature;
}

export function patchPickRay(
  calls: Cartesian3[],
  sandbox: sinon.SinonSandbox,
): () => void {
  const stub = (sandbox ?? sinon).stub(IntersectionTests, 'rayPlane');
  calls.forEach((value, index) => {
    stub.onCall(index).returns(value);
  });

  return () => {
    stub.restore();
  };
}

export function createFeatureWithId(
  propsOrProps: Point | Record<string, unknown>,
): Feature<Point> {
  const feature = new Feature(propsOrProps);
  feature.setId(v4());
  return feature as Feature<Point>;
}
