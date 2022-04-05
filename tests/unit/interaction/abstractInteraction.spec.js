import { EventType, ModificationKeyType, PointerKeyType } from '../../../src/interaction/interactionType.js';
import AbstractInteraction from '../../../src/interaction/abstractInteraction.js';

describe('AbstractInteraction', () => {
  let AI;
  beforeEach(() => { AI = new AbstractInteraction(); });
  describe('#setModification', () => {
    it('should set the modification', () => {
      AI.setModification(ModificationKeyType.CTRL);
      expect(AI)
        .to.have.property('modificationKey', ModificationKeyType.CTRL);
    });

    it('should reset the default modification key if called without arguments', () => {
      AI.setModification(ModificationKeyType.CTRL);
      expect(AI)
        .to.have.property('modificationKey', ModificationKeyType.CTRL);
      AI.setModification();
      expect(AI)
        .to.have.property('modificationKey', ModificationKeyType.NONE);
    });
  });

  describe('#setPointer', () => {
    it('should set the pointer', () => {
      AI.setPointer(PointerKeyType.RIGHT);
      expect(AI)
        .to.have.property('pointerKey', PointerKeyType.RIGHT);
    });

    it('should reset the default pointer key if called without arguments', () => {
      AI.setPointer(PointerKeyType.RIGHT);
      expect(AI)
        .to.have.property('pointerKey', PointerKeyType.RIGHT);
      AI.setPointer();
      expect(AI)
        .to.have.property('pointerKey', PointerKeyType.LEFT);
    });
  });

  describe('#setActive', () => {
    it('should set the active event, if called with a number', () => {
      AI.setActive(EventType.MOVE);
      expect(AI).to.have.property('active', EventType.MOVE);
    });

    it('should toggle the default active if called with a boolean', () => {
      expect(AI).to.have.property('active', EventType.NONE);
      expect(AI).to.have.property('modificationKey', ModificationKeyType.NONE);

      AI._defaultActive = EventType.MOVE;
      AI.setActive(true);
      expect(AI).to.have.property('active', EventType.MOVE);
      AI.setModification(ModificationKeyType.CTRL);
      AI.setActive(false);
      expect(AI).to.have.property('active', EventType.NONE);
      expect(AI).to.have.property('modificationKey', ModificationKeyType.CTRL);
    });

    it('should reset all defaults, if called without arguments', () => {
      AI.setModification(ModificationKeyType.CTRL);
      AI.setPointer(PointerKeyType.MIDDLE);
      AI.setActive();
      expect(AI).to.have.property('active', EventType.NONE);
      expect(AI).to.have.property('modificationKey', ModificationKeyType.NONE);
      expect(AI).to.have.property('pointerKey', PointerKeyType.LEFT);
    });
  });
});
