import VcsEvent from '../../../../src/vcs/vcm/event/vcsEvent.js';

describe('vcs.vcm.util.VcsEvent', () => {
  let sandbox;
  /** @type {import("@vcmap/core").VcsEvent} */
  let event;

  before(() => {
    sandbox = sinon.createSandbox();
    event = new VcsEvent();
  });

  after(() => {
    sandbox.restore();
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
      const listener = () => {};
      event.addEventListener(listener);
      event.removeEventListener(listener);
      expect(event.numberOfListeners).to.equal(size);
    });

    it('should remove a listener via remove', () => {
      const size = event.numberOfListeners;
      const listener = () => {};
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

  describe('raising of events', () => {
    it('should raise a void event', () => {
      const spy = sandbox.spy();
      event.addEventListener(spy);
      event.raiseEvent();
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
      const listener = () => new Promise((resolve) => {
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
});
