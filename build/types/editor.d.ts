import { VcsEvent, AbstractInteraction } from '@vcmap/core';

/**
 * This is a common interface for all geometry creation interactions.
 * The interaction shall be active on creation.
 * On click, the interaction shall create a geometry and raise the created event with said geoemtry
 * To deactivate (finish) an active interaction, call finish instead of setActive.
 * An interaction shall be finishable via a double click.
 * On finish, the finished event shall be called with the now finished geometry.
 * Said geometry may be invalid.
 * Geometries created may be in pixel coordinates. Appropriate symbols shall be set by the interaction.
 */
export interface CreateInteraction<T extends import('ol/geom').Geometry> {
  finish(): void;
  finished: VcsEvent<T | null>;
  created: VcsEvent<T>;
  destroy(): void;
}

export type Vertex = import('ol').Feature<import('ol/geom').Point>;

export interface SelectFeatureInteraction extends AbstractInteraction {
  readonly selected: Array<import('ol').Feature>;
  setSelected(
    features:
      | Array<
          | import('ol').Feature
          | import('@vcmap-cesium/engine').Cesium3DTileFeature
          | import('@vcmap-cesium/engine').Cesium3DTilePointFeature
          | import('@vcmap-cesium/engine').Entity
        >
      | import('ol').Feature
      | import('@vcmap-cesium/engine').Cesium3DTileFeature
      | import('@vcmap-cesium/engine').Cesium3DTilePointFeature
      | import('@vcmap-cesium/engine').Entity,
  ): void;
  hasFeatureId(id: string): boolean;
}
