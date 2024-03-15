import { Component, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatListModule } from '@angular/material/list';
import { Select, Store } from '@ngxs/store';
import { Observable, map } from 'rxjs';

import { CoreModule } from '~/core';
import { AddClient, ChangeSelectedClient, ClientsState, IncrementMaxClientId, UpdateClientName } from '~/state/clients.state';
import { Client } from '~/state/clients.state.model';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [
    MatListModule,

    CoreModule
  ],
  templateUrl: './events.component.html',
  styleUrl: './events.component.scss'
})
export class EventsComponent {

}
