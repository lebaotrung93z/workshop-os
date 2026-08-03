import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BoschButtonComponent } from '../bosch-ui/bosch-button/bosch-button.component';
import { BoschCardComponent } from '../bosch-ui/bosch-card/bosch-card.component';
import { BoschLogoComponent } from '../bosch-ui/bosch-logo/bosch-logo.component';
import { BoschIconComponent } from '../bosch-icon/bosch-icon/bosch-icon.component';
import { ApiService } from '../core/api.service';

type StepType = 'welcome' | 'poll' | 'input' | 'voting' | 'form';

interface DraftGroup {
  title: string;
}

interface DraftOption {
  id: string;
  label: string;
}

interface DraftStep {
  type: StepType;
  title: string;
  instructions: string;
  timerSeconds: number | null;
  anonymous: boolean;
  votesPerParticipant: number;
  options: DraftOption[];
  groups: DraftGroup[];
}

@Component({
  selector: 'app-format-builder',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    BoschButtonComponent,
    BoschCardComponent,
    BoschLogoComponent,
    BoschIconComponent
  ],
  template: `
    <div class="page">
      <header class="top">
        <app-bosch-logo />
        <div>
          <h1>Manual format</h1>
          <p>Build your own workshop flow, then start a session</p>
        </div>
        <a routerLink="/" class="back">Back to templates</a>
      </header>

      <app-bosch-card title="Format details" subtitle="Name this format for your team">
        <label>
          Format name
          <input [(ngModel)]="formatName" placeholder="Product discovery workshop" />
        </label>
        <label>
          Description
          <input [(ngModel)]="description" placeholder="Optional short description" />
        </label>
        <label>
          Workshop title
          <input [(ngModel)]="workshopTitle" placeholder="Discovery – Q3 planning" />
        </label>
      </app-bosch-card>

      <app-bosch-card title="Steps" subtitle="Order matters — participants move through these in sequence">
        <div class="add-row">
          <label class="inline">
            Add step
            <select [(ngModel)]="addType">
              @for (t of stepTypes; track t.value) {
                <option [value]="t.value">{{ t.label }}</option>
              }
            </select>
          </label>
          <app-bosch-button variant="secondary" icon="plus" (click)="addStep()">Add</app-bosch-button>
        </div>

        @if (steps().length === 0) {
          <p class="hint">No steps yet. Add a welcome step to start.</p>
        }

        <div class="steps">
          @for (step of steps(); track $index; let i = $index) {
            <article class="step">
              <header class="step-head">
                <strong>{{ i + 1 }}. {{ typeLabel(step.type) }}</strong>
                <div class="step-actions">
                  <button type="button" class="icon-btn" [disabled]="i === 0" (click)="move(i, -1)" aria-label="Move up">
                    <app-bosch-icon name="chevron-down" class="flip" />
                  </button>
                  <button type="button" class="icon-btn" [disabled]="i === steps().length - 1" (click)="move(i, 1)" aria-label="Move down">
                    <app-bosch-icon name="chevron-down" />
                  </button>
                  <button type="button" class="icon-btn danger" (click)="remove(i)" aria-label="Remove step">
                    <app-bosch-icon name="delete" />
                  </button>
                </div>
              </header>

              <label>
                Title
                <input [(ngModel)]="step.title" />
              </label>
              <label>
                Instructions
                <input [(ngModel)]="step.instructions" />
              </label>

              @if (step.type === 'poll') {
                <div class="sub">
                  <p class="sub-title">Options</p>
                  @for (opt of step.options; track $index; let oi = $index) {
                    <div class="row">
                      <input [(ngModel)]="opt.label" placeholder="Option label" (ngModelChange)="syncOptionId(opt)" />
                      <button type="button" class="icon-btn danger" (click)="removeOption(step, oi)" aria-label="Remove option">
                        <app-bosch-icon name="delete" />
                      </button>
                    </div>
                  }
                  <app-bosch-button variant="secondary" (click)="addOption(step)">Add option</app-bosch-button>
                </div>
              }

              @if (step.type === 'input') {
                <div class="sub">
                  <label class="check">
                    <input type="checkbox" [(ngModel)]="step.anonymous" />
                    Anonymous sticky notes
                  </label>
                  <p class="sub-title">Columns</p>
                  @for (g of step.groups; track $index; let gi = $index) {
                    <div class="row">
                      <input [(ngModel)]="g.title" placeholder="Column title" />
                      <button type="button" class="icon-btn danger" (click)="removeGroup(step, gi)" aria-label="Remove column">
                        <app-bosch-icon name="delete" />
                      </button>
                    </div>
                  }
                  <app-bosch-button variant="secondary" (click)="addGroup(step)">Add column</app-bosch-button>
                </div>
              }

              @if (step.type === 'voting') {
                <label>
                  Votes per participant
                  <input type="number" min="1" max="20" [(ngModel)]="step.votesPerParticipant" />
                </label>
              }
            </article>
          }
        </div>
      </app-bosch-card>

      @if (error()) {
        <p class="err">{{ error() }}</p>
      }

      <div class="actions">
        <app-bosch-button icon="dashboard" [disabled]="busy()" (click)="create()">
          Create format &amp; start session
        </app-bosch-button>
      </div>
    </div>
  `,
  styles: `
    .page { max-width: 820px; margin: 0 auto; padding: 1.5rem 1rem 3rem; display: grid; gap: 1rem; }
    .top { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .top h1 { margin: 0; font-size: 1.4rem; }
    .top p { margin: 0.2rem 0 0; color: var(--bosch-text-muted); }
    .back { margin-left: auto; color: var(--bosch-accent); font-weight: 700; }
    label { display: grid; gap: 0.35rem; margin-bottom: 0.85rem; font-weight: 600; }
    label.inline { margin: 0; }
    label.check { display: flex; align-items: center; gap: 0.5rem; font-weight: 600; }
    input, select { border: 1px solid var(--bosch-border-strong); padding: 0.65rem 0.75rem; font: inherit; }
    .add-row { display: flex; gap: 0.75rem; align-items: end; margin-bottom: 1rem; flex-wrap: wrap; }
    .hint { color: var(--bosch-text-muted); }
    .steps { display: grid; gap: 0.85rem; }
    .step { border: 1px solid var(--bosch-border); background: var(--bosch-bg-muted); padding: 0.9rem; }
    .step-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
    .step-actions { display: flex; gap: 0.25rem; }
    .icon-btn { border: 1px solid var(--bosch-border); background: #fff; padding: 0.35rem; cursor: pointer; }
    .icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .icon-btn.danger { color: var(--bosch-error); }
    .flip { transform: rotate(180deg); display: inline-flex; }
    .sub { margin-top: 0.5rem; display: grid; gap: 0.5rem; }
    .sub-title { margin: 0; font-weight: 700; }
    .row { display: grid; grid-template-columns: 1fr auto; gap: 0.5rem; align-items: center; }
    .actions { display: flex; gap: 1rem; }
    .err { color: var(--bosch-error); margin: 0; }
  `
})
export class FormatBuilderComponent {
  private api = inject(ApiService);
  private router = inject(Router);

