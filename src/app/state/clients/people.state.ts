import { Selector, StateContext, createSelector } from '@ngxs/store';

import { ClientAction, ClientsState } from '../clients.state';
import { Client } from '../clients.state.model';
import { Person } from './people.state.model';
import { mapRecord } from '~/core';
import { Plan } from './plans.state.model';
import moment from 'moment';

export class AddOrUpdatePerson {
  static readonly type = '[People] AddOrUpdatePerson';
  constructor(public person: Person) {}
}

export class DeletePerson {
  static readonly type = '[People] DeletePerson';
  constructor(public id: string) {}
}

export class PeopleState {
  static maxYear(standardDeviations: number) {
    return createSelector(
      [ClientsState.currentClient],
      (client: Client) => Math.max(
        ...client.people.map(person =>
          Math.ceil(person.dateOfBirth.year() + person.lifeExpectancy.mean + person.lifeExpectancy.variance*standardDeviations)
        ),
        moment().year()
      )
    );
  }

  @Selector([ClientsState.currentClient])
  static people(client: Client) {
    return client.people;
  }

  @ClientAction(AddOrUpdatePerson)
  addOrUpdatePerson(ctx: StateContext<Client>, action: AddOrUpdatePerson) {
    ctx.setState(client => ({
      ...client,
      people: [...client.people.filter(({ id }) => id !== action.person.id), action.person]
    }));
  }

  @ClientAction(DeletePerson)
  deletePerson(ctx: StateContext<Client>, action: DeletePerson) {
    ctx.setState(client => ({
      ...client,
      people: client.people.filter(({ id }) => id !== action.id),
      plans: mapRecord(client.plans, ([id, plan]) => [id, {
        ...plan,
        stages: plan.stages?.map(stage => {
          const updatedStage = { ...stage };

          if (updatedStage.incomeByPerson && updatedStage.incomeByPerson[action.id] !== undefined)
            delete updatedStage.incomeByPerson[action.id];

          return updatedStage;
        })
      } as Plan])
    }));
  }
}
