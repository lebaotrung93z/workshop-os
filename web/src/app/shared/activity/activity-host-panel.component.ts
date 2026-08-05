import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { BoschButtonComponent } from '../../bosch-ui/bosch-button/bosch-button.component';
import { BoschCardComponent } from '../../bosch-ui/bosch-card/bosch-card.component';
import { BoschAvatarComponent } from '../../bosch-ui/bosch-avatar/bosch-avatar.component';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-activity-host-panel',
  standalone: true,
  imports: [BoschButtonComponent, BoschCardComponent, BoschAvatarComponent],
  template: `
    <app-bosch-card title="Live results" [subtitle]="session?.currentStep?.type || ''">
      @if (session?.currentStep?.type === 'poll') {
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
        <div class="columns">
          @for (g of session?.currentStep?.groups || []; track g.id; let gi = $index) {
            <div class="col" [attr.data-tone]="gi % 3">
              <h3>{{ g.title }}</h3>
              @for (e of entriesFor(g.id); track e.id) {
                <article class="note">
                  <div class="note__head">
                    @if (e.authorName) {
                      <app-bosch-avatar [name]="e.authorName" size="sm" />
                      <span class="note__author">{{ e.authorName }}</span>
                    } @else {
                      <span class="note__author muted">Anonymous</span>
                    }
                  </div>
                  <p>{{ e.content }}</p>
                  <app-bosch-button variant="danger" icon="delete" (click)="hide(e.id)">Hide</app-bosch-button>
                </article>
              }
            </div>
          }
        </div>
      }

      @if (session?.currentStep?.type === 'voting') {
        <div class="wall">
          @for (e of entries(); track e.id) {
            <article class="note">
              <div class="note__head">
                @if (e.authorName) {
                  <app-bosch-avatar [name]="e.authorName" size="sm" />
                  <span class="note__author">{{ e.authorName }}</span>
                }
              </div>
              <p>{{ e.content }}</p>
              <app-bosch-button variant="danger" icon="delete" (click)="hide(e.id)">Hide</app-bosch-button>
            </article>
          }
        </div>
        <ol class="board">
          @for (v of votes(); track v.entryId; let i = $index) {
            <li>
              <span class="rank">{{ i + 1 }}</span>
              <span class="board__content">{{ v.content }}</span>
              <em>{{ v.votes }} votes</em>
            </li>
          }
        </ol>
      }

      @if (session?.currentStep?.type === 'form' || actions().length) {
        <table>
          <thead>
            <tr><th>Action</th><th>Owner</th><th>Due</th></tr>
          </thead>
          <tbody>
            @for (a of actions(); track a.id) {
              <tr>
                <td>{{ a.action }}</td>
                <td class="owner">
                  @if (a.owner) {
                    <app-bosch-avatar [name]="a.owner" size="sm" />
                    <span>{{ a.owner }}</span>
                  }
                </td>
                <td>{{ a.dueDate }}</td>
              </tr>
            }
          </tbody>
        </table>
      }
    </app-bosch-card>
  `,
  styles: `
    .bars { display: grid; gap: 0.6rem; }
    .bar-row { align-items: center; display: grid; gap: 0.5rem; grid-template-columns: 100px 1fr 40px; }
    .track { background: var(--bosch-gray-90); height: 12px; }
    .fill { background: var(--bosch-accent); height: 12px; }
    .columns { display: grid; gap: 0.85rem; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
    .col { background: var(--bosch-bg-muted); border-top: 4px solid var(--bosch-accent); padding: 0.75rem; }
    .col[data-tone='0'] { border-top-color: var(--bosch-positive); }
    .col[data-tone='1'] { border-top-color: var(--bosch-error); }
    .col[data-tone='2'] { border-top-color: var(--bosch-accent); }
    .col h3 { color: var(--bosch-text); font-size: 0.95rem; margin: 0 0 0.65rem; }
    .wall { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); margin-bottom: 1rem; }
    .note { background: var(--bosch-yellow-95); border: 1px solid var(--bosch-border); display: grid; gap: 0.5rem; padding: 0.75rem; }
    .note__head { align-items: center; display: flex; gap: 0.4rem; }
    .note__author { font-size: 0.8rem; font-weight: 600; }
    .note__author.muted { color: var(--bosch-text-muted); font-weight: 500; }
    .note p { margin: 0; }
    .board { list-style: none; margin: 0; padding: 0; }
    .board li { align-items: baseline; border-bottom: 1px solid var(--bosch-border); display: flex; gap: 0.75rem; padding: 0.55rem 0; }
    .rank { color: var(--bosch-accent); font-weight: 800; width: 1.5rem; }
    .board__content { flex: 1; }
    em { font-style: normal; font-weight: 800; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid var(--bosch-border); padding: 0.5rem; text-align: left; }
    .owner { align-items: center; display: flex; gap: 0.45rem; }
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

  hide(entryId: string) {
    this.api.hideEntry(this.session.id, entryId).subscribe(() => this.ngOnChanges());
  }
}
