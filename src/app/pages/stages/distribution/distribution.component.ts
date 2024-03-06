import { Component, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { Store } from '@ngxs/store';
import { debounceTime, filter, map, skip } from 'rxjs';

import { CoreModule } from '~/core';
import { PatchStage, StagesState } from '~/state/clients/plans/stages.state';
import { Portfolio, WithdrawalScheme } from '~/state/clients/plans/stages.state.model';

@Component({
  selector: 'app-stages-distribution',
  standalone: true,
  styleUrl: './distribution.component.scss',
  templateUrl: './distribution.component.html',
  imports: [
    MatCheckboxModule,
    MatExpansionModule,
    MatListModule,
    MatSelectModule,

    CoreModule,
  ]
})
export class DistributionComponent {
  distribution = input.required<Portfolio | undefined>();
  frequency = input.required<number | undefined>();
  stageId = input.required<string>();
  enabledControl = new FormControl(true, { nonNullable: true });
  form = new FormGroup(
    {
      cash: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
      bonds: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
      stocks: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
      crypto: new FormControl(0, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
    },
    {
      validators: control => {
        const group = control as FormGroup;
        const cashControl = group.controls['cash'];
        const bondsControl = group.controls['bonds'];
        const stocksControl = group.controls['stocks'];
        const cryptoControl = group.controls['crypto'];

        if (cashControl.value + bondsControl.value + stocksControl.value + cryptoControl.value !== 1) {
          return { sum: 'Must sum to 1' };
        }

        return null;
      }
    }
  );

  constructor(private store: Store) {
    this.enabledControl.valueChanges
      .pipe(
        skip(1), // skip the value set in ngOnInit
        takeUntilDestroyed()
      )
      .subscribe(enabled => {
        store.dispatch(new PatchStage(
          this.stageId(),
          {
            portfolioRedistributionFrequency: enabled ? 1 : Infinity
          }
        ));
      });

    this.form.valueChanges
      .pipe(
        skip(1), // skip the value set in ngOnInit
        debounceTime(250),
        filter(() => this.form.valid),
        map(() => this.form.getRawValue()),
        takeUntilDestroyed()
      )
      .subscribe(portfolioDistribution => {
        store.dispatch(new PatchStage(this.stageId(), { portfolioDistribution }));
      });
  }

  ngOnInit() {
    const stage = this.store.selectSnapshot(StagesState.unrolledStage(this.stageId()));
    if (!stage) throw new Error(`Cannot find stage '${this.stageId()}'`);

    this.enabledControl.setValue(stage.portfolioRedistributionFrequency < Infinity);
    this.form.setValue(stage.portfolioDistribution);
  }
}
