import type { Cartesian2 } from '@vcmap-cesium/engine';
import { Color, Material } from '@vcmap-cesium/engine';
import { getLogger } from '@vcsuite/logger';

const source = `
czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material m = czm_getDefaultMaterial(materialInput);
    vec2 clamped = clamp(materialInput.st, min, max);
    vec2 scaled = (clamped - min) / (max - min);
    vec4 t_color = texture(image, scaled);
    m.diffuse = t_color.rgb;
    m.specular = 0.5;
    m.emission = t_color.rgb * vec3(0.5);
    m.alpha = alpha;
    return m;
}
`;

export default class PanoramaTileMaterial extends Material {
  private _opacity = 1;

  ready: Promise<void>;

  declare private _loadedImages: unknown[];

  declare uniforms: {
    image: HTMLCanvasElement;
    min: Cartesian2;
    max: Cartesian2;
    alpha: number;
    color: Color;
  };

  private _readyResolve: (() => void) | undefined;

  constructor(image: HTMLCanvasElement, min: Cartesian2, max: Cartesian2) {
    super({
      fabric: {
        type: 'TileImage',
        uniforms: {
          image,
          color: Color.WHITE.withAlpha(0.0),
          min,
          max,
          alpha: 0,
        },
        source,
      },
      translucent: false,
    });

    this.ready = new Promise<void>((resolve) => {
      this._readyResolve = resolve;
    });

    this.ready
      .then(() => {
        this.uniforms.alpha = this.opacity;
      })
      .catch(() => {
        getLogger('PanoramaTileMaterial').error(
          'Error loading panorama tile material',
        );
      });
  }

  get opacity(): number {
    return this._opacity;
  }

  set opacity(value: number) {
    this._opacity = value;
    if (!this._readyResolve) {
      this.uniforms.alpha = value;
    }
  }

  update(context: unknown): void {
    const resolve = this._readyResolve && !!this._loadedImages?.length;
    // @ts-expect-error is actually private
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    super.update(context);

    if (resolve) {
      this._readyResolve?.();
      this._readyResolve = undefined;
    }
  }
}
