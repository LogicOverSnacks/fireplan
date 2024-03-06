import { Injectable } from '@angular/core';
import { Action, Selector, State, StateContext } from '@ngxs/store';

import constantGraph from '~assets/data/constant.json';
import inflationGraph from '~assets/data/uk_inflation.json';
import bondsGraph from '~assets/data/us_bond_yield.json';
import sAndP500Graph from '~assets/data/s_and_p_500.json';
import goldGraph from '~assets/data/gold.json';

export type Graph = {
  data: {
    date: string;
    value: number;
  }[];
};

export class AddOrUpdateGraph {
  static readonly type = '[Graphs] AddGraph';
  constructor(public name: string, public graph: Graph) {}
}

export class RenameGraph {
  static readonly type = '[Graphs] RenameGraph';
  constructor(public oldName: string, public newName: string) {}
}

export class DeleteGraph {
  static readonly type = '[Graphs] DeleteGraph';
  constructor(public name: string) {}
}

export class SetInflationGraph {
  static readonly type = '[Graphs] SetInflationGraph';
  constructor(public name: string) {}
}

export class SetCashGraph {
  static readonly type = '[Graphs] SetCashGraph';
  constructor(public name: string) {}
}

export class SetBondsGraph {
  static readonly type = '[Graphs] SetBondsGraph';
  constructor(public name: string) {}
}

export class SetStocksGraph {
  static readonly type = '[Graphs] SetStocksGraph';
  constructor(public name: string) {}
}

export class SetCryptoGraph {
  static readonly type = '[Graphs] SetCryptoGraph';
  constructor(public name: string) {}
}

// TODO: graph generator that takes two params: avg gain and volatility, then draws from
// a normal distribution to model a graph
// monte-carlo generator, sampling from real data

export type GraphsStateModel = {
  graphs: Record<string, Graph>;
  inflation: string;
  cash: string;
  bonds: string;
  stocks: string;
  crypto: string;
};

const defaultState = {
  graphs: {
    'Constant': { data: constantGraph.map(data => ({ date: data.date, value: 1 + data.rate / 100 })) },
    'UK Inflation': {
      data: inflationGraph.map(data => ({
        date: data.date,
        value: Math.pow(1 + data.rate / 100, 1/12)
      }))
    },
    'US 10-year Treasury Bonds': {
      data: bondsGraph.map(data => ({
        date: data.date,
        value: Math.pow(1 + data.rate / 100, 1/12)
      }))
    },
    'S&P 500': { data: sAndP500Graph.map(data => ({ date: data.date, value: 1 + data.rate / 100 })) },
    'Gold': { data: constantGraph.map(data => ({ date: data.date, value: 1 + data.rate / 100 })) },
    // { data: goldGraph.map(data => ({ date: data.date, value: 1 + data.rate / 100 })) }
  },
  inflation: 'UK Inflation',
  cash: 'Constant',
  bonds: 'US 10-year Treasury Bonds',
  stocks: 'S&P 500',
  crypto: 'Gold'
} satisfies GraphsStateModel;

@State<GraphsStateModel>({
  name: 'graphs',
  defaults: defaultState
})
@Injectable()
export class GraphsState {
  @Selector()
  static graphs(state: GraphsStateModel) {
    return state.graphs;
  }

  @Selector()
  static inflation(state: GraphsStateModel) {
    return [state.inflation, state.graphs[state.inflation]] as const;
  }

  @Selector()
  static cash(state: GraphsStateModel) {
    return [state.cash, state.graphs[state.cash]] as const;
  }

  @Selector()
  static bonds(state: GraphsStateModel) {
    return [state.bonds, state.graphs[state.bonds]] as const;
  }

  @Selector()
  static stocks(state: GraphsStateModel) {
    return [state.stocks, state.graphs[state.stocks]] as const;
  }

  @Selector()
  static crypto(state: GraphsStateModel) {
    return [state.crypto, state.graphs[state.crypto]] as const;
  }

