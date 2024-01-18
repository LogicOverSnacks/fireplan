import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';

import { CoreModule } from '~/core/core.module';
import { Person } from '~/state/clients/people.state.model';

@Component({
  imports: [
    MatDatepickerModule,
    MatDialogModule,
    MatDividerModule,
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
    <div mat-dialog-title>Add Person</div>
    <form [formGroup]="form">
      <mat-dialog-content>
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
        <mat-divider></mat-divider>
        <h4>Life Expectancy</h4>
        <!-- TODO: draw a mini normal distribution with sliders to change the values -->
        <div class="row">
          <mat-form-field subscriptSizing="dynamic">
            <mat-label>Mean</mat-label>
            <input type="number" matInput formControlName="lifeExpectancyMean">
          </mat-form-field>
          <mat-form-field subscriptSizing="dynamic">
            <mat-label>Variance</mat-label>
            <input type="number" matInput formControlName="lifeExpectancyVariance">
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions>
        <button mat-button [mat-dialog-close]="undefined">Cancel</button>
        <button mat-flat-button type="submit"
          color="primary"
          [mat-dialog-close]="createPerson()"
          [disabled]="form.invalid"
        >Save</button>
      </mat-dialog-actions>
    </form>
  `
})
export class PersonDialogComponent {
  form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: Validators.required }),
    dateOfBirth: new FormControl<Date | null>(null, Validators.required),
    lifeExpectancyMean: new FormControl(81, { nonNullable: true, validators: Validators.required }),
    lifeExpectancyVariance: new FormControl(8, { nonNullable: true, validators: Validators.required })
  });

  createPerson = () => ({
    id: crypto.randomUUID(),
    name: this.form.controls.name.value!,
    dateOfBirth: this.form.controls.dateOfBirth.value!,
    lifeExpectancy: {
      mean: this.form.controls.lifeExpectancyMean.value,
      variance: this.form.controls.lifeExpectancyVariance.value
    }
  } satisfies Person);
}
