import type {
  HeightReference,
  Model,
  Primitive,
  Scene,
} from '@vcmap-cesium/engine';
import {
  Cartesian3,
  Cartographic,
  ClassificationPrimitive,
  Matrix4,
} from '@vcmap-cesium/engine';
import { mercatorToCartographic } from '../math.js';

const scratchUpdateHeightCartesian = new Cartesian3();

function getUpdateHeightCallback(
  primitive: Primitive | Model,
  originalPosition: Cartesian3,
): (cartographic: Cartographic) => void {
  return function updatePrimitiveHeight(clampedPosition: Cartographic) {
    Cartographic.toCartesian(
      clampedPosition,
      undefined,
      scratchUpdateHeightCartesian,
    );

    Cartesian3.subtract(
      scratchUpdateHeightCartesian,
      originalPosition,
      scratchUpdateHeightCartesian,
    );

    const { modelMatrix } = primitive;
    primitive.modelMatrix = Matrix4.setTranslation(
      modelMatrix,
      scratchUpdateHeightCartesian,
      new Matrix4(),
    );
  };
}

function getUpdateClassificationHeightCallback(
  primitive: ClassificationPrimitive,
  originalPosition: Cartesian3,
): (cartographic: Cartographic) => void {
  return function updatePrimitiveHeight(clampedPosition: Cartographic) {
    Cartographic.toCartesian(
      clampedPosition,
      undefined,
      scratchUpdateHeightCartesian,
    );

    Cartesian3.subtract(
      scratchUpdateHeightCartesian,
      originalPosition,
      scratchUpdateHeightCartesian,
    );

    if (primitive.ready) {
      // eslint-disable-next-line no-underscore-dangle
      const innerPrimitive = primitive._primitive as Primitive;

      const { modelMatrix } = innerPrimitive;
      innerPrimitive.modelMatrix = Matrix4.setTranslation(
        modelMatrix,
        scratchUpdateHeightCartesian,
        new Matrix4(),
      );
    } else {
      // eslint-disable-next-line no-underscore-dangle
      primitive._primitiveOptions!.modelMatrix = Matrix4.setTranslation(
        Matrix4.IDENTITY,
        scratchUpdateHeightCartesian,
        new Matrix4(),
      );
    }
  };
}

export function setupClampedPrimitive(
  scene: Scene,
  primitive: Primitive | Model | ClassificationPrimitive,
  origin: [number, number],
  heightReference: HeightReference,
): void {
  const destroy = primitive.destroy.bind(primitive);
  const originCartographic = mercatorToCartographic(origin);
  let callback;
  if (primitive instanceof ClassificationPrimitive) {
    callback = getUpdateClassificationHeightCallback(
      primitive,
      Cartographic.toCartesian(originCartographic),
    );
  } else {
    callback = getUpdateHeightCallback(
      primitive,
      Cartographic.toCartesian(originCartographic),
    );
  }

  const callbackHandler = scene.updateHeight(
    originCartographic,
    callback,
    heightReference,
  );

  const height = scene.getHeight(originCartographic, heightReference);
  if (height) {
    const updatedHeightCarto = originCartographic.clone();
    updatedHeightCarto.height = height;
    callback(updatedHeightCarto);
  }

  primitive.destroy = (): void => {
    callbackHandler();
    destroy();
  };
}