  stepTypes = [
    { value: 'welcome' as StepType, label: 'Welcome' },
    { value: 'poll' as StepType, label: 'Poll' },
    { value: 'input' as StepType, label: 'Input (sticky wall)' },
    { value: 'voting' as StepType, label: 'Voting' },
    { value: 'form' as StepType, label: 'Action form' }
  ];

  formatName = '';
  description = '';
  workshopTitle = '';
  addType: StepType = 'welcome';
  steps = signal<DraftStep[]>([]);
  busy = signal(false);
  error = signal('');

  constructor() {
    this.steps.set([
      this.blankStep('welcome'),
      this.blankStep('poll'),
      this.blankStep('input'),
      this.blankStep('voting'),
      this.blankStep('form')
    ]);
  }

  typeLabel(type: StepType) {
    return this.stepTypes.find((t) => t.value === type)?.label || type;
  }

  addStep() {
    this.steps.update((list) => [...list, this.blankStep(this.addType)]);
  }

  remove(index: number) {
    this.steps.update((list) => list.filter((_, i) => i !== index));
  }

  move(index: number, delta: number) {
    const next = index + delta;
    this.steps.update((list) => {
      if (next < 0 || next >= list.length) return list;
      const copy = [...list];
      const [item] = copy.splice(index, 1);
      copy.splice(next, 0, item);
      return copy;
    });
  }

