import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { BoschButtonComponent } from '../../bosch-ui/bosch-button/bosch-button.component';
import { BoschAvatarComponent } from '../../bosch-ui/bosch-avatar/bosch-avatar.component';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-activity-host-panel',
  standalone: true,
  imports: [BoschButtonComponent, BoschAvatarComponent],
  template: `
    <div class="panel">
      @if (session?.currentStep?.type === 'poll') {
        <h3>Poll results</h3>
        <div class="bars">
          @for (o of poll(); track o.id) {
            <div class="bar-row">
              <span>{{ o.label }}</span>
              <div class="track"><div class="fill" [style.width.%]="pct(o.count)"></div></div>
              <strong>{{ o.count }}</strong>
            </div>
          }
        </div>
      }

      @if (session?.currentStep?.type === 'input') {
        <h3>Live wall</h3>
        <div class="columns">
          @for (g of session?.currentStep?.groups || []; track g.id; let gi = $index) {
            <div class="col" [attr.data-tone]="gi % 3">
              <header>{{ g.title }}</header>
              <div class="col__body">
                @for (e of entriesFor(g.id); track e.id) {
                  <article class="note">
                    <div class="note__head">
                      @if (e.authorName) {
                        <app-bosch-avatar [name]="e.authorName" size="sm" />
                        <span>{{ e.authorName }}</span>
                      } @else {
                        <span class="muted">Anonymous</span>
                      }
                    </div>
                    <p>{{ e.content }}</p>
                    <button type="button" class="hide" (click)="hide(e.id)">Hide</button>
                  </article>
                } @empty {
                  <p class="empty">Waiting for ideas…</p>
                }
              </div>
            </div>
          }
        </div>
      }

      @if (session?.currentStep?.type === 'voting') {
        <div class="vote-head">
          <h3>Voting results</h3>
          <span>{{ totalVotes() }} total votes · {{ session?.participantCount || 0 }} participants</span>
        </div>
        <div class="vote-bars">
          @for (v of votes(); track v.entryId; let i = $index) {
            <div class="vote-row">
              <span class="rank">{{ i + 1 }}</span>
              <div class="vote-row__body">
                <div class="vote-row__label">{{ v.content }}</div>
                <div class="track"><div class="fill fill--purple" [style.width.%]="votePct(v.votes)"></div></div>
              </div>
              <strong>{{ v.votes }}</strong>
            </div>
          }
        </div>
      }

      @if (session?.currentStep?.type === 'form' || actions().length) {
        <h3>Action plan</h3>
        <div class="actions">
          @for (a of actions(); track a.id) {
            <article class="action">
              <p>{{ a.action }}</p>
              <div class="action__meta">
                @if (a.owner) {
                  <app-bosch-avatar [name]="a.owner" size="sm" />
                  <span>{{ a.owner }}</span>
                }
                @if (a.dueDate) {
                  <em>{{ a.dueDate }}</em>
                }
              </div>
            </article>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .panel { display: grid; gap: 0.85rem; }
    h3 { font-size: 0.95rem; margin: 0; }
    .bars, .vote-bars { display: grid; gap: 0.65rem; }
    .bar-row, .vote-row { align-items: center; display: grid; gap: 0.65rem; grid-template-columns: 110px 1fr 40px; }
    .vote-row { grid-template-columns: 2rem 1fr 2.5rem; }
    .track { background: #e8eef8; border-radius: 999px; height: 12px; overflow: hidden; }
    .fill { background: linear-gradient(90deg, var(--wos-primary), #3d7dff); height: 12px; }
    .fill--purple { background: linear-gradient(90deg, #7c4dff, #5b8def); }
    .columns { display: grid; gap: 0.75rem; grid-template-columns: repeat(3, 1fr); }
    @media (max-width: 900px) { .columns { grid-template-columns: 1fr; } }
    .col { border-radius: var(--wos-radius-lg); min-height: 10rem; overflow: hidden; }
    .col header { font-weight: 700; padding: 0.7rem 0.85rem; }
    .col__body { display: grid; gap: 0.55rem; padding: 0.65rem; }
    .col[data-tone='0'] { background: var(--wos-success-soft); }
    .col[data-tone='0'] header { background: rgba(15, 157, 88, 0.12); color: var(--wos-success-ink); }
    .col[data-tone='1'] { background: var(--wos-danger-soft); }
    .col[data-tone='1'] header { background: rgba(217, 48, 37, 0.1); color: var(--wos-danger-ink); }
    .col[data-tone='2'] { background: var(--wos-info-soft); }
    .col[data-tone='2'] header { background: rgba(26, 115, 232, 0.1); color: var(--wos-info-ink); }
    .note { background: #fff; border-radius: var(--wos-radius); box-shadow: var(--wos-shadow); display: grid; gap: 0.4rem; padding: 0.7rem; }
    .note__head { align-items: center; display: flex; font-size: 0.78rem; font-weight: 600; gap: 0.35rem; }
    .note p { margin: 0; }
    .hide { background: transparent; border: 0; color: var(--wos-danger); cursor: pointer; font-size: 0.78rem; font-weight: 700; padding: 0; text-align: left; }
    .empty, .muted { color: var(--wos-text-muted); margin: 0; }
    .vote-head { align-items: baseline; display: flex; flex-wrap: wrap; gap: 0.65rem; justify-content: space-between; }
    .vote-head span { color: var(--wos-text-muted); font-size: 0.85rem; }
    .rank { color: var(--wos-primary); font-weight: 800; }
    .vote-row__label { font-weight: 600; margin-bottom: 0.25rem; }
    .actions { display: grid; gap: 0.55rem; }
    .action { background: #f8fafc; border: 1px solid var(--wos-border); border-radius: var(--wos-radius); padding: 0.75rem; }
    .action p { font-weight: 600; margin: 0 0 0.45rem; }
    .action__meta { align-items: center; color: var(--wos-text-secondary); display: flex; gap: 0.4rem; }
    .action__meta em { color: var(--wos-text-muted); font-style: normal; margin-left: auto; }
  `
})
export class ActivityHostPanelComponent implements OnChanges {
  @Input() session: any;
  @Input() refreshToken = 0;

  private api = inject(ApiService);
  entries = signal<any[]>([]);
  poll = signal<any[]>([]);
  votes = signal<any[]>([]);
  actions = signal<any[]>([]);

  ngOnChanges() {
    if (!this.session?.id) return;
    const stepId = this.session.currentStepId;
    this.api.listEntries(this.session.id, stepId).subscribe((e) => this.entries.set(e));
    this.api.pollTally(this.session.id, stepId).subscribe((p) => this.poll.set(p));
    this.api.tallyVotes(this.session.id, stepId).subscribe((v) => this.votes.set(v));
    this.api.listActions(this.session.id).subscribe((a) => this.actions.set(a));
  }

  entriesFor(groupId: string) {
    return this.entries().filter((e) => e.groupId === groupId);
  }

  pct(count: number) {
    const max = Math.max(1, ...this.poll().map((p) => Number(p.count) || 0));
    return (Number(count) / max) * 100;
  }

  votePct(count: number) {
    const max = Math.max(1, ...this.votes().map((v) => Number(v.votes) || 0));
    return (Number(count) / max) * 100;
  }

  totalVotes() {
    return this.votes().reduce((sum, v) => sum + (Number(v.votes) || 0), 0);
  }

  hide(entryId: string) {
    this.api.hideEntry(this.session.id, entryId).subscribe(() => this.ngOnChanges());
  }
}
