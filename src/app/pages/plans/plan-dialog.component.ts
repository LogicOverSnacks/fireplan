import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSelectModule } from '@angular/material/select';
import { Store } from '@ngxs/store';
import { map } from 'rxjs';

import { CoreModule } from '~/core/core.module';
import { PlansState } from '~/state/clients/plans.state';
import { Plan } from '~/state/clients/plans.state.model';

export type PlanDialogData = {
  id: string;
  inheritsFrom: string | null;
  name: string;
}

@Component({
  imports: [
    MatDatepickerModule,
    MatDialogModule,
    MatExpansionModule,
    MatSelectModule,

    CoreModule
  ],
  standalone: true,
  styles: [`
    mat-dialog-content {
      display: flex;
      gap: 20px;
      flex-direction: column;
      max-width: (180px + 16px*2)*2 + 20px + 24px*2;
    }

    .row {
      display: flex;
      gap: 20px;
    }
  `],
  template: `
    <div mat-dialog-title>{{data?.id ? 'Edit' : 'Add'}} Plan</div>
    <form [formGroup]="form">
      <mat-dialog-content>
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>Extends</mat-label>
          <mat-select formControlName="inheritsFrom">
            <mat-option [value]="null">None</mat-option>
            @for (plan of plans | async | keyvalue; track plan.key) {
              <mat-option [value]="plan.key">{{plan.value.name}}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>Name</mat-label>
          <input type="text" required matInput formControlName="name" cdkFocusInitial>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions>
        <button mat-button [mat-dialog-close]="undefined">Cancel</button>
        <button mat-flat-button type="submit"
          color="primary"
          (click)="close()"
          [disabled]="form.invalid"
        >Save</button>
      </mat-dialog-actions>
    </form>
  `
})
export class PlanDialogComponent {
  data?: PlanDialogData = inject(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<PlanDialogComponent>);
  private store = inject(Store);

  plans = this.store.select(PlansState.plans).pipe(
    map(plans => Object.fromEntries(Object.entries(plans).filter(([id]) =>
      !this.data?.id || !this.getPlanAncestors(plans, id).includes(this.data.id)
    )))
  );

  form = new FormGroup({
    inheritsFrom: new FormControl<string | null>(this.data?.inheritsFrom ?? null),
    name: new FormControl(this.data?.name ?? null, Validators.required)
  });

  close = () => this.dialogRef.close({
    id: this.data?.id ?? crypto.randomUUID(),
    inheritsFrom: this.form.controls.inheritsFrom.value,
    name: this.form.controls.name.value!
  } satisfies PlanDialogData);

  private getPlanAncestors(plans: Record<string, Plan>, id: string): string[] {
    const ids: string[] = [];

    let currentId: string | null = id;
    while (currentId) {
      ids.push(currentId);
      const plan: Plan = plans[currentId];
      currentId = plan.inheritsFrom;
    }

    return ids;
  }
}
