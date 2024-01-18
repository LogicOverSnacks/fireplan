import { Component, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatListModule } from '@angular/material/list';
import { Select, Store } from '@ngxs/store';
import { Observable, map } from 'rxjs';

import { CoreModule } from '~/core/core.module';
import { AddClient, ChangeSelectedClient, ClientsState, IncrementMaxClientId, UpdateClientName } from '~/state/clients.state';
import { Client } from '~/state/clients.state.model';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [
    MatListModule,

    CoreModule
  ],
  templateUrl: './clients.component.html',
  styleUrl: './clients.component.scss'
})
export class ClientsComponent {
  @Select(ClientsState.clients)
  clients!: Observable<Record<number, Client>>;

  currentClientId = toSignal(this.store.select(ClientsState.currentClientId));

  editingClientId = signal<number | null>(null);
  editingClientName = '';

  constructor(private store: Store) {}

  addClient() {
    this.store.dispatch(new IncrementMaxClientId())
      .pipe(map(() => this.store.selectSnapshot(ClientsState.maxClientId)))
      .subscribe(id => {
        this.store.dispatch(new AddClient(id));
      });
  }

  selectClient(id: number) {
    this.store.dispatch(new ChangeSelectedClient(id));
  }

  editClient(id: number, name: string) {
    this.editingClientId.set(id);
    this.editingClientName = name;
  }

  updateClientName(id: number, name: string) {
    this.store.dispatch(new UpdateClientName(id, name));
    this.editingClientId.set(null);
    this.editingClientName = '';
  }
}
