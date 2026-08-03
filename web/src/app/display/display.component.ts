import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { BoschLogoComponent } from '../bosch-ui/bosch-logo/bosch-logo.component';
import { ApiService } from '../core/api.service';
import { RealtimeService } from '../core/realtime.service';

@Component({
  selector: 'app-display',
  standalone: true,
  imports: [BoschLogoComponent],
  template: `
    <div class="screen">
      <header>
        <app-bosch-logo />
        <div>
          <h1>{{ session()?.title }}</h1>
          <p>Code <span class="code">{{ session()?.code }}</span> · {{ session()?.participantCount || 0 }} online</p>
        </div>
      </header>

      @if (session()?.status === 'LOBBY' || !session()?.currentStep) {
        <section class="hero">
          <h2>Scan to join</h2>
          <p class="code-lg">{{ session()?.code }}</p>
          <p>Waiting for the host to start…</p>
        </section>
      }

      @if (session()?.currentStep?.type === 'welcome') {
        <section class="hero">
          <h2>{{ session()?.currentStep?.title }}</h2>
          <p>{{ session()?.currentStep?.instructions }}</p>
        </section>
      }

      @if (session()?.currentStep?.type === 'poll') {
        <section>
          <h2>{{ session()?.currentStep?.title }}</h2>
          <div class="bars">
            @for (o of poll(); track o.id) {
              <div class="row">
                <span>{{ o.label }}</span>
                <div class="track"><div class="fill" [style.width.%]="pct(o.count)"></div></div>
                <strong>{{ o.count }}</strong>
              </div>
            }
          </div>
        </section>
      }

      @if (session()?.currentStep?.type === 'input') {
        <section>
          <h2>{{ session()?.currentStep?.title }}</h2>
          <div class="columns">
            @for (g of session()?.currentStep?.groups || []; track g.id) {
              <div class="col">
                <h3>{{ g.title }}</h3>
                @for (e of entriesFor(g.id); track e.id) {
                  <article>{{ e.content }}</article>
                }
              </div>
            }
          </div>
        </section>
      }

      @if (session()?.currentStep?.type === 'voting') {
        <section>
          <h2>Leaderboard</h2>
          <ol>
            @for (v of votes(); track v.entryId; let i = $index) {
              <li><span class="rank">{{ i + 1 }}</span> {{ v.content }} <em>{{ v.votes }}</em></li>
            }
          </ol>
        </section>
      }

      @if (session()?.currentStep?.type === 'form' || summary()) {
        <section class="split">
          <div>
            <h2>Actions</h2>
            <table>
              <thead><tr><th>Action</th><th>Owner</th><th>Due</th></tr></thead>
              <tbody>
                @for (a of actions(); track a.id) {
                  <tr><td>{{ a.action }}</td><td>{{ a.owner }}</td><td>{{ a.dueDate }}</td></tr>
                }
              </tbody>
            </table>
          </div>
          @if (summary()?.insights) {
            <div>
              <h2>Key insights</h2>
              <ul>
                @for (i of summary()?.insights || []; track i) {
                  <li>{{ i }}</li>
                }
              </ul>
            </div>
          }
        </section>
      }
    </div>
  `,
  styles: `
    .screen { min-height: 100vh; padding: 2rem 2.5rem; background: linear-gradient(180deg, #fff 0%, var(--bosch-gray-95) 100%); color: var(--bosch-text); }
    header { display: flex; gap: 1.25rem; align-items: center; margin-bottom: 2rem; }
    h1 { margin: 0; font-size: 2rem; }
    h2 { font-size: 2.2rem; margin: 0 0 1rem; }
    h3 { margin: 0 0 0.75rem; color: var(--bosch-accent); }
    .code, .code-lg { font-weight: 800; letter-spacing: 0.12em; color: var(--bosch-accent); }
    .code-lg { font-size: 4rem; display: block; margin: 0.5rem 0; }
    .hero { text-align: center; padding: 4rem 1rem; }
    .bars { display: grid; gap: 1rem; max-width: 900px; }
    .row { display: grid; grid-template-columns: 160px 1fr 60px; gap: 1rem; align-items: center; font-size: 1.4rem; }
    .track { height: 28px; background: var(--bosch-gray-90); }
    .fill { height: 28px; background: var(--bosch-accent); }
    .columns { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    .col article { background: var(--bosch-yellow-95); border: 1px solid var(--bosch-border); padding: 0.85rem; margin-bottom: 0.65rem; font-size: 1.15rem; }
    ol { list-style: none; padding: 0; margin: 0; font-size: 1.6rem; }
    li { display: flex; gap: 1rem; align-items: baseline; padding: 0.6rem 0; border-bottom: 1px solid var(--bosch-border); }
    .rank { color: var(--bosch-accent); font-weight: 800; width: 2rem; }
    em { margin-left: auto; font-style: normal; font-weight: 800; }
    .split { display: grid; grid-template-columns: 1.2fr 1fr; gap: 2rem; }
    table { width: 100%; border-collapse: collapse; font-size: 1.2rem; }
    th, td { border-bottom: 1px solid var(--bosch-border); text-align: left; padding: 0.65rem; }
    ul { font-size: 1.35rem; }
    @media (max-width: 900px) {
      .columns, .split { grid-template-columns: 1fr; }
    }
  `
})
export class DisplayComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private realtime = inject(RealtimeService);
  private sub?: Subscription;

  id = '';
  session = signal<any>(null);
  entries = signal<any[]>([]);
  poll = signal<any[]>([]);
  votes = signal<any[]>([]);
  actions = signal<any[]>([]);
  summary = signal<any>(null);

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('sessionId') || '';
    this.refresh();
    this.realtime.connect(this.id);
    this.sub = this.realtime.events$.subscribe((e) => {
      if (e.type === 'step.changed' || e.type === 'session.ended') {
        this.session.set(e.data);
        this.loadExtras();
      }
      if (e.type === 'entry.created' || e.type === 'entry.hidden' || e.type === 'vote.updated' || e.type === 'action.created') {
        this.loadExtras();
      }
      if (e.type === 'summary.ready') this.summary.set(e.data);
      if (e.type === 'participant.joined') this.refresh();
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.realtime.disconnect();
  }

  refresh() {
    this.api.getDisplay(this.id).subscribe((s) => {
      this.session.set(s);
      this.loadExtras();
    });
    this.api.getSummary(this.id).subscribe((s) => {
      if (s?.insights) this.summary.set(s);
    });
  }

  loadExtras() {
    const stepId = this.session()?.currentStepId;
    if (!this.session()?.id) return;
    this.api.listEntries(this.id, stepId).subscribe((e) => this.entries.set(e));
    this.api.pollTally(this.id, stepId).subscribe((p) => this.poll.set(p));
    this.api.tallyVotes(this.id, stepId).subscribe((v) => this.votes.set(v));
    this.api.listActions(this.id).subscribe((a) => this.actions.set(a));
  }

  entriesFor(groupId: string) {
    return this.entries().filter((e) => e.groupId === groupId);
  }

  pct(count: number) {
    const max = Math.max(1, ...this.poll().map((p) => Number(p.count) || 0));
    return (Number(count) / max) * 100;
  }
}
