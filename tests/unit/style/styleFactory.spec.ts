import { expect } from 'chai';
import DeclarativeStyleItem from '../../../src/style/declarativeStyleItem.js';
import VectorStyleItem, {
  defaultVectorStyle,
} from '../../../src/style/vectorStyleItem.js';
import { getStyleOrDefaultStyle } from '../../../src/style/styleFactory.js';

describe('getStyleOrDefaultStyle', () => {
  it('should return an empty declarative style', () => {
    const style = getStyleOrDefaultStyle(undefined);
    expect(style).to.be.an.instanceOf(DeclarativeStyleItem);
    expect(style).to.have.property('show', 'true');
  });

  it('should return a new vector style item', () => {
    const style = getStyleOrDefaultStyle({
      type: VectorStyleItem.className,
      stroke: { width: 5, color: '#FF00FF' },
      name: 'foo',
    }) as VectorStyleItem;
    expect(style).to.be.an.instanceOf(VectorStyleItem);
    expect(style).to.have.property('stroke');
    expect(style.name).to.equal('foo');
    expect(style.stroke?.getWidth()).to.equal(5);
  });

  it('should return a passed defaultStyle', () => {
    const style = getStyleOrDefaultStyle(defaultVectorStyle.clone());
    expect(style)
      .to.have.property('fillColor')
      .to.have.members(defaultVectorStyle.fillColor!);
  });

  it('should return a cloned, assigned to a passed default style', () => {
    const defaultStyle = defaultVectorStyle.clone();
    const style = getStyleOrDefaultStyle(
      {
        type: VectorStyleItem.className,
        stroke: { width: 5, color: '#FF00FF' },
        name: 'foo',
      },
      defaultStyle,
    ) as VectorStyleItem;
    expect(style)
      .to.have.property('fillColor')
      .to.have.members(defaultVectorStyle.fillColor!);
    expect(style).to.have.property('stroke');
    expect(style).to.not.equal(defaultStyle);
    expect(style.name).to.equal('foo');
    expect(style.stroke?.getWidth()).to.equal(5);
  });

  it('should return a new declarative style item', () => {
    const style = getStyleOrDefaultStyle({
      type: DeclarativeStyleItem.className,
      declarativeStyle: { color: 'color("#FF00FF")' },
    });
    expect(style).to.be.an.instanceOf(DeclarativeStyleItem);
    expect(style).to.have.property('color', 'color("#FF00FF")');
  });
});
