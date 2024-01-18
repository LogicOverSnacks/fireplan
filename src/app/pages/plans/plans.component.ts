import { Component } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { Store } from '@ngxs/store';

import { CoreModule } from '~/core/core.module';

@Component({
  selector: 'app-plans',
  standalone: true,
  imports: [
    MatListModule,

    CoreModule
  ],
  templateUrl: './plans.component.html',
  styleUrl: './plans.component.scss'
})
export class PlansComponent {
  constructor(private store: Store) {}
}
