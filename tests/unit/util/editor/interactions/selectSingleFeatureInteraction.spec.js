import { Feature } from 'ol';
import {
  isTiledFeature,
  SelectSingleFeatureInteraction,
  VectorLayer,
} from '../../../../../index.js';

describe('SelectSingleFeatureInteraction', () => {
  let layer;
  let featureA;
  let featureB;

  before(() => {
    featureA = new Feature();
    featureB = new Feature();
    layer = new VectorLayer({});
    layer.addFeatures([featureA, featureB]);
  });

  after(() => {
    layer.destroy();
  });

  describe('handling events', () => {
    describe('if no feature is selected', () => {
      let interaction;
      let featureChangedListener;
      let event;

      before(async () => {
        featureChangedListener = sinon.spy();
        interaction = new SelectSingleFeatureInteraction(layer);
        interaction.featureChanged.addEventListener(featureChangedListener);
        event = { feature: featureA };
        await interaction.pipe(event);
      });

      after(() => {
        interaction.destroy();
      });

      it('should set the currently selected feature', () => {
        expect(interaction.selected).to.have.members([featureA]);
      });

      it('should raise the featureChanged event', () => {
        expect(featureChangedListener).to.have.been.calledWithExactly(featureA);
      });

      it('should stop event propagation', () => {
        expect(event.stopPropagation).to.be.true;
      });
    });

    describe('if the same feature is already selected', () => {
      let interaction;
      let featureChangedListener;
      let event;

      before(async () => {
        featureChangedListener = sinon.spy();
        interaction = new SelectSingleFeatureInteraction(layer);
        await interaction.setSelected(featureA);
        interaction.featureChanged.addEventListener(featureChangedListener);
        event = { feature: featureA };
        await interaction.pipe(event);
      });

      after(() => {
        interaction.destroy();
      });

      it('should set the currently selected feature', () => {
        expect(interaction.selected).to.have.members([featureA]);
      });

      it('should not raise the featureChanged event', () => {
        expect(featureChangedListener).to.not.have.been.called;
      });

      it('should not set stop propagation on the event', () => {
        expect(event.stopPropagation).to.not.exist;
      });
    });

    describe('if another feature is already selected', () => {
      let interaction;
      let featureChangedListener;
      let event;

      before(async () => {
        featureChangedListener = sinon.spy();
        interaction = new SelectSingleFeatureInteraction(layer);
        await interaction.setSelected(featureA);
        interaction.featureChanged.addEventListener(featureChangedListener);
        event = { feature: featureB };
        await interaction.pipe(event);
      });

      after(() => {
        interaction.destroy();
      });

      it('should set the currently selected feature', () => {
        expect(interaction.selected).to.have.members([featureB]);
      });

      it('should raise the featureChanged event with the selected feature', () => {
        expect(featureChangedListener).to.have.been.calledWithExactly(featureB);
      });

      it('should set stop propagation on the event to true', () => {
        expect(event.stopPropagation).to.be.true;
      });
    });

    describe('if the feature does not belong to the layer', () => {
      let interaction;
      let featureChangedListener;
      let event;

      before(async () => {
        featureChangedListener = sinon.spy();
        interaction = new SelectSingleFeatureInteraction(layer);
        interaction.featureChanged.addEventListener(featureChangedListener);
        event = { feature: new Feature() };
        await interaction.pipe(event);
      });

      after(() => {
        interaction.destroy();
      });

      it('should not set the currently selected feature', () => {
        expect(interaction.selected).to.be.empty;
      });

      it('should not raise the featureChanged event', () => {
        expect(featureChangedListener).to.not.have.been.called;
      });

      it('should not set stop propagation on the event', () => {
        expect(event.stopPropagation).to.not.exist;
      });
    });

    describe('if the feature does not belong to the layer and there is a selected feature', () => {
      let interaction;
      let featureChangedListener;
      let event;

      before(async () => {
        featureChangedListener = sinon.spy();
        interaction = new SelectSingleFeatureInteraction(layer);
        await interaction.setSelected(featureA);
        interaction.featureChanged.addEventListener(featureChangedListener);
        event = { feature: new Feature() };
        await interaction.pipe(event);
      });

      after(() => {
        interaction.destroy();
      });

      it('should not set the currently selected feature', () => {
        expect(interaction.selected).to.be.empty;
      });

      it('should raise the featureChanged event null', () => {
        expect(featureChangedListener).to.have.been.calledWith(null);
      });

      it('should not set stop propagation on the event', () => {
        expect(event.stopPropagation).to.not.exist;
      });
    });

    describe('if there is no feature and there is a selected feature', () => {
      let interaction;
      let featureChangedListener;
      let event;

      before(async () => {
        featureChangedListener = sinon.spy();
        interaction = new SelectSingleFeatureInteraction(layer);
        await interaction.setSelected(featureA);
        interaction.featureChanged.addEventListener(featureChangedListener);
        event = { feature: null };
        await interaction.pipe(event);
      });

      after(() => {
        interaction.destroy();
      });

      it('should not set the currently selected feature', () => {
        expect(interaction.selected).to.be.empty;
      });

      it('should raise the featureChanged event with null', () => {
        expect(featureChangedListener).to.have.been.calledWith(null);
      });

      it('should not set stop propagation on the event', () => {
        expect(event.stopPropagation).to.not.exist;
      });
    });
  });

  describe('selecting a feature store feature', () => {
    let interaction;
    let featureChangedListener;
    let olFeature;

    before(async () => {
      olFeature = new Feature();
      layer.switchStaticFeatureToDynamic = sinon.stub().resolves(olFeature);
      interaction = new SelectSingleFeatureInteraction(layer);
      const tiledFeature = new Feature();
      tiledFeature[isTiledFeature] = true;
      featureChangedListener = sinon.spy();
      interaction.featureChanged.addEventListener(featureChangedListener);
      await interaction.setSelected(tiledFeature);
    });

    after(() => {
      delete layer.switchStaticFeatureToDynamic;
      interaction.destroy();
    });

    it('should not set the currently selected feature to the dynamic feature', () => {
      expect(interaction.selected).to.have.members([olFeature]);
    });

    it('should raise the featureChanged event with the dynamic feature', () => {
      expect(featureChangedListener).to.have.been.calledWithExactly(olFeature);
    });
  });
});
