import { Selector, StateContext } from '@ngxs/store';

import { ClientAction, ClientsState } from '../clients.state';
import { Client } from '../clients.state.model';
import { Plan } from './plans.state.model';

export class AddOrUpdatePlan {
  static readonly type = '[Plans] AddOrUpdatePlan';
  constructor(public id: string, public plan: Plan) {}
}

export class DeletePlan {
  static readonly type = '[Plans] DeletePlan';
  constructor(public id: string) {}
}

export class ChangeSelectedPlan {
  static readonly type = '[Plans] ChangeSelectedPlan';
  constructor(public id: string | null) {}
}

export class UpdatePlanParent {
  static readonly type = '[Plans] UpdatePlanParent';
  constructor(public id: string, public parentId: string | null) {}
}

export class UpdatePlanName {
  static readonly type = '[Plans] UpdatePlanName';
  constructor(public id: string, public name: string) {}
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
    return client.plans[client.selectedPlanId];
  }

  @ClientAction(AddOrUpdatePlan)
  addOrUpdatePlan(ctx: StateContext<Client>, action: AddOrUpdatePlan) {
    ctx.setState(client => {
      const newClient = { ...client };
      if (newClient.plans[action.id])
        throw new Error(`Plan with id ${action.id} already exists`);

      newClient.plans[action.id] = action.plan;
      return newClient;
    });
  }

  @ClientAction(DeletePlan)
  deletePlan(ctx: StateContext<Client>, action: DeletePlan) {
    ctx.setState(client => {
      const newClient = { ...client };

      delete newClient.plans[action.id];
      if (newClient.selectedPlanId === action.id)
        newClient.selectedPlanId = null;

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

  @ClientAction(UpdatePlanParent)
  updatePlanParent(ctx: StateContext<Client>, action: UpdatePlanParent) {
    ctx.setState(client => {
      const plan = client.plans[action.id];
      if (!plan) throw new Error(`Plan with id ${action.id} doesn't exist`);

      return {
        ...client,
        plans: {
          ...client.plans,
          [action.id]: {
            ...plan,
            inheritsFrom: action.parentId
          }
        }
      };
    });
  }

  @ClientAction(UpdatePlanName)
  updatePlanName(ctx: StateContext<Client>, action: UpdatePlanName) {
    ctx.setState(client => {
      const plan = client.plans[action.id];
      if (!plan) throw new Error(`Plan with id ${action.id} doesn't exist`);

      return {
        ...client,
        plans: {
          ...client.plans,
          [action.id]: {
            ...plan,
            name: action.name
          }
        }
      };
    });
  }
}
