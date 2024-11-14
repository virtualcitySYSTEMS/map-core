import {
  Cartesian3,
  GeometryInstance,
  Material,
  MaterialAppearance,
  Matrix3,
  Matrix4,
  Primitive,
  SphereGeometry,
  TranslationRotationScale,
  VertexFormat,
  Math as CesiumMath,
  Quaternion,
} from '@vcmap-cesium/engine';

export type PanoramaMapOptions = {
  url: string;
};

export default class PanoramaImage {
  private _url: string;

  private _primitive: Primitive | undefined;

  constructor(options: PanoramaMapOptions) {
    this._url = options.url;
  }

  getPrimitive(): Primitive {
    if (!this._primitive) {
      const imgMat = new MaterialAppearance({
        material: Material.fromType('Image', { image: this._url }),
      });

      this._primitive = new Primitive({
        geometryInstances: new GeometryInstance({
          geometry: new SphereGeometry({
            vertexFormat: VertexFormat.POSITION_NORMAL_AND_ST,
            radius: 30.0,
          }),
        }),
        appearance: imgMat,
        asynchronous: false,
        modelMatrix: Matrix4.fromTranslationRotationScale(
          new TranslationRotationScale(
            Cartesian3.fromDegrees(0.0, 0.0, 30),
            Quaternion.fromRotationMatrix(
              Matrix3.fromRotationY(CesiumMath.PI_OVER_TWO),
            ),
          ),
        ),
      });
    }
    return this._primitive;
  }

  destroy(): void {
    if (this._primitive) {
      if (!this._primitive?.isDestroyed()) {
        this._primitive.destroy();
      }
      this._primitive = undefined;
    }
  }
}
