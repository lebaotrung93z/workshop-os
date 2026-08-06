import { Routes } from '@angular/router';
import { HostDashboardComponent } from './host/host-dashboard.component';
import { HostSetupComponent } from './host/host-setup.component';
import { HostLiveComponent } from './host/host-live.component';
import { FormatBuilderComponent } from './host/format-builder.component';
import { JoinComponent } from './participant/join.component';
import { ParticipantLiveComponent } from './participant/participant-live.component';
import { DisplayComponent } from './display/display.component';

export const routes: Routes = [
  { path: '', component: HostDashboardComponent },
  { path: 'host', component: HostSetupComponent },
  { path: 'host/format', component: FormatBuilderComponent },
  { path: 'host/:id', component: HostLiveComponent },
  { path: 'j', component: JoinComponent },
  { path: 'p/:id', component: ParticipantLiveComponent },
  { path: 'display/:sessionId', component: DisplayComponent },
  { path: '**', redirectTo: '' }
];
