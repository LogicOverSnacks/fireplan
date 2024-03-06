import { Component, signal } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { Select, Store } from '@ngxs/store';
import moment, { Moment } from 'moment';
import { Observable, combineLatest, last, map } from 'rxjs';
import { mapRecord } from '~/core';

import { CoreModule } from '~/core';
import { AssetsState } from '~/state/clients/assets.state';
import { PeopleState } from '~/state/clients/people.state';
import { StagesState } from '~/state/clients/plans/stages.state';
import { DynamicWithdrawalScheme, Portfolio, Stage, UnrolledStage, WithdrawalScheme } from '~/state/clients/plans/stages.state.model';
import { Graph, GraphsState } from '~/state/graphs.state';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [
    MatDividerModule,

    CoreModule
  ],
  templateUrl: './overview.component.html',
  styleUrl: './overview.component.scss'
})
export class OverviewComponent {
  // cryptoAmount = this.store.select(InvestmentsState.crypto).pipe(
  //   map(crypto => crypto.map(investment => investment.balanceGbp)),
  //   map(amounts => amounts.reduce((amount, total) => amount + total, 0))
  // );

  // netWorth = combineLatest([
  //   this.cryptoAmount
  // ]).pipe(
  //   map(amounts => amounts.reduce((amount, total) => amount + total, 0))
  // );

  // cryptoPercentage = combineLatest([this.cryptoAmount, this.netWorth]).pipe(
  //   map(([amount, total]) => 100 * amount / total)
  // );

  // @Select(StrategyState.stages)
  // stages!: Observable<Stage[]>;

  // @Select(PeopleState.people)
  // people!: Observable<Person[]>;

  standardDeviations = 3;

  xOffset = 0;
  xUnit = 300 / (12 * 1);
  xCount = 13;
  xLabelWidth = '10%';
  yUnit = 1;

  medianPath = signal<string>('');
  percentilesPath = signal<string>('');
  path = signal<string>('');
  xLabels = signal<Record<string, string[]>>({});
  yLabels = signal<{ value: number; y: string; }[]>([]);
  successRate = signal(0);

  percentile = 5;

