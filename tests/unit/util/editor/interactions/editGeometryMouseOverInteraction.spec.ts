import { Feature } from 'ol';
import { expect } from 'chai';
import { Cartesian2 } from '@vcmap-cesium/engine';
import type { EventAfterEventHandler } from '../../../../../index.js';
import {
  cursorMap,
  EditGeometryMouseOverInteraction,
  EventType,
  ModificationKeyType,
  mouseOverSymbol,
  OpenlayersMap,
  PointerEventType,
  PointerKeyType,
  vcsLayerName,
  vertexSymbol,
} from '../../../../../index.js';

describe('EditGeometryMouseOverInteraction', () => {
  let interaction: EditGeometryMouseOverInteraction;
  let layerName: string;
  let feature: Feature;
  let vertex: Feature;
  let cursorStyle: CSSStyleDeclaration;
  let map: OpenlayersMap;
  let baseEvent: EventAfterEventHandler;

  before(() => {
    feature = new Feature();
    feature[vcsLayerName] = layerName;
    vertex = new Feature();
    vertex[vertexSymbol] = true;
    map = new OpenlayersMap({});
    baseEvent = {
      map,
      pointer: PointerKeyType.LEFT,
      pointerEvent: PointerEventType.DOWN,
      type: EventType.MOVE,
      windowPosition: new Cartesian2(0, 0),
      key: ModificationKeyType.NONE,
      position: [0, 0],
      positionOrPixel: [0, 0],
    };
  });

  beforeEach(() => {
    cursorStyle = new CSSStyleDeclaration();
    interaction = new EditGeometryMouseOverInteraction();
    interaction.cursorStyle = cursorStyle;
  });

  afterEach(() => {
    interaction.destroy();
  });

  after(() => {
    map.destroy();
  });

  describe('interaction with vertices', () => {
    it('should change the cursor style, to translate, if hovering over a vertex', async () => {
      await interaction.pipe({ ...baseEvent, feature: vertex });
      expect(cursorStyle.cursor).to.equal(cursorMap.translateVertex);
    });

    it('should change the cursor style, to remove, if hovering over a vertex with shift', async () => {
      await interaction.pipe({
        ...baseEvent,
        feature: vertex,
        key: ModificationKeyType.SHIFT,
      });
      expect(cursorStyle.cursor).to.equal(cursorMap.removeVertex);
    });

    it('should change the cursor style, to auto, if cursor leaves vertex', async () => {
      await interaction.pipe({ ...baseEvent, feature: vertex });
      await interaction.pipe({ ...baseEvent });
      expect(cursorStyle.cursor).to.equal(cursorMap.auto);
    });

    it('should change the cursor style, if modification key changes to shift while hovering over a vertex', async () => {
      await interaction.pipe({ ...baseEvent, feature: vertex });
      interaction.modifierChanged(ModificationKeyType.SHIFT);
      expect(cursorStyle.cursor).to.equal(cursorMap.removeVertex);
    });
  });

  describe('interaction with other features', () => {
    it('should not reset cursor style when style was changed by different interaction', async () => {
      cursorStyle.cursor = cursorMap.scaleNESW;
      cursorStyle[mouseOverSymbol] = 'other_id';
      await interaction.pipe({ ...baseEvent, feature });
      expect(cursorStyle.cursor).to.equal(cursorMap.scaleNESW);
    });
  });
});
