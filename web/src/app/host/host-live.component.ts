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
import { cssBackgroundImage, fileToEmbeddedImageDataUrl } from '../core/image-data-url';

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
            @if (session()?.status !== 'CLOSED') {
              <p class="steps-hint">Select a step to configure its settings</p>
            }
            <ol>
              @for (s of orderedSteps(); track s.id; let i = $index) {
                <li
                  [class.done]="s.status === 'DONE'"
                  [class.active]="s.status === 'ACTIVE'"
                  [class.selected]="selectedStepId() === s.id"
                  [class.selectable]="session()?.status !== 'CLOSED'"
                  [attr.role]="session()?.status !== 'CLOSED' ? 'button' : null"
                  [attr.tabindex]="session()?.status !== 'CLOSED' ? 0 : null"
                  [attr.title]="session()?.status !== 'CLOSED' ? 'Configure this step' : null"
                  (click)="selectStep(s)"
                  (keydown.enter)="selectStep(s)"
                  (keydown.space)="$event.preventDefault(); selectStep(s)"
                >
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
                @if (tab() === 'settings' && selectedStep()) {
                  <p class="eyebrow">Step settings · {{ selectedIndex() }} of {{ stepTotal() }}</p>
                  <h2>{{ selectedStep()?.title || 'Step' }}</h2>
                } @else {
                  <p class="eyebrow">Live control · Step {{ currentIndex() }} of {{ stepTotal() }}</p>
                  <h2>{{ session()?.currentStep?.title || 'Lobby' }}</h2>
                }
              </div>
              @if (tab() === 'settings') {
                <div class="history-bar">
                  <button
                    type="button"
                    class="history-btn"
                    [disabled]="busySettings() || !canUndoContent()"
                    title="Undo content (Ctrl/⌘Z)"
                    (click)="undoContent()"
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    class="history-btn"
                    [disabled]="busySettings() || !canRedoContent()"
                    title="Redo content (Ctrl/⌘⇧Z)"
                    (click)="redoContent()"
                  >
                    Redo
                  </button>
                </div>
              }
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
                @if (!draftStepId) {
                  <p class="hint">Select a session step on the left to configure it.</p>
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

                  @if (draftType === 'welcome') {
                    <label>
                      Big screen welcome text
                      <textarea
                        rows="4"
                        [(ngModel)]="draftWelcomeText"
                        placeholder="Message shown on the projector / big screen…"
                      ></textarea>
                    </label>
                    <label class="file-label">
                      Upload background image
                      <input type="file" accept="image/*" (change)="onBackgroundFile($event)" />
                    </label>
                    <p class="hint">Photos are compressed in the browser and saved with the session (no cloud storage).</p>
                    <label>
                      Or paste a public image URL
                      <input [(ngModel)]="draftBackgroundImageUrl" placeholder="https://…" />
                    </label>
                    @if (uploadingBg()) {
                      <p class="hint">Preparing image…</p>
                    }
                    @if (draftBackgroundImageUrl) {
                      <div class="bg-preview" [style.background-image]="bgPreviewCss()"></div>
                      <button type="button" class="linkish" (click)="draftBackgroundImageUrl = ''">Clear background</button>
                    }
                  }

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

                  @if (draftType === 'breakout') {
                    <p class="section-label">Groups &amp; topics</p>
                    <p class="hint">Name each team and assign a discussion topic. People are assigned from Big Screen Preview.</p>
                    @for (g of draftGroups; track $index; let gi = $index) {
                      <div class="breakout-draft">
                        <div class="row">
                          <input [(ngModel)]="g.title" placeholder="Group name" />
                          <button type="button" class="icon-btn danger" (click)="removeGroup(gi)" aria-label="Remove group">×</button>
                        </div>
                        <input class="topic-input" [(ngModel)]="g.topic" placeholder="Topic for this group…" />
                      </div>
                    }
                    <app-bosch-button variant="secondary" (click)="addBreakoutGroup()">Add group</app-bosch-button>
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
                  <li><span class="insight-check">✓</span> {{ i }}</li>
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
    :host { display: block; width: 100%; }
    .page { display: grid; gap: 1rem; width: 100%; }
    .top { align-items: center; display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; }
    .title-row { align-items: center; display: flex; flex-wrap: wrap; gap: 0.65rem; }
    .title-input {
      border: 1px solid var(--wos-border-strong);
      border-radius: var(--wos-radius);
      font: inherit;
      font-size: 1.25rem;
      font-weight: 700;
      max-width: 100%;
      min-width: min(280px, 100%);
      padding: 0.4rem 0.65rem;
      width: min(420px, 100%);
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
    .progress__main { flex: 1 1 220px; min-width: 0; }
    .progress__title { font-size: 1.25rem; margin: 0.15rem 0 0.35rem; }
    .progress__meta { color: var(--wos-text-muted); margin: 0; }
    .progress__timer { align-items: end; display: grid; flex: 0 1 auto; gap: 0.5rem; justify-items: end; }
    .timer-actions { display: flex; flex-wrap: wrap; gap: 0.4rem; justify-content: end; }
    .participants__head { align-items: center; display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; }
    .participants__head h2, .steps h2, .summary h2 { font-size: 1rem; margin: 0 0 0.85rem; }
    .steps-hint {
      color: var(--wos-text-muted);
      font-size: 0.8rem;
      margin: -0.45rem 0 0.75rem;
    }
    .layout {
      display: grid;
      gap: 1rem;
      grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
    }
    .steps { min-width: 0; }
    .control { min-width: 0; }
    .steps ol { display: grid; gap: 0.55rem; list-style: none; margin: 0; padding: 0; }
    .steps li {
      align-items: center;
      background: #f8fafc;
      border: 1px solid var(--wos-border);
      border-radius: var(--wos-radius);
      display: grid;
      gap: 0.65rem;
      grid-template-columns: auto minmax(0, 1fr) auto;
      padding: 0.7rem;
    }
    .steps li > div { min-width: 0; }
    .steps li.selectable {
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
    }
    .steps li.selectable:hover {
      border-color: #9db7ef;
      box-shadow: 0 0 0 2px var(--wos-primary-ring);
    }
    .steps li.selectable:focus-visible {
      outline: 2px solid var(--wos-primary);
      outline-offset: 2px;
    }
    .steps li.active { background: var(--wos-primary-soft); border-color: #9db7ef; }
    .steps li.selected {
      background: #fff;
      border-color: var(--wos-primary);
      box-shadow: 0 0 0 3px var(--wos-primary-ring);
    }
    .steps li.active.selected {
      background: var(--wos-primary-soft);
    }
    .steps li.done { opacity: 0.92; }
    .num { align-items: center; background: #fff; border: 1px solid var(--wos-border-strong); border-radius: 50%; display: inline-flex; font-size: 0.8rem; font-weight: 800; height: 1.7rem; justify-content: center; width: 1.7rem; }
    .steps li.active .num { background: var(--wos-primary); border-color: var(--wos-primary); color: #fff; }
    .steps li.selected .num { background: var(--wos-primary); border-color: var(--wos-primary); color: #fff; }
    .steps li.done .num { background: var(--wos-success); border-color: var(--wos-success); color: #fff; }
    .steps strong {
      display: block;
      font-size: 0.9rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
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
      width: 100%;
    }
    .add-step__actions { display: flex; flex-wrap: wrap; gap: 0.45rem; }
    .control__head { align-items: start; display: flex; gap: 1rem; justify-content: space-between; margin-bottom: 0.85rem; }
    .history-bar { align-items: center; display: flex; flex: 0 0 auto; gap: 0.45rem; }
    .history-btn {
      background: #fff;
      border: 1px solid var(--wos-border-strong);
      border-radius: var(--wos-radius);
      color: var(--wos-text);
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 700;
      padding: 0.4rem 0.7rem;
    }
    .history-btn:hover:not(:disabled) {
      border-color: var(--wos-primary);
      color: var(--wos-primary);
    }
    .history-btn:disabled {
      cursor: default;
      opacity: 0.45;
    }
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
    .tabs { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.9rem; }
    .tab { background: transparent; border: 0; border-bottom: 2px solid transparent; color: var(--wos-text-muted); cursor: pointer; font-weight: 700; padding: 0.45rem 0.35rem; }
    .tab.on { border-bottom-color: var(--wos-primary); color: var(--wos-primary); }
    .qr-block {
      align-items: center;
      background: #f8fafc;
      border: 1px solid var(--wos-border);
      border-radius: var(--wos-radius);
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      margin-bottom: 1rem;
      padding: 0.85rem;
    }
    .qr-block > div { flex: 1 1 180px; min-width: 0; }
    .join-url { font-size: 0.85rem; margin: 0 0 0.35rem; word-break: break-all; }
    .hint { color: var(--wos-text-muted); margin: 0; }
    .settings label { display: grid; font-weight: 600; gap: 0.35rem; margin-bottom: 0.85rem; }
    .settings input, .settings select, .settings textarea {
      border: 1px solid var(--wos-border-strong);
      border-radius: var(--wos-radius);
      font: inherit;
      max-width: 100%;
      padding: 0.65rem;
    }
    .settings textarea { resize: vertical; }
    .file-label input[type='file'] { padding: 0.35rem 0; }
    .bg-preview {
      background-position: center;
      background-size: cover;
      border: 1px solid var(--wos-border);
      border-radius: var(--wos-radius);
      height: 120px;
      margin: 0.35rem 0 0.65rem;
    }
    .settings .check {
      align-items: center;
      background: transparent;
      border-radius: 0;
      color: inherit;
      display: flex;
      flex: none;
      font-weight: 600;
      gap: 0.5rem;
      height: auto;
      justify-content: flex-start;
      margin-bottom: 0.65rem;
      width: auto;
    }
    .settings .check input {
      flex: 0 0 auto;
      margin: 0;
      width: auto;
    }
    .settings .row {
      align-items: center;
      display: grid;
      gap: 0.5rem;
      grid-template-columns: 1fr auto;
      margin-bottom: 0.5rem;
    }
    .breakout-draft {
      display: grid;
      gap: 0.4rem;
      margin-bottom: 0.75rem;
    }
    .breakout-draft .row { margin-bottom: 0; }
    .topic-input {
      border: 1px solid var(--wos-border-strong);
      border-radius: var(--wos-radius);
      padding: 0.65rem 0.75rem;
      width: 100%;
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
    .insight-check { align-items: center; background: var(--wos-success-soft); border-radius: 50%; color: var(--wos-success-ink); display: inline-flex; flex: 0 0 1.35rem; font-weight: 800; height: 1.35rem; justify-content: center; width: 1.35rem; }
    .actions-list { display: grid; gap: 0.75rem; list-style: none; margin: 0; padding: 0; }
    .actions-list li { align-items: start; background: #f8fafc; border: 1px solid var(--wos-border); border-radius: var(--wos-radius); display: flex; gap: 0.75rem; padding: 0.85rem; }
    .actions-list__n { align-items: center; background: var(--wos-primary); border-radius: 50%; color: #fff; display: inline-flex; flex: 0 0 1.6rem; font-weight: 800; height: 1.6rem; justify-content: center; width: 1.6rem; }
    .owner { align-items: center; color: var(--wos-text-secondary); display: flex; flex-wrap: wrap; gap: 0.45rem; margin-top: 0.4rem; }
    .owner em { color: var(--wos-text-muted); font-style: normal; margin-left: auto; }
    .summary__tabs { display: flex; gap: 0.35rem; margin-bottom: 0.75rem; }

    @media (max-width: 1024px) {
      .layout { grid-template-columns: minmax(200px, 260px) minmax(0, 1fr); }
      .progress__timer { justify-items: start; }
      .timer-actions { justify-content: start; }
    }

    @media (max-width: 768px) {
      .layout { grid-template-columns: 1fr; }
      .steps {
        max-height: none;
      }
      .steps ol {
        display: flex;
        gap: 0.55rem;
        overflow-x: auto;
        padding-bottom: 0.25rem;
      }
      .steps li {
        flex: 0 0 min(240px, 78vw);
        grid-template-columns: auto minmax(0, 1fr);
      }
      .steps li .badge { grid-column: 2; justify-self: start; }
      .qr-block { flex-direction: column; align-items: flex-start; }
      h1 { font-size: 1.35rem; }
    }

    @media (min-width: 1280px) {
      .layout { grid-template-columns: 320px minmax(0, 1fr); }
    }
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
  /** Step opened in Step Settings (does not change live currentStepId). */
  selectedStepId = signal('');
  summaryTab = signal<'insights' | 'actions'>('insights');
  nowTick = signal(Date.now());
  editingTitle = signal(false);
  titleDraft = '';
  busyStep = signal(false);
  busySettings = signal(false);
  private contentUndo: Array<{ stepId: string; before: any; after: any }> = [];
  private contentRedo: Array<{ stepId: string; before: any; after: any }> = [];
  private applyingContentHistory = false;
  addStepType: 'welcome' | 'poll' | 'input' | 'voting' | 'form' | 'breakout' = 'poll';
  addStepTitle = '';
  draftStepId = '';
  draftType: 'welcome' | 'poll' | 'input' | 'voting' | 'form' | 'breakout' = 'welcome';
  draftTitle = '';
  draftInstructions = '';
  draftTimerSeconds: number | null = null;
  draftOptions: { id: string; label: string }[] = [];
  draftAnonymous = true;
  draftLinkedBoard = false;
  draftGroups: { id?: string; title: string; topic?: string }[] = [];
  draftVotesPerParticipant = 3;
  draftLinkActionToKr = false;
  draftWelcomeText = '';
  draftBackgroundImageUrl = '';
  uploadingBg = signal(false);
  joinUrl = '';

  stepTypes = [
    { value: 'welcome' as const, label: 'Welcome' },
    { value: 'poll' as const, label: 'Poll' },
    { value: 'input' as const, label: 'Input (sticky wall)' },
    { value: 'voting' as const, label: 'Voting' },
    { value: 'form' as const, label: 'Action form' },
    { value: 'breakout' as const, label: 'Group participants' }
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

  selectedStep = computed(() => {
    const id = this.selectedStepId();
    if (!id) return null;
    return this.orderedSteps().find((s: any) => s.id === id) || null;
  });

  selectedIndex = computed(() => {
    const id = this.selectedStepId();
    const idx = this.orderedSteps().findIndex((s: any) => s.id === id);
    return idx >= 0 ? idx + 1 : 0;
  });

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    // Restore this workshop's host token before any host writes (avoids clobbering registry).
    this.api.activateHostSession(this.id);
    this.joinUrl = buildJoinUrl(location.origin, '');
    this.refresh();
    this.realtime.connect(this.id);
    this.tickHandle = setInterval(() => this.nowTick.set(Date.now()), 250);
    this.sub = this.realtime.events$.subscribe((e) => {
      if (e.type === 'step.changed' || e.type === 'session.ended') {
        const prevStepId = this.session()?.currentStepId;
        this.session.set(e.data);
        this.panelTick.update((n) => n + 1);
        if (!this.selectedStepId() && e.data?.currentStepId) {
          this.selectedStepId.set(e.data.currentStepId);
        }
        // Do not wipe in-progress Step Settings when facilitation advances;
        // only refresh the draft if we are editing the step that just became current
        // and the host had that same step selected.
        if (
          this.tab() === 'settings' &&
          e.data?.currentStepId !== prevStepId &&
          this.selectedStepId() === e.data?.currentStepId
        ) {
          this.loadStepDraft();
        }
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
    if (which === 'settings') {
      if (!this.selectedStepId()) {
        const currentId = this.session()?.currentStepId || this.orderedSteps()[0]?.id || '';
        if (currentId) this.selectedStepId.set(currentId);
      }
      this.loadStepDraft();
    }
  }

  selectStep(step: { id: string }) {
    if (!step?.id || this.session()?.status === 'CLOSED') return;
    this.selectedStepId.set(step.id);
    this.tab.set('settings');
    this.loadStepDraft();
  }

  typeLabel(type: string) {
    return this.stepTypes.find((t) => t.value === type)?.label || type;
  }

  loadStepDraft() {
    const steps = this.orderedSteps();
    const id =
      this.selectedStepId() ||
      this.session()?.currentStepId ||
      steps[0]?.id ||
      '';
    const step =
      (id && steps.find((s: any) => s.id === id)) ||
      this.session()?.currentStep ||
      null;
    if (!step) {
      this.draftStepId = '';
      return;
    }
    this.selectedStepId.set(step.id);
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
    this.draftGroups = (step.groups || []).map((g: any) => ({
      id: g.id,
      title: g.title || '',
      topic: g.topic || ''
    }));
    if (!this.draftGroups.length) {
      if (this.draftType === 'breakout') {
        this.draftGroups = [
          { title: 'Group 1', topic: '' },
          { title: 'Group 2', topic: '' },
          { title: 'Group 3', topic: '' }
        ];
      } else {
        this.draftGroups = this.draftLinkedBoard
          ? [{ title: 'Objectives' }]
          : [{ title: 'Column A' }, { title: 'Column B' }, { title: 'Column C' }];
      }
    }
    this.draftVotesPerParticipant = Number(cfg.votesPerParticipant) || 3;
    this.draftLinkActionToKr = cfg.linkTo === 'kr';
    this.draftWelcomeText = String(cfg.welcomeText || '');
    this.draftBackgroundImageUrl = String(cfg.backgroundImageUrl || '');
  }

  addOption() {
    const n = this.draftOptions.length + 1;
    this.draftOptions.push({ id: `opt${n}`, label: `Option ${n}` });
  }

  removeOption(index: number) {
    this.draftOptions.splice(index, 1);
  }

  syncOptionId(opt: { id: string; label: string }) {
    // Only assign an id for new/blank options — renaming must not orphan existing votes.
    if (opt.id?.trim()) return;
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

  addBreakoutGroup() {
    this.draftGroups.push({ title: `Group ${this.draftGroups.length + 1}`, topic: '' });
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
    } else if (this.draftType === 'welcome') {
      patch.config = {
        welcomeText: this.draftWelcomeText.trim(),
        backgroundImageUrl: this.draftBackgroundImageUrl.trim()
      };
    } else if (this.draftType === 'breakout') {
      const existing = this.selectedStep()?.config || this.session()?.currentStep?.config || {};
      const prevAssignments =
        existing && typeof existing === 'object' && existing.assignments && typeof existing.assignments === 'object'
          ? existing.assignments
          : {};
      patch.config = { assignments: { ...prevAssignments } };
      patch.groups = this.draftGroups
        .filter((g) => g.title.trim())
        .map((g) => ({ id: g.id, title: g.title.trim(), topic: (g.topic || '').trim() }));
      if (!patch.groups.length) {
        patch.groups = [
          { title: 'Group 1', topic: '' },
          { title: 'Group 2', topic: '' },
          { title: 'Group 3', topic: '' }
        ];
      }
    }
    return patch;
  }

  onBackgroundFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploadingBg.set(true);
    this.message.set('');
    void fileToEmbeddedImageDataUrl(file)
      .then((dataUrl) => {
        this.draftBackgroundImageUrl = dataUrl;
        this.uploadingBg.set(false);
        this.message.set('Background ready — click Save step settings to apply.');
      })
      .catch((err: unknown) => {
        this.uploadingBg.set(false);
        this.message.set(err instanceof Error ? err.message : 'Could not read image file');
      });
  }

  bgPreviewCss() {
    return cssBackgroundImage(this.draftBackgroundImageUrl);
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
    const before = this.snapshotStep(stepId);
    this.busySettings.set(true);
    this.message.set('');
    this.api.updateStep(this.id, stepId, this.buildStepPatch(), { restartTimer }).subscribe({
      next: (s) => {
        this.session.set(s);
        this.busySettings.set(false);
        this.loadStepDraft();
        const after = this.snapshotStep(stepId);
        if (!this.applyingContentHistory && before && after && JSON.stringify(before) !== JSON.stringify(after)) {
          this.contentUndo.push({ stepId, before, after });
          if (this.contentUndo.length > 40) this.contentUndo.shift();
          this.contentRedo = [];
        }
        this.message.set(restartTimer ? 'Step saved and timer restarted.' : 'Step settings saved.');
        this.panelTick.update((n) => n + 1);
      },
      error: (e) => {
        this.busySettings.set(false);
        this.message.set(e?.error?.message || 'Could not save step');
      }
    });
  }

  canUndoContent() {
    return this.contentUndo.length > 0;
  }

  canRedoContent() {
    return this.contentRedo.length > 0;
  }

  undoContent() {
    const entry = this.contentUndo.pop();
    if (!entry || this.busySettings()) return;
    this.contentRedo.push(entry);
    this.applyContentSnapshot(entry.stepId, entry.before);
  }

  redoContent() {
    const entry = this.contentRedo.pop();
    if (!entry || this.busySettings()) return;
    this.contentUndo.push(entry);
    this.applyContentSnapshot(entry.stepId, entry.after);
  }

  private snapshotStep(stepId: string) {
    const step = (this.session()?.steps || []).find((s: any) => s.id === stepId);
    if (!step) return null;
    return {
      title: step.title || '',
      instructions: step.instructions || '',
      timerSeconds: step.timerSeconds ?? null,
      config: JSON.parse(JSON.stringify(step.config || {})),
      groups: JSON.parse(JSON.stringify(step.groups || []))
    };
  }

  private applyContentSnapshot(stepId: string, snap: any) {
    this.applyingContentHistory = true;
    this.busySettings.set(true);
    this.selectedStepId.set(stepId);
    this.api
      .updateStep(this.id, stepId, {
        title: snap.title,
        instructions: snap.instructions,
        timerSeconds: snap.timerSeconds,
        config: snap.config,
        groups: snap.groups
      })
      .subscribe({
        next: (s) => {
          this.session.set(s);
          this.busySettings.set(false);
          this.applyingContentHistory = false;
          this.tab.set('settings');
          this.loadStepDraft();
          this.message.set('Content restored.');
          this.panelTick.update((n) => n + 1);
        },
        error: (e) => {
          this.busySettings.set(false);
          this.applyingContentHistory = false;
          this.message.set(e?.error?.message || 'Could not restore content');
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
        const prevStepId = this.session()?.currentStepId;
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
        if (!this.selectedStepId() && s.currentStepId) {
          this.selectedStepId.set(s.currentStepId);
        }
        if (this.tab() === 'settings' && (!this.draftStepId || !this.selectedStepId())) {
          this.loadStepDraft();
        } else if (
          this.tab() === 'settings' &&
          s.currentStepId !== prevStepId &&
          this.selectedStepId() === s.currentStepId
        ) {
          this.loadStepDraft();
        }
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
