import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BoschButtonComponent } from '../bosch-ui/bosch-button/bosch-button.component';
import { BoschAvatarStackComponent } from '../bosch-ui/bosch-avatar/bosch-avatar-stack.component';
import { BoschAvatarComponent } from '../bosch-ui/bosch-avatar/bosch-avatar.component';
import { ApiService } from '../core/api.service';
import { RealtimeService } from '../core/realtime.service';
import { Subscription } from 'rxjs';
import QRCode from 'qrcode';
import { ActivityHostPanelComponent } from '../shared/activity/activity-host-panel.component';
import { buildJoinUrl } from '../core/join-url';
import { HostShellComponent } from './host-shell.component';

@Component({
  selector: 'app-host-live',
  standalone: true,
  imports: [
    RouterLink,
    BoschButtonComponent,
    BoschAvatarStackComponent,
    BoschAvatarComponent,
    ActivityHostPanelComponent,
    HostShellComponent
  ],
  template: `
    <app-host-shell>
      <div class="page">
        <header class="top">
          <div>
            <div class="title-row">
              <h1>{{ session()?.title || 'Live session' }}</h1>
              @if (session()?.status && session()?.status !== 'CLOSED') {
                <span class="badge badge--live">Live</span>
              }
            </div>
            <p>
              Code <strong class="code">{{ session()?.code }}</strong>
              · Step {{ currentIndex() }} of {{ (session()?.steps || []).length || 0 }}
            </p>
          </div>
          <a class="ghost" [routerLink]="['/display', id]" target="_blank">Open big screen</a>
        </header>

        <section class="participants card">
          <div class="participants__head">
            <h2>{{ session()?.participantCount || 0 }} Participants</h2>
            <app-bosch-avatar-stack [people]="participants()" [max]="7" size="md" />
          </div>
        </section>

        <div class="layout">
          <section class="card steps">
            <h2>Session steps</h2>
            <ol>
              @for (s of session()?.steps || []; track s.id; let i = $index) {
                <li [class.done]="s.status === 'DONE'" [class.active]="s.status === 'ACTIVE'">
                  <span class="num">{{ i + 1 }}</span>
                  <div>
                    <strong>{{ s.title }}</strong>
                    <small>{{ s.type }}</small>
                  </div>
                  <span class="badge" [class.badge--done]="s.status === 'DONE'" [class.badge--active]="s.status === 'ACTIVE'" [class.badge--pending]="s.status !== 'DONE' && s.status !== 'ACTIVE'">
                    {{ stepLabel(s) }}
                  </span>
                </li>
              }
            </ol>
          </section>

          <section class="card control">
            <div class="control__head">
              <div>
                <p class="eyebrow">Live control · Step {{ currentIndex() }} of {{ (session()?.steps || []).length || 0 }}</p>
                <h2>{{ session()?.currentStep?.title || 'Lobby' }}</h2>
              </div>
              @if (timerLabel()) {
                <div class="timer">{{ timerLabel() }}</div>
              }
            </div>

            <div class="tabs">
              <button type="button" class="tab" [class.on]="tab() === 'preview'" (click)="tab.set('preview')">Big Screen Preview</button>
              <button type="button" class="tab" [class.on]="tab() === 'settings'" (click)="tab.set('settings')">Step Settings</button>
            </div>

            @if (tab() === 'preview') {
              <div class="qr-block">
                @if (qrDataUrl()) {
                  <img [src]="qrDataUrl()" alt="Join QR" width="160" height="160" />
                }
                <div>
                  <p class="join-url">{{ joinUrl }}</p>
                  <p class="hint">{{ session()?.currentStep?.instructions || 'Share the QR or code with participants.' }}</p>
                </div>
              </div>

              <app-activity-host-panel [session]="session()" [refreshToken]="panelTick()" />
            } @else {
              <div class="settings">
                <label>Activity type <input [value]="session()?.currentStep?.type || ''" readonly /></label>
                <p class="section-label">Section groups</p>
                <ul class="groups">
                  @for (g of session()?.currentStep?.groups || []; track g.id; let gi = $index) {
                    <li [attr.data-tone]="gi % 3">{{ g.title }}</li>
                  } @empty {
                    <li class="empty">No groups on this step</li>
                  }
                </ul>
              </div>
            }

            <div class="controls">
              @if (session()?.status === 'LOBBY') {
                <app-bosch-button icon="dashboard" (click)="start()">Start session</app-bosch-button>
              } @else {
                <app-bosch-button variant="secondary" icon="chevron-left" [disabled]="isFirstStep()" (click)="back()">Previous</app-bosch-button>
                <app-bosch-button icon="chevron-right" [disabled]="isLastStep()" (click)="advance()">Next Step</app-bosch-button>
              }
              <app-bosch-button variant="secondary" icon="star" (click)="summarize()">AI summary</app-bosch-button>
              <app-bosch-button variant="secondary" icon="download" (click)="download('xlsx')">CSV</app-bosch-button>
              <app-bosch-button variant="danger" (click)="end()">End Session</app-bosch-button>
            </div>
            @if (message()) {
              <p class="msg">{{ message() }}</p>
            }
          </section>
        </div>

        @if (summary()) {
          <section class="card summary">
            <div class="summary__tabs">
              <button type="button" class="tab" [class.on]="summaryTab() === 'insights'" (click)="summaryTab.set('insights')">Summary</button>
              <button type="button" class="tab" [class.on]="summaryTab() === 'actions'" (click)="summaryTab.set('actions')">Actions</button>
            </div>
            @if (summaryTab() === 'insights') {
              <h2>Key Insights</h2>
              <ul class="insights">
                @for (i of summary()?.insights || []; track i) {
                  <li><span class="check">✓</span> {{ i }}</li>
                }
              </ul>
            } @else {
              <h2>Suggested Actions</h2>
              <ol class="actions-list">
                @for (a of summary()?.suggestedActions || []; track a.title; let i = $index) {
                  <li>
                    <span class="actions-list__n">{{ i + 1 }}</span>
                    <div>
                      <strong>{{ a.title }}</strong>
                      <div class="owner">
                        @if (a.owner) {
                          <app-bosch-avatar [name]="a.owner" size="sm" />
                          <span>{{ a.owner }}</span>
                        }
                        @if (a.dueDate) {
                          <em>{{ a.dueDate }}</em>
                        }
                      </div>
                    </div>
                  </li>
                }
              </ol>
            }
          </section>
        }
      </div>
    </app-host-shell>
  `,
  styles: `
    .page { display: grid; gap: 1rem; }
    .top { align-items: center; display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; }
    .title-row { align-items: center; display: flex; gap: 0.65rem; }
    h1 { font-size: 1.55rem; margin: 0; }
    .top p { color: var(--wos-text-muted); margin: 0.25rem 0 0; }
    .code { color: var(--wos-primary); letter-spacing: 0.06em; }
    .ghost { background: #fff; border: 1px solid var(--wos-border); border-radius: var(--wos-radius); color: var(--wos-text); font-weight: 600; padding: 0.6rem 0.9rem; text-decoration: none; }
    .card { background: var(--wos-surface); border: 1px solid var(--wos-border); border-radius: var(--wos-radius-lg); box-shadow: var(--wos-shadow); padding: 1rem 1.1rem; }
    .participants__head { align-items: center; display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; }
    .participants__head h2, .steps h2, .summary h2 { font-size: 1rem; margin: 0 0 0.85rem; }
    .layout { display: grid; gap: 1rem; grid-template-columns: 300px 1fr; }
    @media (max-width: 980px) { .layout { grid-template-columns: 1fr; } }
    .steps ol { display: grid; gap: 0.55rem; list-style: none; margin: 0; padding: 0; }
    .steps li { align-items: center; background: #f8fafc; border: 1px solid var(--wos-border); border-radius: var(--wos-radius); display: grid; gap: 0.65rem; grid-template-columns: auto 1fr auto; padding: 0.7rem; }
    .steps li.active { background: var(--wos-primary-soft); border-color: #9db7ef; }
    .steps li.done { opacity: 0.92; }
    .num { align-items: center; background: #fff; border: 1px solid var(--wos-border-strong); border-radius: 50%; display: inline-flex; font-size: 0.8rem; font-weight: 800; height: 1.7rem; justify-content: center; width: 1.7rem; }
    .steps li.active .num { background: var(--wos-primary); border-color: var(--wos-primary); color: #fff; }
    .steps li.done .num { background: var(--wos-success); border-color: var(--wos-success); color: #fff; }
    .steps strong { display: block; font-size: 0.9rem; }
    .steps small { color: var(--wos-text-muted); text-transform: capitalize; }
    .control__head { align-items: start; display: flex; gap: 1rem; justify-content: space-between; margin-bottom: 0.85rem; }
    .eyebrow { color: var(--wos-primary); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.03em; margin: 0 0 0.25rem; text-transform: uppercase; }
    .control h2 { margin: 0; }
    .timer { background: #0f172a; border-radius: var(--wos-radius); color: #fff; font-variant-numeric: tabular-nums; font-weight: 800; padding: 0.55rem 0.75rem; }
    .tabs { display: flex; gap: 0.35rem; margin-bottom: 0.9rem; }
    .tab { background: transparent; border: 0; border-bottom: 2px solid transparent; color: var(--wos-text-muted); cursor: pointer; font-weight: 700; padding: 0.45rem 0.35rem; }
    .tab.on { border-bottom-color: var(--wos-primary); color: var(--wos-primary); }
    .qr-block { align-items: center; background: #f8fafc; border: 1px solid var(--wos-border); border-radius: var(--wos-radius); display: flex; gap: 1rem; margin-bottom: 1rem; padding: 0.85rem; }
    .join-url { font-size: 0.85rem; margin: 0 0 0.35rem; word-break: break-all; }
    .hint { color: var(--wos-text-muted); margin: 0; }
    .settings label { display: grid; font-weight: 600; gap: 0.35rem; margin-bottom: 0.85rem; }
    .settings input { border: 1px solid var(--wos-border-strong); border-radius: var(--wos-radius); padding: 0.65rem; }
    .section-label { font-size: 0.85rem; font-weight: 700; margin: 0 0 0.5rem; }
    .groups { display: grid; gap: 0.45rem; list-style: none; margin: 0; padding: 0; }
    .groups li { background: #f8fafc; border-left: 4px solid var(--wos-primary); border-radius: var(--wos-radius); padding: 0.65rem 0.75rem; }
    .groups li[data-tone='0'] { background: var(--wos-success-soft); border-left-color: var(--wos-success); color: var(--wos-success-ink); }
    .groups li[data-tone='1'] { background: var(--wos-danger-soft); border-left-color: var(--wos-danger); color: var(--wos-danger-ink); }
    .groups li[data-tone='2'] { background: var(--wos-info-soft); border-left-color: var(--wos-info); color: var(--wos-info-ink); }
    .groups .empty { border-left-color: var(--wos-border-strong); color: var(--wos-text-muted); }
    .controls { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
    .msg { color: var(--wos-primary); }
    .insights { display: grid; gap: 0.55rem; list-style: none; margin: 0; padding: 0; }
    .insights li { align-items: start; display: flex; gap: 0.55rem; }
    .check { align-items: center; background: var(--wos-success-soft); border-radius: 50%; color: var(--wos-success-ink); display: inline-flex; flex: 0 0 1.35rem; font-weight: 800; height: 1.35rem; justify-content: center; width: 1.35rem; }
    .actions-list { display: grid; gap: 0.75rem; list-style: none; margin: 0; padding: 0; }
    .actions-list li { align-items: start; background: #f8fafc; border: 1px solid var(--wos-border); border-radius: var(--wos-radius); display: flex; gap: 0.75rem; padding: 0.85rem; }
    .actions-list__n { align-items: center; background: var(--wos-primary); border-radius: 50%; color: #fff; display: inline-flex; flex: 0 0 1.6rem; font-weight: 800; height: 1.6rem; justify-content: center; width: 1.6rem; }
    .owner { align-items: center; color: var(--wos-text-secondary); display: flex; flex-wrap: wrap; gap: 0.45rem; margin-top: 0.4rem; }
    .owner em { color: var(--wos-text-muted); font-style: normal; margin-left: auto; }
    .summary__tabs { display: flex; gap: 0.35rem; margin-bottom: 0.75rem; }
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
  tab = signal<'preview' | 'settings'>('preview');
  summaryTab = signal<'insights' | 'actions'>('insights');
  joinUrl = '';

  currentIndex = computed(() => {
    const steps = this.session()?.steps || [];
    const id = this.session()?.currentStepId;
    const idx = steps.findIndex((s: any) => s.id === id);
    return idx >= 0 ? idx + 1 : 0;
  });

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
      if (e.type === 'summary.ready') this.summary.set(e.data);
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.realtime.disconnect();
  }

  timerLabel() {
    return '';
  }

  stepLabel(step: any): string {
    if (step.status === 'DONE') return 'Completed';
    if (step.status === 'ACTIVE') return 'In Progress';
    return 'Pending';
  }

  refresh() {
    this.api.getHostSession(this.id).subscribe({
      next: (s) => {
        this.session.set(s);
        this.joinUrl = buildJoinUrl(location.origin, s.code);
        QRCode.toDataURL(this.joinUrl, { width: 160, margin: 1, errorCorrectionLevel: 'M' }).then((url) =>
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
    if (this.isLastStep()) return;
    this.api.advance(this.id).subscribe({ next: (s) => this.session.set(s), error: (e) => this.message.set(e?.error?.message) });
  }
  back() {
    if (this.isFirstStep()) return;
    this.api.back(this.id).subscribe({ next: (s) => this.session.set(s), error: (e) => this.message.set(e?.error?.message) });
  }
  end() {
    this.api.end(this.id).subscribe({ next: (s) => this.session.set(s) });
  }

  private stepIndex() {
    const s = this.session();
    const steps = [...(s?.steps || [])].sort((a: any, b: any) => a.stepOrder - b.stepOrder);
    return {
      steps,
      index: steps.findIndex((st: any) => st.id === s?.currentStepId)
    };
  }

  isFirstStep() {
    const { index } = this.stepIndex();
    return index <= 0;
  }

  isLastStep() {
    const { steps, index } = this.stepIndex();
    return index < 0 || index >= steps.length - 1;
  }
  summarize() {
    this.message.set('Generating summary…');
    this.api.generateSummary(this.id).subscribe({
      next: (s) => {
        this.summary.set(s);
        this.summaryTab.set('insights');
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
