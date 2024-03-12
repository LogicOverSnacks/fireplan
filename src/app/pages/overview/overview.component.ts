import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MatDividerModule } from '@angular/material/divider';
import { MatSliderModule } from '@angular/material/slider';
import { Store } from '@ngxs/store';
import moment, { Moment } from 'moment';
import { combineLatest, map, throttleTime } from 'rxjs';

import { CoreModule, mapRecord } from '~/core';
import { AssetsState } from '~/state/clients/assets.state';
import { PeopleState } from '~/state/clients/people.state';
import { StagesState } from '~/state/clients/plans/stages.state';
import { DynamicWithdrawalScheme, Portfolio, UnrolledStage } from '~/state/clients/plans/stages.state.model';
import { GraphsState } from '~/state/graphs.state';

type GraphDelta = {
  inflation: number;
  cash: number;
  bonds: number;
  stocks: number;
  crypto: number;
};

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [
    MatDividerModule,
    MatSliderModule,

    CoreModule
  ],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss'
})
export class OverviewComponent {
  store = inject(Store);

  svg = viewChild.required<ElementRef<SVGElement>>('svg');
  percentileControl = new FormControl(90, { nonNullable: true });

  hoverPoint = signal<{
    lower: { x: number; y: number; value: number; };
    median: { x: number; y: number; value: number; };
    upper: { x: number; y: number; value: number; };
  } | null>(null);
  percentile = toSignal(
    this.percentileControl.valueChanges.pipe(
      throttleTime(50, undefined, { leading: true, trailing: true }),
      map(value => (100 - value) / 2)
    ),
    { initialValue: (100 - this.percentileControl.value) / 2 }
  );
  maxYear = toSignal(this.store.select(PeopleState.maxYear(3)), { requireSync: true });
  yearsPerCycle = computed(() => this.maxYear() - moment().year());
  monthsPerCycle = computed(() => this.yearsPerCycle() * 12);

  people = toSignal(this.store.select(PeopleState.people), { requireSync: true });
  deltas = toSignal(
    combineLatest([
      this.store.select(GraphsState.inflation),
      this.store.select(GraphsState.cash),
      this.store.select(GraphsState.bonds),
      this.store.select(GraphsState.stocks),
      this.store.select(GraphsState.crypto)
    ]).pipe(map(([[, inflation], [, cash], [, bonds], [, stocks], [, crypto]]) => {
      const maxDate = [inflation, cash, bonds, stocks, crypto]
        .map(graph => moment(graph.data[graph.data.length - 1].date))
        .reduce((a, b) => a.isBefore(b) ? a : b);

      [inflation, cash, bonds, stocks, crypto] = [inflation, cash, bonds, stocks, crypto].map(graph => ({
        data: graph.data.filter(({ date }) => moment(date).isSameOrBefore(maxDate, 'month'))
      }));

      const monthsAvailable = Math.min(...[inflation, cash, bonds, stocks, crypto].map(graph => graph.data.length));

      if (this.monthsPerCycle() > monthsAvailable)
        throw new Error(`Graphs do not provide enough data`);

      [inflation, cash, bonds, stocks, crypto] = [inflation, cash, bonds, stocks, crypto].map(graph => ({
        data: graph.data.slice(-monthsAvailable)
      }));

      const deltas: GraphDelta[] = [];
      for (let i = 0; i < monthsAvailable; ++i) {
        deltas.push({
          inflation: inflation.data[i].value,
          cash: cash.data[i].value,
          bonds: bonds.data[i].value,
          stocks: stocks.data[i].value,
          crypto: crypto.data[i].value,
        });
      }

      return deltas;
    })),
    { requireSync: true }
  );
  stages = toSignal(this.store.select(StagesState.unrolledStages), { requireSync: true });
  // toSignal(store.select(AssetsState.portfolioTotals), { requireSync: true })
  initialPortfolio = signal({
    cash: 0,
    bonds: 0,
    stocks: 800000,
    crypto: 0
  });
  initialTotal = computed(() => Object.values(this.initialPortfolio()).reduce((total, value) => total + value, 0));

