import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { BoschButtonComponent } from '../../bosch-ui/bosch-button/bosch-button.component';
import { BoschCardComponent } from '../../bosch-ui/bosch-card/bosch-card.component';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-activity-host-panel',
  standalone: true,
  imports: [BoschButtonComponent, BoschCardComponent],
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
      @if (session?.currentStep?.type === 'input' || session?.currentStep?.type === 'voting') {
        <div class="wall">
          @for (e of entries(); track e.id) {
            <article class="note">
              <p>{{ e.content }}</p>
              <app-bosch-button variant="danger" icon="delete" (click)="hide(e.id)">Hide</app-bosch-button>
            </article>
          }
        </div>
      }
      @if (session?.currentStep?.type === 'voting') {
        <ol class="board">
          @for (v of votes(); track v.entryId) {
            <li>{{ v.content }} — {{ v.votes }} votes</li>
          }
        </ol>
      }
      @if (session?.currentStep?.type === 'form' || actions().length) {
        <table>
          <thead><tr><th>Action</th><th>Owner</th><th>Due</th></tr></thead>
          <tbody>
            @for (a of actions(); track a.id) {
              <tr><td>{{ a.action }}</td><td>{{ a.owner }}</td><td>{{ a.dueDate }}</td></tr>
            }
          </tbody>
        </table>
      }
    </app-bosch-card>
  `,
  styles: `
    .bars { display: grid; gap: 0.6rem; }
    .bar-row { display: grid; grid-template-columns: 100px 1fr 40px; gap: 0.5rem; align-items: center; }
    .track { background: var(--bosch-gray-90); height: 12px; }
    .fill { background: var(--bosch-accent); height: 12px; }
    .wall { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.75rem; }
    .note { background: var(--bosch-yellow-95); border: 1px solid var(--bosch-border); padding: 0.75rem; display: grid; gap: 0.5rem; }
    .note p { margin: 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid var(--bosch-border); text-align: left; padding: 0.5rem; }
  `
})
export class ActivityHostPanelComponent implements OnChanges {
  @Input() session: any;
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

  pct(count: number) {
    const max = Math.max(1, ...this.poll().map((p) => Number(p.count) || 0));
    return (Number(count) / max) * 100;
  }

  hide(entryId: string) {
    this.api.hideEntry(this.session.id, entryId).subscribe(() => this.ngOnChanges());
  }
}
