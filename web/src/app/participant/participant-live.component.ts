import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { BoschButtonComponent } from '../bosch-ui/bosch-button/bosch-button.component';
import { BoschCardComponent } from '../bosch-ui/bosch-card/bosch-card.component';
import { BoschLogoComponent } from '../bosch-ui/bosch-logo/bosch-logo.component';
import { BoschAvatarComponent } from '../bosch-ui/bosch-avatar/bosch-avatar.component';
import { ApiService } from '../core/api.service';
import { RealtimeService } from '../core/realtime.service';

@Component({
  selector: 'app-participant-live',
  standalone: true,
  imports: [FormsModule, BoschButtonComponent, BoschCardComponent, BoschLogoComponent, BoschAvatarComponent],
  template: `
    <div class="page">
      <header class="top">
        <app-bosch-logo />
        <div class="me">
          <app-bosch-avatar [name]="displayName()" size="sm" />
          <span>{{ displayName() }}</span>
        </div>
      </header>

      <h1>{{ session()?.title }}</h1>
      <p class="status">{{ session()?.status }} · {{ session()?.currentStep?.title }}</p>

      @if (session()?.status === 'LOBBY' || !session()?.currentStep) {
        <app-bosch-card title="Waiting" subtitle="Host will start shortly">
          <p>Stay on this screen. Your facilitator controls the next step.</p>
        </app-bosch-card>
      } @else if (session()?.currentStep?.type === 'welcome') {
        <app-bosch-card title="Welcome" [subtitle]="session()?.currentStep?.title">
          <p>{{ session()?.currentStep?.instructions }}</p>
        </app-bosch-card>
      }

      @if (session()?.status !== 'LOBBY' && session()?.currentStep?.type === 'poll') {
        <app-bosch-card title="Poll" [subtitle]="session()?.currentStep?.instructions">
          <div class="options">
            @for (o of options(); track o.id) {
              <app-bosch-button
                [block]="true"
                [variant]="picked() === o.id ? 'primary' : 'secondary'"
                (click)="answerPoll(o.id)"
              >
                {{ o.label }}
              </app-bosch-button>
            }
          </div>
        </app-bosch-card>
      }

      @if (session()?.status !== 'LOBBY' && session()?.currentStep?.type === 'input') {
        <app-bosch-card title="Sticky notes" [subtitle]="session()?.currentStep?.instructions">
          <div class="groups">
            @for (g of session()?.currentStep?.groups || []; track g.id) {
              <button type="button" class="g" [class.on]="groupId === g.id" (click)="groupId = g.id">
                {{ g.title }}
              </button>
            }
          </div>
          <textarea [(ngModel)]="content" rows="4" placeholder="Your sticky note…"></textarea>
          <app-bosch-button icon="add" [block]="true" (click)="submitEntry()">Add note</app-bosch-button>
        </app-bosch-card>
      }

      @if (session()?.status !== 'LOBBY' && session()?.currentStep?.type === 'voting') {
        <app-bosch-card title="Vote" [subtitle]="'Remaining votes: ' + votesLeft()">
          <div class="vote-list">
            @for (e of entries(); track e.id) {
              <button type="button" class="vote" (click)="vote(e.id)">
                <div class="vote__meta">
                  @if (e.authorName) {
                    <app-bosch-avatar [name]="e.authorName" size="sm" />
                    <span>{{ e.authorName }}</span>
                  } @else {
                    <span class="muted">Anonymous</span>
                  }
                </div>
                <p>{{ e.content }}</p>
                <span class="vote__cta">Tap to vote</span>
              </button>
            }
          </div>
        </app-bosch-card>
      }

      @if (session()?.status !== 'LOBBY' && session()?.currentStep?.type === 'form') {
        <app-bosch-card title="Define 1 action" subtitle="Owner + due date">
          <label>Action <input [(ngModel)]="action" placeholder="What will we do?" /></label>
          <label>
            Owner
            <div class="owner-row">
              <app-bosch-avatar [name]="owner || displayName()" size="sm" />
              <input [(ngModel)]="owner" [placeholder]="displayName()" />
            </div>
          </label>
          <label>Due date <input type="date" [(ngModel)]="dueDate" /></label>
          <app-bosch-button icon="save" [block]="true" (click)="submitAction()">Submit</app-bosch-button>
        </app-bosch-card>
      }

      @if (session()?.status === 'CLOSED') {
        <app-bosch-card title="Thanks" subtitle="Session closed">
          <p>Results were saved by the host.</p>
        </app-bosch-card>
      }

      @if (msg()) {
        <p class="msg">{{ msg() }}</p>
      }
    </div>
  `,
  styles: `
    .page {
      display: grid;
      gap: 0.85rem;
      margin: 0 auto;
      max-width: 480px;
      padding: 1rem;
    }

    .top {
      align-items: center;
      display: flex;
      justify-content: space-between;
    }

    .me {
      align-items: center;
      color: var(--bosch-text-secondary);
      display: inline-flex;
      font-size: 0.9rem;
      font-weight: 600;
      gap: 0.45rem;
    }

    h1 {
      font-size: 1.25rem;
      margin: 0;
    }

    .status {
      color: var(--bosch-text-muted);
      margin: 0;
    }

    .options,
    .vote-list {
      display: grid;
      gap: 0.5rem;
    }

    .groups {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 0.75rem;
    }

    .g {
      background: var(--bosch-surface);
      border: 1px solid var(--bosch-border-strong);
      padding: 0.4rem 0.6rem;
    }

    .g.on {
      background: var(--bosch-accent-soft);
      border-color: var(--bosch-accent);
    }

    textarea,
    input {
      border: 1px solid var(--bosch-border-strong);
      box-sizing: border-box;
      font: inherit;
      margin-bottom: 0.65rem;
      padding: 0.65rem;
      width: 100%;
    }

    label {
      display: grid;
      font-weight: 600;
      gap: 0.25rem;
    }

    .owner-row {
      align-items: center;
      display: grid;
      gap: 0.5rem;
      grid-template-columns: auto 1fr;
    }

    .owner-row input {
      margin-bottom: 0;
    }

    .vote {
      background: var(--bosch-yellow-95);
      border: 1px solid var(--bosch-border);
      display: grid;
      gap: 0.45rem;
      padding: 0.75rem;
      text-align: left;
    }

    .vote__meta {
      align-items: center;
      display: flex;
      gap: 0.4rem;
      font-size: 0.82rem;
      font-weight: 600;
    }

    .vote p {
      margin: 0;
    }

    .vote__cta {
      color: var(--bosch-accent);
      font-size: 0.78rem;
      font-weight: 700;
    }

    .muted {
      color: var(--bosch-text-muted);
    }

    .msg {
      color: var(--bosch-accent);
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
  displayName = signal(localStorage.getItem('wos_display_name') || 'You');
  content = '';
  groupId = '';
  action = '';
  owner = '';
  dueDate = '';
  msg = signal('');

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || this.api.sessionId();
    if (!this.owner) this.owner = this.displayName() === 'You' ? '' : this.displayName();
    this.realtime.connect(this.id);
    this.refresh();
    this.sub = this.realtime.events$.subscribe((e) => {
      if (e.type === 'step.changed' || e.type === 'session.ended') {
        this.session.set(e.data);
        this.loadStepData();
      }
      if (e.type === 'vote.updated') {
        this.votesLeft.set(e.data?.votesRemaining ?? this.votesLeft());
        this.api.listEntries(this.id).subscribe((list) => this.entries.set(list));
      }
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.realtime.disconnect();
  }

  refresh() {
    this.api.getDisplay(this.id).subscribe((s) => {
      this.session.set(s);
      this.loadStepData();
    });
  }

  loadStepData() {
    const step = this.session()?.currentStep;
    if (!step) return;
    if (step.type === 'poll') {
      try {
        const cfg = typeof step.config === 'string' ? JSON.parse(step.config) : step.config;
        this.options.set(cfg.options || []);
      } catch {
        this.options.set([]);
      }
    }
    if (step.type === 'voting' || step.type === 'input') {
      this.api.listEntries(this.id, step.id).subscribe((e) => this.entries.set(e));
      if (step.groups?.length && !this.groupId) this.groupId = step.groups[0].id;
    }
    if (step.type === 'voting') {
      try {
        const cfg = typeof step.config === 'string' ? JSON.parse(step.config) : step.config;
        this.votesLeft.set(cfg.votesPerParticipant ?? 3);
      } catch {
        this.votesLeft.set(3);
      }
    }
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
    this.api.submitEntry(this.id, this.content, this.groupId || undefined).subscribe({
      next: () => {
        this.content = '';
        this.msg.set('Added');
      },
      error: (e) => this.msg.set(e?.error?.message)
    });
  }

  vote(entryId: string) {
    this.api.castVote(this.id, entryId).subscribe({
      next: (r) => {
        this.votesLeft.set(r.votesRemaining);
        this.msg.set('Vote cast');
      },
      error: (e) => this.msg.set(e?.error?.message)
    });
  }

  submitAction() {
    const owner = this.owner || this.displayName();
    this.api.submitAction(this.id, { action: this.action, owner, dueDate: this.dueDate }).subscribe({
      next: () => {
        this.action = '';
        this.msg.set('Action saved');
      },
      error: (e) => this.msg.set(e?.error?.message)
    });
  }
}