  xUnit = computed(() => 300 / this.monthsPerCycle());
  xInterval = computed(() => Math.floor(this.yearsPerCycle() / (this.xCount - 1)));
  xLabels = computed(() => {
    const start = moment();
    const xUnit = this.xUnit() * this.xInterval() * 12;
    const getYears = (dateOfBirth: Moment) => {
      const age = Math.floor(start.diff(dateOfBirth, 'years'));
      const allAges = [...Array(this.yearsPerCycle())].map((_, index) => `${age + index}`);
      const visibleAges = allAges.filter((_, index) => index % this.xInterval() == 0);

      return visibleAges.map((age, index) => ({ value: age, x: index * xUnit }));
    };

    return this.people().map(person => ({
      name: person.name,
      labels: getYears(person.dateOfBirth)
    }));
  });
  xLabelWidth = computed(() => {
    const xRemainder = this.yearsPerCycle() - this.xInterval() * (this.xCount - 1);
    const labelledXPortion = (this.yearsPerCycle() - xRemainder) / this.yearsPerCycle();
    return `${100 * labelledXPortion / (this.xCount - 1)}%`;
  });
  yMaxValue = computed(() => {
    const upper = [...this.points().upper].sort((a, b) => b - a);

    return Math.max(
      Math.min(
        upper[0],
        // upper[Math.floor((upper.length - 1) * 0.25)],
        this.initialTotal() * 5
      ),
      // this.initialTotal() * 1.5
    );
  });
  yUnit = computed(() => 100 / this.yMaxValue());
  yInterval = computed(() =>
    this.yMaxValue() > 5000000000 ? 1000000000
    : this.yMaxValue() > 2500000000 ? 500000000
    : this.yMaxValue() > 1000000000 ? 250000000
    : this.yMaxValue() > 500000000 ? 100000000
    : this.yMaxValue() > 250000000 ? 50000000
    : this.yMaxValue() > 100000000 ? 25000000
    : this.yMaxValue() > 50000000 ? 10000000
    : this.yMaxValue() > 25000000 ? 5000000
    : this.yMaxValue() > 10000000 ? 2500000
    : this.yMaxValue() > 5000000 ? 1000000
    : this.yMaxValue() > 2500000 ? 500000
    : this.yMaxValue() > 1000000 ? 250000
    : this.yMaxValue() > 500000 ? 100000
    : this.yMaxValue() > 250000 ? 50000
    : this.yMaxValue() > 100000 ? 25000
    : this.yMaxValue() > 50000 ? 10000
    : this.yMaxValue() > 25000 ? 5000
    : this.yMaxValue() > 10000 ? 2500
    : this.yMaxValue() > 5000 ? 1000
    : this.yMaxValue() > 2500 ? 500
    : this.yMaxValue() > 1000 ? 250
    : this.yMaxValue() > 500 ? 100
    : this.yMaxValue() > 250 ? 50
    : this.yMaxValue() > 100 ? 25
    : this.yMaxValue() > 50 ? 10
    : this.yMaxValue() > 25 ? 5
    : 1
  );
  yLabels = computed(() => {
    const yCount = Math.floor(this.yMaxValue() / this.yInterval());
    const remainder = this.yMaxValue() - yCount * this.yInterval();
    const labelledYPortion = (this.yMaxValue() - remainder) / this.yMaxValue();
    const yLabelHeight = 100 * labelledYPortion / yCount;
    return [...Array(yCount)].map((_, index) => ({
      value: (index + 1) * this.yInterval(),
      y: 100 - (index + 1) * yLabelHeight
    }));
  });

  cycles = computed(() => {
    const graphDeltas = this.deltas();
    const monthsAvailable = graphDeltas.length;

    const start = moment();
    const end = moment(`${this.maxYear()}-01-01`);
    const cycles: number[][] = [];
    for (let m = 0; m < monthsAvailable - this.monthsPerCycle(); ++m) {
      const deltas = graphDeltas.slice(m, m + this.monthsPerCycle());
      const cycle = this.calculateCycle(
        start,
        end,
        this.initialPortfolio(),
        this.stages(),
        deltas
      );
      cycles.push(cycle);
    }

    return cycles;
  });

  successRate = computed(() => {
    const cycles = this.cycles();
    const successes = cycles.filter(cycle => cycle[cycle.length - 1] > 0);
    return successes.length / cycles.length;
  });

  points = computed(() => {
    const cycles = this.cycles();

    const lower: number[] = [];
    const median: number[] = [];
    const upper: number[] = [];
    for (let m = 0; m < this.monthsPerCycle(); ++m) {
      const values = cycles.map(cycle => cycle[m]).sort((a, b) => a - b);
      const maxIndex = values.length - 1;
      lower.push(values[Math.floor(maxIndex * (this.percentile() / 100))]);
      median.push(values[Math.floor(maxIndex * 0.5)]);
      upper.push(values[Math.floor(maxIndex * (1 - this.percentile() / 100))]);
    }

    return { lower, median, upper };
  });

  paths = computed(() => {
    const { lower, median, upper } = this.points();

    return {
      median: [
        `M ${this.getXCoord(0)} ${this.getYCoord(this.initialTotal())}`,
        ...median.map((value, index) => `L ${this.getXCoord(index)} ${this.getYCoord(value)}`)
      ].join(' '),
      percentiles: [
        `M ${this.getXCoord(0)} ${this.getYCoord(this.initialTotal())}`,
        ...lower.map((value, index) => `L ${this.getXCoord(index)} ${this.getYCoord(value)}`),
        ...upper.map((value, index) => `L ${this.getXCoord(index)} ${this.getYCoord(value)}`).reverse(),
        'Z'
      ].join(' ')
    };
  });

  getXCoord = (value: number): number => value * this.xUnit();
  getYCoord = (value: number): number => 100 - value * this.yUnit();

