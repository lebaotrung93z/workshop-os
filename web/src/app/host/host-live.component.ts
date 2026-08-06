import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
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
import {
  formatCountdown,
  hasTimer,
  isTimerPaused,
  isTimerRunning,
  remainingSeconds,
  stepTimerSeconds
} from '../core/timer.util';

@Component({
  selector: 'app-host-live',
  standalone: true,
  imports: [
    FormsModule,
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
              @if (editingTitle()) {
                <input class="title-input" [(ngModel)]="titleDraft" (keyup.enter)="saveTitle()" />
                <app-bosch-button variant="secondary" (click)="saveTitle()">Save</app-bosch-button>
                <button type="button" class="linkish" (click)="cancelTitleEdit()">Cancel</button>
              } @else {
                <h1>{{ session()?.title || 'Live session' }}</h1>
                <button type="button" class="linkish" (click)="startTitleEdit()">Edit title</button>
              }
              @if (session()?.status === 'LOBBY') {
                <span class="badge badge--prep">Prepared</span>
              } @else if (session()?.status && session()?.status !== 'CLOSED') {
                <span class="badge badge--live">Live</span>
              }
            </div>
            <p class="lede">
              Code <strong class="code">{{ session()?.code }}</strong>
              · {{ session()?.participantCount || 0 }} online
            </p>
          </div>
          <div class="top-actions">
            @if (session()?.status === 'LOBBY') {
              <app-bosch-button variant="secondary" (click)="saveForLater()">Save for later</app-bosch-button>
            }
            <a class="ghost" [routerLink]="['/display', id]" target="_blank">Open big screen</a>
          </div>
        </header>

        <section class="progress card">
          <div class="progress__main">
            <p class="eyebrow">{{ session()?.status === 'LOBBY' ? 'Prepare workshop' : 'Facilitation' }}</p>
            <h2 class="progress__title">{{ session()?.currentStep?.title || 'Lobby' }}</h2>
            <p class="progress__meta">
              Step {{ currentIndex() }} of {{ stepTotal() }}
              · {{ stepTypeLabel() }}
              · {{ session()?.participantCount || 0 }} participants
              @if (session()?.status === 'LOBBY') {
                · Add content below, then Start when ready
              }
            </p>
          </div>
          <div class="progress__timer">
            @if (timerLabel()) {
              <div class="timer" [class.timer--paused]="timerPaused()" [class.timer--ended]="timerEnded()">
                {{ timerLabel() }}
              </div>
            } @else if (canStartTimer()) {
              <div class="timer timer--idle">{{ formatDuration(stepDuration()) }}</div>
            }
            <div class="timer-actions">
              @if (canStartTimer() && !timerActive()) {
                <app-bosch-button variant="secondary" (click)="startTimer()">Start timer</app-bosch-button>
              }
              @if (timerRunning()) {
                <app-bosch-button variant="secondary" (click)="pauseTimer()">Pause</app-bosch-button>
              }
              @if (timerPaused()) {
                <app-bosch-button variant="secondary" (click)="resumeTimer()">Resume</app-bosch-button>
              }
              @if (timerActive()) {
                <app-bosch-button variant="secondary" (click)="resetTimer()">Reset</app-bosch-button>
              }
            </div>
          </div>
        </section>

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
              @for (s of orderedSteps(); track s.id; let i = $index) {
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

            @if (session()?.status !== 'CLOSED') {
              <div class="add-step">
                <p class="section-label">Add step during workshop</p>
                <label class="inline">
                  Type
                  <select [(ngModel)]="addStepType">
                    @for (t of stepTypes; track t.value) {
                      <option [value]="t.value">{{ t.label }}</option>
                    }
                  </select>
                </label>
                <label class="inline">
                  Title (optional)
                  <input [(ngModel)]="addStepTitle" placeholder="Leave blank for default" />
                </label>
                <div class="add-step__actions">
                  <app-bosch-button
                    variant="secondary"
                    icon="plus"
                    [disabled]="busyStep()"
                    (click)="addStep('afterCurrent')"
                  >
                    Add after current
                  </app-bosch-button>
                  <app-bosch-button
                    variant="secondary"
                    [disabled]="busyStep()"
                    (click)="addStep('end')"
                  >
                    Add at end
                  </app-bosch-button>
                </div>
              </div>
            }
          </section>

          <section class="card control">
            <div class="control__head">
              <div>
                <p class="eyebrow">Live control · Step {{ currentIndex() }} of {{ stepTotal() }}</p>
                <h2>{{ session()?.currentStep?.title || 'Lobby' }}</h2>
              </div>
            </div>

            <div class="tabs">
              <button type="button" class="tab" [class.on]="tab() === 'preview'" (click)="setTab('preview')">Big Screen Preview</button>
              <button type="button" class="tab" [class.on]="tab() === 'settings'" (click)="setTab('settings')">Step Settings</button>
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
                @if (!session()?.currentStep) {
                  <p class="hint">Start the session to edit the active step.</p>
                } @else {
                  <label>
                    Activity type
                    <input [value]="typeLabel(draftType)" readonly />
                  </label>
                  <label>
                    Title
                    <input [(ngModel)]="draftTitle" />
                  </label>
                  <label>
                    Instructions
                    <input [(ngModel)]="draftInstructions" />
                  </label>
                  <label>
                    Timer (seconds)
                    <input type="number" min="0" max="7200" [(ngModel)]="draftTimerSeconds" placeholder="0 = no timer" />
                  </label>
                  <p class="hint">0 or empty disables the timer for this step. Saving clears a running countdown.</p>

                  @if (draftType === 'poll') {
                    <p class="section-label">Poll options</p>
                    @for (opt of draftOptions; track $index; let oi = $index) {
                      <div class="row">
                        <input [(ngModel)]="opt.label" placeholder="Option label" (ngModelChange)="syncOptionId(opt)" />
                        <button type="button" class="icon-btn danger" (click)="removeOption(oi)" aria-label="Remove option">×</button>
                      </div>
                    }
                    <app-bosch-button variant="secondary" (click)="addOption()">Add option</app-bosch-button>
                  }

                  @if (draftType === 'input') {
                    <label class="check">
                      <input type="checkbox" [(ngModel)]="draftAnonymous" />
                      Anonymous sticky notes
                    </label>
                    <label class="check">
                      <input type="checkbox" [(ngModel)]="draftLinkedBoard" (ngModelChange)="onLinkedBoardToggle()" />
                      Linked board (Objective → Key Result)
                    </label>
                    <p class="section-label">{{ draftLinkedBoard ? 'Board' : 'Columns' }}</p>
                    @for (g of draftGroups; track $index; let gi = $index) {
                      <div class="row">
                        <input [(ngModel)]="g.title" [placeholder]="draftLinkedBoard ? 'Objectives' : 'Column title'" />
                        @if (!draftLinkedBoard) {
                          <button type="button" class="icon-btn danger" (click)="removeGroup(gi)" aria-label="Remove column">×</button>
                        }
                      </div>
                    }
                    @if (!draftLinkedBoard) {
                      <app-bosch-button variant="secondary" (click)="addGroup()">Add column</app-bosch-button>
                    }
                  }

                  @if (draftType === 'voting') {
                    <label>
                      Votes per participant
                      <input type="number" min="1" max="20" [(ngModel)]="draftVotesPerParticipant" />
                    </label>
                  }

                  @if (draftType === 'form') {
                    <label class="check">
                      <input type="checkbox" [(ngModel)]="draftLinkActionToKr" />
                      Link action to Key Result
                    </label>
                  }

                  <div class="settings-actions">
                    <app-bosch-button [disabled]="busySettings()" (click)="saveStepSettings(false)">
                      {{ busySettings() ? 'Saving…' : 'Save step settings' }}
                    </app-bosch-button>
                    @if (canStartTimer() || timerActive()) {
                      <app-bosch-button
                        variant="secondary"
                        [disabled]="busySettings() || !draftTimerSeconds"
                        (click)="saveStepSettings(true)"
                      >
                        Save &amp; restart timer
                      </app-bosch-button>
                    }
                  </div>
                }
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
    .title-row { align-items: center; display: flex; flex-wrap: wrap; gap: 0.65rem; }
    .title-input {
      border: 1px solid var(--wos-border-strong);
      border-radius: var(--wos-radius);
      font: inherit;
      font-size: 1.25rem;
      font-weight: 700;
      min-width: min(420px, 70vw);
      padding: 0.4rem 0.65rem;
    }
    .linkish {
      background: transparent;
      border: 0;
      color: var(--wos-primary);
      cursor: pointer;
      font-weight: 700;
      padding: 0;
    }
    .top-actions { align-items: center; display: flex; flex-wrap: wrap; gap: 0.65rem; }
    .badge--prep {
      background: #fef3c7;
      color: #92400e;
      font-size: 0.75rem;
      font-weight: 800;
      padding: 0.2rem 0.55rem;
      border-radius: var(--wos-radius-pill);
    }
    h1 { font-size: 1.55rem; margin: 0; }
    .top p, .lede { color: var(--wos-text-muted); margin: 0.25rem 0 0; }
    .code { color: var(--wos-primary); letter-spacing: 0.06em; }
    .ghost { background: #fff; border: 1px solid var(--wos-border); border-radius: var(--wos-radius); color: var(--wos-text); font-weight: 600; padding: 0.6rem 0.9rem; text-decoration: none; }
    .card { background: var(--wos-surface); border: 1px solid var(--wos-border); border-radius: var(--wos-radius-lg); box-shadow: var(--wos-shadow); padding: 1rem 1.1rem; }
    .progress {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      justify-content: space-between;
    }
    .progress__title { font-size: 1.25rem; margin: 0.15rem 0 0.35rem; }
    .progress__meta { color: var(--wos-text-muted); margin: 0; }
    .progress__timer { align-items: end; display: grid; gap: 0.5rem; justify-items: end; }
    .timer-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; justify-content: end; }
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
    .add-step {
      border-top: 1px solid var(--wos-border);
      display: grid;
      gap: 0.65rem;
      margin-top: 1rem;
      padding-top: 0.9rem;
    }
    .add-step .inline { display: grid; font-weight: 600; gap: 0.3rem; margin: 0; }
    .add-step input, .add-step select {
      border: 1px solid var(--wos-border-strong);
      border-radius: var(--wos-radius);
      font: inherit;
      padding: 0.55rem 0.65rem;
    }
    .add-step__actions { display: flex; flex-wrap: wrap; gap: 0.45rem; }
    .control__head { align-items: start; display: flex; gap: 1rem; justify-content: space-between; margin-bottom: 0.85rem; }
    .eyebrow { color: var(--wos-primary); font-size: 0.78rem; font-weight: 700; letter-spacing: 0.03em; margin: 0 0 0.25rem; text-transform: uppercase; }
    .control h2 { margin: 0; }
    .timer {
      background: #0f172a;
      border-radius: var(--wos-radius);
      color: #fff;
      font-size: 1.35rem;
      font-variant-numeric: tabular-nums;
      font-weight: 800;
      min-width: 4.5rem;
      padding: 0.55rem 0.85rem;
      text-align: center;
    }
    .timer--paused { background: #92400e; }
    .timer--ended { background: var(--wos-danger); }
    .timer--idle { background: #334155; opacity: 0.85; }
    .tabs { display: flex; gap: 0.35rem; margin-bottom: 0.9rem; }
    .tab { background: transparent; border: 0; border-bottom: 2px solid transparent; color: var(--wos-text-muted); cursor: pointer; font-weight: 700; padding: 0.45rem 0.35rem; }
    .tab.on { border-bottom-color: var(--wos-primary); color: var(--wos-primary); }
    .qr-block { align-items: center; background: #f8fafc; border: 1px solid var(--wos-border); border-radius: var(--wos-radius); display: flex; gap: 1rem; margin-bottom: 1rem; padding: 0.85rem; }
    .join-url { font-size: 0.85rem; margin: 0 0 0.35rem; word-break: break-all; }
    .hint { color: var(--wos-text-muted); margin: 0; }
    .settings label { display: grid; font-weight: 600; gap: 0.35rem; margin-bottom: 0.85rem; }
    .settings input, .settings select { border: 1px solid var(--wos-border-strong); border-radius: var(--wos-radius); padding: 0.65rem; }
    .settings .check {
      align-items: center;
      display: flex;
      font-weight: 600;
      gap: 0.5rem;
      margin-bottom: 0.65rem;
    }
    .settings .row {
      align-items: center;
      display: grid;
      gap: 0.5rem;
      grid-template-columns: 1fr auto;
      margin-bottom: 0.5rem;
    }
    .settings .icon-btn {
      background: #fff;
      border: 1px solid var(--wos-border);
      border-radius: var(--wos-radius);
      cursor: pointer;
      font-size: 1.1rem;
      font-weight: 700;
      line-height: 1;
      padding: 0.35rem 0.55rem;
    }
    .settings .icon-btn.danger { color: var(--wos-danger); }
    .settings-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.75rem; }
    .section-label { font-size: 0.85rem; font-weight: 700; margin: 0.35rem 0 0.5rem; }
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
  private router = inject(Router);
  private api = inject(ApiService);
  private realtime = inject(RealtimeService);
  private sub?: Subscription;
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  id = '';
  session = signal<any>(null);
  participants = signal<{ id: string; displayName: string }[]>([]);
  qrDataUrl = signal('');
  summary = signal<any>(null);
  message = signal('');
  panelTick = signal(0);
  tab = signal<'preview' | 'settings'>('preview');
  summaryTab = signal<'insights' | 'actions'>('insights');
  nowTick = signal(Date.now());
  editingTitle = signal(false);
  titleDraft = '';
  busyStep = signal(false);
  busySettings = signal(false);
  addStepType: 'welcome' | 'poll' | 'input' | 'voting' | 'form' = 'poll';
  addStepTitle = '';
  draftStepId = '';
  draftType: 'welcome' | 'poll' | 'input' | 'voting' | 'form' = 'welcome';
  draftTitle = '';
  draftInstructions = '';
  draftTimerSeconds: number | null = null;
  draftOptions: { id: string; label: string }[] = [];
  draftAnonymous = true;
  draftLinkedBoard = false;
  draftGroups: { id?: string; title: string }[] = [];
  draftVotesPerParticipant = 3;
  draftLinkActionToKr = false;
  joinUrl = '';

  stepTypes = [
    { value: 'welcome' as const, label: 'Welcome' },
    { value: 'poll' as const, label: 'Poll' },
    { value: 'input' as const, label: 'Input (sticky wall)' },
    { value: 'voting' as const, label: 'Voting' },
    { value: 'form' as const, label: 'Action form' }
  ];

  currentIndex = computed(() => {
    const steps = this.orderedSteps();
    const id = this.session()?.currentStepId;
    const idx = steps.findIndex((s: any) => s.id === id);
    return idx >= 0 ? idx + 1 : 0;
  });

  stepTotal = computed(() => this.orderedSteps().length);

  orderedSteps = computed(() =>
    [...(this.session()?.steps || [])].sort((a: any, b: any) => a.stepOrder - b.stepOrder)
  );

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.joinUrl = buildJoinUrl(location.origin, '');
    this.refresh();
    this.realtime.connect(this.id);
    this.tickHandle = setInterval(() => this.nowTick.set(Date.now()), 250);
    this.sub = this.realtime.events$.subscribe((e) => {
      if (e.type === 'step.changed' || e.type === 'session.ended') {
        this.session.set(e.data);
        this.panelTick.update((n) => n + 1);
        if (this.tab() === 'settings') this.loadStepDraft();
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
    if (this.tickHandle) clearInterval(this.tickHandle);
  }

  setTab(which: 'preview' | 'settings') {
    this.tab.set(which);
    if (which === 'settings') this.loadStepDraft();
  }

  typeLabel(type: string) {
    return this.stepTypes.find((t) => t.value === type)?.label || type;
  }

  loadStepDraft() {
    const step = this.session()?.currentStep;
    if (!step) {
      this.draftStepId = '';
      return;
    }
    this.draftStepId = step.id;
    this.draftType = step.type;
    this.draftTitle = step.title || '';
    this.draftInstructions = step.instructions || '';
    this.draftTimerSeconds = step.timerSeconds ?? null;
    const cfg = step.config || {};
    this.draftOptions = Array.isArray(cfg.options)
      ? cfg.options.map((o: any) => ({ id: String(o.id || ''), label: String(o.label || '') }))
      : [
          { id: 'great', label: 'Great' },
          { id: 'ok', label: 'OK' },
          { id: 'rough', label: 'Rough' }
        ];
    this.draftAnonymous = !!cfg.anonymous;
    this.draftLinkedBoard = cfg.boardMode === 'okr';
    this.draftGroups = (step.groups || []).map((g: any) => ({ id: g.id, title: g.title || '' }));
    if (!this.draftGroups.length) {
      this.draftGroups = this.draftLinkedBoard
        ? [{ title: 'Objectives' }]
        : [{ title: 'Column A' }, { title: 'Column B' }, { title: 'Column C' }];
    }
    this.draftVotesPerParticipant = Number(cfg.votesPerParticipant) || 3;
    this.draftLinkActionToKr = cfg.linkTo === 'kr';
  }

  addOption() {
    const n = this.draftOptions.length + 1;
    this.draftOptions.push({ id: `opt${n}`, label: `Option ${n}` });
  }

  removeOption(index: number) {
    this.draftOptions.splice(index, 1);
  }

  syncOptionId(opt: { id: string; label: string }) {
    const slug = opt.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|$)/g, '')
      .slice(0, 24);
    opt.id = slug || `opt-${Math.random().toString(36).slice(2, 7)}`;
  }

  addGroup() {
    this.draftGroups.push({ title: `Column ${this.draftGroups.length + 1}` });
  }

  removeGroup(index: number) {
    this.draftGroups.splice(index, 1);
  }

  onLinkedBoardToggle() {
    if (this.draftLinkedBoard) {
      this.draftGroups = [{ id: this.draftGroups[0]?.id, title: 'Objectives' }];
      this.draftAnonymous = false;
      if (!this.draftInstructions.trim()) {
        this.draftInstructions = 'Host adds Objectives. Participants attach Key Results under each Objective.';
      }
    } else if (this.draftGroups.length < 2) {
      this.draftGroups = [{ title: 'Column A' }, { title: 'Column B' }, { title: 'Column C' }];
    }
  }

  private buildStepPatch() {
    const timer =
      this.draftTimerSeconds != null && Number(this.draftTimerSeconds) > 0
        ? Math.floor(Number(this.draftTimerSeconds))
        : null;
    const patch: any = {
      title: this.draftTitle.trim(),
      instructions: this.draftInstructions,
      timerSeconds: timer,
      config: {},
      groups: [] as Array<{ id?: string; title: string }>
    };
    if (this.draftType === 'poll') {
      patch.config = {
        options: this.draftOptions
          .filter((o) => o.label.trim())
          .map((o) => ({ id: o.id || this.slug(o.label), label: o.label.trim() }))
      };
    } else if (this.draftType === 'input') {
      if (this.draftLinkedBoard) {
        patch.config = {
          anonymous: !!this.draftAnonymous,
          boardMode: 'okr',
          parentKind: 'objective',
          childKind: 'kr',
          parentLabel: 'Objective',
          childLabel: 'Key Result'
        };
        patch.groups = [{ id: this.draftGroups[0]?.id, title: this.draftGroups[0]?.title?.trim() || 'Objectives' }];
      } else {
        patch.config = { anonymous: !!this.draftAnonymous };
        patch.groups = this.draftGroups
          .filter((g) => g.title.trim())
          .map((g) => ({ id: g.id, title: g.title.trim() }));
      }
    } else if (this.draftType === 'voting') {
      patch.config = { votesPerParticipant: Number(this.draftVotesPerParticipant) || 3 };
    } else if (this.draftType === 'form') {
      patch.config = this.draftLinkActionToKr ? { linkTo: 'kr', linkLabel: 'Key Result' } : {};
    }
    return patch;
  }

  private slug(value: string) {
    return (
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|$)/g, '')
        .slice(0, 24) || 'opt'
    );
  }

  saveStepSettings(restartTimer: boolean) {
    const stepId = this.draftStepId || this.session()?.currentStepId;
    if (!stepId) return;
    this.busySettings.set(true);
    this.message.set('');
    this.api.updateStep(this.id, stepId, this.buildStepPatch(), { restartTimer }).subscribe({
      next: (s) => {
        this.session.set(s);
        this.busySettings.set(false);
        this.loadStepDraft();
        this.message.set(restartTimer ? 'Step saved and timer restarted.' : 'Step settings saved.');
        this.panelTick.update((n) => n + 1);
      },
      error: (e) => {
        this.busySettings.set(false);
        this.message.set(e?.error?.message || 'Could not save step');
      }
    });
  }

  stepTypeLabel() {
    const type = this.session()?.currentStep?.type;
    return type ? String(type) : 'waiting';
  }

  stepDuration() {
    return stepTimerSeconds(this.session());
  }

  canStartTimer() {
    const s = this.session();
    return !!s?.currentStep && s.status !== 'LOBBY' && s.status !== 'CLOSED' && this.stepDuration() > 0;
  }

  timerActive() {
    return hasTimer(this.session());
  }

  timerRunning() {
    return isTimerRunning(this.session());
  }

  timerPaused() {
    return isTimerPaused(this.session());
  }

  timerEnded() {
    const rem = remainingSeconds(this.session(), this.nowTick());
    return rem === 0 && this.timerRunning();
  }

  timerLabel() {
    this.nowTick();
    const rem = remainingSeconds(this.session(), this.nowTick());
    if (rem == null) return '';
    const prefix = this.timerPaused() ? 'Paused ' : rem === 0 ? 'Time’s up ' : '';
    return `${prefix}${formatCountdown(rem)}`;
  }

  formatDuration(seconds: number) {
    return formatCountdown(seconds);
  }

  startTimer() {
    this.api.startTimer(this.id).subscribe({
      next: (s) => this.session.set(s),
      error: (e) => this.message.set(e?.error?.message || 'Timer start failed')
    });
  }

  pauseTimer() {
    this.api.pauseTimer(this.id).subscribe({
      next: (s) => this.session.set(s),
      error: (e) => this.message.set(e?.error?.message || 'Pause failed')
    });
  }

  resumeTimer() {
    this.api.resumeTimer(this.id).subscribe({
      next: (s) => this.session.set(s),
      error: (e) => this.message.set(e?.error?.message || 'Resume failed')
    });
  }

  resetTimer() {
    this.api.clearTimer(this.id).subscribe({
      next: (s) => this.session.set(s),
      error: (e) => this.message.set(e?.error?.message || 'Reset failed')
    });
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
        this.api.rememberHostSession({
          id: this.id,
          hostToken: this.api.hostToken(),
          title: s.title,
          code: s.code,
          status: s.status
        });
        this.joinUrl = buildJoinUrl(location.origin, s.code);
        QRCode.toDataURL(this.joinUrl, { width: 160, margin: 1, errorCorrectionLevel: 'M' }).then((url) =>
          this.qrDataUrl.set(url)
        );
        this.panelTick.update((n) => n + 1);
        if (this.tab() === 'settings') this.loadStepDraft();
      }
    });
    this.refreshParticipants();
    this.api.getSummary(this.id).subscribe({
      next: (s) => {
        if (s?.insights) this.summary.set(s);
      }
    });
  }

  startTitleEdit() {
    this.titleDraft = this.session()?.title || '';
    this.editingTitle.set(true);
  }

  cancelTitleEdit() {
    this.editingTitle.set(false);
  }

  saveTitle() {
    this.api.updateTitle(this.id, this.titleDraft).subscribe({
      next: (s) => {
        this.session.set(s);
        this.editingTitle.set(false);
      },
      error: (e) => this.message.set(e?.error?.message || 'Could not save title')
    });
  }

  saveForLater() {
    const s = this.session();
    this.api.rememberHostSession({
      id: this.id,
      hostToken: this.api.hostToken(),
      title: s?.title,
      code: s?.code,
      status: s?.status || 'LOBBY'
    });
    this.message.set('Saved — resume anytime from the home screen.');
    this.router.navigate(['/'], { queryParams: { saved: this.id } });
  }

  addStep(position: 'afterCurrent' | 'end') {
    this.busyStep.set(true);
    this.message.set('');
    this.api
      .insertStep(this.id, this.addStepType, position, {
        title: this.addStepTitle.trim() || undefined
      })
      .subscribe({
        next: (s) => {
          this.session.set(s);
          this.busyStep.set(false);
          this.addStepTitle = '';
          this.message.set(
            position === 'afterCurrent'
              ? 'Step added after the current one — use Next Step when ready.'
              : 'Step added at the end of the workshop.'
          );
          this.panelTick.update((n) => n + 1);
        },
        error: (e) => {
          this.busyStep.set(false);
          this.message.set(e?.error?.message || 'Could not add step');
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
    this.api.start(this.id).subscribe({
      next: (s) => {
        this.session.set(s);
        this.api.rememberHostSession({
          id: this.id,
          hostToken: this.api.hostToken(),
          title: s.title,
          code: s.code,
          status: s.status
        });
      },
      error: (e) => this.message.set(e?.error?.message)
    });
  }
  advance() {
    if (this.isLastStep()) return;
    this.api.advance(this.id).subscribe({
      next: (s) => {
        this.session.set(s);
        this.api.rememberHostSession({
          id: this.id,
          hostToken: this.api.hostToken(),
          title: s.title,
          code: s.code,
          status: s.status
        });
      },
      error: (e) => this.message.set(e?.error?.message)
    });
  }
  back() {
    if (this.isFirstStep()) return;
    this.api.back(this.id).subscribe({
      next: (s) => {
        this.session.set(s);
        this.api.rememberHostSession({
          id: this.id,
          hostToken: this.api.hostToken(),
          title: s.title,
          code: s.code,
          status: s.status
        });
      },
      error: (e) => this.message.set(e?.error?.message)
    });
  }
  end() {
    this.api.end(this.id).subscribe({
      next: (s) => {
        this.session.set(s);
        this.api.rememberHostSession({
          id: this.id,
          hostToken: this.api.hostToken(),
          title: s.title,
          code: s.code,
          status: s.status
        });
      }
    });
  }

  private stepIndex() {
    const steps = this.orderedSteps();
    return {
      steps,
      index: steps.findIndex((st: any) => st.id === this.session()?.currentStepId)
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