  constructor(store: Store) {
    // maybe show multiple plans on one graph in different colors
    const start = moment();
    const maxYear = store.selectSnapshot(PeopleState.maxYear(this.standardDeviations));
    const end = moment(`${maxYear}-01-01`);
    const yearsPerCycle = maxYear - start.year();
    const monthsPerCycle = yearsPerCycle * 12;

    this.xUnit = 300 / monthsPerCycle;
    const xInterval = Math.floor(yearsPerCycle / (this.xCount - 1));
    const xRemainder = yearsPerCycle - xInterval * (this.xCount - 1);
    const labelledXPortion = (yearsPerCycle - xRemainder) / yearsPerCycle;
    this.xLabelWidth = `${100 * labelledXPortion / (this.xCount - 1)}%`;

    const getYears = (dateOfBirth: Moment) => {
      const age = Math.floor(start.diff(dateOfBirth, 'years'));
      const allAges = [...Array(yearsPerCycle)].map((_, index) => `${age + index}`);
      return allAges.filter((_, index) => index % xInterval == 0);
    };

    this.xLabels.set(Object.fromEntries(store.selectSnapshot(PeopleState.people).map(person => [
      person.name,
      getYears(person.dateOfBirth)
    ])));

    const [, inflationGraph] = store.selectSnapshot(GraphsState.inflation);
    const [, cashGraph] = store.selectSnapshot(GraphsState.cash);
    const [, bondsGraph] = store.selectSnapshot(GraphsState.bonds);
    const [, stocksGraph] = store.selectSnapshot(GraphsState.stocks);
    const [, cryptoGraph] = store.selectSnapshot(GraphsState.crypto);

    let monthsAvailable = Math.min(...[inflationGraph, cashGraph, bondsGraph, stocksGraph, cryptoGraph].map(graph => graph.data.length));

    if (monthsPerCycle > monthsAvailable)
      throw new Error(`Graphs do not provide enough data`);

    const trimmedGraphData = [cashGraph, bondsGraph, stocksGraph, cryptoGraph].map(graph => graph.data.slice(-monthsAvailable));
    const allGraphDeltas: Portfolio[] = [];
    const allInflationDeltas: number[] = [];
    for (let i = 0; i < monthsAvailable; ++i) {
      const [cash, bonds, stocks, crypto] = trimmedGraphData.map(data => data[i].value);
      allGraphDeltas.push({ cash, bonds, stocks, crypto });
      allInflationDeltas.push(inflationGraph.data[i].value);
    }

    const initialPortfolio = {
      cash: 0,
      bonds: 0,
      stocks: 595000,
      crypto: 0
    }; //store.selectSnapshot(AssetsState.portfolioTotals);
    const stages = store.selectSnapshot(StagesState.unrolledStages);
    const cycles: number[][] = [];
    for (let m = 0; m < monthsAvailable - monthsPerCycle; ++m) {
      const graphDeltas = allGraphDeltas.slice(m, m + monthsPerCycle);
      const inflationDeltas = allInflationDeltas.slice(m, m + monthsPerCycle);
      const cycle = this.calculateCycle(
        start,
        end,
        initialPortfolio,
        stages,
        graphDeltas,
        inflationDeltas
      );
      cycles.push(cycle);
    }

    const lower: number[] = [];
    const lowerPercentile: number[] = [];
    const median: number[] = [];
    const upperPercentile: number[] = [];
    const upper: number[] = [];
    for (let m = 0; m < monthsPerCycle; ++m) {
      const values = cycles.map(cycle => cycle[m]).sort((a, b) => a - b);
      const maxIndex = values.length - 1;
      lower.push(values[0]);
      lowerPercentile.push(values[Math.floor(maxIndex * (this.percentile / 100))]);
      median.push(values[Math.floor(maxIndex / 2)]);
      upperPercentile.push(values[Math.floor(maxIndex * (1 - this.percentile / 100))]);
      upper.push(values[maxIndex]);
    }

    const finalValues = cycles.map(cycle => cycle[cycle.length - 1]);
    const successes = finalValues.filter(value => value > 0);
    this.successRate.set(successes.length / finalValues.length);

    const initialTotal = Object.values(initialPortfolio).reduce((total, value) => total + value, 0);

    const maxVisibleAmount = Math.max(
      Math.min(
        [...upper].sort((a, b) => b - a)[Math.floor((upper.length - 1) * 0.25)],
        initialTotal * 5
      ),
      initialTotal * 1.5
    );
    this.yUnit = 100 / maxVisibleAmount;

    const yInterval = maxVisibleAmount > 5000000000 ? 1000000000
      : maxVisibleAmount > 2500000000 ? 500000000
      : maxVisibleAmount > 1000000000 ? 250000000
      : maxVisibleAmount > 500000000 ? 100000000
      : maxVisibleAmount > 250000000 ? 50000000
      : maxVisibleAmount > 100000000 ? 25000000
      : maxVisibleAmount > 50000000 ? 10000000
      : maxVisibleAmount > 25000000 ? 5000000
      : maxVisibleAmount > 10000000 ? 2500000
      : maxVisibleAmount > 5000000 ? 1000000
      : maxVisibleAmount > 2500000 ? 500000
      : maxVisibleAmount > 1000000 ? 250000
      : maxVisibleAmount > 500000 ? 100000
      : maxVisibleAmount > 250000 ? 50000
      : maxVisibleAmount > 100000 ? 25000
      : maxVisibleAmount > 50000 ? 10000
      : maxVisibleAmount > 25000 ? 5000
      : maxVisibleAmount > 10000 ? 2500
      : maxVisibleAmount > 5000 ? 1000
      : maxVisibleAmount > 2500 ? 500
      : maxVisibleAmount > 1000 ? 250
      : maxVisibleAmount > 500 ? 100
      : maxVisibleAmount > 250 ? 50
      : maxVisibleAmount > 100 ? 25
      : maxVisibleAmount > 50 ? 10
      : maxVisibleAmount > 25 ? 5
      : 1;

    const yCount = Math.floor(maxVisibleAmount / yInterval);
    const remainder = maxVisibleAmount - yCount * yInterval;
    const labelledYPortion = (maxVisibleAmount - remainder) / maxVisibleAmount;
    const yLabelHeight = labelledYPortion / yCount;
    this.yLabels.set([...Array(yCount)].map((_, index) => ({
      value: (index + 1) * yInterval,
      y: `${100 * (index + 1) * yLabelHeight}%`
    })));

    this.path.set([
      `M ${this.getXCoord(0)} ${this.getYCoord(initialTotal)}`,
      ...lower.map((value, index) => `L ${this.getXCoord(index)} ${this.getYCoord(value)}`),
      ...upper.map((value, index) => `L ${this.getXCoord(index)} ${this.getYCoord(value)}`).reverse(),
      'Z'
    ].join(' '));
    this.percentilesPath.set([
      `M ${this.getXCoord(0)} ${this.getYCoord(initialTotal)}`,
      ...lowerPercentile.map((value, index) => `L ${this.getXCoord(index)} ${this.getYCoord(value)}`),
      ...upperPercentile.map((value, index) => `L ${this.getXCoord(index)} ${this.getYCoord(value)}`).reverse(),
      'Z'
    ].join(' '));
    this.medianPath.set([
      `M ${this.getXCoord(0)} ${this.getYCoord(initialTotal)}`,
      ...median.map((value, index) => `L ${this.getXCoord(index)} ${this.getYCoord(value)}`)
    ].join(' '));
  }

  calculateWithdrawal(lastWithdrawal: number, totalPortfolio: number, scheme: DynamicWithdrawalScheme) {
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

  getXCoord = (value: number) => this.xOffset + value * this.xUnit;
  getYCoord = (value: number) => 100 - value * this.yUnit;



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
}
