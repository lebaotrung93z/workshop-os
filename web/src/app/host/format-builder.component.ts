import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDragHandle,
  CdkDragPlaceholder,
  CdkDragPreview,
  CdkDropList,
  moveItemInArray
} from '@angular/cdk/drag-drop';
import { BoschButtonComponent } from '../bosch-ui/bosch-button/bosch-button.component';
import { BoschIconComponent } from '../bosch-icon/bosch-icon/bosch-icon.component';
import { ApiService } from '../core/api.service';
import { HostShellComponent } from './host-shell.component';

type StepType = 'welcome' | 'poll' | 'input' | 'voting' | 'form';

interface DraftGroup {
  title: string;
}

interface DraftOption {
  id: string;
  label: string;
}

interface DraftStep {
  uid: string;
  type: StepType;
  title: string;
  instructions: string;
  timerSeconds: number | null;
  anonymous: boolean;
  linkedBoard: boolean;
  linkActionToKr: boolean;
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
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    CdkDragPreview,
    BoschButtonComponent,
    BoschIconComponent,
    HostShellComponent
  ],
  template: `
    <app-host-shell>
      <div class="page">
        <header class="top">
          <div class="top__copy">
            <p class="eyebrow">{{ customizing() ? 'Edit template' : 'Workflow board' }}</p>
            <h1>{{ customizing() ? 'Customize on the board' : 'Design your workshop flow' }}</h1>
            <p class="lede">
              Drag activities from the palette onto the board — reorder like sticky notes on a Miro board.
            </p>
          </div>
          <div class="top__actions">
            <a class="ghost" routerLink="/">Back</a>
            <app-bosch-button
              variant="secondary"
              icon="plus"
              [disabled]="busy()"
              (click)="saveAsCustom()"
            >
              {{ busy() && saveMode() === 'template' ? 'Saving…' : 'Save template' }}
            </app-bosch-button>
            <app-bosch-button icon="dashboard" [disabled]="busy()" (click)="createAndStart()">
              {{ busy() && saveMode() === 'session' ? 'Starting…' : 'Save & start' }}
            </app-bosch-button>
          </div>
        </header>

        @if (customizing() && sourceName()) {
          <p class="banner">
            Based on <strong>{{ sourceName() }}</strong> — edits save as a new custom template.
          </p>
        }

        <section class="meta card">
          <label>
            Format name
            <input [(ngModel)]="formatName" placeholder="Product discovery workshop" />
          </label>
          <label>
            Purpose
            <input [(ngModel)]="description" placeholder="Why are we running this workshop?" />
          </label>
          <label>
            Workshop title
            <input [(ngModel)]="workshopTitle" placeholder="Discovery – Q3 planning" />
          </label>
        </section>

        <div class="workspace">
          <aside class="palette card">
            <p class="section-label">Activities</p>
            <p class="hint">Drag onto the board, or click to add</p>
            <div
              id="palette-list"
              class="palette__list"
              cdkDropList
              [cdkDropListData]="paletteItems"
              [cdkDropListSortingDisabled]="true"
              [cdkDropListConnectedTo]="['board-list']"
              [cdkDropListEnterPredicate]="blockPaletteEnter"
            >
              @for (t of paletteItems; track t.value) {
                <button
                  type="button"
                  class="palette-item"
                  [attr.data-tone]="t.value"
                  cdkDrag
                  [cdkDragData]="t.value"
                  (cdkDragStarted)="onPaletteDragStarted()"
                  (cdkDragEnded)="onPaletteDragEnded()"
                  (click)="addStep(t.value)"
                >
                  <span class="palette-item__tone"></span>
                  <span class="palette-item__copy">
                    <strong>{{ t.label }}</strong>
                    <small>{{ t.hint }}</small>
                  </span>
                  <div class="palette-preview" *cdkDragPreview>
                    <span class="flow-card" [attr.data-tone]="t.value">
                      <strong>{{ t.label }}</strong>
                    </span>
                  </div>
                </button>
              }
            </div>
          </aside>

          <section class="board card">
            <div class="board__head">
              <div>
                <p class="section-label">Flow board</p>
                <p class="hint">Left → right is the live workshop order</p>
              </div>
              <span class="count">{{ steps().length }} steps</span>
            </div>

            @if (steps().length === 0) {
              <div
                class="board__empty"
                id="board-list"
                cdkDropList
                [cdkDropListData]="steps()"
                [cdkDropListConnectedTo]="['palette-list']"
                (cdkDropListDropped)="onBoardDrop($event)"
              >
                <p>Drop an activity here to start the flow</p>
              </div>
            } @else {
              <div
                class="board__lane"
                id="board-list"
                cdkDropList
                cdkDropListOrientation="horizontal"
                [cdkDropListData]="steps()"
                [cdkDropListConnectedTo]="['palette-list']"
                (cdkDropListDropped)="onBoardDrop($event)"
              >
                @for (step of steps(); track step.uid; let i = $index) {
                  <div class="lane-item" cdkDrag [cdkDragData]="step">
                    <div class="drag-placeholder" *cdkDragPlaceholder></div>
                    @if (i > 0) {
                      <div class="connector" aria-hidden="true"></div>
                    }
                    <article
                      class="flow-card"
                      [attr.data-tone]="step.type"
                      [class.is-selected]="selectedUid() === step.uid"
                      (click)="select(step.uid)"
                    >
                      <header class="flow-card__head">
                        <button type="button" class="grip" cdkDragHandle aria-label="Drag to reorder">⋮⋮</button>
                        <span class="flow-card__num">{{ i + 1 }}</span>
                        <span class="flow-card__type">{{ typeLabel(step.type) }}</span>
                        <button
                          type="button"
                          class="icon-btn danger"
                          (click)="remove(step.uid); $event.stopPropagation()"
                          aria-label="Remove step"
                        >
                          <app-bosch-icon name="delete" />
                        </button>
                      </header>
                      <strong class="flow-card__title">{{ step.title || typeLabel(step.type) }}</strong>
                      <p class="flow-card__hint">{{ step.instructions || 'No instructions yet' }}</p>
                    </article>
                  </div>
                }
              </div>
            }
          </section>

          <aside class="inspector card">
            <p class="section-label">Step settings</p>
            @if (!selected()) {
              <p class="hint">Select a card on the board to edit title, options, and columns.</p>
            } @else {
              <p class="inspector__type">{{ typeLabel(selected()!.type) }}</p>
              <label>
                Title
                <input [(ngModel)]="selected()!.title" />
              </label>
              <label>
                Instructions
                <input [(ngModel)]="selected()!.instructions" />
              </label>

              @if (selected()!.type === 'poll') {
                <div class="sub">
                  <p class="sub-title">Options</p>
                  @for (opt of selected()!.options; track $index; let oi = $index) {
                    <div class="row">
                      <input [(ngModel)]="opt.label" placeholder="Option label" (ngModelChange)="syncOptionId(opt)" />
                      <button type="button" class="icon-btn danger" (click)="removeOption(selected()!, oi)" aria-label="Remove option">
                        <app-bosch-icon name="delete" />
                      </button>
                    </div>
                  }
                  <app-bosch-button variant="secondary" (click)="addOption(selected()!)">Add option</app-bosch-button>
                </div>
              }

              @if (selected()!.type === 'input') {
                <div class="sub">
                  <label class="check">
                    <input type="checkbox" [(ngModel)]="selected()!.anonymous" />
                    Anonymous sticky notes
                  </label>
                  <label class="check">
                    <input type="checkbox" [(ngModel)]="selected()!.linkedBoard" (ngModelChange)="onLinkedBoardToggle(selected()!)" />
                    Linked board (Objective → Key Result)
                  </label>
                  @if (selected()!.linkedBoard) {
                    <p class="hint">Host adds Objectives; participants attach Key Results under each one.</p>
                  }
                  <p class="sub-title">{{ selected()!.linkedBoard ? 'Board' : 'Columns' }}</p>
                  @for (g of selected()!.groups; track $index; let gi = $index) {
                    <div class="row">
                      <input
                        [(ngModel)]="g.title"
                        [placeholder]="selected()!.linkedBoard ? 'Objectives' : 'Column title'"
                        [disabled]="selected()!.linkedBoard && gi === 0"
                      />
                      @if (!selected()!.linkedBoard) {
                        <button type="button" class="icon-btn danger" (click)="removeGroup(selected()!, gi)" aria-label="Remove column">
                          <app-bosch-icon name="delete" />
                        </button>
                      }
                    </div>
                  }
                  @if (!selected()!.linkedBoard) {
                    <app-bosch-button variant="secondary" (click)="addGroup(selected()!)">Add column</app-bosch-button>
                  }
                </div>
              }

              @if (selected()!.type === 'voting') {
                <label>
                  Votes per participant
                  <input type="number" min="1" max="20" [(ngModel)]="selected()!.votesPerParticipant" />
                </label>
              }

              @if (selected()!.type === 'form') {
                <label class="check">
                  <input type="checkbox" [(ngModel)]="selected()!.linkActionToKr" />
                  Link action to Key Result
                </label>
                @if (selected()!.linkActionToKr) {
                  <p class="hint">Participants pick a KR after voting, then define the action.</p>
                }
              }
            }
          </aside>
        </div>

        @if (error()) {
          <p class="err">{{ error() }}</p>
        }
      </div>
    </app-host-shell>
  `,
  styles: `
    .page {
      display: grid;
      gap: 1rem;
      max-width: 1280px;
    }
    .top {
      align-items: end;
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      justify-content: space-between;
    }
    .eyebrow {
      color: var(--wos-primary);
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      margin: 0 0 0.35rem;
      text-transform: uppercase;
    }
    h1 { font-size: 1.75rem; margin: 0; }
    .lede { color: var(--wos-text-muted); margin: 0.35rem 0 0; max-width: 42rem; }
    .top__actions { align-items: center; display: flex; flex-wrap: wrap; gap: 0.55rem; }
    .ghost {
      background: var(--wos-surface);
      border: 1px solid var(--wos-border);
      border-radius: var(--wos-radius);
      color: var(--wos-text);
      font-weight: 600;
      padding: 0.65rem 0.9rem;
      text-decoration: none;
    }
    .banner {
      background: var(--wos-primary-soft);
      border: 1px solid color-mix(in srgb, var(--wos-primary) 28%, #fff);
      border-radius: var(--wos-radius);
      margin: 0;
      padding: 0.75rem 1rem;
    }
    .card {
      background: var(--wos-surface);
      border: 1px solid var(--wos-border);
      border-radius: var(--wos-radius-lg);
      box-shadow: var(--wos-shadow);
      padding: 1rem;
    }
    .meta {
      display: grid;
      gap: 0.85rem;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    @media (max-width: 900px) {
      .meta { grid-template-columns: 1fr; }
    }
    .section-label {
      color: var(--wos-text-secondary);
      font-size: 0.85rem;
      font-weight: 700;
      margin: 0 0 0.35rem;
    }
    .hint { color: var(--wos-text-muted); font-size: 0.86rem; margin: 0 0 0.75rem; }
    label { display: grid; font-weight: 600; gap: 0.35rem; margin-bottom: 0.85rem; }
    label.check {
      align-items: center;
      display: flex;
      font-weight: 600;
      gap: 0.5rem;
      margin-bottom: 0.55rem;
    }
    input, select {
      border: 1px solid var(--wos-border-strong);
      border-radius: var(--wos-radius);
      font: inherit;
      padding: 0.65rem 0.75rem;
    }
    input:disabled { background: #f1f5f9; color: var(--wos-text-muted); }

    .workspace {
      display: grid;
      gap: 1rem;
      grid-template-columns: 220px minmax(0, 1fr) 300px;
      min-height: 520px;
    }
    @media (max-width: 1100px) {
      .workspace { grid-template-columns: 1fr; }
    }

    .palette__list { display: grid; gap: 0.55rem; }
    .palette-item {
      align-items: stretch;
      background: #fff;
      border: 1px solid var(--wos-border);
      border-radius: 12px;
      cursor: grab;
      display: grid;
      gap: 0.65rem;
      grid-template-columns: 8px 1fr;
      overflow: hidden;
      padding: 0;
      text-align: left;
    }
    .palette-item:active { cursor: grabbing; }
    .palette-item__tone { background: #94a3b8; }
    .palette-item[data-tone='welcome'] .palette-item__tone { background: #38bdf8; }
    .palette-item[data-tone='poll'] .palette-item__tone { background: #818cf8; }
    .palette-item[data-tone='input'] .palette-item__tone { background: #34d399; }
    .palette-item[data-tone='voting'] .palette-item__tone { background: #fbbf24; }
    .palette-item[data-tone='form'] .palette-item__tone { background: #fb7185; }
    .palette-item__copy { display: grid; gap: 0.15rem; padding: 0.65rem 0.7rem 0.65rem 0; }
    .palette-item__copy strong { font-size: 0.9rem; }
    .palette-item__copy small { color: var(--wos-text-muted); font-size: 0.75rem; }
    .palette-preview { padding: 0.25rem; }

    .board {
      background:
        radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.35) 1px, transparent 0) 0 0 / 18px 18px,
        #f8fafc;
      display: flex;
      flex-direction: column;
      min-height: 520px;
      overflow: hidden;
    }
    .board__head {
      align-items: start;
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.75rem;
    }
    .count {
      background: #fff;
      border: 1px solid var(--wos-border);
      border-radius: var(--wos-radius-pill);
      color: var(--wos-primary);
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.55rem;
    }
    .board__empty {
      align-items: center;
      border: 2px dashed #cbd5e1;
      border-radius: 16px;
      color: var(--wos-text-muted);
      display: grid;
      flex: 1;
      font-weight: 600;
      justify-items: center;
      min-height: 280px;
      padding: 2rem;
    }
    .board__lane {
      align-items: stretch;
      display: flex;
      flex: 1;
      gap: 0;
      overflow-x: auto;
      padding: 0.5rem 0.25rem 1rem;
    }
    .lane-item {
      align-items: center;
      display: flex;
      flex: 0 0 auto;
      position: relative;
    }
    .connector {
      background: linear-gradient(90deg, #94a3b8, #64748b);
      flex: 0 0 28px;
      height: 3px;
      margin: 0 0.15rem;
      position: relative;
    }
    .connector::after {
      border-bottom: 5px solid transparent;
      border-left: 8px solid #64748b;
      border-top: 5px solid transparent;
      content: '';
      position: absolute;
      right: -6px;
      top: 50%;
      transform: translateY(-50%);
    }
    .flow-card {
      background: #fff;
      border: 2px solid transparent;
      border-radius: 14px;
      box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
      cursor: pointer;
      display: grid;
      gap: 0.45rem;
      min-height: 150px;
      padding: 0.75rem;
      width: 210px;
    }
    .flow-card[data-tone='welcome'] { background: linear-gradient(180deg, #e0f2fe, #fff 42%); border-color: #bae6fd; }
    .flow-card[data-tone='poll'] { background: linear-gradient(180deg, #e0e7ff, #fff 42%); border-color: #c7d2fe; }
    .flow-card[data-tone='input'] { background: linear-gradient(180deg, #d1fae5, #fff 42%); border-color: #a7f3d0; }
    .flow-card[data-tone='voting'] { background: linear-gradient(180deg, #fef3c7, #fff 42%); border-color: #fde68a; }
    .flow-card[data-tone='form'] { background: linear-gradient(180deg, #ffe4e6, #fff 42%); border-color: #fecdd3; }
    .flow-card.is-selected {
      border-color: var(--wos-primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--wos-primary) 25%, transparent);
    }
    .flow-card__head {
      align-items: center;
      display: flex;
      gap: 0.35rem;
    }
    .grip {
      background: transparent;
      border: 0;
      color: #94a3b8;
      cursor: grab;
      font-size: 0.85rem;
      letter-spacing: -0.08em;
      line-height: 1;
      padding: 0.15rem;
    }
    .flow-card__num {
      align-items: center;
      background: rgba(15, 23, 42, 0.06);
      border-radius: 999px;
      display: inline-flex;
      font-size: 0.72rem;
      font-weight: 800;
      height: 1.35rem;
      justify-content: center;
      width: 1.35rem;
    }
    .flow-card__type {
      color: var(--wos-text-secondary);
      flex: 1;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .flow-card__title {
      font-size: 1rem;
      line-height: 1.25;
    }
    .flow-card__hint {
      color: var(--wos-text-muted);
      font-size: 0.8rem;
      line-height: 1.35;
      margin: 0;
      max-height: 3.2em;
      overflow: hidden;
    }
    .drag-placeholder {
      background: color-mix(in srgb, var(--wos-primary) 12%, #fff);
      border: 2px dashed var(--wos-primary);
      border-radius: 14px;
      min-height: 150px;
      width: 210px;
    }
    .cdk-drag-preview {
      box-sizing: border-box;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.2);
    }
    .cdk-drag-animating { transition: transform 180ms ease; }
    .board__lane.cdk-drop-list-dragging .lane-item:not(.cdk-drag-placeholder) {
      transition: transform 180ms ease;
    }

    .inspector { align-content: start; }
    .inspector__type {
      color: var(--wos-primary);
      font-size: 0.8rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      margin: 0 0 0.75rem;
      text-transform: uppercase;
    }
    .sub { display: grid; gap: 0.5rem; margin-top: 0.2rem; }
    .sub-title { font-weight: 700; margin: 0.15rem 0 0; }
    .row {
      align-items: center;
      display: grid;
      gap: 0.5rem;
      grid-template-columns: 1fr auto;
    }
    .icon-btn {
      align-items: center;
      background: #fff;
      border: 1px solid var(--wos-border);
      border-radius: var(--wos-radius);
      color: var(--wos-text-secondary);
      cursor: pointer;
      display: inline-flex;
      justify-content: center;
      padding: 0.3rem;
    }
    .icon-btn.danger { color: var(--wos-danger); }
    .err { color: var(--wos-danger); font-weight: 600; margin: 0; }
  `
})
export class FormatBuilderComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  paletteItems = [
    { value: 'welcome' as StepType, label: 'Welcome', hint: 'Kickoff + join code' },
    { value: 'poll' as StepType, label: 'Poll', hint: 'Quick pulse check' },
    { value: 'input' as StepType, label: 'Sticky wall', hint: 'Ideas / OKR board' },
    { value: 'voting' as StepType, label: 'Voting', hint: 'Prioritize items' },
    { value: 'form' as StepType, label: 'Action form', hint: 'Owners & due dates' }
  ];

  stepTypes = this.paletteItems;

  formatName = '';
  description = '';
  workshopTitle = '';
  steps = signal<DraftStep[]>([]);
  selectedUid = signal<string | null>(null);
  busy = signal(false);
  error = signal('');
  customizing = signal(false);
  sourceName = signal('');
  saveMode = signal<'template' | 'session' | null>(null);
  private paletteDragging = false;

  /** Palette is source-only — never accept drops back onto it. */
  blockPaletteEnter = () => false;

  constructor() {
    const initial = [
      this.blankStep('welcome'),
      this.blankStep('poll'),
      this.blankStep('input'),
      this.blankStep('voting'),
      this.blankStep('form')
    ];
    this.steps.set(initial);
    this.selectedUid.set(initial[0]?.uid || null);
  }

  ngOnInit() {
    const fromId = this.route.snapshot.queryParamMap.get('from');
    if (!fromId) return;
    this.busy.set(true);
    this.api.getTemplate(fromId).subscribe({
      next: (tpl) => {
        this.customizing.set(true);
        this.sourceName.set(tpl.name);
        this.formatName = `Copy of ${tpl.name}`;
        this.description = tpl.description || '';
        this.workshopTitle = '';
        const ordered = [...(tpl.steps || [])].sort(
          (a: any, b: any) => (a.stepOrder || 0) - (b.stepOrder || 0)
        );
        const mapped = ordered.map((s: any) => this.fromTemplateStep(s));
        this.steps.set(mapped);
        this.selectedUid.set(mapped[0]?.uid || null);
        this.busy.set(false);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(e?.error?.message || 'Could not load template to customize');
      }
    });
  }

  selected() {
    const uid = this.selectedUid();
    return this.steps().find((s) => s.uid === uid) || null;
  }

  select(uid: string) {
    this.selectedUid.set(uid);
  }

  typeLabel(type: StepType) {
    return this.paletteItems.find((t) => t.value === type)?.label || type;
  }

  addStep(type: StepType) {
    // Ignore the click that follows a successful palette drag.
    if (this.paletteDragging) return;
    const step = this.blankStep(type);
    this.steps.update((list) => [...list, step]);
    this.selectedUid.set(step.uid);
  }

  onPaletteDragStarted() {
    this.paletteDragging = true;
  }

  onPaletteDragEnded() {
    // Keep the flag through the trailing click event.
    setTimeout(() => {
      this.paletteDragging = false;
    }, 0);
  }

  remove(uid: string) {
    this.steps.update((list) => list.filter((s) => s.uid !== uid));
    if (this.selectedUid() === uid) {
      this.selectedUid.set(this.steps()[0]?.uid || null);
    }
  }

  onBoardDrop(event: CdkDragDrop<DraftStep[]>) {
    if (event.previousContainer === event.container) {
      const list = [...this.steps()];
      moveItemInArray(list, event.previousIndex, event.currentIndex);
      this.steps.set(list);
      return;
    }
    const type = event.item.data as StepType;
    if (!type || typeof type !== 'string') return;
    const step = this.blankStep(type);
    const list = [...this.steps()];
    const index = Math.min(Math.max(event.currentIndex, 0), list.length);
    list.splice(index, 0, step);
    this.steps.set(list);
    this.selectedUid.set(step.uid);
  }

  addOption(step: DraftStep) {
    const n = step.options.length + 1;
    step.options.push({ id: `opt${n}`, label: `Option ${n}` });
  }

  removeOption(step: DraftStep, index: number) {
    step.options.splice(index, 1);
  }

  syncOptionId(opt: DraftOption) {
    if (opt.id?.trim()) return;
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

  saveAsCustom() {
    this.persistTemplate('template');
  }

  createAndStart() {
    this.persistTemplate('session');
  }

  private persistTemplate(mode: 'template' | 'session') {
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

    this.saveMode.set(mode);
    this.busy.set(true);
    this.api.createTemplate(payload).subscribe({
      next: (tpl) => {
        if (mode === 'template') {
          this.busy.set(false);
          this.saveMode.set(null);
          this.router.navigate(['/'], { queryParams: { custom: tpl.id } });
          return;
        }
        this.api.createSession(tpl.id, this.workshopTitle || this.formatName).subscribe({
          next: (s) => {
            this.api.setHostSession(s.id, s.hostToken, {
              title: s.title,
              code: s.code,
              status: s.status
            });
            this.router.navigate(['/host', s.id]);
          },
          error: (e) => {
            this.busy.set(false);
            this.saveMode.set(null);
            this.error.set(e?.error?.message || 'Session create failed');
          }
        });
      },
      error: (e) => {
        this.busy.set(false);
        this.saveMode.set(null);
        this.error.set(e?.error?.message || 'Format create failed');
      }
    });
  }

  private fromTemplateStep(step: any): DraftStep {
    const type = (step.type || 'welcome') as StepType;
    const draft = this.blankStep(type);
    draft.title = step.title || draft.title;
    draft.instructions = step.instructions || '';
    draft.timerSeconds = step.timerSeconds ?? null;
    const cfg = step.config || {};

    if (type === 'poll') {
      const opts = Array.isArray(cfg['options']) ? cfg['options'] : [];
      if (opts.length) {
        draft.options = opts.map((o: any) => ({
          id: String(o.id || this.slug(String(o.label || 'opt'))),
          label: String(o.label || '')
        }));
      }
    } else if (type === 'input') {
      draft.anonymous = !!cfg['anonymous'];
      draft.linkedBoard = cfg['boardMode'] === 'okr';
      const groups = Array.isArray(step.groups) ? step.groups : [];
      if (groups.length) {
        const ordered = [...groups].sort(
          (a: any, b: any) => (a.groupOrder || 0) - (b.groupOrder || 0)
        );
        draft.groups = ordered.map((g: any) => ({ title: String(g.title || '') }));
      } else if (draft.linkedBoard) {
        draft.groups = [{ title: 'Objectives' }];
      }
    } else if (type === 'voting') {
      draft.votesPerParticipant = Number(cfg['votesPerParticipant']) || 3;
    } else if (type === 'form') {
      draft.linkActionToKr = cfg['linkTo'] === 'kr';
    }

    return draft;
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
      if (step.linkedBoard) {
        base.config = {
          anonymous: !!step.anonymous,
          boardMode: 'okr',
          parentKind: 'objective',
          childKind: 'kr',
          parentLabel: 'Objective',
          childLabel: 'Key Result'
        };
        base.groups = [{ title: step.groups[0]?.title?.trim() || 'Objectives' }];
      } else {
        base.config = { anonymous: !!step.anonymous };
        base.groups = step.groups
          .filter((g) => g.title.trim())
          .map((g) => ({ title: g.title.trim() }));
      }
    } else if (step.type === 'voting') {
      base.config = { votesPerParticipant: Number(step.votesPerParticipant) || 3 };
    } else if (step.type === 'form') {
      base.config = step.linkActionToKr
        ? { linkTo: 'kr', linkLabel: 'Key Result' }
        : {};
    }
    return base;
  }

  onLinkedBoardToggle(step: DraftStep) {
    if (step.linkedBoard) {
      step.groups = [{ title: 'Objectives' }];
      step.anonymous = false;
      if (!step.instructions.trim()) {
        step.instructions = 'Host adds Objectives. Participants attach Key Results under each Objective.';
      }
    } else if (step.groups.length < 2) {
      step.groups = [{ title: 'Column A' }, { title: 'Column B' }, { title: 'Column C' }];
    }
  }

  private blankStep(type: StepType): DraftStep {
    const step: DraftStep = {
      uid: this.uid(),
      type,
      title: this.typeLabel(type),
      instructions: '',
      timerSeconds: null,
      anonymous: true,
      linkedBoard: false,
      linkActionToKr: false,
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

  private uid() {
    return `d-${Math.random().toString(36).slice(2, 10)}`;
  }

  private slug(value: string) {
    return (
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|$)/g, '')
        .slice(0, 24) || 'opt'
    );
  }
}
