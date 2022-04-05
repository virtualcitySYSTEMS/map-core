import ObliqueImageMeta from '../../../src/oblique/obliqueImageMeta.js';

describe('ObliqueImageMeta', () => {
  let defaultOptions;

  before(() => {
    defaultOptions = {
      name: 'test',
      'camera-matrix': [[0, 0, 0], [0, 0, 0], [1, 1, 0]],
      'focal-length': 1,
      'principal-point': [1, 1],
      'radial-distorsion-expected-2-found': [1, 1, 1],
    };
  });

  it('should correctly calculate image coordinates with radial distortion - 1', () => {
    const meta = new ObliqueImageMeta({
      ...defaultOptions,
      'principal-point': [5834.37, 4362.2],
      'pixel-size': [0.0046, 0.0046],
      'radial-distorsion-found-2-expected': [0.000161722, 0.00421904, 0.0000305735, -0.00000912995, 3.9396e-8],
    });

    const coordinate = [3358.7531972410193, 7119.501739914109];

    const result = meta.radialDistortionCoordinate(coordinate, true);
    expect(result).to.have.members([3353.0790125906424, 7125.8215545120875]);
  });

  it('should correctly calculate image coordinates with radial distortion - 2', () => {
    const meta = new ObliqueImageMeta({
      ...defaultOptions,
      'principal-point': [5823.91, 4376.41],
      'pixel-size': [0.0046, 0.0046],
      'radial-distorsion-found-2-expected': [-0.000154022, -0.00421231, -0.0000274032, 0.00000871298, -2.8186e-8],
    });

    const coordinate = [453.2752152989915, 8538.086841725162];

    const result = meta.radialDistortionCoordinate(coordinate, true);
    expect(result).to.have.members([439.4363377121408, 8548.810515681307]);
  });
});
