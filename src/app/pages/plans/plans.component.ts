import { Component } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { Select, Store } from '@ngxs/store';
import { Observable } from 'rxjs';

import { CoreModule } from '~/core';
import { AddOrReplacePlan, DeletePlan, PlansState, UpdatePlan } from '~/state/clients/plans.state';
import { Plan } from '~/state/clients/plans.state.model';
import { PlanDialogComponent, PlanDialogData } from './plan-dialog.component';

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
  @Select(PlansState.plans)
  plans!: Observable<Record<string, Plan>>;

  constructor(
    private dialog: MatDialog,
    private store: Store
  ) {}

  addPlan() {
    this.dialog.open<PlanDialogComponent, PlanDialogData, PlanDialogData>(PlanDialogComponent)
      .afterClosed()
      .subscribe(data => {
        if (data) {
          const plan: Plan = data.inheritsFrom === null
            ? {
              inheritsFrom: null,
              name: data.name,
              initialPortfolioTotal: 100000,
              stages: []
            }
            : {
              inheritsFrom: data.inheritsFrom,
              initialPortfolioTotal: 100000,
              name: data.name
            };
          this.store.dispatch(new AddOrReplacePlan(data.id, plan));
        }
      });
  }

  editPlan(id: string, plan: Plan) {
    const data: PlanDialogData = {
      id: id,
      inheritsFrom: plan.inheritsFrom,
      name: plan.name,
    };

    this.dialog.open<PlanDialogComponent, PlanDialogData, PlanDialogData>(PlanDialogComponent, { data })
      .afterClosed()
      .subscribe(value => {
        if (value)
          this.store.dispatch(new UpdatePlan(value.id, value.inheritsFrom, value.name));
      });
  }

  deletePlan(id: string) {
    this.store.dispatch(new DeletePlan(id));
  }
}
