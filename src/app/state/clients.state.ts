import { Injectable } from '@angular/core';
import { Action, ActionOptions, ActionType, Selector, State, StateContext, StateOperator } from '@ngxs/store';

import { Client, ClientsStateModel } from './clients.state.model';
import { Plan } from './clients/plans.state.model';

export class IncrementMaxClientId {
  static readonly type = '[Clients] IncrementMaxApiId';
}

export class AddClient {
  static readonly type = '[Clients] AddClient';
  constructor(public id: number) {}
}

export class DeleteClient {
  static readonly type = '[Clients] DeleteClient';
  constructor(public id: number) {}
}

export class UpdateClientName {
  static readonly type = '[Clients] UpdateClientName';
  constructor(public id: number, public name: string) {}
}

export class ChangeSelectedClient {
  static readonly type = '[Clients] ChangeSelectedClient';
  constructor(public id: number) {}
}

const createClient = (id: number) => {
  const planId = crypto.randomUUID();

  return {
    archived: false,
    name: `Client ${id}`,
    currency: 'GBP',
    people: [],
    plans: {
      [planId]: {
        inheritsFrom: null,
        name: 'Default',
        stages: []
      }
    },
    selectedPlanId: planId,
    assets: []
  } satisfies Client;
};

@State<ClientsStateModel>({
  name: 'clients',
  defaults: {
    clients: {
      0: createClient(0)
    },
    maxClientId: 0,
    selectedClientId: 0
  }
})
@Injectable()
export class ClientsState {
  @Selector()
  static maxClientId(state: ClientsStateModel) {
    return state.maxClientId;
  }

  @Selector()
  static clients(state: ClientsStateModel) {
    return state.clients;
  }

  @Selector()
  static currentClientId(state: ClientsStateModel) {
    return state.selectedClientId;
  }

  @Selector()
  static currentClient(state: ClientsStateModel) {
    if (state.selectedClientId === null) throw new Error(`No client selected`);
    return state.clients[state.selectedClientId];
  }

  @Selector()
  static currentCurrency(state: ClientsStateModel) {
    if (state.selectedClientId === null) return 'GBP';
    return state.clients[state.selectedClientId].currency;
  }

  @Action(IncrementMaxClientId)
  incrementMaxCLientId(ctx: StateContext<ClientsStateModel>, action: IncrementMaxClientId) {
    ctx.setState(state => ({
      ...state,
      maxClientId: state.maxClientId + 1
    }));
  }

  @Action(AddClient)
  addClient(ctx: StateContext<ClientsStateModel>, action: AddClient) {
    ctx.setState(state => {
      const newState = { ...state };
      if (newState.clients[action.id])
        throw new Error(`Client with id ${action.id} already exists`);

      newState.clients[action.id] = createClient(action.id);
      return newState;
    });
  }

  @Action(DeleteClient)
  deleteClient(ctx: StateContext<ClientsStateModel>, action: DeleteClient) {
    ctx.setState(state => {
      const newState = { ...state };

      delete newState.clients[action.id];
      if (newState.selectedClientId === action.id) {
        const ids = Object.keys(newState.clients) as unknown as number[];
        newState.selectedClientId = ids[0] ?? null;
      }
      return newState;
    });
  }

  @Action(UpdateClientName)
  updateClientName(ctx:StateContext<ClientsStateModel>, action: UpdateClientName) {
    ctx.setState(state => ({
      ...state,
      clients: {
        ...state.clients,
        [action.id]: {
          ...state.clients[action.id],
          name: action.name
        }
      }
    }));
  }

  @Action(ChangeSelectedClient)
  changeSelectedClient(ctx: StateContext<ClientsStateModel>, action: ChangeSelectedClient) {
    ctx.setState(state => {
      if (!state.clients[action.id]) throw new Error(`Client with id ${action.id} doesn't exist`)

      return {
        ...state,
        selectedClientId: action.id
      }
    });
  }
}

const getActionMethodName = (action: ActionType) => {
  const actionName = action.type.replace(/[^a-zA-Z0-9]+/g, '').substring(0, 128);
  return `${actionName}_${Math.random().toString(36).slice(2)}`;
};

