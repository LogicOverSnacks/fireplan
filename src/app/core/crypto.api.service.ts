import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CryptoApiService {
  constructor(private http: HttpClient) {}

  getBitcoinBalance(addresses: string[]) {
    const url = `https://blockchain.info/balance?active=${addresses.join('|')}`;
    return this.http.get<Record<string, { final_balance: number; }>>(url).pipe(
      map(data =>
        Object.values(data)
          .map(({ final_balance }) => final_balance)
          .reduce((value, total) => value + total, 0)
          * 1e-10
      )
    );
  }

  getEthereumBalance(address: string) {
    const url = `https://api.etherscan.io/api?module=account&action=balance&address=${address}`;
    return this.http.get<{ status: '0' | '1'; result: string; }>(url).pipe(
      map(data => data.status === '1'
        ? +data.result * 1e-18
        : null
      )
    );
  }

  getEthereumValidatorBalance(address: string) {
    const url = `https://beaconcha.in/api/v1/validator/${address}/balancehistory?limit=1`;
    return this.http.get<{ status: 'OK'; data: { balance: number; }[]; }>(url).pipe(
      map(data => data.status === 'OK'
        ? data.data[0].balance * 1e-9
        : null
      )
    );
  }

  getCryptoPrices() {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=gbp`;
    return this.http.get<{ bitcoin: { gbp: number }, ethereum: { gbp: number } }>(url).pipe(
      map(data => ({
        btc: data.bitcoin.gbp,
        eth: data.ethereum.gbp
      }))
    );
  }
}
