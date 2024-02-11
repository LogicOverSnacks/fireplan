import { Component, OnInit, computed, input, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatSliderModule } from '@angular/material/slider';
import { Store } from '@ngxs/store';
import { debounceTime, filter, map, skip } from 'rxjs';

import { CoreModule } from '~/core/core.module';
import { PatchStage } from '~/state/clients/plans/stages.state';
import { DynamicWithdrawalScheme } from '~/state/clients/plans/stages.state.model';

@Component({
  selector: 'app-stages-dynamic-scheme',
  standalone: true,
  imports: [
    MatExpansionModule,
    MatListModule,
    MatSliderModule,

    CoreModule,
  ],
  templateUrl: './dynamic-scheme.component.html',
  styleUrl: './dynamic-scheme.component.scss'
})
export class DynamicSchemeComponent implements OnInit {
  scheme = input.required<DynamicWithdrawalScheme>();
  stageId = input.required<string>();

  isPercentView = signal(false);
  form = new FormGroup({
    adjustment: new FormControl(5, Validators.min(0)),
    target: new FormControl(4, { nonNullable: true, validators: [Validators.min(0.001), Validators.max(100), Validators.required] }),
    threshold: new FormControl(20, Validators.min(0))
  });
  adjustment = toSignal(this.form.controls.adjustment.valueChanges, { initialValue: this.form.controls.adjustment.value });
  target = toSignal(this.form.controls.target.valueChanges, { initialValue: this.form.controls.target.value });
  threshold = toSignal(this.form.controls.threshold.valueChanges, { initialValue: this.form.controls.threshold.value });

  exampleFundData = [1.2, 1.1, 0.9, 1.1, 1.05, 0.85, 0.8, 1.2, 1.14, 0.9, 1.05]; // TODO: replace with graph data

  // svg paths for cost display
  costPaths = computed(() => {
    const adjustment = (this.adjustment() ?? Infinity) / 100;
    const target = this.target() / 100;
    const threshold = (this.threshold() ?? Infinity) / 100;

    const lowerThreshold = target / (1 + threshold);
    const upperThreshold = target * (1 + threshold);

    let fundValue = 1;
    let correctedFundValue = fundValue;
    const initialRate = fundValue * target;
    let rate = initialRate;
    let correctedRate = initialRate;

    const results = [{
      target: fundValue * target,
      lowerThreshold: fundValue * lowerThreshold,
      upperThreshold: fundValue * Math.min(1, upperThreshold),
      rate: rate,
      correctedRate: correctedRate
    }];
    for (const data of this.exampleFundData) {
      if (fundValue <= rate) {
        rate = fundValue;
      }

      if (correctedFundValue <= correctedRate) {
        correctedRate = correctedFundValue;
      } else if (correctedRate < correctedFundValue * lowerThreshold) {
        correctedRate = Math.min(correctedFundValue * target, correctedRate * (1 + adjustment));
      } else if (correctedRate > correctedFundValue * upperThreshold) {
        correctedRate = Math.max(correctedFundValue * target, correctedRate / (1 + adjustment));
      }

      results.push({
        target: correctedFundValue * target,
        lowerThreshold: correctedFundValue * lowerThreshold,
        upperThreshold: correctedFundValue * Math.min(1, upperThreshold),
        rate: rate,
        correctedRate: correctedRate
      });

      fundValue = Math.max(0, (fundValue - rate) * data);
      correctedFundValue = Math.max(0, (correctedFundValue - correctedRate) * data);
    }

    const allValues = results.flatMap(result => [result.target, result.correctedRate]);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const scale = Math.max(max - initialRate, initialRate - min) * 2;
    const scaled = (value: number) => 0.5 + (value - initialRate) / scale;

    const targets = results.map(result => scaled(result.target)).map(this.toPath);
    const rates = results.map(result => scaled(result.rate)).map(this.toPath);
    const correctedRates = results.map(result => scaled(result.correctedRate)).map(this.toPath);
    const thresholds = [
      ...results.map(result => scaled(result.lowerThreshold)).map(this.toPath),
      ...results
        .map(result => scaled(result.upperThreshold))
        .map((value, index) => this.toPath(value, index).replace('M', 'L'))
        .reverse(),
      'Z'
    ];

    return {
      target: targets.join(' '),
      rate: rates.join(' '),
      correctedRate: correctedRates.join(' '),
      threshold: thresholds.join(' ')
    };
  });

  // svg paths for percentage display
  percentagePaths = computed(() => {
    const adjustment = (this.adjustment() ?? Infinity) / 100;
    const target = this.target() / 100;
    const threshold = (this.threshold() ?? Infinity) / 100;

    const lowerThreshold = target / (1 + threshold);
    const upperThreshold = target * (1 + threshold);

    let fundValue = 1;
    let correctedFundValue = fundValue;
    const initialRate = fundValue * target;
    let rate = initialRate;
    let correctedRate = initialRate;

    const results = [{
      rate: rate,
      correctedRate: correctedRate
    }];
    for (const data of this.exampleFundData) {
      if (fundValue <= rate) {
        rate = fundValue;
      }

      if (correctedFundValue <= correctedRate) {
        correctedRate = correctedFundValue;
      } else if (correctedRate < correctedFundValue * lowerThreshold) {
        correctedRate = Math.min(correctedFundValue * target, correctedRate * (1 + adjustment));
      } else if (correctedRate > correctedFundValue * upperThreshold) {
        correctedRate = Math.max(correctedFundValue * target, correctedRate / (1 + adjustment));
      }

      results.push({
        rate: fundValue > 0 ? rate / fundValue : 0,
        correctedRate: correctedFundValue > 0 ? correctedRate / correctedFundValue : 0
      });

      fundValue = Math.max(0, (fundValue - rate) * data);
      correctedFundValue = Math.max(0, (correctedFundValue - correctedRate) * data);
    }

    const allValues = results.flatMap(result => [result.rate, result.correctedRate]);
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const scale = Math.max(max - initialRate, initialRate - min) * 2;
    const scaled = (value: number) => 0.5 + (value - initialRate) / scale;

    const rates = results.map(result => scaled(result.rate)).map(this.toPath);
    const correctedRates = results.map(result => scaled(result.correctedRate)).map(this.toPath);
    const thresholds = [
      `M 0 ${(1 - scaled(Math.min(1, lowerThreshold))) * 100}`,
      `H 200`,
      `V ${(1 - scaled(Math.min(1, upperThreshold))) * 100}`,
      `H 0`,
      'Z'
    ];

    return {
      rate: rates.join(' '),
      correctedRate: correctedRates.join(' '),
      threshold: thresholds.join(' ')
    };
  });

