import { Selector, StateContext } from '@ngxs/store';

import { ClientAction, ClientsState } from '../clients.state';
import { Client } from '../clients.state.model';
import { FullPlan, Plan, UnrolledPlan } from './plans.state.model';

export class AddOrReplacePlan {
  static readonly type = '[Plans] AddOrReplacePlan';
  constructor(public id: string, public plan: Plan) {}
}

export class UpdatePlan {
  static readonly type = '[Plans] UpdatePlan';
  constructor(public id: string, public inheritsFrom: string | null, public name: string) {}
}

export class DeletePlan {
  static readonly type = '[Plans] DeletePlan';
  constructor(public id: string) {}
}

export class ChangeSelectedPlan {
  static readonly type = '[Plans] ChangeSelectedPlan';
  constructor(public id: string | null) {}
}

export class PlansState {
  @Selector([ClientsState.currentClient])
  static plans(client: Client) {
    return client.plans;
  }

  @Selector([ClientsState.currentClient])
  static selectedPlanId(client: Client) {
    return client.selectedPlanId;
  }

  @Selector([ClientsState.currentClient])
  static currentPlan(client: Client) {
    if (client.selectedPlanId === null) throw new Error(`No plan selected`);
    return PlansState.unrollPlan(client.plans, client.plans[client.selectedPlanId]);
  }

  static unrollPlan(plans: Record<string, Plan>, plan: Plan): UnrolledPlan {
    if (plan.inheritsFrom === null) return plan;

    return {
      ...this.unrollPlan(plans, plans[plan.inheritsFrom]),
      ...plan
    };
  }

  @ClientAction(AddOrReplacePlan)
  addOrReplacePlan(ctx: StateContext<Client>, action: AddOrReplacePlan) {
    ctx.setState(client => ({
      ...client,
      plans: {
        ...client.plans,
        [action.id]: action.plan
      }
    }));
  }

  @ClientAction(UpdatePlan)
  updatePlan(ctx: StateContext<Client>, action: UpdatePlan) {
    ctx.setState(client => {
      const plan = client.plans[action.id];
      if (!plan)
        throw new Error(`Plan with id ${action.id} doesn't exist`);

      let newPlan: Plan;

      if (action.inheritsFrom === null) {
        if (!plan.stages)
          throw new Error(`Cannot remove parent from plan with id ${action.id} because there are missing parts`);

        newPlan = {
          inheritsFrom: null,
          name: action.name,
          stages: plan.stages
        };
      } else {
        newPlan = {
          ...plan,
          inheritsFrom: action.inheritsFrom,
          name: action.name
        };
      }

      return {
        ...client,
        plans: {
          ...client.plans,
          [action.id]: newPlan
        }
      };
    });
  }

  @ClientAction(DeletePlan)
  deletePlan(ctx: StateContext<Client>, action: DeletePlan) {
    ctx.setState(client => {
      const newClient = { ...client };

      const removedPlan = newClient.plans[action.id];
      delete newClient.plans[action.id];

      if (newClient.selectedPlanId === action.id)
        newClient.selectedPlanId = null;

      for (const id of Object.keys(newClient.plans)) {
        if (newClient.plans[id].inheritsFrom === action.id) {
          if (removedPlan.inheritsFrom === null) {
            newClient.plans[id] = {
              ...removedPlan,
              ...newClient.plans[id],
              inheritsFrom: null
            };
          } else {
            newClient.plans[id].inheritsFrom = removedPlan.inheritsFrom;
          }
        }
      }

      return newClient;
    });
  }

  @ClientAction(ChangeSelectedPlan)
  changeSelectedPlan(ctx: StateContext<Client>, action: ChangeSelectedPlan) {
    ctx.setState(client => ({
      ...client,
      selectedPlanId: action.id && client.plans[action.id]
        ? action.id
        : null
    }));
  }
}