export function ClientAction(
  actionType: ActionType,
  options?: ActionOptions
): MethodDecorator {
  return function(
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const original = descriptor.value;
    const methodName = getActionMethodName(actionType);

    (ClientsState.prototype as any)[methodName] = function(ctx: StateContext<ClientsStateModel>, action: ActionType) {
      const clientStateCtx: StateContext<Client> = {
        getState: () => {
          const { clients, selectedClientId } = ctx.getState();
          if (selectedClientId === null) throw new Error(`No client selected`);

          return clients[selectedClientId];
        },

        setState: (val: Client | StateOperator<Client>) => {
          const { clients: { clients, selectedClientId } } = ctx.setState(state => {
            if (state.selectedClientId === null) throw new Error(`No client selected`);

            return {
              ...state,
              clients: {
                ...state.clients,
                [state.selectedClientId]: typeof val === 'function'
                  ? val(state.clients[state.selectedClientId])
                  : val
              }
            };
          }) as unknown as { clients: ClientsStateModel; };
          if (selectedClientId === null) throw new Error(`No client selected`);

          return clients[selectedClientId];
        },

        patchState: (val: Partial<Client>) => {
          const { clients: { clients, selectedClientId } } = ctx.setState(state => {
            if (state.selectedClientId === null) throw new Error(`No client selected`);

            return {
              ...state,
              clients: {
                ...state.clients,
                [state.selectedClientId]: {
                  ...state.clients[state.selectedClientId],
                  ...val
                }
              }
            };
          }) as unknown as { clients: ClientsStateModel; };
          if (selectedClientId === null) throw new Error(`No client selected`);

          return clients[selectedClientId];
        },

        dispatch: (actions: any | any[]) => ctx.dispatch(actions)
      };

      return original.apply(this, [clientStateCtx, action]);
    };

    Action(actionType, options)({ constructor: ClientsState }, methodName, {});

    return descriptor;
  };
}

export function PlanAction(
  actionType: ActionType,
  options?: ActionOptions
): MethodDecorator {
  return function(
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const original = descriptor.value;
    const methodName = getActionMethodName(actionType);

    (ClientsState.prototype as any)[methodName] = function(rootCtx: StateContext<ClientsStateModel>, action: ActionType) {
      const planStateCtx: StateContext<Plan> = {
        getState: () => {
          const { clients, selectedClientId } = rootCtx.getState();
          if (selectedClientId === null) throw new Error(`No client selected`);

          const { plans, selectedPlanId } = clients[selectedClientId];
          if (selectedPlanId === null) throw new Error(`No plan selected for client ${selectedClientId}`);

          return plans[selectedPlanId];
        },

        setState: (val: Plan | StateOperator<Plan>) => {
          const { clients: { clients, selectedClientId } } = rootCtx.setState(state => {
            if (state.selectedClientId === null) throw new Error(`No client selected`);

            const { plans, selectedPlanId } = state.clients[state.selectedClientId];
            if (selectedPlanId === null) throw new Error(`No plan selected for client ${state.selectedClientId}`);

            return {
              ...state,
              clients: {
                ...state.clients,
                [state.selectedClientId]: {
                  ...state.clients[state.selectedClientId],
                  plans: {
                    ...plans,
                    [selectedPlanId]: typeof val === 'function' ? val(plans[selectedPlanId]) : val
                  }
                }
              }
            };
          }) as unknown as { clients: ClientsStateModel; };
          if (selectedClientId === null) throw new Error(`No client selected`);

          const { plans, selectedPlanId } = clients[selectedClientId];
          if (selectedPlanId === null) throw new Error(`No plan selected for client ${selectedClientId}`);

          return plans[selectedPlanId];
        },

        patchState: (val: Partial<Plan>) => {
          const { clients: { clients, selectedClientId } } = rootCtx.setState(state => {
            if (state.selectedClientId === null) throw new Error(`No client selected`);

            const { plans, selectedPlanId } = state.clients[state.selectedClientId];
            if (selectedPlanId === null) throw new Error(`No plan selected for client ${state.selectedClientId}`);

            const plan = plans[selectedPlanId];
            let newPlan: Plan;

            if (val.inheritsFrom === null) {
              if (!plan.stages)
                throw new Error(`Cannot remove parent from plan with id ${selectedPlanId} because there are missing parts`);

              newPlan = {
                inheritsFrom: null,
                name: val.name ?? plan.name,
                stages: plan.stages
              };
            } else {
              if (plan.inheritsFrom === null) {
                newPlan = { ...plan, ...val };
              } else {
                newPlan = {
                  ...plan,
                  ...val,
                  inheritsFrom: val.inheritsFrom ?? plan.inheritsFrom
                };
              }
            }

            return {
              ...state,
              clients: {
                ...state.clients,
                [state.selectedClientId]: {
                  ...state.clients[state.selectedClientId],
                  plans: {
                    ...plans,
                    [selectedPlanId]: newPlan
                  }
                }
              }
            };
          }) as unknown as { clients: ClientsStateModel; };
          if (selectedClientId === null) throw new Error(`No client selected`);

          const { plans, selectedPlanId } = clients[selectedClientId];
          if (selectedPlanId === null) throw new Error(`No plan selected for client ${selectedClientId}`);

          return plans[selectedPlanId];
        },

        dispatch: (actions: any | any[]) => rootCtx.dispatch(actions)
      };

      return original.apply(this, [planStateCtx, action]);
    };

    Action(actionType, options)({ constructor: ClientsState }, methodName, {});

    return descriptor;
  };
}
