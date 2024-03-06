import { Pipe, PipeTransform } from '@angular/core';
import moment, { Moment } from 'moment';

import { Graph } from '~/state/graphs.state';

export type GraphDisplay = {
  x: { date: Moment; x: number; }[];
  y: { value: number; y: number }[];
  path: string;
};

@Pipe({ name: 'appGraphDisplay', standalone: true })
export class AppGraphDisplayPipe implements PipeTransform {
  private input?: Graph | null;
  private cumulative = true;
  private output?: GraphDisplay | null;

  transform(value: Graph | null, cumulative = true) {
    if (this.input === undefined || this.output === undefined || this.input !== value || this.cumulative !== cumulative) {
      this.input = value;
      this.cumulative = cumulative;
      this.output = this.convert();
    }

    return this.output;
  }

  private convert() {
    const graph = this.input === undefined || this.input === null ? null : this.input;
    if (!graph) return null;

    if (this.cumulative) {
      const values = graph.data.reduce((prev, { value }) => [...prev, prev[prev.length - 1] * value], [1]);
      const xStep = 300 / (values.length - 1);
      const maxY = Math.max(...values);
      const yStep = maxY === 1 ? 50 : 100 / maxY;

      return {
        x: [
          { date: moment(graph.data[0].date), x: 0 },
          { date: moment(graph.data[graph.data.length - 1].date), x: 300 }
        ],
        y: [
          { value: 1, y: 0 },
          { value: maxY, y: 100 }
        ],
        path: [
          `M 0 ${100 - 1 * yStep}`,
          ...values.map((value, index) => `L ${index * xStep} ${100 - value * yStep}`)
        ].join(' ')
      };
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
    const yStep = 100 / (maxY - minY);

    let zeroY: number | null = null;
    if (minY < 0) {
      zeroY = 100 + yStep * minY;
    }

    return {
      x: [
        { date: moment(graph.data[0].date), x: 0 },
        { date: moment(graph.data[graph.data.length - 1].date), x: 300 }
      ],
      y: [
        { value: minY, y: 0 },
        ...(zeroY !== null ? [{ value: 0, y: zeroY }] : []),
        { value: maxY, y: 100 },
      ],
      path: values
        .map((value, index) => `${index > 0 ? 'L' : 'M'} ${index * xStep} ${100 - yStep * (value - minY)}`)
        .join(' ')
    };
  }
}
