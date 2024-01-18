import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormControl } from '@angular/forms';
import { MatIconRegistry } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterModule, RouterOutlet } from '@angular/router';
import { Store } from '@ngxs/store';
import { map } from 'rxjs';

import { routes } from './app.routes';
import { CoreModule } from './core/core.module';
import { ChangeSelectedPlan, PlansState } from './state/clients/plans.state';
import { DomSanitizer } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    MatListModule,
    MatSelectModule,
    MatSidenavModule,
    MatToolbarModule,
    RouterModule,
    RouterOutlet,

    CoreModule
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'fireplan';
  routes = routes;

  ltMd = this.breakpointObserver.observe([Breakpoints.XSmall, Breakpoints.Small]).pipe(map(({ matches }) => matches));

  planControl = new FormControl<string | null>(this.store.selectSnapshot(PlansState.selectedPlanId));
  // plans = this.store.select(PlansState.plans).pipe(map(plans => Object.keys(plans)));

  constructor(
    domSanitizer: DomSanitizer,
    http: HttpClient,
    matIconRegistry: MatIconRegistry,
    private breakpointObserver: BreakpointObserver,
    private store: Store
  ) {
    http.get('assets/custom-mdi.svg', { responseType: 'text' }).subscribe(response => {
      matIconRegistry.addSvgIconSetLiteral(domSanitizer.bypassSecurityTrustHtml(response));
    });

    this.store.select(PlansState.selectedPlanId).pipe(takeUntilDestroyed()).subscribe(id => {
      this.planControl.setValue(id);
    });

    this.planControl.valueChanges.pipe(takeUntilDestroyed()).subscribe(id => {
      this.store.dispatch(new ChangeSelectedPlan(id));
    });
  }

  addPlan() {

  }
}
