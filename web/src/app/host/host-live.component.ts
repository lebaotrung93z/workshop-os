import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BoschButtonComponent } from '../bosch-ui/bosch-button/bosch-button.component';
import { BoschCardComponent } from '../bosch-ui/bosch-card/bosch-card.component';
import { BoschLogoComponent } from '../bosch-ui/bosch-logo/bosch-logo.component';
import { BoschAvatarStackComponent } from '../bosch-ui/bosch-avatar/bosch-avatar-stack.component';
import { ApiService } from '../core/api.service';
import { RealtimeService } from '../core/realtime.service';
import { Subscription } from 'rxjs';
import QRCode from 'qrcode';
import { ActivityHostPanelComponent } from '../shared/activity/activity-host-panel.component';
import { buildJoinUrl } from '../core/join-url';

@Component({
  selector: 'app-host-live',
  standalone: true,
  imports: [
    RouterLink,
    BoschButtonComponent,
    BoschCardComponent,
    BoschLogoComponent,
    BoschAvatarStackComponent,
    ActivityHostPanelComponent
  ],
  template: `
    <div class="page">
      <header class="top">
        <app-bosch-logo />
        <div class="top__meta">
          <h1>{{ session()?.title || 'Live control' }}</h1>
          <p>
            Code <strong class="code">{{ session()?.code }}</strong>
            · {{ session()?.status }}
          </p>
        </div>
        <a class="display-link" [routerLink]="['/display', id]" target="_blank">Open big screen</a>
      </header>

      <section class="participants card-block">
        <div class="participants__head">
          <h2>{{ session()?.participantCount || 0 }} Participants</h2>
          <app-bosch-avatar-stack [people]="participants()" [max]="7" size="md" />
        </div>
      </section>

      <section class="steps card-block">
        <h2>Session progress</h2>
        <ol class="step-rail">
          @for (s of session()?.steps || []; track s.id; let i = $index) {
            <li
              class="step"
              [class.step--done]="s.status === 'DONE'"
              [class.step--active]="s.status === 'ACTIVE'"
              [class.step--pending]="s.status !== 'DONE' && s.status !== 'ACTIVE'"
            >
              <span class="step__num">{{ i + 1 }}</span>
              <div class="step__body">
                <strong>{{ s.title }}</strong>
                <span class="step__type">{{ s.type }}</span>
                <span class="step__status">{{ stepLabel(s) }}</span>
              </div>
            </li>
          }
        </ol>
      </section>

      <div class="grid">
        <app-bosch-card title="Lobby / QR" subtitle="Share with participants">
          @if (qrDataUrl()) {
            <img class="qr" [src]="qrDataUrl()" alt="Join QR" width="180" height="180" />
          }
          <p class="join-url">{{ joinUrl }}</p>
        </app-bosch-card>

        <app-bosch-card title="Live control" [subtitle]="session()?.currentStep?.title || 'Not started'">
          <p class="instructions">{{ session()?.currentStep?.instructions || 'Start when everyone has joined.' }}</p>
          <div class="controls">
            @if (session()?.status === 'LOBBY') {
              <app-bosch-button icon="dashboard" (click)="start()">Start session</app-bosch-button>
            } @else {
              <app-bosch-button variant="secondary" icon="chevron-left" (click)="back()">Back</app-bosch-button>
              <app-bosch-button icon="chevron-right" (click)="advance()">Next step</app-bosch-button>
            }
            <app-bosch-button variant="secondary" icon="star" (click)="summarize()">AI summary</app-bosch-button>
            <app-bosch-button variant="secondary" icon="download" (click)="download('xlsx')">CSV</app-bosch-button>
            <app-bosch-button variant="secondary" icon="export" (click)="download('pdf')">Report</app-bosch-button>
            <app-bosch-button variant="danger" (click)="end()">End</app-bosch-button>
          </div>
          @if (message()) {
            <p class="msg">{{ message() }}</p>
          }
        </app-bosch-card>
      </div>

      <app-activity-host-panel [session]="session()" [refreshToken]="panelTick()" />

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
    .page { display: grid; gap: 1rem; margin: 0 auto; max-width: 1100px; padding: 1.25rem; }
    .top { align-items: center; display: flex; flex-wrap: wrap; gap: 1rem; }
    .top__meta h1 { font-size: 1.35rem; margin: 0; }
    .top__meta p { color: var(--bosch-text-muted); margin: 0.2rem 0 0; }
    .code { color: var(--bosch-accent); letter-spacing: 0.08em; }
    .display-link { color: var(--bosch-accent); font-weight: 700; margin-left: auto; }
    .card-block { background: var(--bosch-surface); border: 1px solid var(--bosch-border); padding: 1rem 1.1rem; }
    .card-block h2 { font-size: 1rem; margin: 0 0 0.75rem; }
    .participants__head { align-items: center; display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; }
    .participants__head h2 { margin: 0; }
    .step-rail { display: grid; gap: 0.5rem; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); list-style: none; margin: 0; padding: 0; }
    .step { background: var(--bosch-bg-muted); border: 1px solid var(--bosch-border); border-left: 4px solid var(--bosch-gray-70); display: grid; gap: 0.65rem; grid-template-columns: auto 1fr; padding: 0.75rem; }
    .step--done { border-left-color: var(--bosch-positive); }
    .step--active { background: var(--bosch-accent-soft); border-left-color: var(--bosch-accent); }
    .step__num { align-items: center; background: var(--bosch-surface); border: 1px solid var(--bosch-border-strong); display: inline-flex; font-size: 0.85rem; font-weight: 800; height: 1.75rem; justify-content: center; width: 1.75rem; }
    .step--active .step__num { background: var(--bosch-accent); border-color: var(--bosch-accent); color: var(--bosch-on-accent); }
    .step--done .step__num { background: var(--bosch-positive); border-color: var(--bosch-positive); color: var(--bosch-on-accent); }
    .step__body { display: grid; gap: 0.15rem; }
    .step__body strong { font-size: 0.92rem; }
    .step__type, .step__status { color: var(--bosch-text-muted); font-size: 0.78rem; text-transform: capitalize; }
    .grid { display: grid; gap: 1rem; grid-template-columns: 260px 1fr; }
    @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } }
    .qr { display: block; }
    .join-url { color: var(--bosch-text-secondary); font-size: 0.85rem; word-break: break-all; }
    .instructions { color: var(--bosch-text-secondary); margin: 0; }
    .controls { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
    .msg { color: var(--bosch-accent); }
    h3 { font-size: 0.95rem; margin: 1rem 0 0.4rem; }
  `
})
export class HostLiveComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private realtime = inject(RealtimeService);
  private sub?: Subscription;

  id = '';
  session = signal<any>(null);
  participants = signal<{ id: string; displayName: string }[]>([]);
  qrDataUrl = signal('');
  summary = signal<any>(null);
  message = signal('');
  panelTick = signal(0);
  joinUrl = '';

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.joinUrl = buildJoinUrl(location.origin, '');
    this.refresh();
    this.realtime.connect(this.id);
    this.sub = this.realtime.events$.subscribe((e) => {
      if (e.type === 'step.changed' || e.type === 'session.ended') {
        this.session.set(e.data);
        this.panelTick.update((n) => n + 1);
      }
      if (e.type === 'participant.joined') {
        this.refreshParticipants();
        this.refresh();
      }
      if (e.type === 'entry.created' || e.type === 'entry.hidden' || e.type === 'vote.updated' || e.type === 'action.created') {
        this.panelTick.update((n) => n + 1);
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

  stepLabel(step: any): string {
    if (step.status === 'DONE') return 'Completed';
    if (step.status === 'ACTIVE') return 'In progress';
    return 'Pending';
  }

  refresh() {
    this.api.getHostSession(this.id).subscribe({
      next: (s) => {
        this.session.set(s);
        this.joinUrl = buildJoinUrl(location.origin, s.code);
        QRCode.toDataURL(this.joinUrl, { width: 180, margin: 1, errorCorrectionLevel: 'M' }).then((url) =>
          this.qrDataUrl.set(url)
        );
        this.panelTick.update((n) => n + 1);
      }
    });
    this.refreshParticipants();
    this.api.getSummary(this.id).subscribe({
      next: (s) => {
        if (s?.insights) this.summary.set(s);
      }
    });
  }

  refreshParticipants() {
    this.api.listParticipants(this.id).subscribe({
      next: (list) => this.participants.set(list || []),
      error: () => this.participants.set([])
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
    const run = kind === 'xlsx' ? this.api.exportCsv(this.id) : this.api.exportPdfText(this.id);
    run
      .then((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = kind === 'xlsx' ? `workshop.csv` : `workshop.txt`;
        a.click();
      })
      .catch((e) => this.message.set(e?.message || 'Export failed'));
  }
}
