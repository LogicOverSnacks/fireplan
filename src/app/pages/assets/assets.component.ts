import { Component } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { Store } from '@ngxs/store';

import { CoreModule } from '~/core';
// import { CryptoComponent } from './crypto/crypto.component';
import { AssetsState } from '~/state/clients/assets.state';

@Component({
  selector: 'app-assets',
  standalone: true,
  imports: [
    MatListModule,

    CoreModule,
    // CryptoComponent
  ],
  templateUrl: './assets.component.html',
  styleUrl: './assets.component.scss'
})
export class AssetsComponent {
  totalAssets = this.store.select(AssetsState.total);

  constructor(private store: Store) {}
}
