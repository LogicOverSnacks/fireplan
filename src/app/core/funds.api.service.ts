import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map } from 'rxjs';

import { YAHOO_API_KEY } from '~/env';

type YahooQuotes = {
  quoteResponse: {
    result: {
      currency: string,
      regularMarketPrice: number,
      symbol: string
    }[],
    error: null
  }
}

@Injectable({ providedIn: 'root' })
export class FundsApiService {
  constructor(private http: HttpClient) {}

  getCurrenciesInGbp(currencies: string[]) {
    const symbols = currencies.map(currency => `${currency}GBP%3DX`).join('%2C');
    const url = `https://apidojo-yahoo-finance-v1.p.rapidapi.com/market/v2/get-quotes?region=GB&symbols=${symbols}`;
    const headers = {
      'X-RapidAPI-Key': YAHOO_API_KEY,
      'X-RapidAPI-Host': 'apidojo-yahoo-finance-v1.p.rapidapi.com'
    };
    return this.http.get<YahooQuotes>(url, { headers }).pipe(
      map(({ quoteResponse }) => Object.fromEntries(quoteResponse.result.map(quote => [quote.symbol, quote.regularMarketPrice])))
    );
  }

  getFundPrice(funds: string[]) {
    const url = `https://apidojo-yahoo-finance-v1.p.rapidapi.com/market/v2/get-quotes?region=GB&symbols=${funds.join('%2C')}`;
    const headers = {
      'X-RapidAPI-Key': YAHOO_API_KEY,
      'X-RapidAPI-Host': 'apidojo-yahoo-finance-v1.p.rapidapi.com'
    };
    return this.http.get<YahooQuotes>(url, { headers }).pipe(
      map(({ quoteResponse }) => Object.fromEntries(quoteResponse.result.map(quote => [quote.symbol, quote.regularMarketPrice / 100])))
    );
  }
}
