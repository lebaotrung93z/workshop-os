import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { BoschButtonComponent } from '../bosch-ui/bosch-button/bosch-button.component';
import { BoschAvatarComponent } from '../bosch-ui/bosch-avatar/bosch-avatar.component';
import { ApiService } from '../core/api.service';
import { RealtimeService } from '../core/realtime.service';
import { formLinksToKr, isOkrBoard, parseStepConfig } from '../core/okr.util';
import {
  formatCountdown,
  isTimerPaused,
  isTimerRunning,
  remainingSeconds
} from '../core/timer.util';

@Component({
  selector: 'app-participant-live',
  standalone: true,
  imports: [FormsModule, BoschButtonComponent, BoschAvatarComponent],
  template: `
    <div class="page">
      <div class="phone">
        <header class="hero">
          <div class="hero__row">
            <div class="hero__copy">
              <p class="brand">Workshop OS</p>
              <h1>{{ session()?.title || 'Workshop' }}</h1>
            </div>
            <app-bosch-avatar [name]="displayName()" size="sm" />
          </div>
          <div class="meta">
            <span class="chip" [attr.data-tone]="statusTone()">{{ statusLabel() }}</span>
            <span class="meta__step">
              @if (stepIndexLabel()) {
                {{ stepIndexLabel() }} ·
              }
              {{ session()?.currentStep?.title || 'Lobby' }}
            </span>
            @if (timerLabel()) {
              <span class="meta__timer" [class.is-paused]="timerPaused()" [class.is-ended]="timerEnded()">
                {{ timerLabel() }}
              </span>
            }
          </div>
        </header>

        @if (session()?.status === 'CLOSED') {
          <section class="panel done">
            <div class="done__icon">✓</div>
            <div class="done__copy">
              <h2>All set!</h2>
              <p>Thanks for contributing. Results were saved by the host.</p>
            </div>
          </section>
        } @else if (session()?.status === 'LOBBY' || !session()?.currentStep) {
          <section class="panel">
            <div class="panel__head">
              <h2>Waiting</h2>
              <p class="hint">Host will start shortly. Stay on this screen.</p>
            </div>
          </section>
        } @else if (session()?.currentStep?.type === 'welcome') {
          <section class="panel">
            <div class="panel__head">
              <h2>{{ session()?.currentStep?.title || 'Welcome' }}</h2>
              <p class="hint">{{ session()?.currentStep?.instructions }}</p>
            </div>
          </section>
        } @else if (session()?.currentStep?.type === 'poll') {
          <section class="panel">
            <div class="panel__head">
              <h2>Poll</h2>
              <p class="hint">{{ session()?.currentStep?.instructions }}</p>
            </div>
            <div class="options">
              @for (o of options(); track o.id) {
                <button
                  type="button"
                  class="option"
                  [class.on]="picked() === o.id"
                  (click)="answerPoll(o.id)"
                >
                  <span class="radio"></span>
                  <span>{{ o.label }}</span>
                </button>
              }
            </div>
            <div class="panel__actions">
              <app-bosch-button [block]="true" [disabled]="!picked()" (click)="msg.set('Answer recorded')">
                Submit
              </app-bosch-button>
            </div>
          </section>
        } @else if (session()?.currentStep?.type === 'input') {
          <section class="panel">
            <div class="panel__head">
              <h2>{{ isOkr() ? 'Key Results' : 'Share ideas' }}</h2>
              <p class="hint">{{ session()?.currentStep?.instructions || 'Add sticky notes in each column.' }}</p>
            </div>

            @if (isOkr()) {
              <div class="obj-list">
                <p class="field__label">Select Objective</p>
                @for (o of objectives(); track o.id) {
                  <button type="button" class="obj" [class.on]="parentId === o.id" (click)="parentId = o.id">
                    <strong>{{ o.content }}</strong>
                    <span>{{ krsUnder(o.id).length }} KRs</span>
                  </button>
                } @empty {
                  <p class="empty">Waiting for the host to add an Objective.</p>
                }
              </div>
              <div class="compose">
                <label class="field">
                  <span class="field__label">Key Result</span>
                  <textarea [(ngModel)]="content" rows="3" placeholder="Add a measurable key result…"></textarea>
                </label>
                <app-bosch-button
                  icon="add"
                  [block]="true"
                  [disabled]="!content.trim() || !parentId"
                  (click)="submitKr()"
                >
                  Add Key Result
                </app-bosch-button>
              </div>
              @if (myEntries().length) {
                <div class="mine">
                  <p class="field__label">Your Key Results</p>
                  @for (e of myEntries(); track e.id) {
                    <div class="mine-card">
                      @if (editingEntryId === e.id) {
                        <textarea [(ngModel)]="editContent" rows="2"></textarea>
                        <div class="mine-actions">
                          <app-bosch-button [disabled]="!editContent.trim() || busy()" (click)="saveEntry(e)">Save</app-bosch-button>
                          <button type="button" class="link" (click)="cancelEdit()">Cancel</button>
                        </div>
                      } @else {
                        <p>{{ e.content }}</p>
                        <div class="mine-actions">
                          <button type="button" class="link" (click)="startEditEntry(e)">Edit</button>
                          <button type="button" class="danger" (click)="deleteEntry(e.id)">Delete</button>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            } @else {
              <div class="group-cards">
                @for (g of session()?.currentStep?.groups || []; track g.id; let gi = $index) {
                  <button
                    type="button"
                    class="gcard"
                    [attr.data-tone]="gi % 3"
                    [class.on]="groupId === g.id"
                    (click)="groupId = g.id"
                  >
                    <strong>{{ g.title }}</strong>
                    <span>{{ countFor(g.id) }} added</span>
                  </button>
                }
              </div>
              <div class="compose">
                <label class="field">
                  <span class="field__label">Your idea</span>
                  <textarea [(ngModel)]="content" rows="3" placeholder="Add idea…"></textarea>
                </label>
                <app-bosch-button icon="add" [block]="true" [disabled]="!content.trim() || !groupId" (click)="submitEntry()">
                  Add idea
                </app-bosch-button>
              </div>
              @if (myEntries().length) {
                <div class="mine">
                  <p class="field__label">Your ideas</p>
                  @for (e of myEntries(); track e.id) {
                    <div class="mine-card">
                      @if (editingEntryId === e.id) {
                        <textarea [(ngModel)]="editContent" rows="2"></textarea>
                        <div class="mine-actions">
                          <app-bosch-button [disabled]="!editContent.trim() || busy()" (click)="saveEntry(e)">Save</app-bosch-button>
                          <button type="button" class="link" (click)="cancelEdit()">Cancel</button>
                        </div>
                      } @else {
                        <p>{{ e.content }}</p>
                        <div class="mine-actions">
                          <button type="button" class="link" (click)="startEditEntry(e)">Edit</button>
                          <button type="button" class="danger" (click)="deleteEntry(e.id)">Delete</button>
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            }
          </section>
        } @else if (session()?.currentStep?.type === 'voting') {
          <section class="panel">
            <div class="panel__head vote-head">
              <div>
                <h2>Vote</h2>
                <p class="hint">{{ isOkr() ? 'Tap a Key Result to cast a vote' : 'Tap an idea to cast a vote' }}</p>
              </div>
              <span class="votes-left">{{ votesLeft() }} left</span>
            </div>
            <div class="vote-list">
              @for (e of voteEntries(); track e.id) {
                <button type="button" class="vote" (click)="vote(e.id)">
                  <div class="vote__top">
                    <div class="vote__meta">
                      @if (e.authorName) {
                        <app-bosch-avatar [name]="e.authorName" size="sm" />
                        <span>{{ e.authorName }}</span>
                      } @else {
                        <span class="muted">Anonymous</span>
                      }
                    </div>
                    <span class="vote__count" [attr.aria-label]="voteCount(e.id) + ' votes'">
                      <strong>{{ voteCount(e.id) }}</strong>
                      <em>{{ voteCount(e.id) === 1 ? 'vote' : 'votes' }}</em>
                    </span>
                  </div>
                  @if (parentLabel(e); as pl) {
                    <span class="vote__parent">{{ pl }}</span>
                  }
                  <p>{{ e.content }}</p>
                  <span class="vote__cta">Tap to vote</span>
                </button>
              } @empty {
                <p class="empty">No ideas to vote on yet. Wait for the board to fill, then try again.</p>
              }
            </div>
          </section>
        } @else if (session()?.currentStep?.type === 'form') {
          <section class="panel">
            <div class="panel__head">
              <h2>{{ editingActionId ? 'Update action' : 'Define 1 action' }}</h2>
              <p class="hint">
                {{
                  linksToKr()
                    ? 'Pick a Key Result, then capture the commitment. You can edit or delete later.'
                    : 'Capture a commitment. You can edit or delete it anytime on this step.'
                }}
              </p>
            </div>
            <div class="form-fields">
              @if (linksToKr()) {
                <label class="field">
                  <span class="field__label">Key Result</span>
                  <select [(ngModel)]="sourceEntryId">
                    <option value="">Select a Key Result…</option>
                    @for (kr of krChoices(); track kr.id) {
                      <option [value]="kr.id">{{ kr.content }}</option>
                    }
                  </select>
                </label>
              }
              <label class="field">
                <span class="field__label">Action</span>
                <input [(ngModel)]="action" placeholder="What will we do?" />
              </label>
              <label class="field">
                <span class="field__label">Owner</span>
                <div class="owner-row">
                  <app-bosch-avatar [name]="owner || displayName()" size="sm" />
                  <input [(ngModel)]="owner" [placeholder]="displayName()" />
                </div>
              </label>
              <label class="field">
                <span class="field__label">Due date</span>
                <input type="date" [(ngModel)]="dueDate" />
              </label>
            </div>
            <div class="panel__actions">
              <app-bosch-button
                icon="save"
                [block]="true"
                [disabled]="!action.trim() || (linksToKr() && !sourceEntryId) || busy()"
                (click)="editingActionId ? saveAction() : submitAction()"
              >
                {{ editingActionId ? 'Save changes' : 'Submit' }}
              </app-bosch-button>
              @if (editingActionId) {
                <button type="button" class="link cancel-edit" (click)="cancelActionEdit()">Cancel edit</button>
              }
            </div>
            @if (myActions().length) {
              <div class="mine">
                <p class="field__label">Your actions</p>
                @for (a of myActions(); track a.id) {
                  <div class="mine-card">
                    <p>{{ a.action }}</p>
                    <p class="mine-meta">
                      {{ a.owner || 'Unassigned' }}
                      @if (a.dueDate) {
                        · {{ a.dueDate }}
                      }
                    </p>
                    <div class="mine-actions">
                      <button type="button" class="link" (click)="startEditAction(a)">Edit</button>
                      <button type="button" class="danger" (click)="deleteAction(a.id)">Delete</button>
                    </div>
                  </div>
                }
              </div>
            }
          </section>
        }

        @if (msg()) {
          <p class="toast" role="status">{{ msg() }}</p>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      --gap-xs: 0.25rem;
      --gap-sm: 0.5rem;
      --gap-md: 0.75rem;
      --gap-lg: 1.25rem;
      --gap-xl: 1.75rem;
    }

    .page {
      align-items: stretch;
      background: linear-gradient(180deg, #dbe7ff 0%, #eef3fb 42%, #f5f7fb 100%);
      display: flex;
      justify-content: center;
      min-height: 100vh;
      padding: 0.75rem;
    }

    .phone {
      background: #fff;
      border: 1px solid var(--wos-border);
      border-radius: 28px;
      box-shadow: var(--wos-shadow-lg);
      display: flex;
      flex-direction: column;
      gap: var(--gap-md);
      max-width: 420px;
      padding: 1.15rem 1rem 1.35rem;
      width: 100%;
    }

    .hero {
      display: flex;
      flex-direction: column;
      gap: var(--gap-sm);
      padding-bottom: var(--gap-xs);
    }

    .hero__row {
      align-items: flex-start;
      display: flex;
      gap: var(--gap-md);
      justify-content: space-between;
    }

    .hero__copy {
      display: flex;
      flex-direction: column;
      gap: var(--gap-xs);
      min-width: 0;
    }

    .brand {
      color: var(--wos-primary);
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      margin: 0;
      text-transform: uppercase;
    }

    h1 {
      font-size: 1.2rem;
      font-weight: 750;
      line-height: 1.25;
      margin: 0;
    }

    .meta {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: var(--gap-sm);
    }

    .chip {
      background: var(--wos-primary-soft);
      border-radius: var(--wos-radius-pill);
      color: var(--wos-primary);
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.02em;
      padding: 0.28rem 0.65rem;
    }

    .chip[data-tone='ok'] {
      background: var(--wos-success-soft);
      color: var(--wos-success-ink);
    }

    .chip[data-tone='wait'] {
      background: #eef1f6;
      color: var(--wos-text-muted);
    }

    .meta__step {
      color: var(--wos-text-secondary);
      font-size: 0.86rem;
      font-weight: 600;
    }

    .meta__timer {
      background: #0f172a;
      border-radius: var(--wos-radius-pill);
      color: #fff;
      font-size: 0.78rem;
      font-variant-numeric: tabular-nums;
      font-weight: 800;
      margin-left: auto;
      padding: 0.28rem 0.65rem;
    }
    .meta__timer.is-paused { background: #92400e; }
    .meta__timer.is-ended { background: var(--wos-danger); }

    .panel {
      background: #f7f9fc;
      border: 1px solid var(--wos-border);
      border-radius: 16px;
      display: flex;
      flex-direction: column;
      gap: var(--gap-md);
      padding: 1.05rem 0.95rem 1.1rem;
    }

    .panel__head {
      display: flex;
      flex-direction: column;
      gap: var(--gap-xs);
      margin-bottom: var(--gap-xs);
    }

    .panel__head h2,
    .done__copy h2 {
      font-size: 1.05rem;
      font-weight: 750;
      margin: 0;
    }

    .hint {
      color: var(--wos-text-muted);
      font-size: 0.9rem;
      line-height: 1.4;
      margin: 0;
    }

    .panel__actions,
    .compose {
      display: flex;
      flex-direction: column;
      gap: var(--gap-sm);
      margin-top: var(--gap-xs);
      padding-top: var(--gap-lg);
      border-top: 1px solid var(--wos-border);
    }

    .options,
    .group-cards,
    .vote-list,
    .form-fields {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .option {
      align-items: center;
      background: #fff;
      border: 1px solid var(--wos-border-strong);
      border-radius: var(--wos-radius);
      cursor: pointer;
      display: flex;
      font-weight: 600;
      gap: 0.7rem;
      padding: 0.85rem 0.9rem;
      text-align: left;
    }

    .option.on {
      background: var(--wos-primary-soft);
      border-color: var(--wos-primary);
      box-shadow: 0 0 0 3px var(--wos-primary-ring);
    }

    .radio {
      border: 2px solid var(--wos-border-strong);
      border-radius: 50%;
      flex: 0 0 1.05rem;
      height: 1.05rem;
      width: 1.05rem;
    }

    .option.on .radio {
      background: var(--wos-primary);
      border-color: var(--wos-primary);
      box-shadow: inset 0 0 0 2px #fff;
    }

    .gcard {
      align-items: center;
      border: 1px solid transparent;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      gap: var(--gap-sm);
      justify-content: space-between;
      padding: 0.85rem 0.9rem;
      text-align: left;
      transition: box-shadow 0.15s ease, transform 0.1s ease;
    }

    .gcard strong {
      font-size: 0.92rem;
      line-height: 1.3;
    }

    .gcard span {
      flex: 0 0 auto;
      font-size: 0.75rem;
      font-weight: 800;
      opacity: 0.85;
      white-space: nowrap;
    }

    .gcard[data-tone='0'] {
      background: var(--wos-success-soft);
      color: var(--wos-success-ink);
    }

    .gcard[data-tone='1'] {
      background: var(--wos-danger-soft);
      color: var(--wos-danger-ink);
    }

    .gcard[data-tone='2'] {
      background: var(--wos-info-soft);
      color: var(--wos-info-ink);
    }

    .gcard.on {
      box-shadow: 0 0 0 2px var(--wos-primary);
      transform: translateY(-1px);
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin: 0;
    }

    .field__label {
      color: var(--wos-text-secondary);
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    textarea,
    input {
      border: 1px solid var(--wos-border-strong);
      border-radius: var(--wos-radius);
      box-sizing: border-box;
      font: inherit;
      padding: 0.8rem 0.85rem;
      resize: vertical;
      width: 100%;
    }

    textarea:focus,
    input:focus {
      border-color: var(--wos-primary);
      box-shadow: 0 0 0 3px var(--wos-primary-ring);
      outline: none;
    }

    .owner-row {
      align-items: center;
      display: grid;
      gap: var(--gap-sm);
      grid-template-columns: auto 1fr;
    }

    .vote-head {
      align-items: flex-start;
      display: flex;
      flex-direction: row;
      gap: var(--gap-md);
      justify-content: space-between;
    }

    .votes-left {
      background: var(--wos-primary-soft);
      border-radius: var(--wos-radius-pill);
      color: var(--wos-primary);
      flex: 0 0 auto;
      font-size: 0.75rem;
      font-weight: 800;
      padding: 0.35rem 0.65rem;
    }

    .vote {
      background: #fff;
      border: 1px solid var(--wos-border);
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: var(--gap-sm);
      padding: 0.85rem 0.9rem;
      text-align: left;
    }

    .vote:active {
      border-color: var(--wos-primary);
      box-shadow: 0 0 0 3px var(--wos-primary-ring);
    }

    .vote__top {
      align-items: center;
      display: flex;
      gap: 0.65rem;
      justify-content: space-between;
    }

    .vote__meta {
      align-items: center;
      color: var(--wos-text-secondary);
      display: flex;
      font-size: 0.8rem;
      font-weight: 650;
      gap: 0.45rem;
      min-width: 0;
    }

    .vote__count {
      align-items: baseline;
      background: var(--wos-purple-soft);
      border-radius: var(--wos-radius-pill);
      color: var(--wos-purple);
      display: inline-flex;
      flex: 0 0 auto;
      gap: 0.25rem;
      padding: 0.3rem 0.65rem;
    }
    .vote__count strong {
      font-size: 1rem;
      font-weight: 800;
      line-height: 1;
    }
    .vote__count em {
      font-size: 0.68rem;
      font-style: normal;
      font-weight: 700;
      text-transform: uppercase;
    }

    .vote p {
      color: var(--wos-text);
      font-size: 0.95rem;
      line-height: 1.4;
      margin: 0;
    }

    .vote__cta {
      color: var(--wos-primary);
      font-size: 0.75rem;
      font-weight: 750;
    }

    .vote__parent {
      color: var(--wos-primary);
      font-size: 0.72rem;
      font-weight: 700;
    }

    .obj-list {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .obj {
      background: var(--wos-primary-soft);
      border: 1px solid transparent;
      border-radius: 10px;
      color: var(--wos-primary);
      cursor: pointer;
      display: flex;
      gap: 0.5rem;
      justify-content: space-between;
      padding: 0.85rem 0.9rem;
      text-align: left;
    }

    .obj.on {
      border-color: var(--wos-primary);
      box-shadow: 0 0 0 2px var(--wos-primary-ring);
    }

    .obj span {
      flex: 0 0 auto;
      font-size: 0.75rem;
      font-weight: 800;
      opacity: 0.85;
    }

    select {
      border: 1px solid var(--wos-border-strong);
      border-radius: var(--wos-radius);
      box-sizing: border-box;
      font: inherit;
      padding: 0.8rem 0.85rem;
      width: 100%;
    }

    .muted {
      color: var(--wos-text-muted);
    }

    .empty {
      background: #fff;
      border: 1px dashed var(--wos-border-strong);
      border-radius: var(--wos-radius);
      color: var(--wos-text-muted);
      font-size: 0.9rem;
      line-height: 1.4;
      margin: 0;
      padding: 1rem 0.9rem;
      text-align: center;
    }

    .done {
      align-items: center;
      gap: var(--gap-lg);
      justify-items: center;
      padding: 2.25rem 1rem;
      text-align: center;
    }

    .done__icon {
      align-items: center;
      background: var(--wos-success-soft);
      border-radius: 50%;
      color: var(--wos-success-ink);
      display: flex;
      font-size: 1.85rem;
      font-weight: 800;
      height: 4.25rem;
      justify-content: center;
      width: 4.25rem;
    }

    .done__copy {
      display: flex;
      flex-direction: column;
      gap: var(--gap-sm);
    }

    .done__copy p {
      color: var(--wos-text-muted);
      margin: 0;
    }

    .toast {
      background: var(--wos-primary-soft);
      border-radius: var(--wos-radius);
      color: var(--wos-primary);
      font-size: 0.9rem;
      font-weight: 700;
      margin: 0;
      padding: 0.7rem 0.85rem;
      text-align: center;
    }

    .mine {
      display: grid;
      gap: var(--gap-sm);
      margin-top: var(--gap-md);
    }
    .mine-card {
      background: #f8fafc;
      border: 1px solid var(--wos-border);
      border-radius: var(--wos-radius);
      display: grid;
      gap: 0.45rem;
      padding: 0.75rem;
    }
    .mine-card p { margin: 0; }
    .mine-card textarea {
      border: 1px solid var(--wos-border-strong);
      border-radius: var(--wos-radius);
      font: inherit;
      padding: 0.55rem 0.65rem;
      width: 100%;
    }
    .mine-meta { color: var(--wos-text-muted); font-size: 0.8rem; }
    .mine-actions { display: flex; gap: 0.85rem; }
    .mine-actions .link, .cancel-edit {
      background: transparent;
      border: 0;
      color: var(--wos-primary);
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 700;
      padding: 0;
    }
    .mine-actions .danger {
      background: transparent;
      border: 0;
      color: var(--wos-danger);
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 700;
      padding: 0;
    }
    .cancel-edit { display: block; margin-top: 0.5rem; text-align: center; width: 100%; }

    @media (max-width: 480px) {
      .page {
        padding: 0;
      }

      .phone {
        border: none;
        border-radius: 0;
        box-shadow: none;
        max-width: none;
        min-height: 100vh;
        padding: 1.15rem 1rem 1.5rem;
      }
    }
  `
})
export class ParticipantLiveComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private realtime = inject(RealtimeService);
  private sub?: Subscription;

  id = '';
  session = signal<any>(null);
  entries = signal<any[]>([]);
  options = signal<any[]>([]);
  picked = signal('');
  votesLeft = signal(3);
  displayName = signal(this.api.displayName() || 'You');
  done = signal(false);
  content = '';
  groupId = '';
  parentId = '';
  sourceEntryId = '';
  action = '';
  owner = '';
  dueDate = '';
  msg = signal('');
  busy = signal(false);
  editingEntryId = '';
  editContent = '';
  editingActionId = '';
  private myEntryCounts = signal<Record<string, number>>({});
  private boardEntries = signal<any[]>([]); // all entries on OKR input step for objectives/parents
  private voteTallies = signal<any[]>([]);
  private myActionsList = signal<any[]>([]);
  private nowTick = signal(Date.now());
  private tickHandle: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || this.api.sessionId();
    if (this.api.displayName()) this.displayName.set(this.api.displayName());
    if (!this.owner && this.displayName() !== 'You') this.owner = this.displayName();
    this.realtime.connect(this.id);
    this.refresh();
    this.tickHandle = setInterval(() => this.nowTick.set(Date.now()), 250);
    this.sub = this.realtime.events$.subscribe((e) => {
      if (e.type === 'step.changed' || e.type === 'session.ended') {
        this.session.set(e.data);
        this.loadStepData();
        if (e.type === 'session.ended') this.done.set(true);
      }
      if (e.type === 'vote.updated' || e.type === 'entry.created' || e.type === 'action.created') {
        this.reloadBoardData();
        this.reloadMyActions();
        if (e.type === 'vote.updated' && e.data?.votesRemaining != null) {
          this.votesLeft.set(e.data.votesRemaining);
        }
      }
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.realtime.disconnect();
    if (this.tickHandle) clearInterval(this.tickHandle);
  }

  stepIndexLabel() {
    const steps = [...(this.session()?.steps || [])].sort((a: any, b: any) => a.stepOrder - b.stepOrder);
    const idx = steps.findIndex((s: any) => s.id === this.session()?.currentStepId);
    if (idx < 0) return '';
    return `Step ${idx + 1}/${steps.length}`;
  }

  timerPaused() {
    return isTimerPaused(this.session());
  }

  timerEnded() {
    const rem = remainingSeconds(this.session(), this.nowTick());
    return rem === 0 && isTimerRunning(this.session());
  }

  timerLabel() {
    this.nowTick();
    const rem = remainingSeconds(this.session(), this.nowTick());
    if (rem == null) return '';
    if (this.timerPaused()) return `Paused ${formatCountdown(rem)}`;
    if (rem === 0) return 'Time’s up';
    return formatCountdown(rem);
  }

  isOkr() {
    const step = this.session()?.currentStep;
    if (step?.type === 'input') return isOkrBoard(step);
    return (this.session()?.steps || []).some((s: any) => s.type === 'input' && isOkrBoard(s));
  }

  linksToKr() {
    const step = this.session()?.currentStep;
    if (step?.type !== 'form') return false;
    return formLinksToKr(step) || this.isOkr();
  }

  objectives() {
    return this.boardEntries().filter((e) => e.kind === 'objective');
  }

  krsUnder(objectiveId: string) {
    return this.boardEntries().filter((e) => e.kind === 'kr' && e.parentId === objectiveId);
  }

  myEntries() {
    const pid = this.api.participantId();
    if (!pid) return [];
    const step = this.session()?.currentStep;
    const pool = step?.type === 'input' ? this.entries() : this.boardEntries();
    return pool.filter((e) => e.participantId === pid && e.kind !== 'objective');
  }

  myActions() {
    return this.myActionsList();
  }

  parentLabel(entry: any): string | null {
    if (!entry?.parentId) return null;
    const parent = this.boardEntries().find((e) => e.id === entry.parentId) || this.entries().find((e) => e.id === entry.parentId);
    return parent?.content ? `Objective: ${parent.content}` : null;
  }

  krChoices() {
    const krs = this.boardEntries().filter((e) => e.kind === 'kr');
    const tallies = new Map(this.voteTallies().map((t) => [t.entryId, t.votes]));
    return [...krs].sort(
      (a, b) => (tallies.get(b.id) || 0) - (tallies.get(a.id) || 0) || String(a.content).localeCompare(String(b.content))
    );
  }

  voteCount(entryId: string) {
    return this.voteTallies().find((t) => t.entryId === entryId)?.votes || 0;
  }

  /** Voting cards sorted by current vote count (highest first). */
  voteEntries() {
    const tallies = new Map(this.voteTallies().map((t) => [t.entryId, t.votes]));
    return [...this.entries()].sort(
      (a, b) => (tallies.get(b.id) || 0) - (tallies.get(a.id) || 0) || String(a.content).localeCompare(String(b.content))
    );
  }

  statusLabel() {
    if (this.done() || this.session()?.status === 'CLOSED') return 'Done';
    const status = this.session()?.status;
    if (!status || status === 'LOBBY') return 'Waiting';
    return 'Live';
  }

  statusTone() {
    const label = this.statusLabel();
    if (label === 'Done') return 'ok';
    if (label === 'Waiting') return 'wait';
    return 'live';
  }

  refresh() {
    this.api.getDisplay(this.id).subscribe((s) => {
      this.session.set(s);
      this.loadStepData();
      if (s?.status === 'CLOSED') this.done.set(true);
    });
  }

  private parseConfig(step: any) {
    return parseStepConfig(step);
  }

  countFor(groupId: string) {
    return this.myEntryCounts()[groupId] || 0;
  }

  private inputStepId(): string | null {
    const steps = this.session()?.steps || [];
    const input = steps.find((s: any) => s.type === 'input' && isOkrBoard(s)) || steps.find((s: any) => s.type === 'input');
    return input?.id || null;
  }

  private reloadBoardData() {
    const step = this.session()?.currentStep;
    if (!step) return;
    if (step.type === 'voting' || step.type === 'input') {
      this.api.listEntries(this.id, step.id).subscribe((list) => {
        this.entries.set(list);
        this.syncMyCounts(list);
      });
    }
    const inputId = this.inputStepId();
    if (inputId) {
      this.api.listEntries(this.id, inputId).subscribe((list) => {
        this.boardEntries.set(list);
        if (step.type === 'input') this.syncMyCounts(list);
        if (this.isOkr() && !this.parentId && list.some((e) => e.kind === 'objective')) {
          this.parentId = list.find((e) => e.kind === 'objective')!.id;
        }
      });
    }
    if (step.type === 'form' || step.type === 'voting') {
      const voting = (this.session()?.steps || []).find((s: any) => s.type === 'voting');
      if (voting) {
        this.api.tallyVotes(this.id, voting.id).subscribe((t) => this.voteTallies.set(t));
      }
    }
    if (step.type === 'form') this.reloadMyActions();
  }

  private syncMyCounts(list: any[]) {
    const pid = this.api.participantId();
    if (!pid) return;
    const counts: Record<string, number> = {};
    list
      .filter((e) => e.participantId === pid && e.kind !== 'objective')
      .forEach((e) => {
        const gid = e.groupId || '_';
        counts[gid] = (counts[gid] || 0) + 1;
      });
    this.myEntryCounts.set(counts);
  }

  private reloadMyActions() {
    this.api.listActions(this.id).subscribe((list) => {
      const pid = this.api.participantId();
      this.myActionsList.set(pid ? list.filter((a) => a.participantId === pid) : []);
    });
  }

  loadStepData() {
    const step = this.session()?.currentStep;
    if (!step) {
      this.entries.set([]);
      return;
    }
    this.cancelEdit();
    this.cancelActionEdit();
    if (step.type === 'poll') {
      const cfg = this.parseConfig(step);
      this.options.set(cfg.options || []);
    }
    if (step.type === 'voting' || step.type === 'input') {
      this.api.listEntries(this.id, step.id).subscribe((e) => {
        this.entries.set(e);
        this.syncMyCounts(e);
      });
      if (step.type === 'input' && step.groups?.length && !this.groupId) {
        this.groupId = step.groups[0].id;
      }
    } else {
      this.entries.set([]);
    }
    if (step.type === 'voting') {
      const cfg = this.parseConfig(step);
      this.votesLeft.set(cfg.votesPerParticipant ?? 3);
    }
    this.reloadBoardData();
    if (step.type === 'form') this.reloadMyActions();
  }

  startEditEntry(e: any) {
    this.editingEntryId = e.id;
    this.editContent = e.content || '';
  }

  cancelEdit() {
    this.editingEntryId = '';
    this.editContent = '';
  }

  saveEntry(e: any) {
    const text = this.editContent.trim();
    if (!text) return;
    this.busy.set(true);
    this.api.updateEntry(this.id, e.id, { content: text, parentId: e.parentId, groupId: e.groupId }, { role: 'participant' }).subscribe({
      next: () => {
        this.busy.set(false);
        this.cancelEdit();
        this.msg.set('Updated');
        this.reloadBoardData();
      },
      error: (err) => {
        this.busy.set(false);
        this.msg.set(err?.error?.message || 'Update failed');
      }
    });
  }

  deleteEntry(entryId: string) {
    this.busy.set(true);
    this.api.removeOwnEntry(this.id, entryId).subscribe({
      next: () => {
        this.busy.set(false);
        if (this.editingEntryId === entryId) this.cancelEdit();
        this.msg.set('Deleted');
        this.reloadBoardData();
      },
      error: (err) => {
        this.busy.set(false);
        this.msg.set(err?.error?.message || 'Delete failed');
      }
    });
  }

  startEditAction(a: any) {
    this.editingActionId = a.id;
    this.action = a.action || '';
    this.owner = a.owner || this.displayName();
    this.dueDate = a.dueDate || '';
    this.sourceEntryId = a.sourceEntryId || '';
  }

  cancelActionEdit() {
    this.editingActionId = '';
    this.action = '';
    this.sourceEntryId = '';
  }

  saveAction() {
    if (!this.editingActionId || !this.action.trim()) return;
    const owner = this.owner || this.displayName();
    const kr = this.krChoices().find((e) => e.id === this.sourceEntryId);
    this.busy.set(true);
    this.api
      .updateAction(this.id, this.editingActionId, {
        action: this.action,
        owner,
        dueDate: this.dueDate,
        sourceEntryId: this.sourceEntryId || undefined,
        sourceLabel: kr?.content
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.cancelActionEdit();
          this.msg.set('Action updated');
          this.reloadMyActions();
        },
        error: (e) => {
          this.busy.set(false);
          this.msg.set(e?.error?.message || 'Update failed');
        }
      });
  }

  deleteAction(actionId: string) {
    this.busy.set(true);
    this.api.removeOwnAction(this.id, actionId).subscribe({
      next: () => {
        this.busy.set(false);
        if (this.editingActionId === actionId) this.cancelActionEdit();
        this.msg.set('Action deleted');
        this.reloadMyActions();
      },
      error: (e) => {
        this.busy.set(false);
        this.msg.set(e?.error?.message || 'Delete failed');
      }
    });
  }

  answerPoll(optionId: string) {
    this.api.submitEntry(this.id, optionId).subscribe({
      next: () => {
        this.picked.set(optionId);
        this.msg.set('Answer recorded');
      },
      error: (e) => this.msg.set(e?.error?.message)
    });
  }

  submitEntry() {
    const text = this.content.trim();
    const gid = this.groupId;
    if (!text || !gid) return;
    this.api.submitEntry(this.id, text, gid).subscribe({
      next: () => {
        this.content = '';
        this.msg.set('Idea added');
        this.reloadBoardData();
      },
      error: (e) => this.msg.set(e?.error?.message)
    });
  }

  submitKr() {
    const text = this.content.trim();
    const step = this.session()?.currentStep;
    if (!text || !this.parentId || !step) return;
    this.api
      .submitEntry(this.id, {
        stepId: step.id,
        groupId: step.groups?.[0]?.id,
        content: text,
        parentId: this.parentId,
        kind: 'kr'
      })
      .subscribe({
        next: () => {
          this.content = '';
          this.msg.set('Key Result added');
          this.reloadBoardData();
        },
        error: (e) => this.msg.set(e?.error?.message)
      });
  }

  vote(entryId: string) {
    this.api.castVote(this.id, entryId).subscribe({
      next: (r) => {
        this.votesLeft.set(r.votesRemaining);
        this.msg.set('Vote cast');
        this.reloadBoardData();
      },
      error: (e) => this.msg.set(e?.error?.message)
    });
  }

  submitAction() {
    const owner = this.owner || this.displayName();
    const kr = this.krChoices().find((e) => e.id === this.sourceEntryId);
    this.busy.set(true);
    this.api
      .submitAction(this.id, {
        action: this.action,
        owner,
        dueDate: this.dueDate,
        sourceEntryId: this.sourceEntryId || undefined,
        sourceLabel: kr?.content
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.action = '';
          this.sourceEntryId = '';
          this.msg.set('Action saved');
          this.reloadMyActions();
        },
        error: (e) => {
          this.busy.set(false);
          this.msg.set(e?.error?.message);
        }
      });
  }
}
