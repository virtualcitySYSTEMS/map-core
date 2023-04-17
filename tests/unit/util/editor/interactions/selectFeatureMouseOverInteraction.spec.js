import { expect } from 'chai';
import { Feature } from 'ol';
import {
  ModificationKeyType,
  cursorMap,
  SelectFeatureMouseOverInteraction,
  SelectMultiFeatureInteraction,
  VectorLayer,
  SelectSingleFeatureInteraction,
  mouseOverSymbol,
} from '../../../../../index.js';

describe('EditGeometryMouseOverInteraction', () => {
  let interaction;
  let layer;
  let feature;
  let cursorStyle;
  let selectFeaturesInteraction;

  before(() => {
    layer = new VectorLayer({});
    feature = new Feature();
    layer.addFeatures([feature]);
    cursorStyle = { cursor: '' };
  });
  afterEach(() => {
    cursorStyle.cursor = '';
  });

  describe('single selection mode', () => {
    before(() => {
      selectFeaturesInteraction = new SelectSingleFeatureInteraction(layer);
      interaction = new SelectFeatureMouseOverInteraction(
        layer.name,
        selectFeaturesInteraction,
      );
      interaction.cursorStyle = cursorStyle;
    });
    it('should change the cursor style, to select, if hovering over a feature', async () => {
      await interaction.pipe({ feature });
      expect(cursorStyle.cursor).to.equal(cursorMap.select);
    });
    it('should change the cursor style, to select, if leaving a feature', async () => {
      await interaction.pipe({ feature });
      await interaction.pipe({});
      expect(cursorStyle.cursor).to.equal(cursorMap.auto);
    });
  });

  describe('multi selection mode', () => {
    before(() => {
      selectFeaturesInteraction = new SelectMultiFeatureInteraction(layer);
      interaction = new SelectFeatureMouseOverInteraction(
        layer.name,
        selectFeaturesInteraction,
      );
      interaction.cursorStyle = cursorStyle;
    });
    it('should change the cursor style, to select, if hovering over a feature', async () => {
      await interaction.pipe({ feature });
      expect(cursorStyle.cursor).to.equal(cursorMap.select);
    });
    it('should change the cursor style, to select, if leaving a feature', async () => {
      await interaction.pipe({ feature });
      await interaction.pipe({});
      expect(cursorStyle.cursor).to.equal(cursorMap.auto);
    });
    it('should change the cursor style to add to selection, if hovering over a feature with CTRL', async () => {
      await interaction.pipe({ feature, key: ModificationKeyType.CTRL });
      expect(cursorStyle.cursor).to.equal(cursorMap.addToSelection);
    });

    it('should change the cursor style to remove from selection if modification key changes to CTRL and the feature is selected', async () => {
      await selectFeaturesInteraction.setSelected([feature]);
      await interaction.pipe({ feature, key: ModificationKeyType.CTRL });
      expect(cursorStyle.cursor).to.equal(cursorMap.removeFromSelection);
    });

    describe('changing the modification key, while a selected feature is hovered', () => {
      beforeEach(async () => {
        await selectFeaturesInteraction.setSelected([feature]);
        await interaction.pipe({ feature });
      });

      it('should change the cursor style, if modification key changes to ctrl', () => {
        interaction.modifierChanged(ModificationKeyType.CTRL);
        expect(cursorStyle.cursor).to.equal(cursorMap.removeFromSelection);
      });

      it('should change the cursor style, if modification key changes to ctrl', () => {
        selectFeaturesInteraction.clear();
        interaction.modifierChanged(ModificationKeyType.CTRL);
        expect(cursorStyle.cursor).to.equal(cursorMap.addToSelection);
      });
    });
  });

  describe('interaction with features on different layers', () => {
    it('should not reset cursor style when style was changed by different interaction', async () => {
      cursorStyle.cursor = cursorMap.scaleNESW;
      cursorStyle[mouseOverSymbol] = 'other_id';
      const featureOnOtherLayer = new Feature();
      await interaction.pipe({ feature: featureOnOtherLayer });
      expect(cursorStyle.cursor).to.equal(cursorMap.scaleNESW);
    });
  });
});
