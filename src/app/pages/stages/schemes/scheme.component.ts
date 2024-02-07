import { Component, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { Store } from '@ngxs/store';

import { CoreModule } from '~/core/core.module';
import { PatchStage } from '~/state/clients/plans/stages.state';
import { WithdrawalScheme } from '~/state/clients/plans/stages.state.model';
import { ConstantSchemeComponent } from './constant/constant-scheme.component';
import { DynamicSchemeComponent } from './dynamic/dynamic-scheme.component';
import { skip } from 'rxjs';

@Component({
  selector: 'app-stages-scheme',
  standalone: true,
  template: `
    <h6 class="mat-headline-6">
      Withdrawals
      <mat-icon inline matTooltip="How much money to withdraw each year">info</mat-icon>
    </h6>
    <mat-form-field subscriptSizing="dynamic">
      <mat-label>Type</mat-label>
      <mat-select [formControl]="typeControl">
        <mat-option value="constant">Constant</mat-option>
        <mat-option value="dynamic">Dynamic</mat-option>
      </mat-select>
    </mat-form-field>

    @if (scheme(); as s) {
      @switch (s.type) {
        @case ('constant') {
          <app-stages-constant-scheme [scheme]="s" [stageId]="stageId()"></app-stages-constant-scheme>
        }
        @case ('dynamic') {
          <app-stages-dynamic-scheme [scheme]="s" [stageId]="stageId()"></app-stages-dynamic-scheme>
        }
      }
    }
  `,
  styles: [`
    h6 {
      mat-icon {
        margin-left: 8px;
        vertical-align: bottom;
      }
    }

    app-stages-constant-scheme {
      display: block;
      margin-top: 20px;
    }
  `],
  imports: [
    MatExpansionModule,
    MatListModule,
    MatSelectModule,

    CoreModule,
    ConstantSchemeComponent,
    DynamicSchemeComponent
  ]
})
export class SchemeComponent {
  scheme = input.required<WithdrawalScheme>();
  stageId = input.required<string>();
  typeControl = new FormControl<WithdrawalScheme['type']>('constant', { nonNullable: true });

  constructor(store: Store) {
    this.typeControl.valueChanges
      .pipe(
        skip(1), // skip the value set in ngOnInit
        takeUntilDestroyed()
      )
      .subscribe(type => {
        const scheme = this.scheme();

        store.dispatch(new PatchStage(
          this.stageId(),
          {
            withdrawal: type === 'constant'
              ? {
                type: 'constant',
                initialRate: scheme.type === 'constant' ? scheme.initialRate : undefined,
                targetPercentage: scheme.type === 'dynamic' || scheme.initialRate === undefined ? scheme.targetPercentage : undefined
              }
              : {
                type: 'dynamic',
                targetPercentage: scheme.targetPercentage ?? 4,
                thresholdPercentage: 20,
                adjustmentPercentage: 5
              }
          }
        ));
      });
  }

  ngOnInit() {
    this.typeControl.setValue(this.scheme().type);
  }
}
