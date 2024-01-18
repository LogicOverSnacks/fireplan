type BaseAsset = {
  id: string;
  name: string;
  taxStatus: 'isa' | 'pension' | 'general';
  units: number;
}

export type CashAsset = BaseAsset & {
  type: 'cash';
}

export type BondsAsset = BaseAsset & {
  type: 'bonds';
  fund: string;
}

export type StocksAsset = BaseAsset & {
  type: 'stocks';
  fund: string;
}

export type CryptoAssetType = 'btc' | 'eth' | 'eth_validator';

export type CryptoAsset = BaseAsset & {
  type: 'crypto';
  cryptoType: CryptoAssetType;
  address: string;
}

export type Asset = CashAsset | BondsAsset | StocksAsset | CryptoAsset;
