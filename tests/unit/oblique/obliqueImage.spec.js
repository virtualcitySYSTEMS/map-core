import { Cartesian3, Matrix3, Matrix4 } from '@vcmap-cesium/engine';
import ObliqueImage from '../../../src/oblique/obliqueImage.js';
import ObliqueImageMeta from '../../../src/oblique/obliqueImageMeta.js';

describe('ObliqueImage', () => {
  let meta;
  let metaOptions;
  let image;

  before(() => {
    metaOptions = {
      size: [11608, 8708],
      'tile-size': [512, 512],
      'tile-resolution': [32, 16, 8, 4, 2, 1],
      name: 'name',
    };
  });

  describe('transformation North Direction', () => {
    before(() => {
      meta = new ObliqueImageMeta({
        ...metaOptions,
        'principal-point': [5793.28, 4354.91],
        'pixel-size': [0.0046, 0.0046],
        'radial-distorsion-expected-2-found': [
          0.000161722, 0.00421904, 3.05735e-5, -9.12995e-6, 3.9396e-8,
        ],
        'radial-distorsion-found-2-expected': [
          -0.000154022, -0.00421231, -2.74032e-5, 8.71298e-6, -2.8186e-8,
        ],
      });
      image = new ObliqueImage({
        name: '004_003_111002665',
        viewDirection: 1,
        meta,
        viewDirectionAngle: 1.57123191749574,
        groundCoordinates: [
          [3457599, 5547108, 0],
          [3456417, 5547112, 0],
          [3456131, 5548571, 0],
          [3457882, 5548548, 0],
        ],
        centerPointOnGround: [3457007.25, 5547834.75],
        projectionCenter: Cartesian3.fromArray([
          3457007.999, 5546115.246, 1927.841,
        ]),
        pToRealworld: new Matrix3(
          0.00459999839666135,
          -1.97340831220024e-6,
          -26.5766861433667,
          -3.67482229060044e-6,
          -0.00340864509919161,
          74.6860641375209,
          1.11642344540013e-6,
          -0.00308887272211537,
          -52.5680063163899,
        ),
        pToImage: new Matrix4(
          -19370.5776626081,
          -3874.68160359031,
          4288.17944588505,
          88445405711.8038,
          5.18888508979235,
          11426.4212634907,
          16231.4797110823,
          -63421478906.0036,
          -0.000716283064,
          -0.671493731856,
          0.74100988861,
          3725229.27087713,
          0,
          0,
          0,
          1,
        ),
      });
    });

    it('should transform imagecoordinates to Realworld', () => {
      let realworldCoords = image.transformImage2RealWorld([1000, 1000], 0);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3456452.5030210735, 5547336.783437387, 0].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([1000, 8000], 0);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3456233.129158076, 5548660.85288266, 0].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 8000], 0);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457855.720687913, 5548660.667917529, 0].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 1000], 0);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457614.830116536, 5547335.753348383, 0].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
    });

    it('should transform imagecoordinates to Realworld with height', () => {
      let realworldCoords = image.transformImage2RealWorld([1000, 1000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3456481.317458385, 5547273.420397421, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([1000, 8000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3456273.3228576384, 5548528.808308579, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 8000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457811.748050196, 5548528.6329378765, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 1000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457583.3528460795, 5547272.44374073, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
    });

    it('should transform realworld coords to image coords', () => {
      let imageCoords = image.transformRealWorld2Image(
        [3456452.5030210735, 5547336.783437387],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 1000]);
      imageCoords = image.transformRealWorld2Image(
        [3456233.129158076, 5548660.85288266],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3457855.720687913, 5548660.667917529],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3457614.830116536, 5547335.753348383],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 1000]);
    });

    it('should transform realworld coords to image coords with height information', () => {
      let imageCoords = image.transformRealWorld2Image(
        [3456481.317458385, 5547273.420397421, 100],
        100,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 1000]);
      imageCoords = image.transformRealWorld2Image(
        [3456273.3228576384, 5548528.808308579, 100],
        100,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3457811.748050196, 5548528.6329378765, 100],
        100,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3457583.3528460795, 5547272.44374073, 100],
        100,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 1000]);
    });
  });

  describe('transformation North Direction without Camera information', () => {
    before(() => {
      meta = new ObliqueImageMeta({
        ...metaOptions,
      });
      image = new ObliqueImage({
        name: '004_003_111002665',
        viewDirection: 1,
        meta,
        viewDirectionAngle: 1.57123191749574,
        groundCoordinates: [
          [3457599, 5547108, 0],
          [3456417, 5547112, 0],
          [3456131, 5548571, 0],
          [3457882, 5548548, 0],
        ],
        centerPointOnGround: [3457007.25, 5547834.75],
      });
    });

    it('should transform imagecoordinates to Realworld', () => {
      let realworldCoords = image.transformImage2RealWorld([1000, 1000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3456499.947953654, 5547228.383326324, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([1000, 8000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3456309.1902201273, 5548401.443051938, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 8000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457760.80680941, 5548381.2100876365, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 1000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457557.5692255585, 5547224.544503543, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
    });

    it('should transform realworld coords to image coords', () => {
      let imageCoords = image.transformRealWorld2Image(
        [3456481.317458385, 5547273.420397421, 100],
        100,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([895, 1362]);
      imageCoords = image.transformRealWorld2Image(
        [3456273.3228576384, 5548528.808308579, 100],
        100,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([899, 8542]);
      imageCoords = image.transformRealWorld2Image(
        [3457811.748050196, 5548528.6329378765, 100],
        100,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11167, 8626]);
      imageCoords = image.transformRealWorld2Image(
        [3457583.3528460795, 5547272.44374073, 100],
        100,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11162, 1394]);
    });
  });

  describe('transformation East Direction', () => {
    before(() => {
      meta = new ObliqueImageMeta({
        ...metaOptions,
        'principal-point': [5823.91, 4376.41],
        'pixel-size': [0.0046, 0.0046],
        'radial-distorsion-expected-2-found': [
          0.000161722, 0.00421904, 3.05735e-5, -9.12995e-6, 3.9396e-8,
        ],
        'radial-distorsion-found-2-expected': [
          -0.000154022, -0.00421231, -2.74032e-5, 8.71298e-6, -2.8186e-8,
        ],
      });
      image = new ObliqueImage({
        name: '002_001_116002531',
        viewDirection: 2,
        meta,
        viewDirectionAngle: -0.00225131669910268,
        groundCoordinates: [
          [3458711, 5546964, 0],
          [3457195, 5547273, 0],
          [3457179, 5548436, 0],
          [3458664, 5548735, 0],
        ],
        centerPointOnGround: [3457937.25, 5547852],
        projectionCenter: Cartesian3.fromArray([
          3456208.931, 5547855.891, 1926.432,
        ]),
        pToRealworld: new Matrix3(
          -3.58361944760043e-6,
          -0.00341413692141781,
          74.6766492191798,
          -0.00459998318832535,
          1.06408879138013e-5,
          26.8680237180451,
          -1.19090213970014e-5,
          -0.00308278378309837,
          -52.5711557997364,
        ),
        pToImage: new Matrix4(
          -3887.94442465914,
          19361.8661250586,
          4372.67191094019,
          -93987718454.0159,
          11443.5919063817,
          -50.93198628665,
          16229.4445272451,
          -39300146150.6746,
          -0.670173927129,
          -0.001399409533,
          0.74220276815,
          2322595.03152512,
          0,
          0,
          0,
          1,
        ),
      });
    });

    it('should transform imagecoordinates to Realworld', () => {
      let realworldCoords = image.transformImage2RealWorld([1000, 1000], 0);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457428.732493062, 5548420.276549364, 0].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([1000, 8000], 0);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3458751.67767971, 5548640.516843923, 0].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 8000], 0);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3458745.389740333, 5547021.515505437, 0].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 1000], 0);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457425.6874514995, 5547259.338557337, 0].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
    });

    it('should transform imagecoordinates to Realworld with height', () => {
      let realworldCoords = image.transformImage2RealWorld([1000, 1000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457365.413240065, 5548390.979584003, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([1000, 8000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3458619.6849993826, 5548599.787317455, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 8000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3458613.7234637244, 5547064.827501358, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 1000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457362.5262460914, 5547290.305289687, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
    });

    it('should transform realworld coords to image coords', () => {
      let imageCoords = image.transformRealWorld2Image(
        [3457428.732493062, 5548420.276549364],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 1000]);
      imageCoords = image.transformRealWorld2Image(
        [3458751.67767971, 5548640.516843923],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3458745.389740333, 5547021.515505437],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3457425.6874514995, 5547259.338557337],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 1000]);
    });

    it('should transform realworld coords to image coords with height information', () => {
      let imageCoords = image.transformRealWorld2Image(
        [3457365.413240065, 5548390.979584003, 100],
        100,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 1000]);
      imageCoords = image.transformRealWorld2Image(
        [3458619.6849993826, 5548599.787317455, 100],
        100,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3458613.7234637244, 5547064.827501358, 100],
        100,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3457362.5262460914, 5547290.305289687, 100],
        100,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 1000]);
    });
  });

  describe('transformation East Direction without Camera information', () => {
    before(() => {
      meta = new ObliqueImageMeta({
        ...metaOptions,
      });
      image = new ObliqueImage({
        name: '002_001_116002531',
        viewDirection: 2,
        meta,
        viewDirectionAngle: -0.00225131669910268,
        groundCoordinates: [
          [3458711, 5546964, 0],
          [3457195, 5547273, 0],
          [3457179, 5548436, 0],
          [3458664, 5548735, 0],
        ],
        centerPointOnGround: [3457937.25, 5547852],
      });
    });

    it('should transform imagecoordinates to Realworld', () => {
      let realworldCoords = image.transformImage2RealWorld([1000, 1000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457297.963856677, 5548355.434831743, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([1000, 8000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3458489.5825598785, 5548552.970382245, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 8000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3458530.014719873, 5547089.481122524, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 1000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457312.6808310323, 5547312.272126607, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
    });

    it('should transform realworld coords to image coords', () => {
      let imageCoords = image.transformRealWorld2Image(
        [3457297.963856677, 5548355.434831743, 0],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 1000]);
      imageCoords = image.transformRealWorld2Image(
        [3458489.5825598785, 5548552.970382245, 0],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3458530.014719873, 5547089.481122524, 0],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3457312.6808310323, 5547312.272126607, 0],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 1000]);
    });
  });

  describe('transformation South Direction', () => {
    before(() => {
      meta = new ObliqueImageMeta({
        ...metaOptions,
        'principal-point': [5824.17, 4368.78],
        'pixel-size': [0.0046, 0.0046],
        'radial-distorsion-expected-2-found': [
          0.000161722, 0.00421904, 3.05735e-5, -9.12995e-6, 3.9396e-8,
        ],
        'radial-distorsion-found-2-expected': [
          -0.000154022, -0.00421231, -2.74032e-5, 8.71298e-6, -2.8186e-8,
        ],
      });
      image = new ObliqueImage({
        name: '002_002_110002530',
        viewDirection: 3,
        meta,
        viewDirectionAngle: -1.57054048121102,
        groundCoordinates: [
          [3457517, 5545332, 0],
          [3455703, 5545329, 0],
          [3456014, 5546859, 0],
          [3457202, 5546865, 0],
        ],
        centerPointOnGround: [3456609, 5546096.25],
        projectionCenter: Cartesian3.fromArray([
          3456608.549, 5547859.032, 1930.676,
        ]),
        pToRealworld: new Matrix3(
          -0.00459999870578595,
          8.02851238800097e-7,
          26.8526062630599,
          -1.6537119600002e-6,
          0.00341358704863721,
          -74.5531710802698,
          -3.02853063040036e-6,
          -0.00308341090625037,
          -52.5485398140242,
        ),
        pToImage: new Matrix4(
          19341.0716322521,
          3910.93716222772,
          4334.76200696013,
          -88560210630.8861,
          -6.5636301369114,
          -11427.4356841196,
          16209.3051492068,
          63389195256.3575,
          -0.000729547563,
          0.670306645068,
          0.742083869477,
          -3717677.73822374,
          0,
          0,
          0,
          1,
        ),
      });
    });

    it('should transform imagecoordinates to Realworld', () => {
      let realworldCoords = image.transformImage2RealWorld([1000, 1000], 0);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457172.0626017735, 5546638.996725733, 0].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([1000, 8000], 0);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457394.5687216837, 5545313.388129975, 0].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 8000], 0);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3455769.701657499, 5545313.713156667, 0].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 1000], 0);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3456007.4692836073, 5546639.302129152, 0].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
    });

    it('should transform imagecoordinates to Realworld with height', () => {
      let realworldCoords = image.transformImage2RealWorld([1000, 1000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457142.875199674, 5546702.188918456, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([1000, 8000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457353.856530172, 5545445.240725906, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 8000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3455813.1500757956, 5545445.548917715, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 1000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3456038.6024369523, 5546702.478503388, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
    });

    it('should transform realworld coords to image coords', () => {
      let imageCoords = image.transformRealWorld2Image(
        [3457172.0626017735, 5546638.996725733, 0],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 1000]);
      imageCoords = image.transformRealWorld2Image(
        [3457394.5687216837, 5545313.388129975, 0],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3455769.701657499, 5545313.713156667, 0],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3456007.4692836073, 5546639.302129152, 0],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 1000]);
    });

    it('should transform realworld coords to image coords with height information', () => {
      let imageCoords = image.transformRealWorld2Image(
        [3457142.875199674, 5546702.188918456, 100],
        100,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 1000]);
      imageCoords = image.transformRealWorld2Image(
        [3457353.856530172, 5545445.240725906, 100],
        100,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3455813.1500757956, 5545445.548917715, 100],
        100,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3456038.6024369523, 5546702.478503388, 100],
        100,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 1000]);
    });
  });

  describe('transformation South Direction without Camera information', () => {
    before(() => {
      meta = new ObliqueImageMeta({
        ...metaOptions,
      });
      image = new ObliqueImage({
        name: '002_002_110002530',
        viewDirection: 3,
        meta,
        viewDirectionAngle: -1.57054048121102,
        groundCoordinates: [
          [3457517, 5545332, 0],
          [3455703, 5545329, 0],
          [3456014, 5546859, 0],
          [3457202, 5546865, 0],
        ],
        centerPointOnGround: [3456609, 5546096.25],
      });
    });

    it('should transform imagecoordinates to Realworld', () => {
      let realworldCoords = image.transformImage2RealWorld([1000, 1000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457120.0295212436, 5546744.667517173, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([1000, 8000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457329.6990180044, 5545513.7188623, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 8000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3455831.185298105, 5545511.675654531, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 1000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3456054.4061301094, 5546739.384977457, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
    });

    it('should transform realworld coords to image coords', () => {
      let imageCoords = image.transformRealWorld2Image(
        [3457120.0295212436, 5546744.667517173, 0],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 1000]);
      imageCoords = image.transformRealWorld2Image(
        [3457329.6990180044, 5545513.7188623, 0],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3455831.185298105, 5545511.675654531, 0],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3456054.4061301094, 5546739.384977457, 0],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 1000]);
    });
  });

  describe('transformation West Direction', () => {
    before(() => {
      meta = new ObliqueImageMeta({
        ...metaOptions,
        'principal-point': [5834.37, 4362.2],
        'pixel-size': [0.0046, 0.0046],
        'radial-distorsion-expected-2-found': [
          0.000161722, 0.00421904, 3.05735e-5, -9.12995e-6, 3.9396e-8,
        ],
        'radial-distorsion-found-2-expected': [
          -0.000154022, -0.00421231, -2.74032e-5, 8.71298e-6, -2.8186e-8,
        ],
      });
      image = new ObliqueImage({
        name: '004_007_119002661',
        viewDirection: 4,
        meta,
        viewDirectionAngle: -3.13740121400662,
        groundCoordinates: [
          [3457595, 5545512, 0],
          [3456064, 5545208, 0],
          [3456108, 5547007, 0],
          [3457612, 5546702, 0],
        ],
        centerPointOnGround: [3456844.75, 5546107.25],
        projectionCenter: Cartesian3.fromArray([
          3458606.187, 5546114.633, 1932.244,
        ]),
        pToRealworld: new Matrix3(
          1.17090415674014e-5,
          0.00341621365204581,
          -74.6085692318723,
          0.00459995773043955,
          -1.93217796112023e-5,
          -26.8299040407416,
          -1.58674672814019e-5,
          -0.00308044005823997,
          -52.6081816885698,
        ),
        pToImage: new Matrix4(
          3857.81793353301,
          -19354.821070108,
          4399.72848766595,
          93992882033.8138,
          -11456.5753623376,
          85.0586208548605,
          16204.2586168896,
          39120726986.7398,
          0.669669217711,
          0.000857167186,
          0.742659009314,
          -2322311.04550671,
          0,
          0,
          0,
          1,
        ),
      });
    });

    it('should transform imagecoordinates to Realworld', () => {
      let realworldCoords = image.transformImage2RealWorld([1000, 1000], 0);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457385.402965681, 5545547.982978649, 0].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([1000, 8000], 0);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3456060.3025574223, 5545329.301171974, 0].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 8000], 0);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3456071.3173159277, 5546951.4371234, 0].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 1000], 0);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457391.1207397645, 5546711.744624096, 0].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
    });

    it('should transform imagecoordinates to Realworld with height', () => {
      let realworldCoords = image.transformImage2RealWorld([1000, 1000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457448.582629307, 5545577.309015635, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([1000, 8000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3456192.0606065053, 5545369.94472508, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 8000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3456202.5053143566, 5546908.129706567, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 1000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457454.0044894265, 5546680.842097116, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
    });

    it('should transform realworld coords to image coords', () => {
      let imageCoords = image.transformRealWorld2Image(
        [3457385.402965681, 5545547.982978649, 0],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 1000]);
      imageCoords = image.transformRealWorld2Image(
        [3456060.3025574223, 5545329.301171974, 0],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3456071.3173159277, 5546951.4371234, 0],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3457391.1207397645, 5546711.744624096, 0],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 1000]);
    });

    it('should transform realworld coords to image coords with height information', () => {
      let imageCoords = image.transformRealWorld2Image(
        [3457448.582629307, 5545577.309015635, 100],
        100,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 1000]);
      imageCoords = image.transformRealWorld2Image(
        [3456192.0606065053, 5545369.94472508, 100],
        100,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3456202.5053143566, 5546908.129706567, 100],
        100,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3457454.0044894265, 5546680.842097116, 100],
        100,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 1000]);
    });
  });

  describe('transformation West Direction without Camera information', () => {
    before(() => {
      meta = new ObliqueImageMeta({
        ...metaOptions,
      });
      image = new ObliqueImage({
        name: '004_007_119002661',
        viewDirection: 4,
        meta,
        viewDirectionAngle: -3.13740121400662,
        groundCoordinates: [
          [3457595, 5545512, 0],
          [3456064, 5545208, 0],
          [3456108, 5547007, 0],
          [3457612, 5546702, 0],
        ],
        centerPointOnGround: [3456844.75, 5546107.25],
      });
    });

    it('should transform imagecoordinates to Realworld', () => {
      let realworldCoords = image.transformImage2RealWorld([1000, 1000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457476.300938633, 5545594.848874346, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([1000, 8000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3456246.7283794065, 5545392.521973434, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 8000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3456284.396694943, 5546880.393480412, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
      realworldCoords = image.transformImage2RealWorld([11000, 1000], 100);
      expect(realworldCoords.map((x) => Math.round(x * 1000) / 1000)).to.eql(
        [3457491.826018541, 5546661.349869621, 100].map(
          (x) => Math.round(x * 1000) / 1000,
        ),
      );
    });

    it('should transform realworld coords to image coords', () => {
      let imageCoords = image.transformRealWorld2Image(
        [3457476.300938633, 5545594.848874346, 0],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 1000]);
      imageCoords = image.transformRealWorld2Image(
        [3456246.7283794065, 5545392.521973434, 0],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([1000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3456284.396694943, 5546880.393480412, 0],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 8000]);
      imageCoords = image.transformRealWorld2Image(
        [3457491.826018541, 5546661.349869621, 0],
        0,
      );
      expect(imageCoords.map((x) => Math.round(x))).to.eql([11000, 1000]);
    });
  });
});
