import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, EventEmitter, HostListener, Output, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { fromEvent, takeUntil, throttleTime } from 'rxjs';

import { CoreModule } from '~/core';

@Component({
  selector: 'app-stages-year-bar',
  standalone: true,
  imports: [
    MatExpansionModule,
    MatListModule,

    CoreModule
  ],
  styles: [`
    :host {
      display: flex;
      align-items: center;
      padding: 25px 0;
      gap: 10px;
      cursor: n-resize;
    }

    .year {
      width: 64px;
    }

    .divider {
      flex: 1 0 auto;
      margin: auto 0;
    }

    .add {
      button {
        mat-icon {
          margin-right: 0;
        }
      }
    }
  `],
  template: `
    <span class="year">{{year()}}</span>
    <span class="divider">
      <mat-divider></mat-divider>
    </span>
    <span class="add">
      <button type="button"
        mat-button
        [disabled]="disableAdd()"
        (click)="addClicked.emit()"
        matTooltip="Add new..."
      ><mat-icon>add</mat-icon></button>
    </span>
  `,
})
export class StagesYearBarComponent {
  year = input.required<number>();
  disableAdd = input(false);

  @Output()
  yearUpdated = new EventEmitter<number>();

  @Output()
  addClicked = new EventEmitter<void>();

  @HostListener('mousedown', ['$event'])
  dragStarted(event: MouseEvent) {
    event.preventDefault();
    const currentYear = this.year();
    const startY = event.y;

    fromEvent<MouseEvent>(this.document, 'mousemove')
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        takeUntil(fromEvent(this.document, 'mouseup')),
        throttleTime(20, undefined, { leading: false, trailing: true })
      )
      .subscribe(({ y }) => {
        const change = Math.floor((y - startY) / 10);
        this.yearUpdated.emit(currentYear + change);
      });
  }

  private destroyRef = inject(DestroyRef);
  private document = inject(DOCUMENT);
}
