import { ChangeDetectionStrategy, Component, OnInit, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { Store } from '@ngxs/store';
import { debounceTime, filter, skip } from 'rxjs';

import { CoreModule } from '~/core';
import { PatchStage } from '~/state/clients/plans/stages.state';
import { ConstantWithdrawalScheme } from '~/state/clients/plans/stages.state.model';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-stages-constant-scheme',
  standalone: true,
  imports: [
    MatExpansionModule,
    MatListModule,
    MatSelectModule,

    CoreModule,
  ],
  templateUrl: './constant-scheme.component.html',
  styleUrl: './constant-scheme.component.scss'
})
export class ConstantSchemeComponent implements OnInit {
  scheme = input.required<ConstantWithdrawalScheme>();
  stageId = input.required<string>();

  form = new FormGroup(
    {
      type: new FormControl<'cost' | 'percentage'>('cost', { nonNullable: true }),
      amount: new FormControl(0, { nonNullable: true })
    },
    {
      validators: control => {
        const group = control as FormGroup;
        const amountControl = group.controls['amount'];
        const typeControl = group.controls['type'];

        const requiredError = Validators.required(amountControl);
        if (requiredError !== null) {
          amountControl.setErrors(requiredError);
          return requiredError;
        }

        if (amountControl.value < 0 ) {
          const errors = { value: 'Cannot set a negative amount' };
          amountControl.setErrors(errors);
          return errors;
        }

        if (typeControl.value === 'percentage' && amountControl.value > 100 ) {
          const errors = { value: 'Cannot set a percentage greater than 100' };
          amountControl.setErrors(errors);
          return errors;
        }

        amountControl.setErrors(null);
        return null;
      }
    }
  );

  constructor(store: Store) {
    this.form.valueChanges
      .pipe(
        skip(1), // skip the value set in ngOnInit
        debounceTime(250),
        filter(() => this.form.valid),
        takeUntilDestroyed()
      )
      .subscribe(({ type, amount }) => {
        const scheme = {
          type: 'constant',
          initialRate: type === 'cost' ? amount : undefined,
          targetPercentage: type === 'percentage' ? amount : undefined
        } as const;
        store.dispatch(new PatchStage(this.stageId(), { withdrawal: scheme }));
      });
  }

  ngOnInit() {
    const scheme = this.scheme();
    this.form.setValue({
      type: scheme.initialRate === undefined ? 'percentage' : 'cost',
      amount: scheme.initialRate ?? scheme.targetPercentage ?? 0
    });
  }

  toggleType() {
    this.form.controls.type.setValue(this.form.controls.type.value === 'cost' ? 'percentage' : 'cost');
    this.form.updateValueAndValidity();
  }
}
