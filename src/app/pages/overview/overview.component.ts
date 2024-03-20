import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { Store } from '@ngxs/store';
import cdf from '@stdlib/stats-base-dists-normal-cdf';
import quantile from '@stdlib/stats-base-dists-normal-quantile';
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
    MatSelectModule,
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
  percentile = toSignal(
    this.percentileControl.valueChanges.pipe(
      throttleTime(50, undefined, { leading: true, trailing: true }),
      map(value => (100 - value) / 2)
    ),
    { initialValue: (100 - this.percentileControl.value) / 2 }
  );
  logarithmicViewCtrl = new FormControl(false, { nonNullable: true });
  logarithmicView = toSignal(this.logarithmicViewCtrl.valueChanges, { initialValue: this.logarithmicViewCtrl.value });

  hoverPoint = signal<{
    lower: { x: number; y: number; textY: number; value: number; };
    median: { x: number; y: number; textY: number; value: number; };
    upper: { x: number; y: number; textY: number; value: number; };
  } | null>(null);
  now = computed(() => moment());
  maxYear = toSignal(this.store.select(PeopleState.maxYear(3)), { requireSync: true });

  yearsPerCycle = computed(() => this.maxYear() - this.now().year());
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
  stageLabels = computed(() => {
    const stages = this.stages();
    const visibleYears = this.xVisibleYears();
    const thisYear = this.now().year();
    const maxYear = thisYear + visibleYears;
    return stages.map((stage, index) => {
      const previousEndYear = index === 0 ? thisYear : (stages[index - 1].endYear ?? maxYear);

      return {
        id: stage.id,
        name: stage.name,
        endYear: stage.endYear,
        width: `${100 * ((stage.endYear ?? maxYear) - previousEndYear) / visibleYears}%`
      };
    });
  });
  // toSignal(store.select(AssetsState.portfolioTotals), { requireSync: true })
  initialPortfolio = signal({
    cash: 0,
    bonds: 0,
    stocks: 394000,
    crypto: 0
  });
  initialTotal = computed(() => Object.values(this.initialPortfolio()).reduce((total, value) => total + value, 0));

  xVisibleYears = computed(() => {
    const percentile = this.percentile();
    const maxVisibleYear = percentile > 0
      ? Math.ceil(Math.max(
        ...this.people().map(({ dateOfBirth, lifeExpectancy }) => quantile(
          1 - percentile / 100,
          dateOfBirth.year() + lifeExpectancy.mean,
          lifeExpectancy.variance
        ))
      ))
      : this.maxYear();
    return maxVisibleYear - this.now().year();
  });
  xUnit = computed(() => 300 / (this.xVisibleYears() * 12));
  xInterval = computed(() => Math.floor(this.xVisibleYears() / (this.xCount - 1)));
  xLabels = computed(() => {
    const start = this.now();
    const xUnit = this.xUnit() * this.xInterval() * 12;
    const getYears = (dateOfBirth: Moment) => {
      const age = Math.floor(start.diff(dateOfBirth, 'years'));
      const allAges = [...Array(this.xVisibleYears())].map((_, index) => `${age + index}`);
      const visibleAges = allAges.filter((_, index) => index % this.xInterval() == 0);

      return visibleAges.map((age, index) => ({ value: age, x: index * xUnit }));
    };

    return this.people().map(person => ({
      id: person.id,
      name: person.name,
      labels: getYears(person.dateOfBirth)
    }));
  });
  xHoverPoint = computed(() => {
    const hoverPoint = this.hoverPoint();
    if (!hoverPoint) return null;

    const x = hoverPoint.median.x;
    const xUnit = this.xUnit() * 12;
    const start = this.now();

    return Object.fromEntries(this.people().map(person => [
      person.id,
      {
        x: x,
        label: `${Math.floor(start.diff(person.dateOfBirth, 'years')) + Math.floor(x / xUnit)}`
      }
    ]));
  });
  xLabelWidth = computed(() => {
    const xRemainder = this.xVisibleYears() - this.xInterval() * (this.xCount - 1);
    const labelledXPortion = (this.xVisibleYears() - xRemainder) / this.xVisibleYears();
    return `${100 * labelledXPortion / (this.xCount - 1)}%`;
  });
  yMinVisibleValue = computed(() => this.logarithmicView()
    ? Math.max(Math.min(...this.points().lower), this.initialTotal() / 4)
    : 0
  );
  yMaxVisibleValue = computed(() => this.logarithmicView()
    ? Math.max(...this.points().upper)
    : Math.min(
      Math.max(...this.points().upper),
      Math.max(...this.points().median) * 1.5,
      this.initialTotal() * 20
    )
  );
  yUnit = computed(() => 100 / (this.logarithmicView()
    ? Math.log(this.yMaxVisibleValue()) - Math.log(this.yMinVisibleValue())
    : this.yMaxVisibleValue()
  ));
  yInterval = computed(() =>
    this.yMaxVisibleValue() > 5000000000 ? 1000000000
    : this.yMaxVisibleValue() > 2500000000 ? 500000000
    : this.yMaxVisibleValue() > 1000000000 ? 250000000
    : this.yMaxVisibleValue() > 500000000 ? 100000000
    : this.yMaxVisibleValue() > 250000000 ? 50000000
    : this.yMaxVisibleValue() > 100000000 ? 25000000
    : this.yMaxVisibleValue() > 50000000 ? 10000000
    : this.yMaxVisibleValue() > 25000000 ? 5000000
    : this.yMaxVisibleValue() > 10000000 ? 2500000
    : this.yMaxVisibleValue() > 5000000 ? 1000000
    : this.yMaxVisibleValue() > 2500000 ? 500000
    : this.yMaxVisibleValue() > 1000000 ? 250000
    : this.yMaxVisibleValue() > 500000 ? 100000
    : this.yMaxVisibleValue() > 250000 ? 50000
    : this.yMaxVisibleValue() > 100000 ? 25000
    : this.yMaxVisibleValue() > 50000 ? 10000
    : this.yMaxVisibleValue() > 25000 ? 5000
    : this.yMaxVisibleValue() > 10000 ? 2500
    : this.yMaxVisibleValue() > 5000 ? 1000
    : this.yMaxVisibleValue() > 2500 ? 500
    : this.yMaxVisibleValue() > 1000 ? 250
    : this.yMaxVisibleValue() > 500 ? 100
    : this.yMaxVisibleValue() > 250 ? 50
    : this.yMaxVisibleValue() > 100 ? 25
    : this.yMaxVisibleValue() > 50 ? 10
    : this.yMaxVisibleValue() > 25 ? 5
    : 1
  );
  yLabels = computed(() => {
    if (this.logarithmicView()) {
      const min = Math.ceil(Math.log10(this.yMinVisibleValue()));
      const max = Math.floor(Math.log10(this.yMaxVisibleValue()));
      const yCount = 1 + max - min;
      return [...Array(yCount)].map((_, index) => ({
        value: Math.pow(10, min + index),
        y: this.getYCoord(Math.pow(10, min + index))
      }));
    }

    const max = this.yMaxVisibleValue();
    const maxExp = Math.floor(Math.log10(max));
    const maxMultiplier = max / Math.pow(10, maxExp);
    const min = this.yMinVisibleValue();
    const minExp = Math.ceil(Math.log10(min));
    const minMultiplier = min / Math.pow(10, minExp);


    max - min;



    const yCount = Math.floor(this.yMaxVisibleValue() / this.yInterval());
    return [...Array(yCount)].map((_, index) => ({
      value: (index + 1) * this.yInterval(),
      y: this.getYCoord((index + 1) * this.yInterval())
    }));
  });

  cycles = computed(() => {
    const graphDeltas = this.deltas();
    const monthsAvailable = graphDeltas.length;

    const start = this.now();
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
    const people = this.people();
    const thisYear = this.now().year();

    /** The probability for each cycle that all people have died before running out of money */
    const probabilities = cycles
      .map(cycle => cycle.findIndex(value => value <= 0))
      .map(index => index < 0
        ? 1
        : people
          .map(({ dateOfBirth, lifeExpectancy }) => cdf(
            thisYear + index / 12,
            dateOfBirth.year() + lifeExpectancy.mean,
            lifeExpectancy.variance
          ))
          .reduce((a, b) => a * b, 1)
      );

    return probabilities.reduce((a, b) => a + b, 0) / probabilities.length;

  });

  points = computed(() => {
    const cycles = this.cycles();

    const lower: number[] = [];
    const median: number[] = [];
    const upper: number[] = [];
    for (let m = 0; m < this.xVisibleYears() * 12; ++m) {
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
  getYCoord = (value: number): number => this.logarithmicView()
    ? 100 - (
      Math.max(0, Math.log(value) - Math.log(this.yMinVisibleValue()))
    ) * this.yUnit()
    : 100 - value * this.yUnit();

  mouseMoved(event: MouseEvent) {
    const pt = new DOMPointReadOnly(event.clientX, event.clientY).matrixTransform(
      (this.svg().nativeElement as any).getScreenCTM().inverse()
    );
    const ptX = pt.x < 0 ? 0
      : pt.x > 300 ? 300
      : pt.x;

    const points = this.points();
    const index = Math.round((points.median.length - 1) * ptX / 300);
    const x = this.getXCoord(index);
    const lowerY = this.getYCoord(points.lower[index]);
    const medianY = this.getYCoord(points.median[index]);
    const upperY = this.getYCoord(points.upper[index]);
    this.hoverPoint.set({
      lower: {
        x: x,
        y: lowerY <= 0 ? 0
          : lowerY >= 100 ? 100
          : lowerY,
        textY: lowerY <= 12 ? 12
          : (lowerY >= 98 || medianY >= 93 || upperY >= 88) ? 98
          : medianY + 5 >= lowerY ? medianY + 5
          : lowerY,
        value: points.lower[index]
      },
      median: {
        x: x,
        y: medianY <= 0 ? 0
          : medianY >= 100 ? 100
          : medianY,
        textY: (medianY <= 7 || lowerY <= 12) ? 7
          : (medianY >= 93 || upperY >= 88) ? 93
          : medianY,
        value: points.median[index]
      },
      upper: {
        x: x,
        y: upperY <= 0 ? 0
          : upperY >= 100 ? 100
          : upperY,
        textY: (upperY <= 2 || medianY <= 7 || lowerY <= 12) ? 2
          : upperY >= 88 ? 88
          : medianY - 5 <= upperY ? medianY - 5
          : upperY,
        value: points.upper[index]
      }
    });
  }

  sliderDisplay = (value: number) => `${value}%`;

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
        const yearlyIncome = Object.values(stage.incomeByPerson).reduce((total, value) => total + value, 0) * totalInflation;

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
