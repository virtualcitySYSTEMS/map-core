import { Cartesian2 } from '@vcmap/cesium';
import EventHandler from '../../../../src/vcs/vcm/interaction/eventHandler.js';
import AbstractInteraction from '../../../../src/vcs/vcm/interaction/abstractInteraction.js';
import InteractionChain from '../../../../src/vcs/vcm/interaction/interactionChain.js';
import { EventType } from '../../../../src/vcs/vcm/interaction/interactionType.js';

describe('vcs.vcm.interaction.EventHandler', () => {
  let sinonBox;
  let windowPosition;
  /** @type {vcs.vcm.interaction.EventHandler} */
  let EH;

  before(() => {
    sinonBox = sinon.createSandbox();
    windowPosition = new Cartesian2(1, 1);
  });

  beforeEach(() => {
    EH = new EventHandler();
  });

  afterEach(() => {
    sinonBox.restore();
    EH.destroy();
  });

  describe('adding/removing interactions', () => {
    let dummy1;
    let dummy2;
    let dummy3;

    beforeEach(() => {
      dummy1 = new AbstractInteraction();
      dummy2 = new AbstractInteraction();
      dummy3 = new AbstractInteraction();
    });

    it('should add an interaction, returning a remover', () => {
      const remover = EH.addPersistentInteraction(dummy1);
      expect(EH.interactions).to.include.members([dummy1]);
      const removed = remover();

      expect(removed).to.equal(1);
      expect(EH.interactions).to.not.include.members([dummy1]);
      const removedAgain = remover();
      expect(removedAgain).to.equal(0);
    });

    it('should add an exclusive interaction, returning a remover', () => {
      const remover = EH.addExclusiveInteraction(dummy1, sinonBox.spy());
      expect(EH.interactions).to.include.members([dummy1]);
      expect(EH._exclusiveInteraction)
        .to.have.property('interactions')
        .to.have.members([dummy1]);

      const removed = remover();
      expect(removed).to.equal(1);
      expect(EH.interactions).to.not.include.members([dummy1]);
      expect(EH._exclusiveInteraction).to.be.null;

      const removedAgain = remover();
      expect(removedAgain).to.equal(0);
    });

    it('should call a removed callback for exclusive interactions', () => {
      const cb = sinonBox.spy();
      const remover1 = EH.addExclusiveInteraction(dummy1, cb);
      expect(EH.interactions).to.include.members([dummy1]);
      expect(EH._exclusiveInteraction)
        .to.have.property('interactions')
        .to.have.members([dummy1]);

      const remover2 = EH.addExclusiveInteraction(dummy2, sinonBox.spy);
      expect(EH.interactions).to.not.include.members([dummy1]);
      expect(cb).to.have.been.called;
      expect(EH.interactions).to.include.members([dummy2]);
      const removed1 = remover1();
      expect(removed1).to.equal(0);
      remover2();
    });

    it('should allow multiple exclusive interaction using the same id', () => {
      const cb1 = sinonBox.spy();
      const cb2 = sinonBox.spy();
      const remover1 = EH.addExclusiveInteraction(dummy1, cb1, 2, 'test');
      const remover2 = EH.addExclusiveInteraction(dummy2, cb2, 3, 'test');
      expect(EH.interactions).to.include.members([dummy1, dummy2]);
      expect(cb1).to.not.have.been.called;

      const removed1 = remover1();
      expect(removed1).to.equal(1);

      expect(EH._exclusiveInteraction)
        .to.have.property('interactions')
        .to.have.ordered.members([undefined, dummy2]);
      expect(EH.interactions).to.not.include.members([dummy1]);

      const removed1again = remover1();
      expect(removed1again).to.equal(0);
      const removed2 = remover2();

      expect(removed2).to.equal(1);
      expect(EH._exclusiveInteraction).to.be.null;
      expect(cb2).to.not.have.been.called;
    });

    it('should remove all interactions of exclusive registerer on new interaction', () => {
      const cb1 = sinonBox.spy();
      const cb2 = sinonBox.spy();
      EH.addExclusiveInteraction(dummy1, cb1, 2, 'test');
      EH.addExclusiveInteraction(dummy2, cb2, 3, 'test');

      const remover = EH.addExclusiveInteraction(dummy3, sinonBox.spy);
      expect(cb1).to.have.been.called;
      expect(cb2).to.have.been.called;
      expect(EH._exclusiveInteraction)
        .to.have.property('interactions')
        .to.have.members([dummy3]);

      remover();
    });

    it('should only call the removed for forcefully removed exclusive interactions', () => {
      dummy1 = new AbstractInteraction();
      dummy2 = new AbstractInteraction();
      dummy3 = new AbstractInteraction();
      const cb1 = sinonBox.spy();
      const cb2 = sinonBox.spy();
      const remover1 = EH.addExclusiveInteraction(dummy1, cb1, 2, 'test');
      EH.addExclusiveInteraction(dummy2, cb2, 3, 'test');
      remover1();

      const remover3 = EH.addExclusiveInteraction(dummy3, sinonBox.spy);
      expect(cb1).to.not.have.been.called;
      expect(cb2).to.have.been.called;
      expect(EH._exclusiveInteraction)
        .to.have.property('interactions')
        .to.have.members([dummy3]);

      remover3();
    });

    it('should raise the exclusive add interaction, when adding an exclusive interaction', () => {
      const spy = sinonBox.spy();
      const listener = EH.exclusiveAdded.addEventListener(() => {
        spy();
      });
      const remover1 = EH.addExclusiveInteraction(dummy1, sinonBox.spy(), 3, 'test');
      const remover2 = EH.addExclusiveInteraction(dummy2, sinonBox.spy(), 4, 'test');
      expect(spy).to.have.been.calledTwice;
      remover1();
      remover2();
      listener();
    });

    it('should raise the exclusive removed interaction, when force removing exclusive interactions', () => {
      const spy = sinonBox.spy();
      const listener = EH.exclusiveRemoved.addEventListener(() => {
        spy();
      });
      EH.addExclusiveInteraction(dummy1, sinonBox.spy(), 3, 'test');
      EH.addExclusiveInteraction(dummy2, sinonBox.spy(), 4, 'test');
      const remover = EH.addExclusiveInteraction(dummy3, sinonBox.spy());
      expect(spy).to.have.been.calledOnce;
      remover();
      listener();
    });

    it('should raise the exclusive removed interaction, when removing exclusive interactions', () => {
      const spy = sinonBox.spy();
      const listener = EH.exclusiveRemoved.addEventListener(() => {
        spy();
      });
      const remover = EH.addExclusiveInteraction(dummy1, sinonBox.spy());
      remover();
      expect(spy).to.have.been.calledOnce;
      listener();
    });
  });

  describe('mouse events', () => {
    let chainPipe;

    beforeEach(() => {
      chainPipe = sinonBox.stub(EH, '_startChain');
    });

    it('should only register the last mouse down event (with time)', () => {
      sinonBox.useFakeTimers(1);
      EH._mouseDown({ windowPosition });
      expect(EH)
        .to.have.property('_lastDown')
        .to.have.property('time', Date.now());
    });

    it('should trigger a click on mouse up', () => {
      EH._mouseDown({ windowPosition });
      expect(EH)
        .to.have.property('_lastDown')
        .to.have.property('time');

      EH._mouseUp({ windowPosition });

      expect(EH)
        .to.have.property('_lastDown')
        .to.be.null;

      expect(chainPipe).to.have.been
        .calledWith({ windowPosition, type: EventType.CLICK });
    });

    it('should call a double click', () => {
      EH._lastClick.time = null;
      sinonBox.useFakeTimers(1);
      EH._mouseDown({ windowPosition });
      expect(EH)
        .to.have.property('_lastDown')
        .to.have.property('time', Date.now());

      EH._mouseUp({ windowPosition });
      expect(EH)
        .to.have.property('_lastDown')
        .to.be.null;
      expect(chainPipe).to.have.been
        .calledWith({ windowPosition, type: EventType.CLICK });

      EH._mouseDown({ windowPosition });
      expect(EH)
        .to.have.property('_lastClick')
        .to.have.property('time')
        .to.equal(Date.now());

      sinonBox.clock.tick(1);
      EH._mouseUp({ windowPosition });
      expect(chainPipe).to.have.been
        .calledWith({ windowPosition, type: EventType.DBLCLICK });
    });

    it('should not call a double click, if the click duration is exceeded', () => {
      sinonBox.useFakeTimers(1);
      EH._mouseDown({ windowPosition });
      expect(EH)
        .to.have.property('_lastDown')
        .to.have.property('time', Date.now());

      EH._mouseUp({ windowPosition });
      expect(EH)
        .to.have.property('_lastDown')
        .to.be.null;
      expect(chainPipe).to.have.been
        .calledWith({ windowPosition, type: EventType.CLICK });

      EH._mouseDown({ windowPosition });
      expect(EH)
        .to.have.property('_lastClick')
        .to.have.property('time')
        .to.equal(Date.now());

      sinonBox.clock.tick(EH.clickDuration);
      EH._mouseUp({ windowPosition });
      expect(chainPipe).to.have.been
        .calledWith({ windowPosition, type: EventType.CLICK });
    });

    it('should not call a double click, if the click distance between the two clicks is exceeded', () => {
      sinonBox.useFakeTimers(1);
      EH._mouseDown({ windowPosition });
      EH._mouseUp({ windowPosition });
      EH._lastClick.windowPosition.x = 10;
      EH._lastClick.windowPosition.y = 10;
      sinonBox.clock.tick(1);
      EH._mouseDown({ windowPosition });
      EH._mouseUp({ windowPosition });
      expect(chainPipe).to.have.been
        .calledWith({ windowPosition, type: EventType.CLICK });
    });

    it('should start dragging, if the dragDuration has passed since lastDown, maintaining the original keys', () => {
      sinonBox.useFakeTimers(1);
      EH._mouseDown({ key: 'test', pointer: 'test', windowPosition });
      EH._mouseMove({ windowPosition });
      expect(chainPipe).to.not.have.been.called;
      sinonBox.clock.tick(EH.dragDuration + 1);
      EH._mouseMove({ windowPosition });
      expect(chainPipe).to.have.been.calledWith({
        windowPosition, type: EventType.DRAGSTART, time: 1, key: 'test', pointer: 'test',
      });
      EH._mouseMove({ windowPosition });
      expect(chainPipe).to.have.been.calledWith({
        windowPosition, type: EventType.DRAG, key: 'test', pointer: 'test',
      });
      EH._mouseUp({ windowPosition });
    });

    it('should discard all events if multiple downs where registered', () => {
      EH._mouseDown({ windowPosition });
      EH._mouseDown({ windowPosition });
      EH._mouseDown({ windowPosition });
      expect(EH).to.have.property('_multiples', true);
      EH._mouseUp({ windowPosition });
      expect(EH).to.have.property('_multiples', false);
      expect(EH).to.have.property('_lastDown', null);
      expect(chainPipe).to.not.have.been.called;

      EH._mouseDown({ windowPosition });
      EH._mouseUp({ windowPosition });
      expect(chainPipe).to.have.been.calledWith({ windowPosition, type: EventType.CLICK });
    });
  });

  describe('startChain/endChain', () => {
    let chainPipe;
    beforeEach(() => {
      chainPipe = sinonBox.stub(InteractionChain.prototype, 'pipe');
      chainPipe.returns(Promise.resolve());
    });

    it('check if start and endChain have been called', (done) => {
      const startChain = sinonBox.spy(EH, '_startChain');
      const endChain = sinonBox.spy(EH, '_endChain');
      EH._mouseDown({ windowPosition });
      EH._mouseUp({ windowPosition });
      expect(startChain)
        .to.have.been.calledOnce;
      setTimeout(() => {
        expect(endChain)
          .to.have.been.calledOnce;
        done();
      }, 1);
    });
    it('check if events are queued and processed', (done) => {
      const startChain = sinonBox.spy(EH, '_startChain');
      const endChain = sinonBox.spy(EH, '_endChain');
      EH._mouseDown({ windowPosition });
      EH._mouseUp({ windowPosition });
      EH._mouseDown({ windowPosition });
      EH._mouseUp({ windowPosition });
      expect(startChain)
        .to.have.been.calledTwice;
      expect(EH).to.have.property('_eventQueue').that.satisfy((value) => {
        expect(value).to.be.instanceof(Array);
        expect(value).to.have.length(1);
        return true;
      });
      setTimeout(() => {
        expect(endChain)
          .to.have.been.calledTwice;
        done();
      }, 1);
    });
    it('mousemove events are discarded if an event is running', (done) => {
      const startChain = sinonBox.spy(EH, '_startChain');
      const endChain = sinonBox.spy(EH, '_endChain');
      EH._mouseDown({ windowPosition });
      EH._mouseUp({ windowPosition });
      EH._mouseMove({ windowPosition });
      expect(startChain)
        .to.have.been.calledTwice;
      expect(EH).to.have.property('_running', true);
      setTimeout(() => {
        expect(endChain)
          .to.have.been.calledOnce;
        EH._mouseMove({ windowPosition });
        setTimeout(() => {
          expect(endChain)
            .to.have.been.calledTwice;
          done();
        }, 1);
      }, 1);
    });
  });
});
