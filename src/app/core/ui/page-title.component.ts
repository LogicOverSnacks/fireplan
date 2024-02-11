import { Component, EventEmitter, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-page-title',
  standalone: true,
  imports: [
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <h2 class="mat-headline-4">
      <ng-content></ng-content>
      <button mat-icon-button (click)="add.emit()" matTooltip="Add new..."><mat-icon>add</mat-icon></button>
    </h2>
  `,
  styles: `
    h2 {
      display: flex;
      align-items: center;
      margin: 0 0 20px 0 !important;

      button {
        margin-left: 10px;
      }
    }
  `
})
export class PageTitleComponent {
  @Output()
  add = new EventEmitter<void>();
}
