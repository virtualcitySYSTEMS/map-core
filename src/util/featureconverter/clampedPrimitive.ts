import {
  Cartesian3,
  Cartographic,
  HeightReference,
  Matrix4,
  Model,
  Primitive,
  Scene,
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

// eslint-disable-next-line import/prefer-default-export
export function setupClampedPrimitive(
  scene: Scene,
  primitive: Primitive | Model,
  origin: [number, number],
  heightReference: HeightReference,
): void {
  const destroy = primitive.destroy.bind(primitive);
  const originCartographic = mercatorToCartographic(origin);
  const callback = getUpdateHeightCallback(
    primitive,
    Cartographic.toCartesian(originCartographic),
  );
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
