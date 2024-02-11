import { Component, signal } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { Select, Store } from '@ngxs/store';
import { Observable, combineLatest, last, map } from 'rxjs';
import { mapRecord } from '~/core';

import { CoreModule } from '~/core/core.module';
import { AssetsState } from '~/state/clients/assets.state';
import { PeopleState } from '~/state/clients/people.state';
import { StagesState } from '~/state/clients/plans/stages.state';
import { DynamicWithdrawalScheme, Portfolio, Stage, WithdrawalScheme } from '~/state/clients/plans/stages.state.model';

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
  yOffset = 0;
  yUnit = 1;

  paths = signal<string[]>([]);

  constructor(store: Store) {
    // maybe show multiple plans on one graph in different colors?

    const stages = store.selectSnapshot(StagesState.unrolledStages);
    const thisYear = new Date().getUTCFullYear();
    const maxYear = store.selectSnapshot(PeopleState.maxYear(this.standardDeviations));

    this.xUnit = 300 / (12 * (maxYear - thisYear));

    /** multiplier from the previous time slice */
    let graphDeltas: Portfolio;
    let portfolio = store.selectSnapshot(AssetsState.portfolioTotals);
    let yearlyWithdrawal: number | undefined;
    let year = thisYear;

    const data: number[] = [];

    for (const stage of stages) {
      const endYear = stage.endYear ?? maxYear;

      while (year < endYear) {
        const yearlyIncome = Object.values(stage.incomeByPerson)
          .map(gross => this.calculateNetIncome(gross))
          .reduce((total, value) => total + value, 0);

        const startOfYearTotal = Object.values(portfolio).reduce((total, value) => total + value, 0);

        const withdrawalScheme = stage.withdrawal;
        if (withdrawalScheme.type === 'constant') {
          yearlyWithdrawal = withdrawalScheme.initialRate ?? ((withdrawalScheme.targetPercentage ?? 0) / 100 * startOfYearTotal);
        } else {
          yearlyWithdrawal = yearlyWithdrawal === undefined
            ? startOfYearTotal * withdrawalScheme.targetPercentage / 100
            : this.calculateWithdrawal(yearlyWithdrawal, startOfYearTotal, withdrawalScheme);
        }

        const monthlyAdjustment = (yearlyIncome - yearlyWithdrawal) / 12;

        for (let month = 1; month <= 12; month++) {
          const grownPortfolio = mapRecord(portfolio, ([asset, amount]) => [asset, amount * graphDeltas[asset]]);
          const monthTotal = monthlyAdjustment + Object.values(grownPortfolio).reduce((total, value) => total + value, 0);
          portfolio = mapRecord(stage.portfolioDistribution, ([asset, value]) => [asset, value * monthTotal]);

          data.push(monthTotal);
        }

        year++;
      }
    }

    this.paths.set([
      this.calculatePath(data)
    ]);
  }

  calculateNetIncome(grossIncome: number) {
    return grossIncome;
  }

  calculateWithdrawal(lastWithdrawal: number, totalPortfolio: number, scheme: DynamicWithdrawalScheme) {
    const percentage = 100 * lastWithdrawal / totalPortfolio;

    if (percentage < scheme.targetPercentage * (1 + scheme.thresholdPercentage)) {
      const maxWithdrawal = lastWithdrawal * (1 + scheme.adjustmentPercentage);
      const maxWithdrawalPercentage = 100 * maxWithdrawal / totalPortfolio;
      return maxWithdrawalPercentage <= scheme.targetPercentage
        ? maxWithdrawal
        : scheme.targetPercentage * totalPortfolio;
    } else if (percentage > scheme.targetPercentage * (1 - scheme.thresholdPercentage)) {
      const minWithdrawal = lastWithdrawal * (1 - scheme.adjustmentPercentage);
      const minWithdrawalPercentage = 100 * minWithdrawal / totalPortfolio;
      return minWithdrawalPercentage >= scheme.targetPercentage
        ? minWithdrawal
        : scheme.targetPercentage * totalPortfolio;
    } else {
      return lastWithdrawal;
    }
  }

  calculatePath = (data: number[]) => data
    .map((value, index) => `${index === 0 ? 'M' : 'L'} ${this.getXCoord(index)} ${this.getYCoord(value)}`)
    .join(' ');

  getXCoord = (value: number) => this.xOffset + value * this.xUnit;
  getYCoord = (value: number) => this.yOffset + value * this.yUnit;



  private calculateCycle(initialPortfolio: Portfolio) {
    let portfolio = initialPortfolio;


  }
}
