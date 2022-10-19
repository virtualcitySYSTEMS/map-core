import { Feature } from 'ol';
import {
  EditGeometryMouseOverInteraction,
  ModificationKeyType,
  vcsLayerName,
  vertexSymbol,
  cursorMap,
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

  it('should change the cursor style, to select, if hovering over a feature', async () => {
    await interaction.pipe({ feature });
    expect(cursorStyle.cursor).to.equal(cursorMap.select);
  });

  it('should change the cursor style, to translate, if hovering over a vertex', async () => {
    await interaction.pipe({ feature: vertex });
    expect(cursorStyle.cursor).to.equal(cursorMap.translateVertex);
  });

  it('should change the cursor style, to select, if hovering over a vertex with shift', async () => {
    await interaction.pipe({ feature: vertex, key: ModificationKeyType.SHIFT });
    expect(cursorStyle.cursor).to.equal(cursorMap.removeVertex);
  });

  it('should change the cursor style, to auto, without a feature', async () => {
    await interaction.pipe({ feature: null });
    expect(cursorStyle.cursor).to.equal(cursorMap.auto);
  });

  it('should change the cursor style, if modification key changes to shift while hovering over a vertex', async () => {
    await interaction.pipe({ feature: vertex });
    interaction.modifierChanged(ModificationKeyType.SHIFT);
    expect(cursorStyle.cursor).to.equal(cursorMap.removeVertex);
  });
});