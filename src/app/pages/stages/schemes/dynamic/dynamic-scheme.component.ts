import { Component, OnInit, computed, input } from '@angular/core';
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

  form = new FormGroup({
    adjustment: new FormControl(5, Validators.min(0)),
    target: new FormControl(4, { nonNullable: true, validators: [Validators.max(100), Validators.min(0)] }),
    threshold: new FormControl(20, Validators.min(0))
  });
  adjustment = toSignal(this.form.controls.adjustment.valueChanges, { initialValue: this.form.controls.adjustment.value });
  target = toSignal(this.form.controls.target.valueChanges, { initialValue: this.form.controls.target.value });
  threshold = toSignal(this.form.controls.threshold.valueChanges, { initialValue: this.form.controls.threshold.value });

  rateData = [1, 1.05, 1.1, 0.9, 1.05, 1.4, 1.6, 1.15, 0.6, 0.5, 0.85, 1.1, 0.97];
  rawRatePath = computed(() => ``);
  ratePath = computed(() => {
    const target = (1 - this.targetSliderValue()) * 100;

    const slope = 50 / 200;

    const threshold = this.threshold();
    if (threshold === null) {
      const end = target > 50 ? target - slope*200 : target + slope*200;
      return `M 0 ${target} L 200 ${end}`;
    }

    const segments = [`M 0 ${target}`];
    const adjustment = this.adjustment();
    const lowerThreshold = Math.min(100, (1 - this.targetSliderValue() * (1 - threshold / 100)) * 100);
    const upperThreshold = Math.max(0, (1 - this.targetSliderValue() * (1 + threshold / 100)) * 100);

    const first = target > 50 ? target - slope*50 : target + slope*50;
    segments.push(`L 50 ${first}`);
    const afterFirst =
      first < upperThreshold ? adjustment === null
        ? target
        : Math.min(target, first * (1 + adjustment / 100))
      : first > lowerThreshold ? adjustment === null
        ? target
        : Math.max(target, first * (1 - adjustment / 100))
      : first;
    segments.push(`V ${afterFirst}`);

    const second = target > 50 ? afterFirst - slope*100 : afterFirst + slope*100;
    segments.push(`L 150 ${second}`);
    const afterSecond =
      second < upperThreshold ? adjustment === null
        ? target
        : Math.min(target, second * (1 + adjustment / 100))
      : second > lowerThreshold ? adjustment === null
        ? target
        : Math.max(target, second * (1 - adjustment / 100))
      : second;
    segments.push(`V ${afterSecond}`);

    const end = target > 50 ? afterSecond - slope*50 : afterSecond + slope*50;
    segments.push(`L 200 ${end}`);

    return segments.join(' ');
  });
  targetPath = computed(() => `M 0 ${(1 - this.targetSliderValue()) * 100} H 200`);
  thresholdRect = computed(() => {
    const threshold = this.threshold();
    if (threshold === null) {
      return {
        y: 0,
        height: 100
      };
    }

    return {
      y: Math.max(0, (1 - this.targetSliderValue() * (1 + threshold / 100)) * 100),
      height: Math.min(
        100,
        (1 - this.targetSliderValue() * (1 - threshold / 100)) * 100
          - (1 - this.targetSliderValue() * (1 + threshold / 100)) * 100
      )
    }
  });

  targetSliderValue = computed(() => {
    const percentage = this.target();
    return percentage > 100 ? 1
      : percentage > 50 ? 0.9 + (percentage - 50) * 0.1 / (100 - 50)
      : percentage > 0.5 ? 0.1 + (Math.log10(percentage) - Math.log10(0.5)) * 0.8 / (Math.log10(50) - Math.log10(0.5))
      : percentage > 0 ? percentage / 0.5 * 0.1
      : 0
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
    const percentage = value > 0.9 ? this.round(50 + (value - 0.9) / 0.1 * (100 - 50))
      : value > 0.1 ? this.round(Math.pow(10, Math.log10(0.5) + (value - 0.1) / 0.8 * (Math.log10(50) - Math.log10(0.5))))
      : value > 0 ? this.round(value / 0.1 * 0.5)
      : 0;

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
}