  targetSliderValue = computed(() => {
    const percentage = this.target();
    return percentage > 100 ? 1
      : percentage > 25 ? 0.9 + (percentage - 25) * 0.1 / (100 - 25)
      : percentage > 0.5 ? 0.1 + (Math.log10(percentage) - Math.log10(0.5)) * 0.8 / (Math.log10(25) - Math.log10(0.5))
      : percentage > 0 ? percentage / 0.5 * 0.1 - 0.1
      : 0.1
  });
  thresholdSliderValue = computed(() => {
    const percentage = this.threshold();
    return percentage === null || percentage > 100 ? 1
      : percentage > 50 ? 0.9 + (percentage - 50) * 0.1 / (100 - 50)
      : percentage > 2 ? 0.1 + (Math.log10(percentage) - Math.log10(2)) * 0.8 / (Math.log10(50) - Math.log10(2))
      : percentage > 0 ? percentage / 2 * 0.1
      : 0
  });
  adjustmentSliderValue = computed(() => {
    const percentage = this.adjustment();
    return percentage === null || percentage > 100 ? 1
      : percentage > 50 ? 0.9 + (percentage - 50) * 0.1 / (100 - 50)
      : percentage > 2 ? 0.1 + (Math.log10(percentage) - Math.log10(2)) * 0.8 / (Math.log10(50) - Math.log10(2))
      : percentage > 0 ? percentage / 2 * 0.1
      : 0
  });

  constructor(store: Store) {
    this.form.valueChanges
      .pipe(
        skip(1), // skip the value set in ngOnInit
        debounceTime(250),
        filter(() => this.form.valid),
        map(() => this.form.getRawValue()),
        takeUntilDestroyed()
      )
      .subscribe(({ adjustment, target, threshold }) => {
        const scheme = {
          type: 'dynamic',
          adjustmentPercentage: adjustment ?? Infinity,
          targetPercentage: target,
          thresholdPercentage: threshold ?? Infinity
        } as const;
        store.dispatch(new PatchStage(this.stageId(), { withdrawal: scheme }));
      });
  }

  ngOnInit() {
    const scheme = this.scheme();
    this.form.setValue({
      adjustment: scheme.adjustmentPercentage === Infinity ? null : scheme.adjustmentPercentage,
      target: scheme.targetPercentage,
      threshold: scheme.thresholdPercentage === Infinity ? null : scheme.thresholdPercentage
    });
  }

  targetSliderChanged(ev: Event) {
    const value: number = (ev.target as any).valueAsNumber;
    const percentage = value > 0.9 ? this.round(25 + (value - 0.9) / 0.1 * (100 - 25))
      : value > 0.1 ? this.round(Math.pow(10, Math.log10(0.5) + (value - 0.1) / 0.8 * (Math.log10(25) - Math.log10(0.5))))
      : value > 0 ? this.round(0.1 + value / 0.1 * 0.5)
      : 0.1;

    this.form.controls.target.setValue(percentage);
  }

  thresholdSliderChanged(ev: Event) {
    const value: number = (ev.target as any).valueAsNumber;
    const percentage = value >= 1 ? null
      : value > 0.9 ? this.round(50 + (value - 0.9) / 0.1 * (100 - 50))
      : value > 0.1 ? this.round(Math.pow(10, Math.log10(2) + (value - 0.1) / 0.8 * (Math.log10(50) - Math.log10(2))))
      : value > 0 ? this.round(value / 0.1 * 2)
      : 0;

    this.form.controls.threshold.setValue(percentage);
  }

  adjustmentSliderChanged(ev: Event) {
    const value: number = (ev.target as any).valueAsNumber;
    const percentage = value >= 1 ? null
      : value > 0.9 ? this.round(50 + (value - 0.9) / 0.1 * (100 - 50))
      : value > 0.1 ? this.round(Math.pow(10, Math.log10(2) + (value - 0.1) / 0.8 * (Math.log10(50) - Math.log10(2))))
      : value > 0 ? this.round(value / 0.1 * 2)
      : 0;

    this.form.controls.adjustment.setValue(percentage);
  }

  /** Round to 2 d.p. */
  private round = (value: number) => Math.round((value + Number.EPSILON) * 10) / 10;

  /**
   * @param value should be in the range [0, 1]
   * @param index
   * @returns SVG path segment
   */
  private toPath = (value: number, index: number) => {
    const width = 200 / this.exampleFundData.length;
    return `${index > 0 ? 'L' : 'M'} ${index * width} ${(1 - value) * 100}`;
  }
}
