import { Component } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { Store } from '@ngxs/store';

import { CoreModule } from '~/core/core.module';
import { CryptoComponent } from './crypto/crypto.component';

@Component({
  selector: 'app-investments',
  standalone: true,
  imports: [
    MatListModule,

    CoreModule,
    CryptoComponent
  ],
  templateUrl: './investments.component.html',
  styleUrl: './investments.component.scss'
})
export class InvestmentsComponent {
  isas: { name: string; total: number; }[] = [];

  constructor(private store: Store) {}

}
