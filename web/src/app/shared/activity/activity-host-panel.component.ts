import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BoschButtonComponent } from '../../bosch-ui/bosch-button/bosch-button.component';
import { BoschAvatarComponent } from '../../bosch-ui/bosch-avatar/bosch-avatar.component';
import { ApiService } from '../../core/api.service';
import { buildOkrTree, isOkrBoard } from '../../core/okr.util';

@Component({
  selector: 'app-activity-host-panel',
  standalone: true,
  imports: [FormsModule, BoschButtonComponent, BoschAvatarComponent],
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

      @if (session?.currentStep?.type === 'input' && isOkr()) {
        <div class="okr-head">
          <h3>OKR board</h3>
          <span>{{ objectives().length }} objectives</span>
        </div>
        <div class="add-obj">
          <input [(ngModel)]="newObjective" placeholder="Add an Objective…" (keyup.enter)="addObjective()" />
          <app-bosch-button [disabled]="!newObjective.trim() || busy()" (click)="addObjective()">Add Objective</app-bosch-button>
        </div>
        <div class="okr-grid">
          @for (obj of objectives(); track obj.id) {
            <article class="obj-card">
              <header>
                <div>
                  <strong>{{ obj.content }}</strong>
                  <span class="count">{{ obj.krs.length }} key results</span>
                </div>
                <div class="obj-actions">
                  <button type="button" class="link" (click)="toggle(obj.id)">
                    {{ isOpen(obj.id, obj.krs.length) ? 'Hide KRs' : 'Show KRs' }}
                  </button>
                  <button type="button" class="hide" (click)="hide(obj.id)">Hide</button>
                </div>
              </header>
              @if (isOpen(obj.id, obj.krs.length)) {
                <div class="kr-list">
                  @for (kr of obj.krs; track kr.id) {
                    <div class="kr">
                      <p>{{ kr.content }}</p>
                      <button type="button" class="hide" (click)="hide(kr.id)">Hide</button>
                    </div>
                  } @empty {
                    <p class="empty">No Key Results yet</p>
                  }
                </div>
              }
            </article>
          } @empty {
            <p class="empty">Add an Objective to start the board.</p>
          }
        </div>
      }

      @if (session?.currentStep?.type === 'input' && !isOkr()) {
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
              @if (a.sourceLabel) {
                <span class="kr-tag">KR · {{ a.sourceLabel }}</span>
              }
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
          } @empty {
            <p class="empty">No actions yet</p>
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
    .hide, .link { background: transparent; border: 0; cursor: pointer; font-size: 0.78rem; font-weight: 700; padding: 0; }
    .hide { color: var(--wos-danger); text-align: left; }
    .link { color: var(--wos-primary); }
    .empty, .muted { color: var(--wos-text-muted); margin: 0; }
    .vote-head, .okr-head { align-items: baseline; display: flex; flex-wrap: wrap; gap: 0.65rem; justify-content: space-between; }
    .vote-head span, .okr-head span { color: var(--wos-text-muted); font-size: 0.85rem; }
    .rank { color: var(--wos-primary); font-weight: 800; }
    .vote-row__label { font-weight: 600; margin-bottom: 0.25rem; }
    .actions { display: grid; gap: 0.55rem; }
    .action { background: #f8fafc; border: 1px solid var(--wos-border); border-radius: var(--wos-radius); padding: 0.75rem; }
    .action p { font-weight: 600; margin: 0 0 0.45rem; }
    .action__meta { align-items: center; color: var(--wos-text-secondary); display: flex; gap: 0.4rem; }
    .action__meta em { color: var(--wos-text-muted); font-style: normal; margin-left: auto; }
    .kr-tag { color: var(--wos-primary); display: block; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.35rem; }
    .add-obj { display: grid; gap: 0.5rem; grid-template-columns: 1fr auto; }
    .add-obj input { border: 1px solid var(--wos-border-strong); border-radius: var(--wos-radius); padding: 0.7rem 0.8rem; }
    .okr-grid { display: grid; gap: 0.75rem; }
    .obj-card { background: var(--wos-primary-soft); border: 1px solid #c9dbff; border-radius: var(--wos-radius-lg); overflow: hidden; }
    .obj-card > header { align-items: start; display: flex; gap: 0.75rem; justify-content: space-between; padding: 0.85rem 1rem; }
    .obj-card strong { display: block; }
    .count { color: var(--wos-text-muted); font-size: 0.78rem; font-weight: 600; }
    .obj-actions { display: flex; flex-direction: column; gap: 0.35rem; align-items: end; }
    .kr-list { background: #fff; display: grid; gap: 0.5rem; padding: 0.75rem 1rem 1rem; }
    .kr { align-items: start; display: flex; gap: 0.75rem; justify-content: space-between; }
    .kr p { margin: 0; }
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
  expanded = signal<Record<string, boolean>>({});
  newObjective = '';
  busy = signal(false);

  ngOnChanges() {
    if (!this.session?.id) return;
    const stepId = this.session.currentStepId;
    this.api.listEntries(this.session.id, stepId).subscribe((e) => this.entries.set(e));
    this.api.pollTally(this.session.id, stepId).subscribe((p) => this.poll.set(p));
    this.api.tallyVotes(this.session.id, stepId).subscribe((v) => this.votes.set(v));
    this.api.listActions(this.session.id).subscribe((a) => this.actions.set(a));
  }

  isOkr() {
    return isOkrBoard(this.session?.currentStep);
  }

  objectives() {
    return buildOkrTree(this.entries(), this.actions());
  }

  isOpen(id: string, krCount: number) {
    const map = this.expanded();
    if (id in map) return map[id];
    return krCount < 4;
  }

  toggle(id: string) {
    const open = this.isOpen(id, this.objectives().find((o) => o.id === id)?.krs.length || 0);
    this.expanded.update((m) => ({ ...m, [id]: !open }));
  }

  addObjective() {
    const content = this.newObjective.trim();
    if (!content || !this.session?.id) return;
    this.busy.set(true);
    this.api.createHostObjective(this.session.id, { content }).subscribe({
      next: () => {
        this.newObjective = '';
        this.busy.set(false);
        this.ngOnChanges();
      },
      error: () => this.busy.set(false)
    });
  }

  entriesFor(groupId: string) {
    return this.entries().filter((e) => e.groupId === groupId && e.kind !== 'objective' && e.kind !== 'kr');
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
