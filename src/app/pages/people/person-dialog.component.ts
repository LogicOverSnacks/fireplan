import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSelectModule } from '@angular/material/select';
import { Moment } from 'moment';

import { CoreModule } from '~/core/core.module';
import { Person } from '~/state/clients/people.state.model';

export type PersonDialogData = {
  id?: string;
  name?: string;
  dateOfBirth?: Moment;
  lifeExpectancyMean?: number;
  lifeExpectancyVariance?: number;
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
    <div mat-dialog-title>{{data?.id ? 'Edit' : 'Add'}} Person</div>
    <form [formGroup]="form">
      <mat-dialog-content>
        <div class="row">
          <mat-form-field subscriptSizing="dynamic">
            <mat-label>Name</mat-label>
            <input type="text" required matInput formControlName="name">
          </mat-form-field>
          <mat-form-field subscriptSizing="dynamic">
            <mat-label>Date of Birth</mat-label>
            <input matInput [matDatepicker]="picker" formControlName="dateOfBirth">
            <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
            <mat-datepicker #picker></mat-datepicker>
          </mat-form-field>
        </div>

        <mat-expansion-panel>
          <mat-expansion-panel-header>
            <mat-panel-title>Life Expectancy</mat-panel-title>
          </mat-expansion-panel-header>

          <div class="row">
            <!-- TODO: draw a mini normal distribution with sliders to change the values -->
            <mat-form-field subscriptSizing="dynamic">
              <mat-label>Mean</mat-label>
              <input type="number" matInput formControlName="lifeExpectancyMean">
            </mat-form-field>
            <mat-form-field subscriptSizing="dynamic">
              <mat-label>Variance</mat-label>
              <input type="number" matInput formControlName="lifeExpectancyVariance">
            </mat-form-field>
          </div>
        </mat-expansion-panel>
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
export class PersonDialogComponent {
  data?: PersonDialogData = inject(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<PersonDialogComponent>);

  form = new FormGroup({
    name: new FormControl(this.data?.name ?? null, Validators.required),
    dateOfBirth: new FormControl<Moment | null>(this.data?.dateOfBirth ?? null, Validators.required),
    lifeExpectancyMean: new FormControl(this.data?.lifeExpectancyMean ?? 81, { nonNullable: true, validators: Validators.required }),
    lifeExpectancyVariance: new FormControl(this.data?.lifeExpectancyVariance ?? 8, { nonNullable: true, validators: Validators.required })
  });

  close = () => this.dialogRef.close({
    id: this.data?.id ?? crypto.randomUUID(),
    name: this.form.controls.name.value!,
    dateOfBirth: this.form.controls.dateOfBirth.value!.toDate(),
    lifeExpectancy: {
      mean: this.form.controls.lifeExpectancyMean.value,
      variance: this.form.controls.lifeExpectancyVariance.value
    }
  } satisfies Person);
}
