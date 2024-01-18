import { Component } from '@angular/core';
import { MatDividerModule } from '@angular/material/divider';
import { Select, Store } from '@ngxs/store';
import { Observable, combineLatest, map } from 'rxjs';

import { CoreModule } from '~/core/core.module';
// import { Person } from '~/state/clients.state.model';
// import { InvestmentsState } from '~/state/clients/investments.state';
import { PeopleState } from '~/state/clients/people.state';
// import { Stage, StrategyState } from '~/state/clients/strategy.state';

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

  constructor(private store: Store) {}
}
