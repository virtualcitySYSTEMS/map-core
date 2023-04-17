import { expect } from 'chai';
import { Feature } from 'ol';
import {
  handlerSymbol,
  mouseOverSymbol,
  cursorMap,
  AXIS_AND_PLANES,
  EditFeaturesMouseOverInteraction,
  SelectMultiFeatureInteraction,
  VectorLayer,
} from '../../../../../index.js';

describe('EditFeaturesMouseOverInteraction', () => {
  let interaction;
  let layer;
  let feature;
  let handler;
  let cursorStyle;
  let selectFeaturesInteraction;

  before(() => {
    layer = new VectorLayer({});
    feature = new Feature();
    layer.addFeatures([feature]);
    handler = new Feature();
    handler[handlerSymbol] = AXIS_AND_PLANES.X;
  });

  beforeEach(() => {
    cursorStyle = { cursor: '' };
    selectFeaturesInteraction = new SelectMultiFeatureInteraction(layer);
    interaction = new EditFeaturesMouseOverInteraction();
    interaction.cursorStyle = cursorStyle;
  });

  afterEach(() => {
    layer.destroy();
    selectFeaturesInteraction.destroy();
    interaction.destroy();
  });

  describe('interaction with handler', () => {
    it('should change the cursor style, to translate, if hovering over a handler', async () => {
      await interaction.pipe({ feature: handler });
      expect(cursorStyle.cursor).to.equal(cursorMap.translate);
    });

    it('should change the cursor style, to auto, if cursor leaves handler', async () => {
      await interaction.pipe({ feature: handler });
      await interaction.pipe({ feature: null });
      expect(cursorStyle.cursor).to.equal(cursorMap.auto);
    });
  });

  describe('interaction with other features', () => {
    it('should not reset cursor style when style was changed by different interaction', async () => {
      cursorStyle.cursor = cursorMap.translateVertex;
      cursorStyle[mouseOverSymbol] = 'other_id';
      await interaction.pipe({ feature });
      expect(cursorStyle.cursor).to.equal(cursorMap.translateVertex);
    });
  });
});
