import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BoschButtonComponent } from '../bosch-ui/bosch-button/bosch-button.component';
import { BoschCardComponent } from '../bosch-ui/bosch-card/bosch-card.component';
import { BoschLogoComponent } from '../bosch-ui/bosch-logo/bosch-logo.component';
import { BoschIconComponent } from '../bosch-icon/bosch-icon/bosch-icon.component';
import { ApiService } from '../core/api.service';
import { RealtimeService } from '../core/realtime.service';
import { Subscription } from 'rxjs';
import QRCode from 'qrcode';
import { ActivityHostPanelComponent } from '../shared/activity/activity-host-panel.component';

@Component({
  selector: 'app-host-live',
  standalone: true,
  imports: [
    RouterLink,
    BoschButtonComponent,
    BoschCardComponent,
    BoschLogoComponent,
    BoschIconComponent,
    ActivityHostPanelComponent
  ],
  template: `
    <div class="page">
      <header class="top">
        <app-bosch-logo />
        <div>
          <h1>{{ session()?.title || 'Live control' }}</h1>
          <p>Code <strong>{{ session()?.code }}</strong> · {{ session()?.participantCount || 0 }} participants · {{ session()?.status }}</p>
        </div>
        <a class="display-link" [routerLink]="['/display', id]" target="_blank">Open big screen</a>
      </header>

      <div class="grid">
        <app-bosch-card title="Lobby / QR" subtitle="Share with participants">
          @if (qrDataUrl()) {
            <img [src]="qrDataUrl()" alt="Join QR" width="180" height="180" />
          }
          <p class="join-url">{{ joinUrl }}</p>
        </app-bosch-card>

        <app-bosch-card title="Step control" [subtitle]="session()?.currentStep?.title || 'Not started'">
          <p>{{ session()?.currentStep?.instructions }}</p>
          <div class="controls">
            @if (session()?.status === 'LOBBY') {
              <app-bosch-button icon="dashboard" (click)="start()">Start session</app-bosch-button>
            } @else {
              <app-bosch-button variant="secondary" icon="chevron-left" (click)="back()">Back</app-bosch-button>
              <app-bosch-button icon="chevron-right" (click)="advance()">Next step</app-bosch-button>
            }
            <app-bosch-button variant="secondary" icon="star" (click)="summarize()">AI summary</app-bosch-button>
            <app-bosch-button variant="secondary" icon="download" (click)="download('xlsx')">Excel</app-bosch-button>
            <app-bosch-button variant="secondary" icon="export" (click)="download('pdf')">PDF</app-bosch-button>
            <app-bosch-button variant="danger" (click)="end()">End</app-bosch-button>
          </div>
          @if (message()) {
            <p class="msg">{{ message() }}</p>
          }
        </app-bosch-card>
      </div>

      <app-activity-host-panel [session]="session()" />

      @if (summary()) {
        <app-bosch-card title="AI summary" [subtitle]="summary()?.provider + ' / ' + summary()?.model">
          <ul>
            @for (i of summary()?.insights || []; track i) {
              <li>{{ i }}</li>
            }
          </ul>
          <h3>Suggested actions</h3>
          <ul>
            @for (a of summary()?.suggestedActions || []; track a.title) {
              <li>{{ a.title }} — {{ a.owner }} {{ a.dueDate }}</li>
            }
          </ul>
        </app-bosch-card>
      }
    </div>
  `,
  styles: `
    .page { max-width: 1100px; margin: 0 auto; padding: 1.25rem; display: grid; gap: 1rem; }
    .top { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
    .top h1 { margin: 0; font-size: 1.35rem; }
    .top p { margin: 0.2rem 0 0; color: var(--bosch-text-muted); }
    .display-link { margin-left: auto; color: var(--bosch-accent); font-weight: 700; }
    .grid { display: grid; grid-template-columns: 260px 1fr; gap: 1rem; }
    @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } }
    .controls { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
    .join-url { word-break: break-all; font-size: 0.85rem; color: var(--bosch-text-secondary); }
    .msg { color: var(--bosch-accent); }
  `
})
export class HostLiveComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private realtime = inject(RealtimeService);
  private sub?: Subscription;

  id = '';
  session = signal<any>(null);
  qrDataUrl = signal('');
  summary = signal<any>(null);
  message = signal('');
  joinUrl = '';

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.joinUrl = `${location.origin}/j?code=${''}`;
    this.refresh();
    this.realtime.connect(this.id);
    this.sub = this.realtime.events$.subscribe((e) => {
      if (e.type === 'step.changed' || e.type === 'session.ended' || e.type === 'participant.joined') {
        if (e.type === 'step.changed' || e.type === 'session.ended') {
          this.session.set(e.data);
        } else {
          this.refresh();
        }
      }
      if (e.type === 'summary.ready') {
        this.summary.set(e.data);
      }
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.realtime.disconnect();
  }

  refresh() {
    this.api.getHostSession(this.id).subscribe({
      next: (s) => {
        this.session.set(s);
        this.joinUrl = `${location.origin}/j?code=${s.code}`;
        QRCode.toDataURL(this.joinUrl, { width: 180, margin: 1 }).then((url) => this.qrDataUrl.set(url));
      }
    });
    this.api.getSummary(this.id).subscribe({
      next: (s) => {
        if (s?.insights) this.summary.set(s);
      }
    });
  }

  start() {
    this.api.start(this.id).subscribe({ next: (s) => this.session.set(s), error: (e) => this.message.set(e?.error?.message) });
  }
  advance() {
    this.api.advance(this.id).subscribe({ next: (s) => this.session.set(s), error: (e) => this.message.set(e?.error?.message) });
  }
  back() {
    this.api.back(this.id).subscribe({ next: (s) => this.session.set(s), error: (e) => this.message.set(e?.error?.message) });
  }
  end() {
    this.api.end(this.id).subscribe({ next: (s) => this.session.set(s) });
  }
  summarize() {
    this.message.set('Generating summary…');
    this.api.generateSummary(this.id).subscribe({
      next: (s) => {
        this.summary.set(s);
        this.message.set('Summary ready');
      },
      error: (e) => this.message.set(e?.error?.message || 'Summary failed')
    });
  }
  download(kind: 'xlsx' | 'pdf') {
    const url = this.api.exportUrl(this.id, kind);
    fetch(url, { headers: { 'X-Host-Token': this.api.hostToken() } })
      .then((r) => r.blob())
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `workshop.${kind}`;
        a.click();
      });
  }
}
