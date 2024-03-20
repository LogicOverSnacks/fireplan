import { animate, query, style, transition, trigger } from '@angular/animations';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { Store } from '@ngxs/store';
import { combineLatest, debounceTime, map, skip, startWith, takeUntil } from 'rxjs';

import { CoreModule, isDefined } from '~/core';
import { PeopleState } from '~/state/clients/people.state';
import { AddStage, DeleteStage, PatchStage, StagesState } from '~/state/clients/plans/stages.state';
import { Portfolio, Stage, WithdrawalScheme } from '~/state/clients/plans/stages.state.model';
import { DistributionComponent } from './distribution/distribution.component';
import { SchemeComponent } from './schemes/scheme.component';
import { StagesYearBarComponent } from './year-bar.component';

type PersonView = {
  id: string;
  name: string;
  incomeCtrl: FormControl<number | null>;
};

type StageView = {
  id: string;
  nameCtrl: FormControl<string>;
  endYear: number | undefined;
  incomeByPerson: PersonView[];
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
  styleUrl: './stages.component.scss',
  animations: [
    trigger('disabled', [
      transition(':enter', [])
    ]),
    trigger('name', [
      transition(':enter', [
        style({
          position: 'absolute',
          top: '34px',
          left: '40.5px',
          'font-size': '1rem',
          opacity: 0.87
        }),
        animate(300, style({
          position: 'absolute',
          top: '14px',
          'font-size': '0.875rem',
          left: '24px',
          opacity: 1
        }))
      ]),
      transition(':leave', [
        style({
          position: 'absolute',
          top: '14px',
          'font-size': '0.875rem',
          left: '24px',
          opacity: 1
        }),
        animate(300, style({
          position: 'absolute',
          top: '34px',
          left: '40.5px',
          'font-size': '1rem',
          opacity: 0.87
        }))
      ])
    ]),
    trigger('nameField', [
      transition(':enter', [
        query('input', style({ display: 'none' })),
        style({
          opacity: 0
        }),
        animate(300, style({
          opacity: 1
        }))
      ]),
      transition(':leave', [
        query('input', style({ display: 'none' })),
        style({
          opacity: 1
        }),
        animate(100, style({
          opacity: 0
        }))
      ])
    ])
  ]
})
export class StagesComponent {
  destroyRef = inject(DestroyRef)
  details$ = combineLatest([this.store.select(StagesState.stages), this.store.select(PeopleState.people)]);

  stages = toSignal(this.details$.pipe(
    map(([stages, people]) => stages.map((stage): StageView => {
      const incomeByPerson = people.map(person => ({
        id: person.id,
        name: person.name,
        incomeCtrl: new FormControl(stage.incomeByPerson?.[person.id] ?? null)
      }));

      const incomeChangesByPerson = incomeByPerson.map(person => person.incomeCtrl.valueChanges.pipe(
        startWith(person.incomeCtrl.value),
        map(value => [person.id, value] as const)
      ));

      combineLatest(incomeChangesByPerson)
        .pipe(
          skip(1),
          debounceTime(400),
          takeUntil(this.details$.pipe(skip(1))),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe(values => {
          this.store.dispatch(new PatchStage(stage.id, {
            incomeByPerson: Object.fromEntries(values.filter((pair): pair is [string, number] => isDefined(pair[1])))
          }));
        });

      const nameCtrl = new FormControl(stage.name, { nonNullable: true });
      nameCtrl.valueChanges
        .pipe(
          debounceTime(400),
          takeUntil(this.details$.pipe(skip(1))),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe(name => {
          this.store.dispatch(new PatchStage(stage.id, { name }));
        });

      return {
        id: stage.id,
        nameCtrl: nameCtrl,
        endYear: stage.endYear,
        incomeByPerson: incomeByPerson,
        scheme: stage.withdrawal,
        portfolioDistribution: stage.portfolioDistribution,
        portfolioDistributionFrequency: stage.portfolioRedistributionFrequency
      };
    }))
  ), { requireSync: true });
  archivedStages = toSignal(this.store.select(StagesState.finishedStages), { requireSync: true });
  currentYear = new Date().getUTCFullYear();

  constructor(private store: Store) {}

  canAddStage(previousStage?: StageView, nextStage?: StageView) {
    const minYear = previousStage?.endYear ?? this.currentYear;
    return nextStage?.endYear === undefined || minYear + 1 < nextStage?.endYear;
  }

  addStage(previousStage?: StageView, nextStage?: StageView) {
    if (!this.canAddStage(previousStage, nextStage))
      throw new Error(`Cannot add stage because dates are too close`);

    const stage: Stage = previousStage
      ? {
        id: crypto.randomUUID(),
        name: 'Unnamed',
        deletable: true,
        endYear: nextStage ? previousStage.endYear! + 1 : undefined
      }
      : {
        id: crypto.randomUUID(),
        name: 'Unnamed',
        deletable: true,
        endYear: nextStage ? this.currentYear + 1 : undefined,
        incomeByPerson: {},
        portfolioDistribution: { cash: 0.1, bonds: 0.2, stocks: 0.7, crypto: 0 },
        portfolioRedistributionFrequency: 1,
        withdrawal: {
          type: 'constant',
          initialRate: 0
        }
      };
    this.store.dispatch(new AddStage(stage, previousStage?.id ?? null));
  }

  deleteStage(stage: Stage | StageView) {
    this.store.dispatch(new DeleteStage(stage.id));
  }

  getIncome(stages: StageView[], index: number, personId: string): number {
    return stages.slice(0, index + 1)
      .map(stage => stage.incomeByPerson.find(({ id }) => id === personId)?.incomeCtrl.value)
      .filter(isDefined)
      .at(-1)
      ?? 0;
  }

  updateYear(id: string, endYear: number) {
    this.store.dispatch(new PatchStage(id, { endYear }));
  }
}
