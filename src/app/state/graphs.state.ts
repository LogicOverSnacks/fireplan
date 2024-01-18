import { Injectable } from '@angular/core';
import { Action, Selector, State, StateContext } from '@ngxs/store';

export type Graph = {
  /**
   * Value for each month
   */
  data: number[];
}

// TODO: graph generator that takes two params: avg gain and volatility, then draws from
// a normal distribution to model a graph

export type GraphsStateModel = {
  graphs: Record<string,Graph>;
  cash: string;
  bonds: string;
  stocks: string;
  crypto: string;
}

@State<GraphsStateModel>({
  name: 'graphs',
  defaults: {
    graphs: {
      'Sterling': { data: [] },
      'UK Government Bond Index': { data: [] },
      'S&P 500': { data: [] },
      'Gold': { data: [] }
    },
    cash: 'Sterling',
    bonds: 'UK Government Bond Index',
    stocks: 'S&P 500',
    crypto: 'Gold'
  }
})
@Injectable()
export class GraphsState {

}
