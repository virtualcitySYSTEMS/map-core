import { Icon, RegularShape } from 'ol/style.js';
import { getDefaultArrowIconSrc } from '../../../src/style/arrowStyle.js';
import { ArrowStyle, PrimitiveOptionsType } from '../../../index.js';

/**
 * @param {NamedNodeMap} attributes
 * @param {string} key
 * @param {*} value
 */
function checkAttributeValue(attributes, key, value) {
  const { value: actualValue } = attributes.getNamedItem(key);
  expect(actualValue).to.equal(String(value), `failed attribute ${key}`);
}

/**
 * @param {Document} svg
 * @param {Array<Array<number>>} coordinates
 */
function checkPolygonPositions(svg, coordinates) {
  const { attributes } = svg.querySelector('polygon');
  checkAttributeValue(attributes, 'points', coordinates.map(c => c.join(',')).join(' '));
}

/**
 * @param {Document} svg
 * @param {number} width
 * @param {number} height
 */
function checkHeightWidth(svg, width, height) {
  const { attributes } = svg.querySelector('svg');
  checkAttributeValue(attributes, 'width', width);
  checkAttributeValue(attributes, 'height', height);
}

/**
 * @param {string} svg
 * @returns {Document}
 */
function parseSvg(svg) {
  return (new DOMParser()).parseFromString(svg, 'application/xml');
}

const red = '#FF0000';
const green = '#00FF00';

describe('ArrowStyle', () => {
  describe('deducing arrow svg', () => {
    describe('from SPHERE', () => {
      /** @type {Document} */
      let svg;

      before(() => {
        svg = parseSvg(getDefaultArrowIconSrc({
          type: PrimitiveOptionsType.SPHERE,
          geometryOptions: {
            radius: 10,
          },
        }, 1));
      });

      it('set the height & width to twice the radius', () => {
        checkHeightWidth(svg, 20, 20);
      });

      it('should create a circle at the center', () => {
        const { attributes } = svg.querySelector('circle');
        checkAttributeValue(attributes, 'cx', 10);
        checkAttributeValue(attributes, 'cx', 10);
        checkAttributeValue(attributes, 'r', 10);
      });
    });

    describe('from BOX', () => {
      /** @type {Document} */
      let svg;

      before(() => {
        svg = parseSvg(getDefaultArrowIconSrc({
          type: PrimitiveOptionsType.BOX,
          geometryOptions: {
            minimum: [0, 0, 0],
            maximum: [10, 6, 10],
          },
        }, 1));
      });

      it('set the height & width to the box extent', () => {
        checkHeightWidth(svg, 10, 6);
      });

      it('should create a square', () => {
        checkPolygonPositions(svg, [[0, 0], [10, 0], [10, 6], [0, 6]]);
      });
    });

    describe('from CYLINDER', () => {
      describe('of upward pointing cone', () => {
        /** @type {Document} */
        let svg;

        before(() => {
          svg = parseSvg(getDefaultArrowIconSrc({
            type: PrimitiveOptionsType.CYLINDER,
            geometryOptions: {
              length: 6,
              bottomRadius: 2,
              topRadius: 0,
            },
          }, 1));
        });

        it('set the height to its length and width to twice the bottom radius', () => {
          checkHeightWidth(svg, 4, 6);
        });

        it('should create a triangle', () => {
          checkPolygonPositions(svg, [[0, 6], [4, 6], [2, 0]]);
        });
      });

      describe('of downward pointing cone', () => {
        /** @type {Document} */
        let svg;

        before(() => {
          svg = parseSvg(getDefaultArrowIconSrc({
            type: PrimitiveOptionsType.CYLINDER,
            geometryOptions: {
              length: 6,
              bottomRadius: 0,
              topRadius: 2,
            },
          }, 1));
        });

        it('set the height to its length and width to twice the top radius', () => {
          checkHeightWidth(svg, 4, 6);
        });

        it('should create a triangle', () => {
          checkPolygonPositions(svg, [[2, 6], [4, 0], [0, 0]]);
        });
      });

      describe('of a cut cone', () => {
        /** @type {Document} */
        let svg;

        before(() => {
          svg = parseSvg(getDefaultArrowIconSrc({
            type: PrimitiveOptionsType.CYLINDER,
            geometryOptions: {
              length: 6,
              bottomRadius: 2,
              topRadius: 6,
            },
          }, 1));
        });

        it('set the height to its length and width to twice the larger radius', () => {
          checkHeightWidth(svg, 12, 6);
        });

        it('should create a suare', () => {
          checkPolygonPositions(svg, [[4, 6], [8, 6], [12, 0], [0, 0]]);
        });
      });
    });
  });

  describe('creating an arrow style', () => {
    /** @type {ArrowStyle} */
    let style;

    before(() => {
      style = new ArrowStyle({ color: red });
    });

    it('should create a stroked style', () => {
      expect(style.getStroke().getColor()).to.equal(red);
    });

    it('should create an icon with said color', () => {
      expect(style.getImage()).to.be.an.instanceof(Icon);
      expect(style.getImage().getColor()).to.have.members([255, 0, 0, 1]);
    });

    it('should have the color set', () => {
      expect(style.color).to.equal(red);
    });
  });

  describe('setting the color', () => {
    /** @type {ArrowStyle} */
    let style;

    beforeEach(() => {
      style = new ArrowStyle({ color: red });
    });

    it('should set the color', () => {
      style.color = green;
      expect(style.color).to.equal(green);
    });

    it('should set the strokes color', () => {
      style.color = green;
      expect(style.getStroke().getColor()).to.equal(green);
    });

    it('should set the color from the stroke', () => {
      style.getStroke().setColor(green);
      expect(style.color).to.equal(green);
    });
  });

  describe('setting the width', () => {
    /** @type {ArrowStyle} */
    let style;

    beforeEach(() => {
      style = new ArrowStyle({ color: red });
    });

    it('should set the color', () => {
      style.width = 3;
      expect(style.width).to.equal(3);
    });

    it('should set the strokes color', () => {
      style.width = 3;
      expect(style.getStroke().getWidth()).to.equal(3);
    });

    it('should set the color from the stroke', () => {
      style.getStroke().setWidth(3);
      expect(style.width).to.equal(3);
    });
  });

  describe('getting the olcs style', () => {
    it('should return a regular shape with the correct color', () => {
      const imageStyle = new ArrowStyle({ color: red }).getOlcsStyle().getImage();
      expect(imageStyle).to.be.an.instanceof(RegularShape);
      expect(imageStyle.getFill().getColor()).to.equal(red);
    });
  });
});
