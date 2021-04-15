import DeclarativeStyleItem from '../../../../../src/vcs/vcm/util/style/declarativeStyleItem.js';
import { StyleType } from '../../../../../src/vcs/vcm/util/style/styleItem.js';
import VectorStyleItem, { defaultVectorStyle } from '../../../../../src/vcs/vcm/util/style/vectorStyleItem.js';
import { getStyleOrDefaultStyle } from '../../../../../src/vcs/vcm/util/style/styleFactory.js';
import resetFramework from '../../../helpers/resetFramework.js';
import { styleCollection } from '../../../../../src/vcs/vcm/globalCollections.js';

describe('getStyleOrDefaultStyle', () => {
  after(() => {
    resetFramework();
  });

  describe('referenced styles', () => {
    let styleItem;
    before(() => {
      styleItem = new DeclarativeStyleItem({
        declarativeStyle: { show: false },
      });
      styleCollection.add(styleItem);
    });

    it('should return an existing style by name if a string is given', () => {
      const myStyle = getStyleOrDefaultStyle(styleItem.name);
      expect(myStyle).to.equal(styleItem);
    });

    it('should return an existing style, if passing a reference', () => {
      const myStyle = getStyleOrDefaultStyle({ type: StyleType.REFERENCE, name: styleItem.name });
      expect(myStyle).to.equal(styleItem);
    });
  });

  it('should return the default DeclarativeStyle if a string is given but the style cannot be found', () => {
    const myStyle = getStyleOrDefaultStyle('styleWhichDoesNotExists');
    expect(myStyle).to.be.an.instanceOf(DeclarativeStyleItem);
  });

  it('should return an empty declarative style', () => {
    const style = getStyleOrDefaultStyle();
    expect(style).to.be.an.instanceOf(DeclarativeStyleItem);
    expect(style).to.have.property('show', 'true');
  });

  it('should return a new vector style item', () => {
    const style = getStyleOrDefaultStyle({ stroke: { width: 5, color: '#FF00FF' } });
    expect(style).to.be.an.instanceOf(VectorStyleItem);
    expect(style).to.have.property('stroke');
    expect(style.stroke.getWidth()).to.equal(5);
  });


  it('should return a passed defaultStyle', () => {
    const style = getStyleOrDefaultStyle(defaultVectorStyle.clone());
    expect(style).to.have.property('fillColor').to.have.members(defaultVectorStyle.fillColor);
  });

  it('should return an assigned to a passed default style', () => {
    const style = getStyleOrDefaultStyle({ stroke: { width: 5, color: '#FF00FF' } }, defaultVectorStyle.clone());
    expect(style).to.have.property('fillColor').to.have.members(defaultVectorStyle.fillColor);
    expect(style).to.have.property('stroke');
    expect(style.stroke.getWidth()).to.equal(5);
  });

  it('should return a new declarative style item', () => {
    const style = getStyleOrDefaultStyle({ declarativeStyle: { color: 'color("#FF00FF")' } });
    expect(style).to.be.an.instanceOf(DeclarativeStyleItem);
    expect(style).to.have.property('color', 'color("#FF00FF")');
  });
});
