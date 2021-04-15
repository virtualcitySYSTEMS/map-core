// eslint-disable-next-line max-classes-per-file
import VcsObject from '../../../src/vcs/vcm/object.js';

describe('VCSObject', () => {
  describe('constructor', () => {
    it('should use vcs.vcm.Framework as fallback className', () => {
      const myClassName = undefined;
      const vcsObject = new VcsObject({
        className: myClassName,
      });
      expect(vcsObject.className).to.equal('vcs.vcm.Framework');
    });
    it('should parse name option', () => {
      const myName = 'name';
      const vcsObject = new VcsObject({
        name: myName,
      });
      expect(vcsObject.name).to.equal(myName);
    });
    it('should create uuid as a fallback if no name is given name option', () => {
      const vcsObject = new VcsObject({});
      expect(vcsObject.name).to.be.a('string');
    });
  });

  describe('getConfigObject', () => {
    it('should return Object with config Options type and name and properties', () => {
      const myName = 'MyName';
      const myProperties = { test: 'a' };
      const vcsObject = new VcsObject({
        properties: myProperties,
        name: myName,
      });
      expect(vcsObject.getConfigObject()).to.deep.equal({
        type: 'vcs.vcm.Framework',
        properties: myProperties,
        name: myName,
      });
    });

    it('should not return empty properties', () => {
      const vcsObject = new VcsObject({
        name: 'test',
      });
      expect(vcsObject.getConfigObject()).to.have.all.keys('name', 'type');
    });
  });

  describe('className', () => {
    it('should return the default className on the vcsObject Instance', () => {
      const vcsObject = new VcsObject({});
      expect(vcsObject.className).to.equal('vcs.vcm.Framework');
    });

    it('should return the default className on the vcsObject Class', () => {
      expect(VcsObject.className).to.equal('vcs.vcm.Framework');
    });

    describe('classWithoutClassName', () => {
      class ClassWithoutClassName extends VcsObject {}

      it('should return the default className on an Instance', () => {
        const testClass = new ClassWithoutClassName({});
        expect(testClass.className).to.equal('vcs.vcm.Framework');
      });

      it('should return the default className on the Class', () => {
        expect(ClassWithoutClassName.className).to.equal('vcs.vcm.Framework');
      });
    });

    describe('classWithClassName', () => {
      class ClassWithClassName extends VcsObject {
        static get className() { return 'testClass'; }
      }

      it('should return the default className on an Instance', () => {
        const testClass = new ClassWithClassName({});
        expect(testClass.className).to.equal('testClass');
      });

      it('should return the default className on the Class', () => {
        expect(ClassWithClassName.className).to.equal('testClass');
      });
    });
  });

  describe('destroy', () => {
    it('should reset the properties Object', () => {
      const myProperties = { test: 'a' };
      const vcsObject = new VcsObject({
        properties: myProperties,
      });
      vcsObject.destroy();
      expect(vcsObject.properties).to.be.empty;
    });
  });
});
