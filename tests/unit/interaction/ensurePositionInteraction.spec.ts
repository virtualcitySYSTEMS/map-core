import { expect } from 'chai';
import { Cartesian2 } from '@vcmap-cesium/engine';
import OpenlayersMap from '../../../src/map/openlayersMap.js';
import type { InteractionEvent } from '../../../src/interaction/abstractInteraction.js';
import {
  EventType,
  ModificationKeyType,
  PointerEventType,
  PointerKeyType,
} from '../../../src/interaction/interactionType.js';
import EnsurePositionInteraction from '../../../src/interaction/ensurePositionInteraction.js';

describe('ensurePositionInteraction', () => {
  let map: OpenlayersMap;
  let event: InteractionEvent;
  let interaction: EnsurePositionInteraction;

  before(() => {
    map = new OpenlayersMap({});
  });

  beforeEach(() => {
    event = {
      key: ModificationKeyType.NONE,
      pointer: PointerKeyType.LEFT,
      pointerEvent: PointerEventType.UP,
      windowPosition: new Cartesian2(0, 0),
      type: EventType.CLICK,
      map,
    };
    interaction = new EnsurePositionInteraction();
  });

  it('should stop propagation, if there is no position', async () => {
    const after = await interaction.pipe(event);
    expect(after.stopPropagation).to.be.true;
  });

  it('should not stop propagation, if there is a position', async () => {
    event.position = [0, 0];
    const after = await interaction.pipe(event);
    expect(after.stopPropagation).to.be.false;
  });

  describe('drag events', () => {
    it('should remember the last position on dragstart', async () => {
      await interaction.pipe({
        ...event,
        type: EventType.DRAGSTART,
        position: [0, 0],
      });

      const drag = await interaction.pipe({
        ...event,
        type: EventType.DRAG,
      });
      expect(drag.stopPropagation).to.be.true;

      const after = await interaction.pipe({
        ...event,
        type: EventType.DRAGEND,
      });
      expect(after.stopPropagation).to.be.false;
      expect(after.position).to.deep.equal([0, 0]);
    });

    it('should set the last position on drag', async () => {
      await interaction.pipe({
        ...event,
        type: EventType.DRAGSTART,
        position: [0, 0],
      });

      await interaction.pipe({
        ...event,
        position: [1, 0],
        type: EventType.DRAG,
      });

      const after = await interaction.pipe({
        ...event,
        type: EventType.DRAGEND,
      });
      expect(after.stopPropagation).to.be.false;
      expect(after.position).to.deep.equal([1, 0]);
    });

    it('should only emit position once', async () => {
      await interaction.pipe({
        ...event,
        type: EventType.DRAGSTART,
        position: [0, 0],
      });

      const after1 = await interaction.pipe({
        ...event,
        type: EventType.DRAGEND,
      });
      expect(after1.stopPropagation).to.be.false;
      expect(after1.position).to.deep.equal([0, 0]);

      const after2 = await interaction.pipe({
        ...event,
        type: EventType.DRAGEND,
      });
      expect(after2.stopPropagation).to.be.true;
    });

    it('should stop propagation on drag stop, if drag start was not successful', async () => {
      await interaction.pipe({
        ...event,
        type: EventType.DRAGSTART,
      });

      const after = await interaction.pipe({
        ...event,
        type: EventType.DRAGEND,
        position: [0, 0],
      });
      expect(after.stopPropagation).to.be.true;
    });

    it('should stop propagation on drag, if drag start was not successful', async () => {
      await interaction.pipe({
        ...event,
        type: EventType.DRAGSTART,
      });

      const after = await interaction.pipe({
        ...event,
        type: EventType.DRAG,
        position: [0, 0],
      });
      expect(after.stopPropagation).to.be.true;

      const after1 = await interaction.pipe({
        ...event,
        type: EventType.DRAGEND,
      });
      expect(after1.stopPropagation).to.be.true;
      expect(after1).to.not.have.property('position');
    });
  });
});
