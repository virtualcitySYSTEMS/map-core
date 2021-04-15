/* eslint-disable no-template-curly-in-string */
import DeclarativeStyleItem from '../../../../../src/vcs/vcm/util/style/declarativeStyleItem.js';
import writeStyle from '../../../../../src/vcs/vcm/util/style/writeStyle.js';
import VectorStyleItem from '../../../../../src/vcs/vcm/util/style/vectorStyleItem.js';
import { referenceableStyleSymbol, StyleType } from '../../../../../src/vcs/vcm/util/style/styleItem.js';

describe('vcs.vcm.util.style.writeStyle', () => {
  it('should write a declarative style', () => {
    const styleItem = new DeclarativeStyleItem({
      declarativeStyle: {
        defines: {
          hasExtrusion: 'Number(${olcs_extrudedHeight}) > 0',
        },
        pointOutlineColor: {
          conditions: [
            ['Boolean(${image})===true', 'color("#00FF00")'],
          ],
        },
        color: {
          conditions: [
            ['Boolean(${noFill})===true', 'false'],
            ['${class} === "up"', 'color("#FF0000") * vec4(1, 1, 1, ${hasExtrusion} ? 0.5 : 1.0)'],
            ['${class} === "middle"', 'color("#00FF00") * vec4(1, 1, 1, ${hasExtrusion} ? 0.5 : 1.0)'],
            ['${class} === "down"', 'color("#0000FF") * vec4(1, 1, 1, ${hasExtrusion} ? 0.5 : 1.0)'],
            ['${image} === "sensor"', 'color("#FF00FF")'],
            ['${image} === "marker"', 'color("#00FFFF")'],
            ['true', 'color("#FFFFFF")'],
          ],
        },
        labelText: '${pegel}',
        labelColor: {
          conditions: [
            ['${pegel} > 3.5', 'color("#FF0000")'],
            ['${pegel} > 3', 'color("#00FF00")'],
            ['${pegel} <= 3', 'color("#0000FF")'],
          ],
        },
        strokeColor: {
          conditions: [
            ['${image} === "sensor"', 'color("#FF00FF")'],
            ['${image} === "marker"', 'color("#00FFFF")'],
            ['true', 'color("#000000")'],
          ],
        },
        strokeWidth: '2',
      },
    });

    const vcsMeta = {};
    writeStyle(styleItem, vcsMeta);
    const returnedStyle = new DeclarativeStyleItem(vcsMeta.style);
    expect(returnedStyle.cesiumStyle.style).to.eql(styleItem.cesiumStyle.style);
  });

  it('should write a vector style', () => {
    const styleItem = new VectorStyleItem({});
    const vcsMeta = {};
    writeStyle(styleItem, vcsMeta);
    const returnedStyle = new VectorStyleItem(vcsMeta.style);
    expect(returnedStyle.style).to.eql(styleItem.style);
  });

  it('should write a style reference, if the style is a config style', () => {
    const styleItem = new VectorStyleItem({});
    styleItem[referenceableStyleSymbol] = true;
    const vcsMeta = {};
    writeStyle(styleItem, vcsMeta);
    expect(vcsMeta.style).to.have.property('type', StyleType.REFERENCE);
    expect(vcsMeta.style).to.have.property('name', styleItem.name);
  });
});