  addOption(step: DraftStep) {
    const n = step.options.length + 1;
    step.options.push({ id: `opt${n}`, label: `Option ${n}` });
  }

  removeOption(step: DraftStep, index: number) {
    step.options.splice(index, 1);
  }

  syncOptionId(opt: DraftOption) {
    const slug = opt.label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|$)/g, '')
      .slice(0, 24);
    opt.id = slug || `opt-${Math.random().toString(36).slice(2, 7)}`;
  }

  addGroup(step: DraftStep) {
    step.groups.push({ title: `Column ${step.groups.length + 1}` });
  }

  removeGroup(step: DraftStep, index: number) {
    step.groups.splice(index, 1);
  }

  create() {
    this.error.set('');
    if (!this.formatName.trim()) {
      this.error.set('Format name is required');
      return;
    }
    if (this.steps().length === 0) {
      this.error.set('Add at least one step');
      return;
    }

    const payload = {
      name: this.formatName.trim(),
      description: this.description.trim() || 'Custom format',
      steps: this.steps().map((s) => this.toPayloadStep(s))
    };

    this.busy.set(true);
    this.api.createTemplate(payload).subscribe({
      next: (tpl) => {
        this.api.createSession(tpl.id, this.workshopTitle || this.formatName).subscribe({
          next: (s) => {
            this.api.setHostSession(s.id, s.hostToken);
            this.router.navigate(['/host', s.id]);
          },
          error: (e) => {
            this.busy.set(false);
            this.error.set(e?.error?.message || 'Session create failed');
          }
        });
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(e?.error?.message || 'Format create failed');
      }
    });
  }

  private toPayloadStep(step: DraftStep) {
    const base: any = {
      type: step.type,
      title: step.title.trim() || this.typeLabel(step.type),
      instructions: step.instructions.trim(),
      timerSeconds: step.timerSeconds,
      config: {},
      groups: [] as { title: string }[]
    };
    if (step.type === 'poll') {
      base.config = {
        options: step.options
          .filter((o) => o.label.trim())
          .map((o) => ({ id: o.id || this.slug(o.label), label: o.label.trim() }))
      };
    } else if (step.type === 'input') {
      base.config = { anonymous: !!step.anonymous };
      base.groups = step.groups
        .filter((g) => g.title.trim())
        .map((g) => ({ title: g.title.trim() }));
    } else if (step.type === 'voting') {
      base.config = { votesPerParticipant: Number(step.votesPerParticipant) || 3 };
    }
    return base;
  }

  private blankStep(type: StepType): DraftStep {
    const step: DraftStep = {
      type,
      title: this.typeLabel(type),
      instructions: '',
      timerSeconds: null,
      anonymous: true,
      votesPerParticipant: 3,
      options: [
        { id: 'great', label: 'Great' },
        { id: 'ok', label: 'OK' },
        { id: 'rough', label: 'Rough' }
      ],
      groups: [
        { title: 'Column A' },
        { title: 'Column B' },
        { title: 'Column C' }
      ]
    };
    if (type === 'welcome') {
      step.title = 'Welcome';
      step.instructions = 'Share the join code and wait for participants.';
    } else if (type === 'poll') {
      step.title = 'Check-in';
      step.instructions = 'Pick the option that fits best.';
    } else if (type === 'input') {
      step.title = 'Collect ideas';
      step.instructions = 'Add sticky notes in each column.';
    } else if (type === 'voting') {
      step.title = 'Prioritize';
      step.instructions = 'Vote on the most important items.';
    } else if (type === 'form') {
      step.title = 'Commitments';
      step.instructions = 'Owners and due dates for next steps.';
    }
    return step;
  }

  private slug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|$)/g, '')
      .slice(0, 24) || 'opt';
  }
}
