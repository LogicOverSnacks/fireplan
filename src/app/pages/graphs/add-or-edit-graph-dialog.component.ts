import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { CoreModule } from '~/core';
import { Graph } from '~/state/graphs.state';

export type AddOrEditGraphDialogData = {
  name: string;
  graph: Graph;
};

@Component({
  imports: [
    MatDialogModule,

    CoreModule
  ],
  standalone: true,
  template: `
    <div mat-dialog-title>{{ data ? 'Edit' : 'Add' }} Graph</div>
    <form [formGroup]="form">
      <mat-dialog-content>
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>Name</mat-label>
          <input type="text" required matInput formControlName="name" spellcheck="false">
        </mat-form-field>

        <mat-form-field subscriptSizing="dynamic" floatLabel="always">
          <mat-label>Graph</mat-label>
          <button type="button" mat-button (click)="fileInput.click()">Choose...</button>
          <span class="file-name">{{selectedFileName()}}</span>
          <input hidden matInput>
          <input type="file" hidden (change)="fileSelected($event)" #fileInput>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions>
        <button type="button" mat-button [mat-dialog-close]="null">Cancel</button>
        <button type="submit" mat-flat-button
          color="primary"
          (click)="close()"
          [disabled]="form.invalid"
        >Save</button>
      </mat-dialog-actions>
    </form>
  `
})
export class AddOrEditGraphDialogComponent {
  data?: AddOrEditGraphDialogData = inject(MAT_DIALOG_DATA);
  dialogRef = inject(MatDialogRef<AddOrEditGraphDialogComponent>);

  selectedFileName = signal<string | null>(null);

  form = new FormGroup({
    name: new FormControl(this.data?.name ?? null, Validators.required),
    graph: new FormControl(this.data?.graph ?? null, Validators.required)
  });

  fileSelected = (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    file?.text().then(text => {
      this.form.controls.graph.setValue({ data: JSON.parse(text) });
      this.selectedFileName.set(file.name);
    });
  };

  close = () => this.dialogRef.close(this.form.value);
}
