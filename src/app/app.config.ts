import { PlatformLocation } from '@angular/common';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { MAT_TOOLTIP_DEFAULT_OPTIONS } from '@angular/material/tooltip';
import { provideMomentDateAdapter } from '@angular/material-moment-adapter';
import { provideClientHydration } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { UrlHandlingStrategy, provideRouter } from '@angular/router';
import { NgxsStoragePluginModule } from '@ngxs/storage-plugin';
import { NgxsModule } from '@ngxs/store';
import 'moment/locale/en-gb';

import { routes } from './app.routes';
import { PreserveQueryParamsUrlHandlingStrategy } from './preserve-query-params-url-handling-strategy';
import { migrations } from './state/migrations';
import { ClientsState } from './state/clients.state';
import { deserializeClientsState, serializeClientsState } from './state/clients.state.model';
import { GraphsState } from './state/graphs.state';
import { PricesState } from './state/prices.state';

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: UrlHandlingStrategy,
      deps: [PlatformLocation],
      useFactory: (platformLocation: PlatformLocation) => new PreserveQueryParamsUrlHandlingStrategy(platformLocation)
    },
    {
      provide: MAT_TOOLTIP_DEFAULT_OPTIONS,
      useValue: {
        disableTooltipInteractivity: true,
        positionAtOrigin: true,
        showDelay: 250
      }
    },
    provideHttpClient(withFetch()),
    provideRouter(routes),
    provideClientHydration(),
    provideAnimations(),
    provideMomentDateAdapter(),
    importProvidersFrom(
      NgxsModule.forRoot(
        [
          ClientsState,
          GraphsState,
          PricesState
        ],
        { selectorOptions: { injectContainerState: false, suppressErrors: false } }
      ),
      NgxsStoragePluginModule.forRoot({
        beforeSerialize: (state, key) => ({
          ...state,
          clients: serializeClientsState(state.clients)
        }),
        afterDeserialize: (state, key) => ({
          ...state,
          clients: deserializeClientsState(state.clients)
        }),
        migrations: migrations
      })
    )
  ]
};
