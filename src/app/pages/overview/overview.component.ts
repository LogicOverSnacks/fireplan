import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MatDividerModule } from '@angular/material/divider';
import { MatSliderModule } from '@angular/material/slider';
import { Store } from '@ngxs/store';
import moment, { Moment } from 'moment';
import { combineLatest, map } from 'rxjs';

import { CoreModule, mapRecord } from '~/core';
import { AssetsState } from '~/state/clients/assets.state';
import { PeopleState } from '~/state/clients/people.state';
import { StagesState } from '~/state/clients/plans/stages.state';
import { DynamicWithdrawalScheme, Portfolio, UnrolledStage } from '~/state/clients/plans/stages.state.model';
import { GraphsState } from '~/state/graphs.state';

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

  percentileControl = new FormControl(5, { nonNullable: true });

  percentile = toSignal(this.percentileControl.valueChanges, { initialValue: this.percentileControl.value });
  maxYear = toSignal(this.store.select(PeopleState.maxYear(3)), { requireSync: true });
  people = toSignal(this.store.select(PeopleState.people), { requireSync: true });
  graphs = toSignal(
    combineLatest([
      this.store.select(GraphsState.inflation),
      this.store.select(GraphsState.cash),
      this.store.select(GraphsState.bonds),
      this.store.select(GraphsState.stocks),
      this.store.select(GraphsState.crypto)
    ]).pipe(map(([[, inflation], [, cash], [, bonds], [, stocks], [, crypto]]) => ({ inflation, cash, bonds, stocks, crypto }))),
    { requireSync: true }
  );
  stages = toSignal(this.store.select(StagesState.unrolledStages), { requireSync: true });
  // toSignal(store.select(AssetsState.portfolioTotals), { requireSync: true })
  initialPortfolio = signal({
    cash: 0,
    bonds: 0,
    stocks: 595000,
    crypto: 0
  });

  yearsPerCycle = computed(() => this.maxYear() - moment().year());
  monthsPerCycle = computed(() => this.yearsPerCycle() * 12);
  initialTotal = computed(() => Object.values(this.initialPortfolio()).reduce((total, value) => total + value, 0));

  xUnit = computed(() => 300 / this.monthsPerCycle());
  xInterval = computed(() => Math.floor(this.yearsPerCycle() / (this.xCount - 1)));
  xLabels = computed(() => {
    const start = moment();
    const getYears = (dateOfBirth: Moment) => {
      const age = Math.floor(start.diff(dateOfBirth, 'years'));
      const allAges = [...Array(this.yearsPerCycle())].map((_, index) => `${age + index}`);
      return allAges.filter((_, index) => index % this.xInterval() == 0);
    };

    return Object.fromEntries(this.people().map(person => [
      person.name,
      getYears(person.dateOfBirth)
    ]));
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
        upper[Math.floor((upper.length - 1) * 0.25)],
        this.initialTotal() * 5
      ),
      this.initialTotal() * 1.5
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
    const yLabelHeight = labelledYPortion / yCount;
    return [...Array(yCount)].map((_, index) => ({
      value: (index + 1) * this.yInterval(),
      y: `${100 * (index + 1) * yLabelHeight}%`
    }));
  });

  cycles = computed(() => {
    const { inflation, cash, bonds, stocks, crypto } = this.graphs();
    let monthsAvailable = Math.min(...[inflation, cash, bonds, stocks, crypto].map(graph => graph.data.length));

    if (this.monthsPerCycle() > monthsAvailable)
      throw new Error(`Graphs do not provide enough data`);

    const trimmedGraphData = [cash, bonds, stocks, crypto].map(graph => graph.data.slice(-monthsAvailable));
    const allGraphDeltas: Portfolio[] = [];
    const allInflationDeltas: number[] = [];
    for (let i = 0; i < monthsAvailable; ++i) {
      const [cash, bonds, stocks, crypto] = trimmedGraphData.map(data => data[i].value);
      allGraphDeltas.push({ cash, bonds, stocks, crypto });
      allInflationDeltas.push(inflation.data[i].value);
    }

    const start = moment();
    const end = moment(`${this.maxYear()}-01-01`);
    const cycles: number[][] = [];
    for (let m = 0; m < monthsAvailable - this.monthsPerCycle(); ++m) {
      const graphDeltas = allGraphDeltas.slice(m, m + this.monthsPerCycle());
      const inflationDeltas = allInflationDeltas.slice(m, m + this.monthsPerCycle());
      const cycle = this.calculateCycle(
        start,
        end,
        this.initialPortfolio(),
        this.stages(),
        graphDeltas,
        inflationDeltas
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

  private readonly xCount = 13;

  private calculateCycle(
    start: Moment,
    end: Moment,
    initialPortfolio: Portfolio,
    stages: UnrolledStage[],
    allGraphDeltas: Portfolio[],
    inflationDeltas: number[]
  ) {
    let portfolio = initialPortfolio;
    let yearlyWithdrawal: number | undefined;
    let totalInflation = 1;
    let year = 0;
    const startYear = start.year();
    const maxYear = end.year();
    const data: number[] = [];

    for (const stage of stages) {
      const endYear = stage.endYear ?? maxYear;

      while (startYear + year < endYear && startYear + year < maxYear) {

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

          if (yearlyWithdrawal < withdrawalScheme.minimumRate * totalInflation)
            yearlyWithdrawal = withdrawalScheme.minimumRate * totalInflation;
        }

        const monthlyAdjustment = (yearlyIncome - yearlyWithdrawal) / 12;

        for (let month = 0; month < 12; ++month) {
          totalInflation = totalInflation * inflationDeltas[year*12 + month];
          const graphDeltas = allGraphDeltas[year*12 + month];
          const grownPortfolio = mapRecord(portfolio, ([asset, amount]) => [asset, amount * graphDeltas[asset]]);
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

        year++;
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
