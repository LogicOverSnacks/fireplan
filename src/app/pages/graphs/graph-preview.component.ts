import { Component, ElementRef, OnInit, viewChild, input, signal, computed } from '@angular/core';
import { MatSelectModule } from '@angular/material/select';
import moment, { Moment } from 'moment';

import { CoreModule } from '~/core';
import { Graph } from '~/state/graphs.state';
import { AppGraphDisplayPipe } from './graph-display.pipe';

@Component({
  selector: 'app-graph-preview',
  standalone: true,
  imports: [
    MatSelectModule,

    CoreModule,
    AppGraphDisplayPipe
  ],
  styles: [`
    @use 'sass:map';
    @use '@angular/material' as mat;
    @use 'theme' as theme;

    $left-margin: 60px;
    $right-margin: 74px;

    :host {
      display: flex;
      flex-direction: column;
      width: fit-content;
    }

    .svg-container {
      position: relative;
      display: flex;
      width: fit-content;

      .y-labels {
        width: $left-margin;
        min-width: $left-margin;
        position: relative;

        .y-label {
          position: absolute;
          right: 8px;

          &::before {
            content: '';
            position: absolute;
            right: -8px;
            top: 50%; // calc(50% - 1px);
            width: 6px;
            border-top: 1px solid black;
          }
        }
      }

      svg {
        height: 200px;
        z-index: 1;
        overflow: visible;

        .hover-point {
          stroke: white;
          stroke-width: 0.5;
          font-size: 6px;
        }

        .x-axis, .y-axis {
          stroke-width: 1;
          stroke: black;
        }
      }

      .view-btn {
        width: 64px;
        margin: auto 0 auto $right-margin - 64px;
      }
    }

    .x-labels {
      margin-left: $left-margin;
      margin-right: $right-margin;
      margin-top: 5px;
      height: 20px;
      position: relative;

      .x-label {
        position: absolute;
        top: 0;
        width: 40px;
        text-align: center;

        &.hover-label {
          color: lightsteelblue;
          background: mat.get-color-from-palette(map.get(map.get(theme.$app-theme, color), background), card);
        }

        &::before {
          content: '';
          position: absolute;
          left: 50%;
          top: -5px;
          height: 5px;
          border-left: 1px solid black;
        }
      }
    }
  `],
  template: `
    <div class="svg-container">
      <div class="y-labels">
        @for (label of yLabels(); track label) {
          <span class="y-label" [style.bottom]="'calc(' + (100 - label.y) + '% - 10px)'">
            @if (cumulative()) {
              {{label.value | appCurrency}}
            } @else {
              {{label.value | number:'1.0-1'}}%
            }
          </span>
        }
      </div>
      <svg viewBox="0 0 300 100" #svg (mousemove)="mouseMoved($event)" (mouseleave)="hoverPoint.set(null)">
        <path [attr.d]="path()" stroke-width="0.5" stroke="lightsteelblue" fill="none"></path>

        <line class="x-axis" x1="0" [attr.y1]="xAxis()" x2="300" [attr.y2]="xAxis()"></line>
        <line class="y-axis" x1="0" y1="0" x2="0" y2="100"></line>

        @if (hoverPoint(); as point) {
          <circle [attr.cx]="point.x" [attr.cy]="point.y" r="1.5" fill="lightsteelblue" />
          <text class="hover-point" [attr.x]="point.x + 6" [attr.y]="point.y + 2">
            @if (cumulative()) {
              {{point.value | appCurrency}}
            } @else {
              {{point.value | number:'1.0-1'}}%
            }
          </text>
        }
      </svg>

      <button type="button"
        mat-button
        class="view-btn"
        (click)="cumulative.set(!cumulative())"
        [matTooltip]="cumulative() ? 'Display annual gains' : 'Display prices'"
      >
        {{cumulative() ? '£' : '%'}}
      </button>
    </div>
    <div class="x-labels">
      @for (label of xLabels(); track label) {
        <span class="x-label" [style.left]="'calc(' + 100 * label.x / 300 + '% - 20px)'">{{label.date.year()}}</span>
      }
      @if (hoverPoint(); as point) {
        <span class="x-label hover-label" [style.left]="'calc(' + 100 * point.x / 300 + '% - 20px)'">
          {{point.date.year()}}
        </span>
      }
    </div>
  `
})
export class GraphPreviewComponent {
  graph = input.required<Graph>();

  svg = viewChild.required<ElementRef<SVGElement>>('svg');

  cumulative = signal(false);
  hoverPoint = signal<{ x: number; y: number; date: Moment; value: number; } | null>(null);

  points = computed(() => {
    const graph = this.graph();

    if (this.cumulative()) {
      const prices = graph.data.reduce((prev, { value }) => [...prev, prev[prev.length - 1] * value], [1]);
      const xStep = 300 / (prices.length - 1);
      const maxY = Math.max(...prices);
      const yStep = maxY === 1 ? 50 : 100 / maxY;

      return graph.data.map(({ date }, index) => ({
        date: moment(date),
        value: prices[index + 1],
        x: index * xStep,
        y: 100 - prices[index + 1] * yStep
      }));
    }

    let year = moment(graph.data[0].date).year();
    let growth = 1;
    const years: [number, number][] = [];
    for (const { date, value } of graph.data) {
      const currentYear = moment(date).year();
      if (currentYear === year) {
        growth = growth * value;
      } else {
        years.push([year, 100 * (growth - 1)]);
        growth = value;
        year = currentYear;
      }
    }
    years.push([year, growth]);

    const xStep = 300 / (years.length - 1);
    const percentages = years.map(([, value]) => value);
    let minY = Math.min(...percentages);
    const maxY = Math.max(...percentages);

    if (minY > 0) {
      minY = 0;
    }

    const yStep = minY === maxY ? 50 : 100 / (maxY - minY);

    return years.map(([year, percentage], index) => ({
      date: moment(`${year}-01-01`),
      value: percentage,
      x: index * xStep,
      y: 100 - yStep * (percentage - minY)
    }));
  });
  path = computed(() => this.points().map(({ x, y }) => `${x === 0 ? 'M' : 'L'} ${x} ${y}`).join(' '));
  xLabels = computed(() => {
    const points = this.points();
    return [points[0], points[points.length - 1]];
  });
  yLabels = computed(() => {
    const points = [...this.points()].sort((a, b) => a.value - b.value);
    const min = points[0].value > 0 ? { value: 0, y: 100 } : points[0];
    const max = points[points.length - 1];

    const zeroY = this.xAxis();
    if (zeroY === 100)
      return points[0].value === max.value ? [max] : [min, max];

    return [min, { value: 0, y: zeroY }, max];
  });
  xAxis = computed(() => {
    if (this.cumulative()) return 100;

    const percentages = this.points().map(({ value }) => value);
    const min = Math.min(...percentages);

    return min < 0 ? 100 - 100 * (0 - min) / (Math.max(...percentages) - min) : 100;
  });

  mouseMoved(event: MouseEvent) {
    const pt = new DOMPointReadOnly(event.clientX, event.clientY).matrixTransform(
      (this.svg().nativeElement as any).getScreenCTM().inverse()
    );

    const points = this.points();
    const index = Math.round((points.length - 1) * pt.x / 300);
    this.hoverPoint.set(points[index]);
  }
}
