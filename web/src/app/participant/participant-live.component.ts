import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { BoschButtonComponent } from '../bosch-ui/bosch-button/bosch-button.component';
import { BoschAvatarComponent } from '../bosch-ui/bosch-avatar/bosch-avatar.component';
import { ApiService } from '../core/api.service';
import { RealtimeService } from '../core/realtime.service';

@Component({
  selector: 'app-participant-live',
  standalone: true,
  imports: [FormsModule, BoschButtonComponent, BoschAvatarComponent],
  template: `
    <div class="page">
      <div class="phone">
        <header class="top">
          <div>
            <p class="brand">Workshop OS</p>
            <h1>{{ session()?.title || 'Workshop' }}</h1>
          </div>
          <div class="me">
            <app-bosch-avatar [name]="displayName()" size="sm" />
          </div>
        </header>

        <p class="status">{{ session()?.status }} · {{ session()?.currentStep?.title || 'Lobby' }}</p>

        @if (session()?.status === 'CLOSED' || done()) {
          <section class="done">
            <div class="done__icon">✓</div>
            <h2>All set!</h2>
            <p>Thanks for contributing. Results were saved by the host.</p>
          </section>
        } @else if (session()?.status === 'LOBBY' || !session()?.currentStep) {
          <section class="card">
            <h2>Waiting</h2>
            <p>Host will start shortly. Stay on this screen.</p>
          </section>
        } @else if (session()?.currentStep?.type === 'welcome') {
          <section class="card">
            <h2>{{ session()?.currentStep?.title || 'Welcome' }}</h2>
            <p>{{ session()?.currentStep?.instructions }}</p>
          </section>
        } @else if (session()?.currentStep?.type === 'poll') {
          <section class="card">
            <h2>Poll</h2>
            <p class="hint">{{ session()?.currentStep?.instructions }}</p>
            <div class="options">
              @for (o of options(); track o.id) {
                <button
                  type="button"
                  class="option"
                  [class.on]="picked() === o.id"
                  (click)="answerPoll(o.id)"
                >
                  <span class="radio"></span>
                  {{ o.label }}
                </button>
              }
            </div>
            <app-bosch-button [block]="true" [disabled]="!picked()" (click)="msg.set('Answer recorded')">
              Submit
            </app-bosch-button>
          </section>
        } @else if (session()?.currentStep?.type === 'input') {
          <section class="card">
            <h2>Share ideas</h2>
            <p class="hint">{{ session()?.currentStep?.instructions }}</p>
            <div class="group-cards">
              @for (g of session()?.currentStep?.groups || []; track g.id; let gi = $index) {
                <button type="button" class="gcard" [attr.data-tone]="gi % 3" [class.on]="groupId === g.id" (click)="groupId = g.id">
                  <strong>{{ g.title }}</strong>
                  <span>{{ countFor(g.id) }} added</span>
                </button>
              }
            </div>
            <textarea [(ngModel)]="content" rows="4" placeholder="Add idea…"></textarea>
            <app-bosch-button icon="add" [block]="true" (click)="submitEntry()">Add idea</app-bosch-button>
          </section>
        } @else if (session()?.currentStep?.type === 'voting') {
          <section class="card">
            <div class="vote-top">
              <h2>Vote</h2>
              <span class="votes-left">{{ votesLeft() }} vote{{ votesLeft() === 1 ? '' : 's' }} left</span>
            </div>
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
          </section>
        } @else if (session()?.currentStep?.type === 'form') {
          <section class="card">
            <h2>Define 1 action</h2>
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
          </section>
        }

        @if (msg()) {
          <p class="msg">{{ msg() }}</p>
        }
      </div>
    </div>
  `,
  styles: `
    .page {
      background: linear-gradient(180deg, #dbe7ff 0%, #f5f7fb 40%, #f5f7fb 100%);
      display: flex;
      justify-content: center;
      min-height: 100vh;
      padding: 1rem;
    }

    .phone {
      background: #fff;
      border: 1px solid var(--wos-border);
      border-radius: 24px;
      box-shadow: var(--wos-shadow-lg);
      display: grid;
      gap: 0.85rem;
      max-width: 420px;
      padding: 1.15rem 1rem 1.4rem;
      width: 100%;
    }

    .top { align-items: center; display: flex; justify-content: space-between; }
    .brand { color: var(--wos-primary); font-size: 0.72rem; font-weight: 800; letter-spacing: 0.04em; margin: 0; text-transform: uppercase; }
    h1 { font-size: 1.15rem; margin: 0.15rem 0 0; }
    .status { color: var(--wos-text-muted); font-size: 0.85rem; margin: 0; }
    .card { background: #f8fafc; border: 1px solid var(--wos-border); border-radius: var(--wos-radius-lg); display: grid; gap: 0.75rem; padding: 1rem; }
    .card h2 { font-size: 1.05rem; margin: 0; }
    .hint { color: var(--wos-text-muted); margin: 0; }
    .options { display: grid; gap: 0.5rem; }
    .option { align-items: center; background: #fff; border: 1px solid var(--wos-border-strong); border-radius: var(--wos-radius); cursor: pointer; display: flex; font-weight: 600; gap: 0.65rem; padding: 0.8rem; text-align: left; }
    .option.on { background: var(--wos-primary-soft); border-color: var(--wos-primary); }
    .radio { border: 2px solid var(--wos-border-strong); border-radius: 50%; flex: 0 0 1rem; height: 1rem; width: 1rem; }
    .option.on .radio { background: var(--wos-primary); border-color: var(--wos-primary); box-shadow: inset 0 0 0 2px #fff; }
    .group-cards { display: grid; gap: 0.5rem; }
    .gcard { border: 1px solid transparent; border-radius: var(--wos-radius); cursor: pointer; display: flex; justify-content: space-between; padding: 0.75rem; text-align: left; }
    .gcard[data-tone='0'] { background: var(--wos-success-soft); color: var(--wos-success-ink); }
    .gcard[data-tone='1'] { background: var(--wos-danger-soft); color: var(--wos-danger-ink); }
    .gcard[data-tone='2'] { background: var(--wos-info-soft); color: var(--wos-info-ink); }
    .gcard.on { box-shadow: 0 0 0 2px var(--wos-primary); }
    .gcard span { font-size: 0.78rem; font-weight: 700; opacity: 0.8; }
    textarea, input { border: 1px solid var(--wos-border-strong); border-radius: var(--wos-radius); box-sizing: border-box; padding: 0.7rem; width: 100%; }
    label { display: grid; font-weight: 600; gap: 0.3rem; }
    .owner-row { align-items: center; display: grid; gap: 0.5rem; grid-template-columns: auto 1fr; }
    .vote-top { align-items: center; display: flex; justify-content: space-between; }
    .votes-left { background: var(--wos-primary-soft); border-radius: var(--wos-radius-pill); color: var(--wos-primary); font-size: 0.78rem; font-weight: 800; padding: 0.25rem 0.55rem; }
    .vote-list { display: grid; gap: 0.5rem; }
    .vote { background: #fff; border: 1px solid var(--wos-border); border-radius: var(--wos-radius); display: grid; gap: 0.4rem; padding: 0.75rem; text-align: left; }
    .vote__meta { align-items: center; display: flex; font-size: 0.8rem; font-weight: 600; gap: 0.4rem; }
    .vote p { margin: 0; }
    .vote__cta { color: var(--wos-primary); font-size: 0.75rem; font-weight: 700; }
    .muted { color: var(--wos-text-muted); }
    .done { align-items: center; display: grid; gap: 0.55rem; justify-items: center; padding: 2rem 1rem; text-align: center; }
    .done__icon { align-items: center; background: var(--wos-success-soft); border-radius: 50%; color: var(--wos-success-ink); display: flex; font-size: 2rem; font-weight: 800; height: 4rem; justify-content: center; width: 4rem; }
    .done h2 { margin: 0; }
    .done p { color: var(--wos-text-muted); margin: 0; }
    .msg { color: var(--wos-primary); font-weight: 600; margin: 0; text-align: center; }
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
  action = '';
  owner = '';
  dueDate = '';
  msg = signal('');
  private myEntryCounts = signal<Record<string, number>>({});

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || this.api.sessionId();
    if (this.api.displayName()) this.displayName.set(this.api.displayName());
    if (!this.owner && this.displayName() !== 'You') this.owner = this.displayName();
    this.realtime.connect(this.id);
    this.refresh();
    this.sub = this.realtime.events$.subscribe((e) => {
      if (e.type === 'step.changed' || e.type === 'session.ended') {
        this.session.set(e.data);
        this.loadStepData();
        if (e.type === 'session.ended') this.done.set(true);
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
      if (s?.status === 'CLOSED') this.done.set(true);
    });
  }

  private parseConfig(step: any) {
    try {
      return typeof step.config === 'string' ? JSON.parse(step.config) : step.config || {};
    } catch {
      return {};
    }
  }

  countFor(groupId: string) {
    return this.myEntryCounts()[groupId] || 0;
  }

  loadStepData() {
    const step = this.session()?.currentStep;
    if (!step) return;
    if (step.type === 'poll') {
      const cfg = this.parseConfig(step);
      this.options.set(cfg.options || []);
    }
    if (step.type === 'voting' || step.type === 'input') {
      this.api.listEntries(this.id, step.id).subscribe((e) => this.entries.set(e));
      if (step.groups?.length && !this.groupId) this.groupId = step.groups[0].id;
    }
    if (step.type === 'voting') {
      const cfg = this.parseConfig(step);
      this.votesLeft.set(cfg.votesPerParticipant ?? 3);
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
    const gid = this.groupId;
    this.api.submitEntry(this.id, this.content, gid || undefined).subscribe({
      next: () => {
        this.content = '';
        if (gid) {
          this.myEntryCounts.update((m) => ({ ...m, [gid]: (m[gid] || 0) + 1 }));
        }
        this.msg.set('Idea added');
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
        this.done.set(true);
        this.msg.set('Action saved');
      },
      error: (e) => this.msg.set(e?.error?.message)
    });
  }
}
