import { Feature } from 'ol';
import { Point } from 'ol/geom.js';
import {
  isTiledFeature,
  ModificationKeyType,
  SelectMultiFeatureInteraction,
  VectorLayer,
} from '../../../../../index.js';
import { createFeatureWithId } from '../transformation/setupTransformationHandler.js';
import { getVcsEventSpy } from '../../../helpers/cesiumHelpers.js';

describe('SelectMultiFeatureInteraction', () => {
  let layer;
  let featureA;
  let featureB;

  before(() => {
    featureA = createFeatureWithId(new Point([0, 0, 0]));
    featureB = createFeatureWithId(new Point([0, 0, 0]));
    layer = new VectorLayer({});
    layer.addFeatures([featureA, featureB]);
  });

  after(() => {
    layer.destroy();
  });

  describe('handling events', () => {
    describe('if no feature is selected', () => {
      let interaction;
      let featuresChangedListener;
      let event;

      before(async () => {
        interaction = new SelectMultiFeatureInteraction(layer);
        featuresChangedListener = getVcsEventSpy(interaction.featuresChanged);
        event = { feature: featureA };
        await interaction.pipe(event);
      });

      after(() => {
        interaction.destroy();
      });

      it('should set the currently selected features', () => {
        expect(interaction.selected).to.have.members([featureA]);
      });

      it('should raise the featuresChanged event', () => {
        expect(featuresChangedListener).to.have.been.calledWith([featureA]);
      });

      it('should stop event propagation', () => {
        expect(event.stopPropagation).to.be.true;
      });
    });

    describe('if the same feature is already selected', () => {
      let interaction;
      let featuresChangedListener;
      let event;

      before(async () => {
        interaction = new SelectMultiFeatureInteraction(layer);
        await interaction.setSelected([featureA]);
        featuresChangedListener = getVcsEventSpy(interaction.featuresChanged);
        event = { feature: featureA };
        await interaction.pipe(event);
      });

      after(() => {
        interaction.destroy();
      });

      it('should set the currently selected features', () => {
        expect(interaction.selected).to.have.members([featureA]);
      });

      it('should not raise the featuresChanged event', () => {
        expect(featuresChangedListener).to.not.have.been.called;
      });

      it('should not stop event propagation', () => {
        expect(event.stopPropagation).to.not.exist;
      });
    });

    describe('if the same feature is already selected, and CTRL is held', () => {
      let interaction;
      let featuresChangedListener;
      let event;

      before(async () => {
        interaction = new SelectMultiFeatureInteraction(layer);
        await interaction.setSelected([featureA]);
        featuresChangedListener = getVcsEventSpy(interaction.featuresChanged);
        event = { feature: featureA, key: ModificationKeyType.CTRL };
        await interaction.pipe(event);
      });

      after(() => {
        interaction.destroy();
      });

      it('should clear the currently selected features', () => {
        expect(interaction.selected).to.be.empty;
      });

      it('should raise the featuresChanged event', () => {
        expect(featuresChangedListener).to.have.been.calledWith([]);
      });

      it('should set stop propagation on the event', () => {
        expect(event.stopPropagation).to.be.true;
      });
    });

    describe('if another feature is already selected', () => {
      let interaction;
      let featuresChangedListener;
      let event;

      before(async () => {
        interaction = new SelectMultiFeatureInteraction(layer);
        await interaction.setSelected([featureA]);
        featuresChangedListener = getVcsEventSpy(interaction.featuresChanged);
        event = { feature: featureB };
        await interaction.pipe(event);
      });

      after(() => {
        interaction.destroy();
      });

      it('should set the currently selected features to the new feature', () => {
        expect(interaction.selected).to.have.members([featureB]);
      });

      it('should raise the featuresChanged event with the selected features', () => {
        expect(featuresChangedListener).to.have.been.calledWith([featureB]);
      });

      it('should set stop propagation on the event to true', () => {
        expect(event.stopPropagation).to.be.true;
      });
    });

    describe('if another feature is already selected, and CTRL is held', () => {
      let interaction;
      let featuresChangedListener;
      let event;

      before(async () => {
        interaction = new SelectMultiFeatureInteraction(layer);
        await interaction.setSelected([featureA]);
        featuresChangedListener = getVcsEventSpy(interaction.featuresChanged);
        event = { feature: featureB, key: ModificationKeyType.CTRL };
        await interaction.pipe(event);
      });

      after(() => {
        interaction.destroy();
      });

      it('should set the currently selected features', () => {
        expect(interaction.selected).to.have.members([featureA, featureB]);
      });

      it('should raise the featuresChanged event with the selected features', () => {
        expect(featuresChangedListener).to.have.been.calledWith([featureA, featureB]);
      });

      it('should set stop propagation on the event to true', () => {
        expect(event.stopPropagation).to.be.true;
      });
    });

    describe('if the feature does not belong to the layer', () => {
      let interaction;
      let featuresChangedListener;
      let event;

      before(async () => {
        interaction = new SelectMultiFeatureInteraction(layer);
        featuresChangedListener = getVcsEventSpy(interaction.featuresChanged);
        event = { feature: new Feature() };
        await interaction.pipe(event);
      });

      after(() => {
        interaction.destroy();
      });

      it('should not set the selection set', () => {
        expect(interaction.selected).to.be.empty;
      });

      it('should not raise the featuresChanged event', () => {
        expect(featuresChangedListener).to.not.have.been.called;
      });

      it('should not set stop propagation on the event', () => {
        expect(event.stopPropagation).to.not.exist;
      });
    });

    describe('if the feature does not belong to the layer and there is a selected feature', () => {
      let interaction;
      let featuresChangedListener;
      let event;

      before(async () => {
        interaction = new SelectMultiFeatureInteraction(layer);
        await interaction.setSelected([featureA]);
        featuresChangedListener = getVcsEventSpy(interaction.featuresChanged);
        event = { feature: new Feature() };
        await interaction.pipe(event);
      });

      after(() => {
        interaction.destroy();
      });

      it('should not set the selection set', () => {
        expect(interaction.selected).to.be.be.empty;
      });

      it('should raise the featuresChanged event null', () => {
        expect(featuresChangedListener).to.have.been.calledWith([]);
      });

      it('should not set stop propagation on the event', () => {
        expect(event.stopPropagation).to.not.exist;
      });
    });

    describe('if there is no feature and there is a selected feature', () => {
      let interaction;
      let featuresChangedListener;
      let event;

      before(async () => {
        interaction = new SelectMultiFeatureInteraction(layer);
        await interaction.setSelected([featureA]);
        featuresChangedListener = getVcsEventSpy(interaction.featuresChanged);
        event = { feature: null };
        await interaction.pipe(event);
      });

      after(() => {
        interaction.destroy();
      });

      it('should not set the selection set', () => {
        expect(interaction.selected).to.be.empty;
      });

      it('should raise the featuresChanged event with null', () => {
        expect(featuresChangedListener).to.have.been.calledWith([]);
      });

      it('should not set stop propagation on the event', () => {
        expect(event.stopPropagation).to.not.exist;
      });
    });
  });

  describe('selecting a feature store feature', () => {
    let interaction;
    let featuresChangedListener;
    let olFeature;

    before(async () => {
      olFeature = new Feature();
      layer.switchStaticFeatureToDynamic = sinon.stub().resolves(olFeature);
      interaction = new SelectMultiFeatureInteraction(layer);
      const tiledFeature = new Feature();
      tiledFeature[isTiledFeature] = true;
      featuresChangedListener = getVcsEventSpy(interaction.featuresChanged);
      await interaction.setSelected([tiledFeature]);
    });

    after(() => {
      delete layer.switchStaticFeatureToDynamic;
      interaction.destroy();
    });

    it('should add the dynamic feature to the selected features', () => {
      expect(interaction.selected).to.have.members([olFeature]);
    });

    it('should raise the featuresChanged event with the dynamic feature', () => {
      expect(featuresChangedListener).to.have.been.calledWith([olFeature]);
    });
  });
});
