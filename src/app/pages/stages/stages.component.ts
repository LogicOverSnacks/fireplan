import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { Store } from '@ngxs/store';
import { map, withLatestFrom } from 'rxjs';

import { CoreModule, isDefined } from '~/core';
import { PeopleState } from '~/state/clients/people.state';
import { AddStage, PatchStage, StagesState } from '~/state/clients/plans/stages.state';
import { Portfolio, Stage, WithdrawalScheme } from '~/state/clients/plans/stages.state.model';
import { DistributionComponent } from './distribution/distribution.component';
import { SchemeComponent } from './schemes/scheme.component';
import { StagesYearBarComponent } from './year-bar.component';

type StageView = {
  id: string;
  name: string;
  endYear: number | undefined;
  income: Record<string, [string, FormControl<number | null>]>;
  scheme: WithdrawalScheme | undefined;
  portfolioDistribution: Portfolio | undefined;
  portfolioDistributionFrequency: number | undefined;
};

@Component({
  selector: 'app-stages',
  standalone: true,
  imports: [
    MatExpansionModule,
    MatListModule,

    CoreModule,
    DistributionComponent,
    SchemeComponent,
    StagesYearBarComponent
  ],
  templateUrl: './stages.component.html',
  styleUrl: './stages.component.scss'
})
export class StagesComponent {
  people = this.store.select(PeopleState.people);
  stages = this.store.select(StagesState.stages).pipe(
    withLatestFrom(this.people),
    map(([stages, people]) => stages.map((stage): StageView => ({
      id: stage.id,
      name: stage.name,
      endYear: stage.endYear,
      // expensesControl: new FormControl(stage.expensesPerYear),
      income: Object.fromEntries(people.map(person => [
        person.id,
        [person.name, new FormControl(stage.incomeByPerson?.[person.id] ?? null)]
      ])),
      scheme: stage.withdrawal,
      portfolioDistribution: stage.portfolioDistribution,
      portfolioDistributionFrequency: stage.portfolioRedistributionFrequency
    })))
  );
  archivedStages = this.store.select(StagesState.finishedStages);
  currentYear = new Date().getUTCFullYear();

  constructor(private store: Store) {}

  canAddStage(previousStage?: StageView, nextStage?: StageView) {
    const minYear = previousStage?.endYear ?? new Date().getUTCFullYear();
    return nextStage?.endYear === undefined || minYear + 1 < nextStage?.endYear;
  }

  addStage(previousStage?: StageView, nextStage?: StageView) {
    if (!this.canAddStage(previousStage, nextStage))
      throw new Error(`Cannot add stage because dates are too close`);

    const thisYear = new Date().getUTCFullYear();

    const stage: Stage = previousStage
      ? {
        id: crypto.randomUUID(),
        name: 'Test',
        deletable: true,
        endYear: nextStage ? previousStage.endYear! + 1 : thisYear + 1
      }
      : {
        id: crypto.randomUUID(),
        name: 'Test',
        deletable: true,
        endYear: nextStage ? thisYear + 1 : undefined,
        incomeByPerson: {},
        portfolioDistribution: { cash: 0.1, bonds: 0.2, stocks: 0.7, crypto: 0 },
        portfolioRedistributionFrequency: 1,
        withdrawal: {
          type: 'dynamic',
          targetPercentage: 5,
          adjustmentPercentage: 5,
          thresholdPercentage: 20,
          minimumRate: 0
        }
      };
    this.store.dispatch(new AddStage(stage, previousStage?.id ?? null));
  }

  deleteStage(stage: any) {

  }

  // getExpenses(stages: StageView[], index: number): number {
  //   return stages.slice(0, index + 1)
  //     .map(stage => stage.expensesControl.value)
  //     .filter(isDefined)
  //     .at(-1)
  //     ?? 0;
  // }

  getIncome(stages: StageView[], index: number, personId: string): number {
    return stages.slice(0, index + 1)
      .map(stage => stage.income[personId]?.[1].value)
      .filter(isDefined)
      .at(-1)
      ?? 0;
  }

  updateYear(id: string, endYear: number) {
    this.store.dispatch(new PatchStage(id, { endYear }));
  }
}
