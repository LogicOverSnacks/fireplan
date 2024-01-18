import { Selector, StateContext } from '@ngxs/store';
import moment from 'moment';
import { defaultIfEmpty, forkJoin, map, tap } from 'rxjs';

import { CryptoApiService } from '~/core';
import { ClientAction, ClientsState } from '../clients.state';
import { Client } from '../clients.state.model';
import { PricesState, PricesStateModel } from '../prices.state';
import { Asset, CryptoAsset } from './assets.state.model';

export class AddOrUpdateAsset {
  static readonly type = '[Assets] AddAsset';
  constructor(public asset: Asset) {}
}

export class DeleteAsset {
  static readonly type = '[Assets] DeleteAsset';
  constructor(public id: string) {}
}

export class UpdateCryptoBalances {
  static readonly type = '[Assets] UpdateCryptoBalances';
}

export class AssetsState {
  @Selector([ClientsState.currentClient, PricesState])
  static total(client: Client, pricesState: PricesStateModel) {
    return client.assets
      .map(asset => AssetsState.getAssetPrice(asset, pricesState))
      .reduce((total, value) => total + value, 0);
  }

  static getAssetPrice(asset: Asset, pricesState: PricesStateModel) {
    switch (asset.type) {
      case 'cash':
        return asset.units;
      case 'bonds':
        return asset.units * pricesState.bonds.funds[asset.fund];
      case 'stocks':
        return asset.units * pricesState.stocks.funds[asset.fund];
      case 'crypto':
        switch (asset.cryptoType) {
          case 'btc':
            return asset.units * pricesState.crypto.btc;
          case 'eth':
          case 'eth_validator':
            return asset.units * pricesState.crypto.eth;
        }
    }
  }

  constructor(private cryptoApi: CryptoApiService) {}

  @ClientAction(AddOrUpdateAsset)
  addOrUpdateAsset(ctx: StateContext<Client>, action: AddOrUpdateAsset) {
    ctx.setState(client => ({
      ...client,
      assets: [
        ...client.assets.filter(({ id }) => id !== action.asset.id),
        action.asset
      ]
    }));
  }

  @ClientAction(DeleteAsset)
  deleteAsset(ctx: StateContext<Client>, action: DeleteAsset) {
    ctx.setState(client => ({
      ...client,
      assets: client.assets.filter(({ id }) => id !== action.id)
    }));
  }

  @ClientAction(UpdateCryptoBalances)
  updateCryptoBalances(ctx: StateContext<Client>, action: UpdateCryptoBalances) {
    const updates$ = ctx.getState()
      .assets
      .filter((asset): asset is CryptoAsset => asset.type === 'crypto')
      .map(asset => this.getCryptoBalance(asset).pipe(map(balance => ({ id: asset.id, units: balance ?? asset.units }))));

    return forkJoin(updates$).pipe(
      defaultIfEmpty([]),
      tap(updates => {
        const idsToUnits = new Map(updates.map(({ id, units }) => [id, units]));

        ctx.setState(client => ({
          ...client,
          lastFetch: moment(),
          assets: client.assets.map(asset => ({
            ...asset,
            units: idsToUnits.get(asset.id) ?? asset.units
          }))
        }));
      })
    );
  }

  // ngxsOnInit(ctx: StateContext<InvestmentsStateModel>) {
  //   ctx.dispatch([new UpdateCryptoBalances(), new UpdateCryptoPrices()]);
  // }

  private getCryptoBalance(asset: CryptoAsset) {
    switch (asset.cryptoType) {
      case 'btc': return this.cryptoApi.getBitcoinBalance([asset.address]);
      case 'eth': return this.cryptoApi.getEthereumBalance(asset.address);
      case 'eth_validator': return this.cryptoApi.getEthereumValidatorBalance(asset.address);
    }
  }
}