  @Action(AddOrUpdateGraph)
  addOrUpdateGraph(ctx: StateContext<GraphsStateModel>, action: AddOrUpdateGraph) {
    ctx.setState(state => ({
      ...state,
      graphs: {
        ...state.graphs,
        [action.name]: action.graph
      }
    }));
  }

  @Action(RenameGraph)
  renameGraph(ctx: StateContext<GraphsStateModel>, action: RenameGraph) {
    ctx.setState(state => {
      if (!state.graphs[action.oldName])
        throw new Error(`Graph '${action.newName}' doesn't exist`);
      if (state.graphs[action.newName])
        throw new Error(`Graph '${action.newName}' already exists`);

      const updatedState = { ...state };
      updatedState.graphs[action.newName] = updatedState.graphs[action.oldName];
      delete updatedState.graphs[action.oldName];

      if (updatedState.inflation === action.oldName)
        updatedState.inflation = action.newName;
      if (updatedState.cash === action.oldName)
        updatedState.cash = action.newName;
      if (updatedState.bonds === action.oldName)
        updatedState.bonds = action.newName;
      if (updatedState.stocks === action.oldName)
        updatedState.stocks = action.newName;
      if (updatedState.crypto === action.oldName)
        updatedState.crypto = action.newName;

      return updatedState;
    });
  }

  @Action(DeleteGraph)
  deleteGraph(ctx: StateContext<GraphsStateModel>, action: DeleteGraph) {
    ctx.setState(state => {
      const updatedState = { ...state };
      delete updatedState.graphs[action.name];
      if (updatedState.inflation === action.name)
        updatedState.inflation = defaultState.inflation;
      if (updatedState.cash === action.name)
        updatedState.cash = defaultState.cash;
      if (updatedState.bonds === action.name)
        updatedState.bonds = defaultState.bonds;
      if (updatedState.stocks === action.name)
        updatedState.stocks = defaultState.stocks;
      if (updatedState.crypto === action.name)
        updatedState.crypto = defaultState.crypto;

      return updatedState;
    });
  }

  @Action(SetInflationGraph)
  setInflationGraph(ctx: StateContext<GraphsStateModel>, action: SetInflationGraph) {
    ctx.setState(state => {
      if (!state.graphs[action.name])
        throw new Error(`Cannot set inflation graph to non-existent graph '${action.name}'`);

      return {
        ...state,
        inflation: action.name
      };
    });
  }

  @Action(SetCashGraph)
  setCashGraph(ctx: StateContext<GraphsStateModel>, action: SetCashGraph) {
    ctx.setState(state => {
      if (!state.graphs[action.name])
        throw new Error(`Cannot set cash graph to non-existent graph '${action.name}'`);

      return {
        ...state,
        cash: action.name
      };
    });
  }

  @Action(SetBondsGraph)
  setBondsGraph(ctx: StateContext<GraphsStateModel>, action: SetBondsGraph) {
    ctx.setState(state => {
      if (!state.graphs[action.name])
        throw new Error(`Cannot set bonds graph to non-existent graph '${action.name}'`);

      return {
        ...state,
        bonds: action.name
      };
    });
  }

  @Action(SetStocksGraph)
  setStocksGraph(ctx: StateContext<GraphsStateModel>, action: SetStocksGraph) {
    ctx.setState(state => {
      if (!state.graphs[action.name])
        throw new Error(`Cannot set stocks graph to non-existent graph '${action.name}'`);

      return {
        ...state,
        stocks: action.name
      };
    });
  }

  @Action(SetCryptoGraph)
  setCryptoGraph(ctx: StateContext<GraphsStateModel>, action: SetCryptoGraph) {
    ctx.setState(state => {
      if (!state.graphs[action.name])
        throw new Error(`Cannot set crypto graph to non-existent graph '${action.name}'`);

      return {
        ...state,
        crypto: action.name
      };
    });
  }
}
