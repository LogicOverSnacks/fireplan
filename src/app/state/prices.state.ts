import { Injectable } from '@angular/core';
import { Action, Selector, State, StateContext } from '@ngxs/store';
import { tap } from 'rxjs';

import { CryptoApiService, FundsApiService } from '~/core';
import { ClientsState } from './clients.state';
import { Currency } from './clients.state.model';

export class UpdateCurrencyPrices {
  static readonly type = '[Prices] UpdateCurrencyPrices';
}

export class UpdateCryptoPrices {
  static readonly type = '[Prices] UpdateCryptoPrices';
}

export type PricesStateModel = {
  currencies: Record<string, number>;
  bonds: {
    funds: Record<string, number>;
  };
  stocks: {
    funds: Record<string, number>;
  };
  crypto: {
    btc: number;
    eth: number;
  };
};

@State<PricesStateModel>({
  name: 'prices',
  defaults: {
    currencies: { GBP: 1, EUR: 0.8576, USD: 0.7888 },
    bonds: { funds: {} },
    stocks: { funds: {} },
    crypto: {
      btc: 33668.07,
      eth: 1999.19
    }
  }
})
@Injectable()
export class PricesState {
  @Selector()
  static getBtcPrice(state: PricesStateModel) {
    return state.crypto.btc;
  }

  @Selector()
  static getEthPrice(state: PricesStateModel) {
    return state.crypto.eth;
  }

  @Selector([ClientsState.currentCurrency, PricesState])
  static currentCurrencyPrice(currency: Currency, state: PricesStateModel) {
    return state.currencies[currency];
  }

  constructor(private cryptoApi: CryptoApiService, private fundsApi: FundsApiService) {}

  @Action(UpdateCurrencyPrices)
  updateCurrencyPrices(ctx: StateContext<PricesStateModel>, action: UpdateCurrencyPrices) {
    return this.fundsApi.getCurrenciesInGbp(['EUR', 'USD']).pipe(
      tap(currencies => {
        ctx.setState(state => ({
          ...state,
          currencies: {
            ...state.currencies,
            ...currencies
          }
        }))
      })
    );
  }

  @Action(UpdateCryptoPrices)
  updateCryptoPrices(ctx: StateContext<PricesStateModel>, action: UpdateCryptoPrices) {
    return this.cryptoApi.getCryptoPrices().pipe(
      tap(({ btc, eth }) => {
        ctx.setState(state => ({
          ...state,
          crypto: { btc, eth }
        }))
      })
    );
  }
}