  mouseMoved(event: MouseEvent) {
    const pt = new DOMPointReadOnly(event.clientX, event.clientY).matrixTransform(
      (this.svg().nativeElement as any).getScreenCTM().inverse()
    );

    const points = this.points();
    const index = Math.round((points.median.length - 1) * pt.x / 300);
    this.hoverPoint.set({
      lower: {
        x: this.getXCoord(index),
        y: this.getYCoord(points.lower[index]),
        value: points.lower[index]
      },
      median: {
        x: this.getXCoord(index),
        y: this.getYCoord(points.median[index]),
        value: points.median[index]
      },
      upper: {
        x: this.getXCoord(index),
        y: this.getYCoord(points.upper[index]),
        value: points.upper[index]
      }
    });
  }

  private readonly xCount = 13;

  private calculateCycle(
    start: Moment,
    end: Moment,
    initialPortfolio: Portfolio,
    stages: UnrolledStage[],
    deltas: GraphDelta[],
  ) {
    let portfolio = initialPortfolio;
    let yearlyWithdrawal: number | undefined;
    let totalInflation = 1;
    let year = 0;
    const startYear = start.year();
    const maxYear = end.year();
    const data = [Object.values(portfolio).reduce((total, value) => total + value, 0)];

    for (const stage of stages) {
      const endYear = Math.min(stage.endYear ?? maxYear, maxYear);

      for (; startYear + year < endYear; ++year) {
        const yearlyIncome = Object.values(stage.incomeByPerson)
          .map(income => income * totalInflation)
          .reduce((total, value) => total + value, 0);

        const startOfYearTotal = Object.values(portfolio).reduce((total, value) => total + value, 0);

        const withdrawalScheme = stage.withdrawal;
        if (withdrawalScheme.type === 'constant') {
          yearlyWithdrawal = withdrawalScheme.initialRate
            ? withdrawalScheme.initialRate * totalInflation
            : (startOfYearTotal * (withdrawalScheme.targetPercentage ?? 0) / 100);
        } else {
          yearlyWithdrawal = yearlyWithdrawal === undefined
            ? startOfYearTotal * withdrawalScheme.targetPercentage / 100
            : this.calculateWithdrawal(yearlyWithdrawal, startOfYearTotal, withdrawalScheme);

          const minWithdrawal = withdrawalScheme.minimumRate * totalInflation;
          if (yearlyWithdrawal < minWithdrawal)
            yearlyWithdrawal = minWithdrawal;
        }

        const monthlyAdjustment = (yearlyIncome - yearlyWithdrawal) / 12;

        for (let month = 0; month < 12; ++month) {
          const delta = deltas[year*12 + month];
          totalInflation = totalInflation * delta.inflation;
          const grownPortfolio = mapRecord(portfolio, ([asset, amount]) => [asset, amount * delta[asset]]);
          const monthTotal = Math.max(0, Object.values(grownPortfolio).reduce((total, value) => total + value, monthlyAdjustment));

          if ((year * 12 + month + 1) % stage.portfolioRedistributionFrequency === 0) {
            portfolio = mapRecord(stage.portfolioDistribution, ([asset, value]) => [asset, value * monthTotal]);
          } else {
            if (monthlyAdjustment <= grownPortfolio.cash) {
              portfolio = {
                ...grownPortfolio,
                cash: grownPortfolio.cash - monthlyAdjustment
              };
            } else if (monthlyAdjustment <= grownPortfolio.cash + grownPortfolio.bonds) {
              portfolio = {
                ...grownPortfolio,
                cash: 0,
                bonds: grownPortfolio.bonds - (monthlyAdjustment - grownPortfolio.cash),
              };
            } else if (monthlyAdjustment <= grownPortfolio.cash + grownPortfolio.bonds + grownPortfolio.stocks) {
              portfolio = {
                ...grownPortfolio,
                cash: 0,
                bonds: 0,
                stocks: grownPortfolio.stocks - (monthlyAdjustment - grownPortfolio.cash - grownPortfolio.bonds),
              };
            } else if (monthlyAdjustment <= grownPortfolio.cash + grownPortfolio.bonds + grownPortfolio.stocks + grownPortfolio.crypto) {
              portfolio = {
                cash: 0,
                bonds: 0,
                stocks: 0,
                crypto: grownPortfolio.crypto - (monthlyAdjustment - grownPortfolio.cash - grownPortfolio.bonds - grownPortfolio.stocks),
              };
            } else {
              portfolio = {
                cash: 0,
                bonds: 0,
                stocks: 0,
                crypto: 0
              };
            }
          }

          data.push(monthTotal);
        }
      }
    }

    return data;
  }

  private calculateWithdrawal(lastWithdrawal: number, totalPortfolio: number, scheme: DynamicWithdrawalScheme) {
    const adjustment = scheme.adjustmentPercentage / 100;
    const target = scheme.targetPercentage / 100;
    const threshold = scheme.thresholdPercentage / 100;
    const lowerThreshold = target / (1 + threshold);
    const upperThreshold = target * (1 + threshold);

    if (totalPortfolio <= lastWithdrawal) {
      return totalPortfolio;
    } else if (lastWithdrawal < totalPortfolio * lowerThreshold) {
      return Math.min(totalPortfolio * target, lastWithdrawal * (1 + adjustment));
    } else if (lastWithdrawal > totalPortfolio * upperThreshold) {
      return Math.max(totalPortfolio * target, lastWithdrawal / (1 + adjustment));
    }

    return lastWithdrawal;
  }
}
