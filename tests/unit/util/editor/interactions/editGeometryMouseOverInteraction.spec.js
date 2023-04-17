import { Feature } from 'ol';
import {
  EditGeometryMouseOverInteraction,
  ModificationKeyType,
  vcsLayerName,
  vertexSymbol,
  cursorMap,
  mouseOverSymbol,
} from '../../../../../index.js';

describe('EditGeometryMouseOverInteraction', () => {
  let interaction;
  let layerName;
  let feature;
  let vertex;
  let cursorStyle;

  before(() => {
    layerName = 'foo';
    feature = new Feature();
    feature[vcsLayerName] = layerName;
    vertex = new Feature();
    vertex[vertexSymbol] = true;
  });

  beforeEach(() => {
    cursorStyle = { cursor: '' };
    interaction = new EditGeometryMouseOverInteraction(layerName);
    interaction.cursorStyle = cursorStyle;
  });

  afterEach(() => {
    interaction.destroy();
  });

  describe('interaction with vertices', () => {
    it('should change the cursor style, to translate, if hovering over a vertex', async () => {
      await interaction.pipe({ feature: vertex });
      expect(cursorStyle.cursor).to.equal(cursorMap.translateVertex);
    });

    it('should change the cursor style, to remove, if hovering over a vertex with shift', async () => {
      await interaction.pipe({
        feature: vertex,
        key: ModificationKeyType.SHIFT,
      });
      expect(cursorStyle.cursor).to.equal(cursorMap.removeVertex);
    });

    it('should change the cursor style, to auto, if cursor leaves vertex', async () => {
      await interaction.pipe({ feature: vertex });
      await interaction.pipe({ feature: null });
      expect(cursorStyle.cursor).to.equal(cursorMap.auto);
    });

    it('should change the cursor style, if modification key changes to shift while hovering over a vertex', async () => {
      await interaction.pipe({ feature: vertex });
      interaction.modifierChanged(ModificationKeyType.SHIFT);
      expect(cursorStyle.cursor).to.equal(cursorMap.removeVertex);
    });
  });

  describe('interaction with other features', () => {
    it('should not reset cursor style when style was changed by different interaction', async () => {
      cursorStyle.cursor = cursorMap.scaleNESW;
      cursorStyle[mouseOverSymbol] = 'other_id';
      await interaction.pipe({ feature });
      expect(cursorStyle.cursor).to.equal(cursorMap.scaleNESW);
    });
  });
});
