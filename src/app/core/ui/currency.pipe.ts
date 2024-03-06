import { CurrencyPipe as AngularCurrencyPipe } from '@angular/common';
import { ChangeDetectorRef, Pipe, PipeTransform } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Store } from '@ngxs/store';
import { combineLatest } from 'rxjs';

import { ClientsState } from '~/state/clients.state';
import { Currency } from '~/state/clients.state.model';
import { PricesState } from '~/state/prices.state';

@Pipe({ name: 'appCurrency', pure: false, standalone: true })
export class AppCurrencyPipe implements PipeTransform {
  private currency: Currency = 'GBP';
  private price: number = 1;
  private input?: number | null;
  private output?: string | null;

  constructor(cdr: ChangeDetectorRef, private currencyPipe: AngularCurrencyPipe, store: Store) {
    combineLatest([store.select(ClientsState.currentCurrency), store.select(PricesState.currentCurrencyPrice)])
      .pipe(takeUntilDestroyed())
      .subscribe(([currency, price]) => {
        this.currency = currency;
        this.price = price;
        if (this.input !== undefined)
          this.output = this.convert();

        cdr.markForCheck();
      });
  }

  transform(value: number | null) {
    if (this.input === undefined || this.output === undefined || this.input !== value) {
      this.input = value;
      this.output = this.convert();
    }

    return this.output;
  }

  private convert() {
    const value = this.input === undefined || this.input == null ? null : this.input * this.price;

    const [suffix, adjustedValue] = !value ? ['', value]
      : value >= 1000000000 ? ['B', value / 1000000000]
      : value >= 1000000 ? ['M', value / 1000000]
      : value >= 1000 ? ['K', value / 1000]
      : ['', value];

    return this.currencyPipe.transform(adjustedValue, this.currency, 'symbol', '1.0-1') + suffix;
  }
}
