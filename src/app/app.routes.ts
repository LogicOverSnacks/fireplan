import { Routes } from '@angular/router';

import { AssetsComponent } from './pages/assets/assets.component';
import { ClientsComponent } from './pages/clients/clients.component';
import { GraphsComponent } from './pages/graphs/graphs.component';
import { OverviewComponent } from './pages/overview/overview.component';
import { PeopleComponent } from './pages/people/people.component';
import { PlansComponent } from './pages/plans/plans.component';
import { StagesComponent } from './pages/stages/stages.component';

export const routes: Routes = [
  { path: '', component: OverviewComponent, data: { title: 'Overview' } },
  { path: 'assets', component: AssetsComponent, data: { title: 'Assets' } },
  { path: 'clients', component: ClientsComponent, data: { title: 'Clients', hide: true } },
  { path: 'graphs', component: GraphsComponent, data: { title: 'Graphs', hide: true } },
  { path: 'people', component: PeopleComponent, data: { title: 'People' } },
  { path: 'plans', component: PlansComponent, data: { title: 'Plans' } },
  { path: 'stages', component: StagesComponent, data: { title: 'Stages' } },
];
