import { Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { Select, Store } from '@ngxs/store';
import { Observable, map } from 'rxjs';

import { isDefined } from '~/core';
import { CoreModule } from '~/core/core.module';
import { Stage, StrategyState, UpdateStageEndYear } from '~/state/clients/strategy.state';
import { StrategyYearBarComponent } from './year-bar.component';

type StageView = {
  name: string;
  endYear: number;
  expensesControl: FormControl<number | null>;
  incomeControl: FormControl<number | null>;
}

@Component({
  selector: 'app-strategy',
  standalone: true,
  imports: [
    MatExpansionModule,
    MatListModule,

    CoreModule,
    StrategyYearBarComponent
  ],
  templateUrl: './strategy.component.html',
  styleUrl: './strategy.component.scss'
})
export class StrategyComponent {
  stages = this.store.select(StrategyState.stages).pipe(
    takeUntilDestroyed(),
    map(stages => stages.map(stage => ({
      name: stage.name,
      endYear: stage.endYear,
      expensesControl: new FormControl(stage.expensesPerYear),
      incomeControl: new FormControl(stage.incomePerYear)
    } as StageView)))
  );

  @Select(StrategyState.finishedStages)
  archivedStages!: Observable<Stage[]>;

  currentYear = new Date().getUTCFullYear();

  constructor(private store: Store) {}

  addStage() {

  }

  deleteStage(stage: any) {

  }

  getExpenses(stages: StageView[], index: number): number {
    return stages.slice(0, index + 1)
      .map(stage => stage.expensesControl.value)
      .filter(isDefined)
      .at(-1)
      ?? 0;
  }

  getIncome(stages: StageView[], index: number): number {
    return stages.slice(0, index + 1)
      .map(stage => stage.incomeControl.value)
      .filter(isDefined)
      .at(-1)
      ?? 0;
  }

  updateYear(stage: StageView, year: number) {
    this.store.dispatch(new UpdateStageEndYear(stage.name, year));
  }
}
