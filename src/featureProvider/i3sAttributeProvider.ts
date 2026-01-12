import { getLogger } from '@vcsuite/logger';
import type { I3SNode } from '@vcmap-cesium/engine';
import { Cesium3DTileFeature } from '@vcmap-cesium/engine';
import Feature from 'ol/Feature.js';
import { isI3SFeature } from '../interaction/featureAtPixelInteraction.js';
import AbstractAttributeProvider from './abstractAttributeProvider.js';
import { isProvidedFeature } from './featureProviderSymbols.js';
import { i3sData } from '../layer/layerSymbols.js';

export default class I3SAttributeProvider extends AbstractAttributeProvider {
  static get className(): string {
    return 'I3SAttributeProvider';
  }

  protected async _getAttributes(
    _key: string,
    feature: Cesium3DTileFeature | Feature,
  ): Promise<Record<string, unknown> | undefined> {
    if (feature instanceof Cesium3DTileFeature) {
      const id = feature.featureId;

      if (id && feature.content?.tile?.i3sNode) {
        const node = feature.content.tile.i3sNode as unknown as I3SNode;
        return node
          .loadFields()
          .then(() => node.getFieldsForFeature(id) as Record<string, unknown>)
          .catch(() => {
            getLogger(this.className).warning(
              `Error getting I3S fields for feature with id ${id}`,
            );
            return undefined;
          });
      }
    } else if (
      feature instanceof Feature &&
      feature[isProvidedFeature] &&
      isI3SFeature(feature)
    ) {
      const { i3sNode, cartesianPosition } = feature[i3sData];
      if (i3sNode && cartesianPosition) {
        return i3sNode
          .loadFields()
          .then(
            () =>
              i3sNode.getFieldsForPickedPosition(cartesianPosition) as Record<
                string,
                unknown
              >,
          )
          .catch(() => {
            getLogger(this.className).warning(
              'Error getting I3S fields for picked position',
            );
            return undefined;
          });
      }
    }
    return undefined;
  }
}
