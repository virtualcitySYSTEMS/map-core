/* eslint-disable no-template-curly-in-string */
import DeclarativeStyleItem from '../../../src/style/declarativeStyleItem.js';
import writeStyle from '../../../src/style/writeStyle.js';
import VectorStyleItem from '../../../src/style/vectorStyleItem.js';

describe('writeStyle', () => {
  it('should write a declarative style', async () => {
    const styleItem = new DeclarativeStyleItem({
      declarativeStyle: {
        defines: {
          hasExtrusion: 'Number(${olcs_extrudedHeight}) > 0',
        },
        pointOutlineColor: {
          conditions: [['Boolean(${image})===true', 'color("#00FF00")']],
        },
        color: {
          conditions: [
            ['Boolean(${noFill})===true', 'false'],
            [
              '${class} === "up"',
              'color("#FF0000") * vec4(1, 1, 1, ${hasExtrusion} ? 0.5 : 1.0)',
            ],
            [
              '${class} === "middle"',
              'color("#00FF00") * vec4(1, 1, 1, ${hasExtrusion} ? 0.5 : 1.0)',
            ],
            [
              '${class} === "down"',
              'color("#0000FF") * vec4(1, 1, 1, ${hasExtrusion} ? 0.5 : 1.0)',
            ],
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
    await styleItem.cesiumStyle.readyPromise;
    const vcsMeta = {};
    writeStyle(styleItem, vcsMeta);
    const returnedStyle = new DeclarativeStyleItem(vcsMeta.style);
    await returnedStyle.cesiumStyle.readyPromise;
    expect(returnedStyle.cesiumStyle.style).to.eql(styleItem.cesiumStyle.style);
  });

  it('should write a vector style', () => {
    const styleItem = new VectorStyleItem({});
    const vcsMeta = {};
    writeStyle(styleItem, vcsMeta);
    const returnedStyle = new VectorStyleItem(vcsMeta.style);
    expect(returnedStyle.style).to.eql(styleItem.style);
  });
});
