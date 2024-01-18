import { Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { Keccak } from 'sha3';

import { CoreModule } from '~/core/core.module';
import { CryptoInvestmentType } from '~/state/clients/investments.state';
import { CryptoBalanceService } from './crypto-balance.service';

const validateBitcoinAddress = Validators.pattern(/\b(bc(0([ac-hj-np-z02-9]{39}|[ac-hj-np-z02-9]{59})|1[ac-hj-np-z02-9]{8,87})|[13][a-km-zA-HJ-NP-Z1-9]{25,35})\b/);

const validateEthereumAddress = Validators.pattern(/^0x[a-fA-F0-9]{40}$/);

const toEthereumChecksumAddress = (address: string) => {
  // see https://github.com/ethereum/ercs/blob/master/ERCS/erc-55.md
  address = address.toLowerCase().replace('0x', '');
  const hash = new Keccak(256).update(address).digest('hex');

  return `0x${[...address].map((char, i) => parseInt(hash[i], 16) >= 8 ? char.toUpperCase() : char).join('')}`;
};

const validateEthereumChecksum = (control: AbstractControl<string | null>): ValidationErrors | null => {
  const address = control.value;
  if (!address || !/[A-Z]/.test(address)) return null;

  return toEthereumChecksumAddress(address) === address
    ? null
    : { checksum: 'failed' }
};

const validateEthereumValidatorAddress = Validators.pattern(/^0x[a-fA-F0-9]{96}$/);

@Component({
  imports: [
    MatDialogModule,
    MatSelectModule,

    CoreModule
  ],
  standalone: true,
  styles: [`
    mat-dialog-content {
      display: flex;
      gap: 20px;
      flex-direction: column;
      max-width: (180px + 16px*2)*2 + 20px + 24px*2;
    }

    .row {
      display: flex;
      gap: 20px;
    }
  `],
  template: `
    <div mat-dialog-title>Add Cryptocurrency Investment</div>
    <form [formGroup]="form">
      <mat-dialog-content>
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>Name</mat-label>
          <input type="text" required matInput formControlName="name">
        </mat-form-field>
        <div class="row">
          <mat-form-field subscriptSizing="dynamic">
            <mat-label>Type</mat-label>
            <mat-select formControlName="type">
              <mat-option value="BTC">Bitcoin</mat-option>
              <mat-option value="ETH">Ethereum</mat-option>
              <mat-option value="ETH_Validator">Ethereum Validator</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field subscriptSizing="dynamic">
            <mat-label>Balance</mat-label>
            <input type="number" matInput formControlName="balance">
          </mat-form-field>
        </div>
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>Address</mat-label>
          <input type="text" matInput formControlName="address">

          <mat-hint>Enter an address to automatically keep the balance up-to-date</mat-hint>

          @if (form.controls.address.value) {
            @if (form.controls.address.hasError('pattern')) {
              <mat-error>Not a valid address</mat-error>
            } @else if (form.controls.address.hasError('checksum')) {
              <mat-error>Checksum failed</mat-error>
            }
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions>
        <button mat-button [mat-dialog-close]="undefined">Cancel</button>
        <button mat-flat-button type="submit"
          color="primary"
          [mat-dialog-close]="form.value"
          [disabled]="form.invalid"
        >Save</button>
      </mat-dialog-actions>
    </form>
  `
})
export class CryptoDialogComponent {
  form = new FormGroup({
    name: new FormControl<string | null>(null, Validators.required),
    type: new FormControl<CryptoInvestmentType>('BTC', { nonNullable: true }),
    address: new FormControl<string | null>(null, [validateBitcoinAddress]),
    balance: new FormControl<number>(0, { nonNullable: true }),
  });

  constructor(private cryptoBalanceService: CryptoBalanceService) {
    this.form.controls.address.valueChanges.pipe(takeUntilDestroyed()).subscribe(address => {
      if (address) {
        this.form.controls.balance.disable();

        if (this.form.controls.address.valid) {
          this.cryptoBalanceService.getBalance(this.form.controls.type.value, address).subscribe(balance => {
            if (balance !== null)
              this.form.controls.balance.setValue(balance);
          });
        }
      } else {
        this.form.controls.balance.enable();
      }
    });

    this.form.controls.type.valueChanges.pipe(takeUntilDestroyed()).subscribe(type => {
      this.form.controls.address.setValidators(
        type === 'BTC' ? [validateBitcoinAddress]
        : type === 'ETH' ? [validateEthereumAddress, validateEthereumChecksum]
        : [validateEthereumValidatorAddress]
      );
      this.form.controls.address.updateValueAndValidity();
    });
  }
}
