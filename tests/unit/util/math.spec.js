import { modulo } from 'ol/math.js';

describe('modulo', () => {
  it('should return the modulo of 5 % 2', () => {
    expect(modulo(5, 2)).to.equal(1);
  });

  it('should return the modulo of 5 % -2', () => {
    expect(modulo(5, -2)).to.equal(-1);
  });

  it('should return the modulo of -5 % -2', () => {
    expect(modulo(5, -2)).to.equal(-1);
  });

  it('should return the modulo of -5 % 2', () => {
    expect(modulo(-5, 2)).to.equal(1);
  });
});
