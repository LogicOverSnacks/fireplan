import { Component, ElementRef, OnInit, viewChild, input, signal } from '@angular/core';
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
            top: calc(50% - 1px);
            width: 6px;
            border-top: 1px solid black;
          }
        }
      }

      svg {
        height: 200px;
        overflow: visible;

        .hover-point {
          stroke: white;
          stroke-width: 0.5;
          font-size: 6px;
        }
      }
    }

    .x-labels {
      margin-left: $left-margin;
      margin-top: 5px;
      height: 20px;
      position: relative;

      .x-label {
        position: absolute;
        top: 0;
        width: 35px;
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
        @for (y of yLabels(); track y) {
          <span class="y-label" [style.bottom]="'calc(' + y.y + '% - 10px)'">
            @if (cumulative()) {
              {{y.value | appCurrency}}
            } @else {
              {{y.value | number:'1.0-1'}}%
            }
          </span>
        }
      </div>
      <svg viewBox="0 0 300 100" #svg (mousemove)="mouseMoved($event)" (mouseleave)="hoverPoint.set(null)">
        <path [attr.d]="path()" stroke-width="0.5" stroke="lightsteelblue" fill="none"></path>

        <line class="x-axis" x1="0" [attr.y1]="xAxis() - 0.25" x2="300" [attr.y2]="xAxis() - 0.25" stroke-width="0.5" stroke="black"></line>
        <line class="y-axis" x1="0.25" y1="0" x2="0.25" y2="100" stroke-width="0.5" stroke="black"></line>

        @if (hoverPoint(); as point) {
          <circle [attr.cx]="point.x" [attr.cy]="point.y" r="1.5" fill="lightsteelblue" />
          <text class="hover-point" [attr.x]="point.x + 3" [attr.y]="point.y + 1">
            @if (cumulative()) {
              {{point.value | appCurrency}}
            } @else {
              {{point.value | number:'1.0-1'}}%
            }
          </text>
        }
      </svg>
    </div>
    <div class="x-labels">
      @if (xLabels(); as labels) {
        <span class="x-label" [style.left]="'calc(' + 100 * labels[0].x / 300 + '% - 17.5px)'">{{labels[0].date.year()}}</span>
        <span class="x-label" [style.left]="'calc(' + 100 * labels[labels.length - 1].x / 300 + '% - 17.5px)'">
          {{labels[labels.length - 1].date.year()}}
        </span>
        @if (hoverPoint(); as point) {
          <span class="x-label hover-label" [style.left]="'calc(' + 100 * point.x / 300 + '% - 17.5px)'">
            {{point.date.year()}}
          </span>
        }
      }
    </div>
  `
})
export class GraphPreviewComponent implements OnInit {
  graph = input.required<Graph>();

  cumulative = signal(false);
  path = signal('');
  xAxis = signal(100);
  xLabels = signal<{ date: Moment; x: number; }[]>([]);
  yLabels = signal<{ value: number; y: number; }[]>([]);
  hoverPoint = signal<{ x: number; y: number; date: Moment; value: number; } | null>(null);
  points = signal<{ date: Moment; value: number; x: number; y: number; }[]>([]);

  svg = viewChild.required<ElementRef<SVGElement>>('svg');

  ngOnInit() {
    const graph = this.graph();

    if (this.cumulative()) {
      const values = graph.data.reduce((prev, { value }) => [...prev, prev[prev.length - 1] * value], [1]);
      const xStep = 300 / (values.length - 1);
      const maxY = Math.max(...values);
      const yStep = maxY === 1 ? 50 : 100 / maxY;

      this.points.set(graph.data.map(({ date, value }, index) => ({
        date: moment(date),
        value: value,
        x: index * xStep,
        y: 100 - value * yStep
      })));
      this.xLabels.set(graph.data.map(({ date }, index) => ({
        date: moment(date),
        x: index * xStep
      })));
      this.yLabels.set([
        { value: 1, y: 0 },
        { value: maxY, y: 100 }
      ]);
      this.path.set([
        `M 0 ${100 - 1 * yStep}`,
        ...values.map((value, index) => `L ${index * xStep} ${100 - value * yStep}`)
      ].join(' '));

      return;
    }

    let year = moment(graph.data[0].date).year();
    let growth = 1;
    const years: [number, number][] = [];
    for (const { date, value } of graph.data) {
      const currentYear = moment(date).year();
      if (currentYear === year) {
        growth = growth * value;
      } else {
        years.push([year, growth]);
        growth = value;
        year = currentYear;
      }
    }
    years.push([year, growth]);

    const values = years.map(([, value]) => 100 * (value - 1));
    const xStep = 300 / (values.length - 1);
    let minY = Math.min(...values);

    if (minY > 0) {
      minY = 0;
    }

    const maxY = Math.max(...values);
    const yStep = minY === maxY ? 50 : 100 / (maxY - minY);

    let zeroY: number | null = null;
    if (minY < 0) {
      zeroY = 100 + yStep * minY;
      this.xAxis.set(zeroY);
    } else {
      this.xAxis.set(100);
    }

    this.points.set(years.map(([year, value ], index) => ({
      date: moment(`${year}-01-01`),
      value: 100 * (value - 1),
      x: index * xStep,
      y: 100 - yStep * (100 * (value - 1) - minY)
    })));
    this.xLabels.set(years.map(([year], index) => ({
      date: moment(`${year}-01-01`),
      x: index * xStep
    })));
    this.yLabels.set([
      { value: minY, y: 0 },
      ...(zeroY !== null ? [{ value: 0, y: 100 - zeroY }] : []),
      { value: maxY, y: 100 },
    ]);
    this.path.set(values
      .map((value, index) => `${index > 0 ? 'L' : 'M'} ${index * xStep} ${100 - yStep * (value - minY)}`)
      .join(' ')
    );
  }

  mouseMoved(event: MouseEvent) {
    const pt = new DOMPointReadOnly(event.clientX, event.clientY).matrixTransform(
      (this.svg().nativeElement as any).getScreenCTM().inverse()
    );

    const points = this.points();
    const index = Math.round((points.length - 1) * pt.x / 300);
    this.hoverPoint.set(points[index]);
  }
}
