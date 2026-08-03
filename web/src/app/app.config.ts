import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    // Hash URLs so Render static hosting can serve deep links (/display, /host, /j)
    // without a Dashboard SPA rewrite rule.
    provideRouter(routes, withHashLocation()),
    provideHttpClient()
  ]
};
