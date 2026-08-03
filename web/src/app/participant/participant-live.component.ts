import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { BoschButtonComponent } from '../bosch-ui/bosch-button/bosch-button.component';
import { BoschCardComponent } from '../bosch-ui/bosch-card/bosch-card.component';
import { ApiService } from '../core/api.service';
import { RealtimeService } from '../core/realtime.service';

@Component({
  selector: 'app-participant-live',
  standalone: true,
  imports: [FormsModule, BoschButtonComponent, BoschCardComponent],
  template: `
    <div class="page">
      <h1>{{ session()?.title }}</h1>
      <p class="status">{{ session()?.status }} · {{ session()?.currentStep?.title }}</p>

      @if (!session()?.currentStep || session()?.status === 'LOBBY') {
        <app-bosch-card title="Waiting" subtitle="Host will start shortly">
          <p>Stay on this screen. Your facilitator controls the next step.</p>
        </app-bosch-card>
      }

      @if (session()?.currentStep?.type === 'welcome') {
        <app-bosch-card title="Welcome" [subtitle]="session()?.currentStep?.title">
          <p>{{ session()?.currentStep?.instructions }}</p>
        </app-bosch-card>
      }

      @if (session()?.currentStep?.type === 'poll') {
        <app-bosch-card title="Poll" [subtitle]="session()?.currentStep?.instructions">
          <div class="options">
            @for (o of options(); track o.id) {
              <app-bosch-button [block]="true" [variant]="picked() === o.id ? 'primary' : 'secondary'" (click)="answerPoll(o.id)">
                {{ o.label }}
              </app-bosch-button>
            }
          </div>
        </app-bosch-card>
      }

      @if (session()?.currentStep?.type === 'input') {
        <app-bosch-card title="Share input" [subtitle]="session()?.currentStep?.instructions">
          <div class="groups">
            @for (g of session()?.currentStep?.groups || []; track g.id) {
              <button type="button" class="g" [class.on]="groupId === g.id" (click)="groupId = g.id">{{ g.title }}</button>
            }
          </div>
          <textarea [(ngModel)]="content" rows="4" placeholder="Your sticky note…"></textarea>
          <app-bosch-button icon="add" [block]="true" (click)="submitEntry()">Add</app-bosch-button>
        </app-bosch-card>
      }

      @if (session()?.currentStep?.type === 'voting') {
        <app-bosch-card title="Vote" subtitle="Tap items to spend your votes">
          <p>Remaining: {{ votesLeft() }}</p>
          <div class="vote-list">
            @for (e of entries(); track e.id) {
              <button type="button" class="vote" (click)="vote(e.id)">{{ e.content }}</button>
            }
          </div>
        </app-bosch-card>
      }

      @if (session()?.currentStep?.type === 'form') {
        <app-bosch-card title="Action" subtitle="Commit to a next step">
          <label>Action <input [(ngModel)]="action" /></label>
          <label>Owner <input [(ngModel)]="owner" /></label>
          <label>Due date <input type="date" [(ngModel)]="dueDate" /></label>
          <app-bosch-button icon="save" [block]="true" (click)="submitAction()">Submit</app-bosch-button>
        </app-bosch-card>
      }

      @if (session()?.status === 'CLOSED') {
        <app-bosch-card title="Thanks" subtitle="Session closed">
          <p>Results were saved by the host.</p>
        </app-bosch-card>
      }

      @if (msg()) { <p class="msg">{{ msg() }}</p> }
    </div>
  `,
  styles: `
    .page { max-width: 480px; margin: 0 auto; padding: 1rem; display: grid; gap: 0.85rem; }
    h1 { margin: 0; font-size: 1.25rem; }
    .status { margin: 0; color: var(--bosch-text-muted); }
    .options, .vote-list { display: grid; gap: 0.5rem; }
    .groups { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.75rem; }
    .g { border: 1px solid var(--bosch-border-strong); background: var(--bosch-surface); padding: 0.4rem 0.6rem; }
    .g.on { background: var(--bosch-accent-soft); border-color: var(--bosch-accent); }
    textarea, input { width: 100%; box-sizing: border-box; border: 1px solid var(--bosch-border-strong); padding: 0.65rem; font: inherit; margin-bottom: 0.65rem; }
    label { display: grid; gap: 0.25rem; font-weight: 600; }
    .vote { text-align: left; padding: 0.75rem; border: 1px solid var(--bosch-border); background: var(--bosch-yellow-95); }
    .msg { color: var(--bosch-accent); }
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
  content = '';
  groupId = '';
  action = '';
  owner = '';
  dueDate = '';
  msg = signal('');

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || this.api.sessionId();
    this.realtime.connect(this.id);
    this.refresh();
    this.sub = this.realtime.events$.subscribe((e) => {
      if (e.type === 'step.changed' || e.type === 'session.ended') {
        this.session.set(e.data);
        this.loadStepData();
      }
      if (e.type === 'vote.updated') {
        this.votesLeft.set(e.data?.votesRemaining ?? this.votesLeft());
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
    this.api.submitAction(this.id, { action: this.action, owner: this.owner, dueDate: this.dueDate }).subscribe({
      next: () => {
        this.action = '';
        this.msg.set('Action saved');
      },
      error: (e) => this.msg.set(e?.error?.message)
    });
  }
}
