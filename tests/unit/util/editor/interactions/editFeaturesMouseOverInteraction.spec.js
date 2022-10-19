import { Feature } from 'ol';
import {
  ModificationKeyType,
  handlerSymbol,
  cursorMap,
  AXIS_AND_PLANES,
  EditFeaturesMouseOverInteraction, SelectMultiFeatureInteraction, VectorLayer,
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
    interaction = new EditFeaturesMouseOverInteraction(layer.name, selectFeaturesInteraction);
    interaction.cursorStyle = cursorStyle;
  });

  afterEach(() => {
    layer.destroy();
    selectFeaturesInteraction.destroy();
    interaction.destroy();
  });

  it('should change the cursor style, to select, if hovering over a feature', async () => {
    await interaction.pipe({ feature });
    expect(cursorStyle.cursor).to.equal(cursorMap.select);
  });

  it('should change the cursor style to add to selection, if hovering over a feature with CTRL', async () => {
    await interaction.pipe({ feature, key: ModificationKeyType.CTRL });
    expect(cursorStyle.cursor).to.equal(cursorMap.addToSelection);
  });

  it('should change the cursor style to remove from selection if modification key changes to CTRL and the feature is selected', async () => {
    await selectFeaturesInteraction.setSelectionSet([feature]);
    await interaction.pipe({ feature, key: ModificationKeyType.CTRL });
    expect(cursorStyle.cursor).to.equal(cursorMap.removeFromSelection);
  });

  it('should change the cursor style, to select, if hovering over a handler with alt', async () => {
    await interaction.pipe({ feature: handler });
    expect(cursorStyle.cursor).to.equal(cursorMap.select);
  });

  it('should change the cursor style, to auto, without a feature', async () => {
    await interaction.pipe({ feature: null });
    expect(cursorStyle.cursor).to.equal(cursorMap.auto);
  });

  describe('changing the modification key, while a selected feature is hovered', () => {
    beforeEach(async () => {
      await selectFeaturesInteraction.setSelectionSet([feature]);
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
