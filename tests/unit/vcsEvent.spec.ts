import sinon, { type SinonSandbox } from 'sinon';
import { expect } from 'chai';
import VcsEvent from '../../src/vcsEvent.js';

describe('VcsEvent', () => {
  let sandbox: SinonSandbox;
  let event: VcsEvent<void | object>;

  before(() => {
    sandbox = sinon.createSandbox();
  });

  after(() => {
    sandbox.restore();
    event.destroy();
  });

  beforeEach(() => {
    event = new VcsEvent();
  });

  afterEach(() => {
    event.destroy();
  });

  describe('adding an event listener', () => {
    it('should add a listener', () => {
      const size = event.numberOfListeners;
      event.addEventListener(() => {});
      expect(event.numberOfListeners).to.equal(size + 1);
    });

    it('should call the listener on event', () => {
      const spy = sandbox.spy();
      event.addEventListener(spy);
      event.raiseEvent();
      expect(spy).to.have.been.called;
    });

    it('should return a remover', () => {
      const spy = sandbox.spy();
      const remover = event.addEventListener(spy);
      expect(remover).to.be.a('function');
    });
  });

  describe('removing an event listener', () => {
    it('should remove a listener via API', () => {
      const size = event.numberOfListeners;
      const listener = (): void => {};
      event.addEventListener(listener);
      event.removeEventListener(listener);
      expect(event.numberOfListeners).to.equal(size);
    });

    it('should remove a listener via remove', () => {
      const size = event.numberOfListeners;
      const listener = (): void => {};
      const remover = event.addEventListener(listener);
      remover();
      expect(event.numberOfListeners).to.equal(size);
    });

    it('should no longer call removed listeners', () => {
      const spy = sandbox.spy();
      event.addEventListener(spy);
      event.removeEventListener(spy);
      event.raiseEvent();
      expect(spy).to.not.have.been.called;
    });
  });

  describe('removing an event listener in a raiseEvent call', () => {
    it('should not call the second listener', () => {
      let removeListener2 = (): void => {};
      const listener = (): void => {
        removeListener2();
      };
      const spy = sandbox.spy();
      event.addEventListener(listener);
      removeListener2 = event.addEventListener(spy);
      expect(event.numberOfListeners).to.equal(2);
      event.raiseEvent(undefined);
      expect(event.numberOfListeners).to.equal(1);
      expect(spy).to.not.have.been.called;
    });
  });

  describe('raising of events', () => {
    it('should raise a void event', () => {
      const spy = sandbox.spy();
      event.addEventListener(spy);
      event.raiseEvent(undefined);
      expect(spy).to.have.been.calledWithExactly(undefined);
    });

    it('should raise an event with an argument', () => {
      const spy = sandbox.spy();
      event.addEventListener(spy);
      const obj = {};
      event.raiseEvent(obj);
      expect(spy).to.have.been.calledWithExactly(obj);
    });
  });

  describe('awaiting listeners', () => {
    it('should await listeners', async () => {
      const spy = sandbox.spy();
      const listener = (): Promise<void> =>
        new Promise((resolve) => {
          setTimeout(() => {
            spy();
            resolve();
          }, 100);
        });
      event.addEventListener(listener);
      await event.awaitRaisedEvent();
      expect(spy).to.have.been.called;
    });
  });

  it('should not call the second listener, if the listener is removed in the trigger', async () => {
    let removeListener2 = (): void => {};
    const listener = (): void => {
      removeListener2();
    };
    const spy = sandbox.spy();
    event.addEventListener(listener);
    removeListener2 = event.addEventListener(spy);
    expect(event.numberOfListeners).to.equal(2);
    await event.awaitRaisedEvent(undefined);
    expect(event.numberOfListeners).to.equal(1);
    expect(spy).to.not.have.been.called;
  });
});
