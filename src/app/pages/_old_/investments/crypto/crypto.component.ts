import { Component, Pipe, PipeTransform } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { Select, Store } from '@ngxs/store';
import { Observable, of } from 'rxjs';

import { CoreModule } from '~/core/core.module';
import {
  AddCryptoInvestment,
  CryptoInvestment,
  CryptoInvestmentType,
  InvestmentsState,
  DeleteCryptoInvestment
} from '~/state/clients/investments.state';
import { CryptoBalanceService } from './crypto-balance.service';
import { CryptoDialogComponent } from './crypto-dialog.component';

@Pipe({ standalone: true, name: 'cryptoIcon' })
export class CryptoIconPipe implements PipeTransform {
  transform(type: CryptoInvestmentType): string {
    switch (type) {
      case 'BTC':
        return 'currency-btc';
      case 'ETH':
      case 'ETH_Validator':
        return 'ethereum';
    }
  }
}

@Pipe({ standalone: true, name: 'cryptoType' })
export class CryptoTypePipe implements PipeTransform {
  transform(type: CryptoInvestmentType): string {
    switch (type) {
      case 'BTC': return 'Bitcoin';
      case 'ETH': return 'Ethereum';
      case 'ETH_Validator': return 'Ethereum Validator';
    }
  }
}

@Pipe({ standalone: true, name: 'cryptoUnit' })
export class CryptoUnitPipe implements PipeTransform {
  transform(type: CryptoInvestmentType): string {
    switch (type) {
      case 'BTC':
        return 'BTC';
      case 'ETH':
      case 'ETH_Validator':
        return 'ETH';
    }
  }
}

@Component({
  selector: 'app-investments-crypto',
  standalone: true,
  imports: [
    MatListModule,

    CoreModule,
    CryptoIconPipe,
    CryptoTypePipe,
    CryptoUnitPipe
  ],
  templateUrl: './crypto.component.html',
  styleUrl: './crypto.component.scss'
})
export class CryptoComponent {
  @Select(InvestmentsState.crypto)
  cryptoCurrencies!: Observable<CryptoInvestment[]>;

  @Select(InvestmentsState.crypto)
  cryptoPrices!: Observable<CryptoInvestment[]>;

  constructor(
    private dialog: MatDialog,
    private store: Store,
    private cryptoBalanceService: CryptoBalanceService
  ) {}

  addCrypto() {
    this.dialog.open<CryptoDialogComponent, any, CryptoInvestment>(CryptoDialogComponent).afterClosed().subscribe(value => {
      if (value) {
        const balance$ = value.address
          ? this.cryptoBalanceService.getBalance(value.type, value.address)
          : of(value.balance);

        balance$.subscribe(balance => {
          this.store.dispatch(new AddCryptoInvestment({
            name: value.name,
            type: value.type,
            address: value.address,
            balance: balance ?? 0,
            balanceGbp: this.cryptoBalanceService.getPrice(value.type) * (balance ?? 0)
          }));
        });
      }
    });
  }

  deleteCrypto(name: string) {
    this.store.dispatch(new DeleteCryptoInvestment(name));
  }
}
