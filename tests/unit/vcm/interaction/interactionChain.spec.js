import sinon from 'sinon';
import InteractionChain from '../../../../src/vcs/vcm/interaction/interactionChain.js';
import AbstractInteraction from '../../../../src/vcs/vcm/interaction/abstractInteraction.js';
import { EventType, ModificationKeyType, PointerKeyType } from '../../../../src/vcs/vcm/interaction/interactionType.js';

describe('vcs.vcm.interaction.InteractionChain', () => {
  it('should add an interaction', () => {
    const ic = new InteractionChain();
    const dummies = [...new Array(3).keys()].map(id => ({ id }));
    ic.addInteraction(dummies[0]);
    expect(ic)
      .to.have.property('chain')
      .to.have.members([dummies[0]]);

    ic.addInteraction(dummies[1]);
    expect(ic)
      .to.have.property('chain')
      .to.have.members([dummies[0], dummies[1]]);

    ic.addInteraction(dummies[2], 1);
    expect(ic)
      .to.have.property('chain')
      .to.have.members([dummies[0], dummies[2], dummies[1]]);
  });

  it('should remove an interaction', () => {
    const ic = new InteractionChain();
    const dummies = [...new Array(3).keys()].map(id => ({ id }));
    dummies.forEach((dummy) => { ic.addInteraction(dummy); });
    expect(ic.chain).to.have.members(dummies);
    ic.removeInteraction(dummies[1]);
    expect(ic.chain).to.have.members([dummies[0], dummies[2]]);
  });

  it('should only remove an interaction, if it is part of the chain', () => {
    const ic = new InteractionChain();
    const dummies = [...new Array(3).keys()].map(id => ({ id }));
    dummies.forEach((dummy) => { ic.addInteraction(dummy); });
    expect(ic.chain).to.have.members(dummies);
    ic.removeInteraction(dummies[1]);
    ic.removeInteraction(new AbstractInteraction());
    expect(ic.chain).to.have.members([dummies[0], dummies[2]]);
  });

  it('should only pipe active interactions', (done) => {
    const modeMap = {
      child: [
        { active: EventType.CLICK, mod: ModificationKeyType.ALL, pointer: PointerKeyType.LEFT },
        { active: EventType.DRAGEVENTS | EventType.CLICK, mod: ModificationKeyType.NONE, pointer: PointerKeyType.ALL },
      ],
      parent: [
        { active: EventType.ALL, mod: ModificationKeyType.CTRL, pointer: PointerKeyType.LEFT },
        {
          active: EventType.MOVE | EventType.CLICK,
          mod: ModificationKeyType.SHIFT | ModificationKeyType.ALT,
          pointer: PointerKeyType.ALL,
        },
      ],
    };
    const spies = [];
    function createSpies(type, arr) {
      arr.forEach((val, index) => {
        const modeType = modeMap[type][index];
        val.setActive(modeType.active);
        val.setModification(modeType.mod);
        val.setPointer(modeType.pointer);
        spies.push(sinon.spy(val, 'pipe'));
      });
    }

    const childInteractions = [...new Array(2)].map(() => new AbstractInteraction());
    const child = new InteractionChain(childInteractions);
    createSpies('child', childInteractions);
    const parentInteractions = [...new Array(2)].map(() => new AbstractInteraction());
    const parent = new InteractionChain([...parentInteractions, child]);
    createSpies('parent', parentInteractions);

    const events = [
      {
        type: EventType.CLICK,
        key: ModificationKeyType.ALT,
        pointer: PointerKeyType.LEFT,
      },
      {
        type: EventType.DRAG,
        key: ModificationKeyType.NONE,
        pointer: PointerKeyType.LEFT,
      },
      {
        type: EventType.DRAG,
        key: ModificationKeyType.CTRL,
        pointer: PointerKeyType.LEFT,
      },
      {
        type: EventType.DRAG,
        key: ModificationKeyType.SHIFT,
        pointer: PointerKeyType.LEFT,
      },
      {
        type: EventType.MOVE,
        key: ModificationKeyType.SHIFT,
        pointer: PointerKeyType.LEFT,
      },
    ];
    const expectations = [
      () => {
        expect(spies[0]).to.have.been.calledWith(events[0]);
        expect(spies[3]).to.have.been.calledWith(events[0]);
      },
      () => {
        expect(spies[1]).to.have.been.calledWith(events[1]);
      },
      () => {
        expect(spies[2]).to.have.been.calledWith(events[2]);
      },
      () => {},
      () => {
        expect(spies[3]).to.have.been.calledWith(events[4]);
      },
    ];

    let promise = Promise.resolve();
    events.forEach((event, index) => {
      promise = promise
        .then(() => parent.pipe(event)
          .then(() => {
            expectations[index]();
          }));
    });

    promise.then(() => {
      expect(spies[0]).to.have.been.calledOnce;
      expect(spies[1]).to.have.been.calledOnce;
      expect(spies[2]).to.have.been.calledOnce;
      expect(spies[3]).to.have.been.calledTwice;
      done();
    });
  });

  it('should stop event propagation', () => {
    const event = {
      type: EventType.CLICK,
      key: ModificationKeyType.NONE,
      pointer: PointerKeyType.LEFT,
    };
    const stopEvent = {
      type: EventType.CLICK,
      key: ModificationKeyType.NONE,
      pointer: PointerKeyType.LEFT,
      stopPropagation: true,
    };
    const interactions = [...new Array(3)].map(() => new AbstractInteraction());
    const stubs = [];
    interactions.forEach((i, index) => {
      i.setActive(EventType.CLICK);
      i.setModification(ModificationKeyType.NONE);
      const iStub = sinon.stub(i, 'pipe');
      if (index === 1) {
        iStub
          .onFirstCall().returns(Promise.resolve(event))
          .onSecondCall().returns(Promise.resolve(stopEvent));
      } else {
        iStub.returns(Promise.resolve(event));
      }
      stubs.push(iStub);
    });
    const ic = new InteractionChain(interactions);
    return ic
      .pipe(event)
      .then(() => {
        stubs.forEach((s) => {
          expect(s).to.have.been.calledOnce;
        });
        return ic
          .pipe(event)
          .then(() => {
            expect(stubs[0]).to.have.been.calledTwice;
            expect(stubs[1]).to.have.been.calledTwice;
            expect(stubs[2]).to.have.been.calledOnce;
          });
      });
  });
});
