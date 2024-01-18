import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { Select, Store } from '@ngxs/store';
import { Observable } from 'rxjs';

import { CoreModule } from '~/core/core.module';
import { AddOrUpdatePerson, PeopleState } from '~/state/clients/people.state';
import { Person } from '~/state/clients/people.state.model';
import { PersonDialogComponent } from './person-dialog.component';

@Component({
  selector: 'app-people',
  standalone: true,
  imports: [
    MatListModule,

    CoreModule
  ],
  templateUrl: './people.component.html',
  styleUrl: './people.component.scss'
})
export class PeopleComponent {
  @Select(PeopleState.people)
  people!: Observable<Person[]>;

  constructor(
    private dialog: MatDialog,
    private store: Store
  ) {}

  addPerson() {
    this.dialog.open<PersonDialogComponent, any, Person>(PersonDialogComponent).afterClosed().subscribe(value => {
      if (value) {
        this.store.dispatch(new AddOrUpdatePerson(value));
      }
    });
  }
}
