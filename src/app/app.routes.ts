import { Routes } from '@angular/router';

import { AssetsComponent } from './pages/assets/assets.component';
import { OverviewComponent } from './pages/overview/overview.component';
import { PeopleComponent } from './pages/people/people.component';
import { PlansComponent } from './pages/plans/plans.component';

export const routes: Routes = [
  { path: '', component: OverviewComponent, data: { title: 'Overview' } },
  { path: 'assets', component: AssetsComponent, data: { title: 'Assets' } },
  { path: 'people', component: PeopleComponent, data: { title: 'People' } },
  { path: 'plans', component: PlansComponent, data: { title: 'Plans' } },
];
