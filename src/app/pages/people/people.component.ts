import { Component, signal } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { Select, Store } from '@ngxs/store';
import { default as moment, Moment } from 'moment';
import { Observable } from 'rxjs';

import { CoreModule } from '~/core/core.module';
import { AddOrUpdatePerson, PeopleState } from '~/state/clients/people.state';
import { Person } from '~/state/clients/people.state.model';
import { PersonDialogComponent, PersonDialogData } from './person-dialog.component';

@Component({
  selector: 'app-people',
  standalone: true,
  imports: [
    MatDatepickerModule,
    MatExpansionModule,
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
    this.dialog.open<PersonDialogComponent, PersonDialogData, Person>(PersonDialogComponent)
      .afterClosed()
      .subscribe(value => {
        if (value) {
          this.store.dispatch(new AddOrUpdatePerson(value));
        }
      });
  }

  editPerson(person: Person) {
    const data = {
      id: person.id,
      name: person.name,
      dateOfBirth: moment(person.dateOfBirth),
      lifeExpectancyMean: person.lifeExpectancy.mean,
      lifeExpectancyVariance: person.lifeExpectancy.variance
    };

    this.dialog.open<PersonDialogComponent, PersonDialogData, Person>(PersonDialogComponent, { data })
      .afterClosed()
      .subscribe(value => {
        if (value) {
          this.store.dispatch(new AddOrUpdatePerson(value));
        }
      });
  }
}
