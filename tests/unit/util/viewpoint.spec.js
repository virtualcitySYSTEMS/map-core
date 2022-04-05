import ViewPoint from '../../../src/util/viewpoint.js';

describe('ViewPoint', () => {
  describe('isValid', () => {
    it('should be invalid if missing camera or ground position', () => {
      const vp = new ViewPoint({
        name: 'hauptbhnhf',
        distance: 2480.9491308407964,
        groundPosition: [
          13.43080593131163,
        ],
        heading: 337.52854532052663,
        pitch: -41.10601490149314,
        roll: 359.8987925198945,
        animate: false,
      });
      expect(vp.isValid()).to.be.false;
    });

    it('should be invalid on non-numeric axis parameters', () => {
      const vp = new ViewPoint({
        name: 'hauptbhnhf',
        distance: 2480.9491308407964,
        cameraPosition: [
          13.441330102798556,
          52.49571151602689,
          1666.0679354733245,
        ],
        groundPosition: [
          13.43080593131163,
          52.51123474050636,
          35.229622864799836,
        ],
        heading: 337.52854532052663,
        pitch: -41.10601490149314,
        roll: 359.8987925198945,
        animate: false,
      });
      expect(vp.isValid()).to.be.true;
      vp.roll = '123';
      expect(vp.isValid()).to.be.false;
    });

    it('should be valid if no distance is given when only setting ground position', () => {
      const vp = new ViewPoint({
        name: 'hauptbhnhf',
        distance: NaN,
        groundPosition: [
          13.43080593131163,
          52.51123474050636,
          35.229622864799836,
        ],
        heading: 337.52854532052663,
        pitch: -41.10601490149314,
        roll: 359.8987925198945,
        animate: false,
      });
      expect(vp).to.have.property('distance', 1000);
      expect(vp.isValid()).to.be.true;
    });
  });

  describe('comparing viewpoints', () => {
    let vp1;
    let vp2;

    beforeEach(() => {
      vp1 = new ViewPoint({
        name: 'hauptbhnhf',
        distance: 2480.9491308407964,
        cameraPosition: [
          13.441330102798556,
          52.49571151602689,
          1666.0679354733245,
        ],
        groundPosition: [
          13.43080593131163,
          52.51123474050636,
          35.229622864799836,
        ],
        heading: 337.52854532052663,
        pitch: -41.10601490149314,
        roll: 359.8987925198945,
        animate: false,
      });

      vp2 = new ViewPoint({
        name: 'hauptbhnhf',
        distance: 2480.9491308407964,
        cameraPosition: [
          13.441330102798556,
          52.49571151602689,
          1666.0679354733245,
        ],
        groundPosition: [
          13.43080593131163,
          52.51123474050636,
          35.229622864799836,
        ],
        heading: 337.52854532052663,
        pitch: -41.10601490149314,
        roll: 359.8987925198945,
        animate: false,
      });
    });

    it('should return true, if the viewpoints are equal', () => {
      expect(vp1.equals(vp1)).to.be.true;
    });

    it('should return true, if the viewpoints values are equal', () => {
      expect(vp1.equals(vp2)).to.be.true;
    });

    it('should return true, if the viewpoints values are equal within epsilon', () => {
      vp2.distance += 0.01;
      vp2.heading += 0.01;
      vp2.pitch -= 0.01;
      vp2.roll -= 0.01;
      vp2.groundPosition[0] += 0.01;
      vp2.cameraPosition[0] += 0.01;
      expect(vp1.equals(vp2, 0.1)).to.be.true;
      expect(vp1.equals(vp2, 0.05)).to.be.true;
    });

    it('should return true, if the viewpoints angles are equal within zeroToTwoPi Range', () => {
      vp1.heading = 0;
      vp1.pitch = -90;
      vp2.heading = 360;
      vp2.pitch = 270;
      expect(vp1.equals(vp2)).to.be.true;
      expect(vp1.equals(vp2, 0.05)).to.be.true;
    });

    it('should return false, if other viewpoint is null', () => {
      expect(vp1.equals(null)).to.be.false;
    });

    it('should return false, if the viewpoints values are NOT equal', () => {
      vp2.distance += 0.01;
      vp2.heading += 0.01;
      vp2.pitch -= 0.01;
      vp2.roll -= 0.01;
      vp2.groundPosition[0] += 0.01;
      vp2.cameraPosition[0] += 0.01;
      expect(vp1.equals(vp2)).to.be.false;
    });

    it('should return false, if the viewpoints values are NOT equal within epsilon', () => {
      vp2.distance += 0.01;
      vp2.heading += 0.01;
      vp2.pitch -= 0.01;
      vp2.roll -= 0.01;
      vp2.groundPosition[0] += 0.01;
      vp2.cameraPosition[0] += 0.01;
      expect(vp1.equals(vp2, 0.01)).to.be.false;
      expect(vp1.equals(vp2, 0.001)).to.be.false;
    });
  });
});
