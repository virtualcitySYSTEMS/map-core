// eslint-disable-next-line max-classes-per-file
import OverrideClassRegistry from '../../src/overrideClassRegistry.js';
import ClassRegistry from '../../src/classRegistry.js';

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class Class {
  static get className() {
    return 'Class';
  }

  constructor() {
    this.type = Class.className;
  }
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class
class Override {
  static get className() {
    return 'Class';
  }

  constructor() {
    this.type = Class.className;
    this.override = true;
  }
}

describe('OverrideClassRegistry', () => {
  describe('registering classes', () => {
    describe('which are not present', () => {
      let classRegistry;

      before(() => {
        classRegistry = new OverrideClassRegistry(new ClassRegistry());
        classRegistry.registerClass('foo', Class.className, Class);
      });

      after(() => {
        classRegistry.destroy();
      });

      it('should add the class', () => {
        expect(classRegistry.hasClass(Class.className)).to.be.true;
      });
    });

    describe('which is present in another context', () => {
      let classRegistry;
      let replaced;

      before(() => {
        classRegistry = new OverrideClassRegistry(new ClassRegistry());
        classRegistry.registerClass('foo', Class.className, Class);
        replaced = sinon.spy();
        classRegistry.replaced.addEventListener(replaced);
        classRegistry.registerClass('bar', Override.className, Override);
      });

      after(() => {
        classRegistry.destroy();
      });

      it('should add the class', () => {
        expect(classRegistry.hasClass(Override.className)).to.be.true;
      });

      it('should override the class', () => {
        expect(classRegistry.getClass(Class.className)).to.equal(Override);
      });

      it('should call replaced', () => {
        expect(replaced).to.have.been.calledWith(Class.className);
      });
    });

    describe('which is present in the core registry', () => {
      let classRegistry;
      let replaced;

      before(() => {
        const coreRegistry = new ClassRegistry();
        coreRegistry.registerClass(Class.className, Class);
        classRegistry = new OverrideClassRegistry(coreRegistry);
        replaced = sinon.spy();
        classRegistry.replaced.addEventListener(replaced);
        classRegistry.registerClass('bar', Override.className, Override);
      });

      after(() => {
        classRegistry.destroy();
      });

      it('should add the class', () => {
        expect(classRegistry.hasClass(Class.className)).to.be.true;
      });

      it('should override the class', () => {
        expect(classRegistry.getClass(Class.className)).to.equal(Override);
      });

      it('should call replaced', () => {
        expect(replaced).to.have.been.calledWith(Class.className);
      });
    });
  });

  describe('unregistering classes', () => {
    describe('which was not present on insertion', () => {
      let classRegistry;
      let removed;

      before(() => {
        classRegistry = new OverrideClassRegistry(new ClassRegistry());
        classRegistry.registerClass('foo', Class.className, Class);
        removed = sinon.spy();
        classRegistry.removed.addEventListener(removed);
        classRegistry.unregisterClass('foo', Class.className);
      });

      after(() => {
        classRegistry.destroy();
      });

      it('should no longer have the class', () => {
        expect(classRegistry.hasClass(Class.className)).to.be.false;
      });

      it('should call removed with the className', () => {
        expect(removed).to.have.been.calledWith(Class.className);
      });
    });

    describe('which was present in another context on insertion', () => {
      let classRegistry;
      let replaced;

      before(() => {
        classRegistry = new OverrideClassRegistry(new ClassRegistry());
        classRegistry.registerClass('foo', Class.className, Class);
        classRegistry.registerClass('bar', Override.className, Override);
        replaced = sinon.spy();
        classRegistry.replaced.addEventListener(replaced);
        classRegistry.unregisterClass('bar', Override.className);
      });

      after(() => {
        classRegistry.destroy();
      });

      it('should still have the class', () => {
        expect(classRegistry.hasClass(Class.className)).to.be.true;
      });

      it('should no longer override the class', () => {
        expect(classRegistry.getClass(Class.className)).to.equal(Class);
      });

      it('should call replaced', () => {
        expect(replaced).to.have.been.calledWith(Class.className);
      });
    });

    describe('which was present in the same context on insertion', () => {
      let classRegistry;
      let removed;

      before(() => {
        classRegistry = new OverrideClassRegistry(new ClassRegistry());
        classRegistry.registerClass('foo', Class.className, Class);
        classRegistry.registerClass('foo', Override.className, Override);
        removed = sinon.spy();
        classRegistry.removed.addEventListener(removed);
        classRegistry.unregisterClass('foo', Override.className);
      });

      after(() => {
        classRegistry.destroy();
      });

      it('should no longer have the class', () => {
        expect(classRegistry.hasClass(Class.className)).to.be.false;
      });

      it('should call removed with the className', () => {
        expect(removed).to.have.been.calledWith(Class.className);
      });
    });

    describe('which is present in the core registry', () => {
      let classRegistry;
      let replaced;

      before(() => {
        const coreRegistry = new ClassRegistry();
        coreRegistry.registerClass(Class.className, Class);
        classRegistry = new OverrideClassRegistry(coreRegistry);
        classRegistry.registerClass('foo', Override.className, Override);
        replaced = sinon.spy();
        classRegistry.replaced.addEventListener(replaced);
        classRegistry.unregisterClass('foo', Override.className);
      });

      after(() => {
        classRegistry.destroy();
      });

      it('should still have the class', () => {
        expect(classRegistry.hasClass(Class.className)).to.be.true;
      });

      it('should no longer override the class', () => {
        expect(classRegistry.getClass(Class.className)).to.equal(Class);
      });

      it('should call replaced', () => {
        expect(replaced).to.have.been.calledWith(Class.className);
      });
    });

    describe('which was present, but is now overridden', () => {
      let replaced;
      let removed;
      let classRegistry;

      beforeEach(() => {
        classRegistry = new OverrideClassRegistry(new ClassRegistry());
        classRegistry.registerClass('foo', Class.className, Class);
        classRegistry.registerClass('bar', Override.className, Override);
        removed = sinon.spy();
        replaced = sinon.spy();
        classRegistry.removed.addEventListener(removed);
        classRegistry.replaced.addEventListener(replaced);
        classRegistry.unregisterClass('foo', Override.className);
      });

      afterEach(() => {
        classRegistry.destroy();
      });

      it('should not call any event', () => {
        expect(removed).to.not.have.been.called;
        expect(replaced).to.not.have.been.called;
      });

      it('should remove the shadow', () => {
        classRegistry.unregisterClass('bar', Override.className);
        expect(removed).to.have.been.called;
        expect(classRegistry.hasClass(Override.className)).to.be.false;
      });
    });
  });

  describe('retrieving classes & classNames', () => {
    describe('of a class which is not present in the core', () => {
      let classRegistry;

      before(() => {
        classRegistry = new OverrideClassRegistry(new ClassRegistry());
        classRegistry.registerClass('foo', Class.className, Class);
      });

      after(() => {
        classRegistry.destroy();
      });

      it('should be part of the classNames', () => {
        expect(classRegistry.getClassNames()).to.have.members([
          Class.className,
        ]);
      });

      it('should be retrievable', () => {
        expect(classRegistry.getClass(Class.className)).to.equal(Class);
      });

      it('should be part of the registry', () => {
        expect(classRegistry.hasClass(Class.className)).to.be.true;
      });
    });

    describe('of a class which is present only in the core', () => {
      let classRegistry;

      before(() => {
        const coreRegistry = new ClassRegistry();
        coreRegistry.registerClass(Class.className, Class);
        classRegistry = new OverrideClassRegistry(coreRegistry);
      });

      after(() => {
        classRegistry.destroy();
      });

      it('should be part of the classNames', () => {
        expect(classRegistry.getClassNames()).to.have.members([
          Class.className,
        ]);
      });

      it('should be retrievable', () => {
        expect(classRegistry.getClass(Class.className)).to.equal(Class);
      });

      it('should be part of the registry', () => {
        expect(classRegistry.hasClass(Class.className)).to.be.true;
      });
    });

    describe('of a class which is present in the core and the override', () => {
      let classRegistry;

      before(() => {
        const coreRegistry = new ClassRegistry();
        coreRegistry.registerClass(Class.className, Class);
        classRegistry = new OverrideClassRegistry(coreRegistry);
        classRegistry.registerClass('foo', Override.className, Override);
      });

      after(() => {
        classRegistry.destroy();
      });

      it('should be part of the classNames', () => {
        expect(classRegistry.getClassNames()).to.have.members([
          Override.className,
        ]);
      });

      it('should be retrievable', () => {
        expect(classRegistry.getClass(Override.className)).to.equal(Override);
      });

      it('should be part of the registry', () => {
        expect(classRegistry.hasClass(Override.className)).to.be.true;
      });
    });
  });

  describe('removing of a context', () => {
    let replaced;
    let removed;
    let classRegistry;
    let coreClassName;
    let overridenCoreClassName;
    let contextClass;

    before(() => {
      coreClassName = 'CoreClass';
      overridenCoreClassName = 'OverridenCoreClass';
      contextClass = 'ContextClass';
      const coreRegistry = new ClassRegistry();
      coreRegistry.registerClass(coreClassName, Class);
      coreRegistry.registerClass(overridenCoreClassName, Class);
      classRegistry = new OverrideClassRegistry(coreRegistry);
      classRegistry.registerClass('foo', Class.className, Class);
      classRegistry.registerClass('foo', overridenCoreClassName, Override);
      classRegistry.registerClass('bar', Override.className, Override);
      classRegistry.registerClass('foo', contextClass, Override);
      removed = sinon.spy();
      replaced = sinon.spy();
      classRegistry.removed.addEventListener(removed);
      classRegistry.replaced.addEventListener(replaced);
      classRegistry.removeModule('foo');
    });

    after(() => {
      classRegistry.destroy();
    });

    it('should maintain core classes', () => {
      expect(classRegistry.hasClass(coreClassName)).to.be.true;
    });

    it('should replace overriden core classes', () => {
      expect(replaced).to.have.been.calledWith(overridenCoreClassName);
      expect(classRegistry.getClass(overridenCoreClassName)).to.equal(Class);
    });

    it('should remove shadows of classes overriden in other modules', () => {
      expect(removed).to.not.have.been.calledWith(Class.className);
      expect(classRegistry.getClass(Override.className)).to.equal(Override);
    });

    it('should remove classes only present in said context', () => {
      expect(removed).to.have.been.calledWith(contextClass);
      expect(classRegistry.hasClass(contextClass)).to.be.false;
    });
  });
});
