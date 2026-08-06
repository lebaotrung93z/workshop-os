import { Component, OnInit, HostListener, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
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

type StepType = 'welcome' | 'poll' | 'input' | 'voting' | 'form' | 'breakout' | 'end';

interface DraftGroup {
  title: string;
  topic?: string;
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
  endText: string;
  linkUrl: string;
  backgroundImageUrl: string;
}

@Component({
  selector: 'app-format-builder',
  standalone: true,
  imports: [
    FormsModule,
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
            <button
              type="button"
              class="history-btn"
              [disabled]="busy() || !canUndoBoard()"
              title="Undo (Ctrl/⌘Z)"
              (click)="undoBoard()"
            >
              Undo
            </button>
            <button
              type="button"
              class="history-btn"
              [disabled]="busy() || !canRedoBoard()"
              title="Redo (Ctrl/⌘⇧Z)"
              (click)="redoBoard()"
            >
              Redo
            </button>
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

        <section class="meta card" (focusin)="beginInspectorEdit()">
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
                  <span class="palette-item__icon" aria-hidden="true">
                    <app-bosch-icon [name]="typeIcon(t.value)" />
                  </span>
                  <span class="palette-item__copy">
                    <strong>{{ t.label }}</strong>
                    <small>{{ t.hint }}</small>
                  </span>
                  <div class="palette-preview" *cdkDragPreview>
                    <article class="flow-card flow-card--preview" [attr.data-tone]="t.value">
                      <div class="flow-card__badge">
                        <app-bosch-icon [name]="typeIcon(t.value)" />
                      </div>
                      <strong>{{ t.label }}</strong>
                      <p>{{ t.hint }}</p>
                    </article>
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
                      <div class="connector" aria-hidden="true">
                        <span class="connector__dot"></span>
                        <span class="connector__line"></span>
                        <span class="connector__arrow"></span>
                      </div>
                    }
                    <article
                      class="flow-card"
                      [attr.data-tone]="step.type"
                      [class.is-selected]="selectedUid() === step.uid"
                      (click)="select(step.uid)"
                    >
                      <div class="flow-card__shine" aria-hidden="true"></div>
                      <header class="flow-card__head">
                        <button type="button" class="grip" cdkDragHandle aria-label="Drag to reorder">
                          <span></span><span></span><span></span>
                        </button>
                        <div class="flow-card__badge" aria-hidden="true">
                          <app-bosch-icon [name]="typeIcon(step.type)" />
                        </div>
                        <div class="flow-card__head-copy">
                          <span class="flow-card__type">{{ typeLabel(step.type) }}</span>
                          <span class="flow-card__num">Step {{ i + 1 }}</span>
                        </div>
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
                      <p class="flow-card__hint">{{ step.instructions || 'Add facilitator instructions…' }}</p>

                      <div class="flow-card__stage" aria-hidden="true">
                        @if (step.type === 'welcome') {
                          <div class="mini mini--welcome">
                            <div class="mini-qr"></div>
                            <div class="mini-welcome-copy">
                              <span class="mini-code">ABC123</span>
                              <span>Join on phone</span>
                            </div>
                          </div>
                        } @else if (step.type === 'poll') {
                          <div class="mini mini--poll">
                            @for (opt of step.options.slice(0, 3); track opt.id) {
                              <div class="mini-bar">
                                <span>{{ opt.label || 'Option' }}</span>
                                <i [style.width.%]="miniPollWidth(opt, step, $index)"></i>
                              </div>
                            }
                          </div>
                        } @else if (step.type === 'input') {
                          <div class="mini mini--input" [class.is-okr]="step.linkedBoard">
                            @if (step.linkedBoard) {
                              <div class="mini-okr">
                                <span class="pill root">Theme</span>
                                <span class="pill obj">Objective</span>
                                <span class="pill kr">Key Result</span>
                              </div>
                            } @else {
                              @for (g of step.groups.slice(0, 3); track $index) {
                                <div class="mini-col">
                                  <em>{{ g.title || 'Column' }}</em>
                                  <span></span><span></span>
                                </div>
                              }
                            }
                          </div>
                        } @else if (step.type === 'voting') {
                          <div class="mini mini--voting">
                            <div class="dot-row">
                              @for (n of voteDots(step); track $index) {
                                <i [class.on]="n"></i>
                              }
                            </div>
                            <span>{{ step.votesPerParticipant || 3 }} votes / person</span>
                          </div>
                        } @else if (step.type === 'form') {
                          <div class="mini mini--form">
                            <div class="mini-field"></div>
                            <div class="mini-field short"></div>
                            <div class="mini-field"></div>
                            @if (step.linkActionToKr) {
                              <span class="mini-tag">Links to KR</span>
                            }
                          </div>
                        } @else if (step.type === 'breakout') {
                          <div class="mini mini--breakout">
                            @for (g of step.groups.slice(0, 3); track $index) {
                              <div class="mini-team">
                                <em>{{ g.title || 'Group' }}</em>
                                @if (g.topic) {
                                  <small>{{ g.topic }}</small>
                                } @else {
                                  <span class="mini-avatars"><i></i><i></i><i></i></span>
                                }
                              </div>
                            }
                          </div>
                        } @else if (step.type === 'end') {
                          <div class="mini mini--end">
                            <div class="mini-qr"></div>
                            <div class="mini-welcome-copy">
                              <span>{{ step.endText || 'Thanks for joining' }}</span>
                              @if (step.linkUrl) {
                                <span class="mini-code">QR link</span>
                              }
                            </div>
                          </div>
                        }
                      </div>

                      <footer class="flow-card__meta">
                        @for (chip of stepChips(step); track chip) {
                          <span class="chip">{{ chip }}</span>
                        }
                      </footer>
                    </article>
                  </div>
                }
              </div>
            }
          </section>

          <aside class="inspector card" (focusin)="beginInspectorEdit()">
            <p class="section-label">Step settings</p>
            @if (!selected()) {
              <p class="hint">Select a card on the board to edit title, options, and columns.</p>
            } @else {
              <div class="inspector__hero" [attr.data-tone]="selected()!.type">
                <span class="inspector__emoji">
                  <app-bosch-icon [name]="typeIcon(selected()!.type)" />
                </span>
                <div>
                  <p class="inspector__type">{{ typeLabel(selected()!.type) }}</p>
                  <strong>{{ selected()!.title || typeLabel(selected()!.type) }}</strong>
                </div>
              </div>
              <label>
                Title
                <input [(ngModel)]="selected()!.title" />
              </label>
              <label>
                Instructions
                <textarea rows="3" [(ngModel)]="selected()!.instructions"></textarea>
              </label>
              <label>
                Timer (seconds)
                <input type="number" min="0" max="7200" [(ngModel)]="selected()!.timerSeconds" placeholder="0 = no timer" />
              </label>
              <p class="hint">Optional countdown shown on host, display, and phones.</p>

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

              @if (selected()!.type === 'breakout') {
                <div class="sub">
                  <p class="sub-title">Groups &amp; topics</p>
                  <p class="hint">Name teams and assign a topic. Host divides participants when live.</p>
                  @for (g of selected()!.groups; track $index; let gi = $index) {
                    <div class="breakout-draft">
                      <div class="row">
                        <input [(ngModel)]="g.title" placeholder="Group name" />
                        <button type="button" class="icon-btn danger" (click)="removeGroup(selected()!, gi)" aria-label="Remove group">
                          <app-bosch-icon name="delete" />
                        </button>
                      </div>
                      <input [(ngModel)]="g.topic" placeholder="Topic for this group…" />
                    </div>
                  }
                  <app-bosch-button variant="secondary" (click)="addBreakoutGroup(selected()!)">Add group</app-bosch-button>
                </div>
              }

              @if (selected()!.type === 'end') {
                <div class="sub">
                  <label>
                    Big screen closing text
                    <textarea rows="3" [(ngModel)]="selected()!.endText" placeholder="Thanks message…"></textarea>
                  </label>
                  <label>
                    Link for big-screen QR
                    <input [(ngModel)]="selected()!.linkUrl" placeholder="https://…" />
                  </label>
                  <p class="hint">Leave blank to hide the QR on the projector.</p>
                  <label>
                    Background image URL
                    <input [(ngModel)]="selected()!.backgroundImageUrl" placeholder="https://… (optional)" />
                  </label>
                </div>
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
    :host {
      display: block;
      width: 100%;
    }

    .page {
      display: grid;
      gap: 1rem;
      max-width: none;
      width: 100%;
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
    .history-btn {
      background: var(--wos-surface);
      border: 1px solid var(--wos-border-strong);
      border-radius: var(--wos-radius);
      color: var(--wos-text);
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 700;
      padding: 0.55rem 0.85rem;
    }
    .history-btn:hover:not(:disabled) {
      border-color: var(--wos-primary);
      color: var(--wos-primary);
    }
    .history-btn:disabled {
      cursor: default;
      opacity: 0.45;
    }
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
    input, select, textarea {
      border: 1px solid var(--wos-border-strong);
      border-radius: var(--wos-radius);
      font: inherit;
      max-width: 100%;
      padding: 0.65rem 0.75rem;
    }
    input:disabled { background: #f1f5f9; color: var(--wos-text-muted); }

    .workspace {
      display: grid;
      gap: 1rem;
      grid-template-columns: 240px minmax(0, 1fr) minmax(280px, 320px);
      min-height: 580px;
    }

    .palette__list { display: grid; gap: 0.55rem; }
    .palette-item {
      align-items: center;
      background: #fff;
      border: 1px solid var(--wos-border);
      border-radius: 14px;
      cursor: grab;
      display: grid;
      gap: 0.65rem;
      grid-template-columns: 2.4rem 1fr;
      overflow: hidden;
      padding: 0.45rem 0.55rem 0.45rem 0.45rem;
      text-align: left;
      transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
    }
    .palette-item:hover {
      border-color: #93c5fd;
      box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
      transform: translateY(-1px);
    }
    .palette-item:active { cursor: grabbing; }
    .palette-item__icon {
      align-items: center;
      background: #f1f5f9;
      border-radius: 10px;
      color: #0f172a;
      display: inline-flex;
      height: 2.4rem;
      justify-content: center;
      width: 2.4rem;
    }
    .palette-item__icon ::ng-deep .bosch-icon,
    .palette-item__icon ::ng-deep .bosch-icon__svg {
      height: 1.15rem;
      width: 1.15rem;
    }
    .palette-item[data-tone='welcome'] .palette-item__icon { background: #e0f2fe; color: #0369a1; }
    .palette-item[data-tone='poll'] .palette-item__icon { background: #e0e7ff; color: #4338ca; }
    .palette-item[data-tone='input'] .palette-item__icon { background: #d1fae5; color: #047857; }
    .palette-item[data-tone='voting'] .palette-item__icon { background: #fef3c7; color: #b45309; }
    .palette-item[data-tone='form'] .palette-item__icon { background: #ffe4e6; color: #be123c; }
    .palette-item[data-tone='breakout'] .palette-item__icon { background: #ede9fe; color: #6d28d9; }
    .palette-item[data-tone='end'] .palette-item__icon { background: #f1f5f9; color: #334155; }
    .flow-card[data-tone='welcome'] .flow-card__badge { color: #0369a1; }
    .flow-card[data-tone='poll'] .flow-card__badge { color: #4338ca; }
    .flow-card[data-tone='input'] .flow-card__badge { color: #047857; }
    .flow-card[data-tone='voting'] .flow-card__badge { color: #b45309; }
    .flow-card[data-tone='form'] .flow-card__badge { color: #be123c; }
    .flow-card[data-tone='breakout'] .flow-card__badge { color: #6d28d9; }
    .flow-card[data-tone='end'] .flow-card__badge { color: #334155; }
    .inspector__hero[data-tone='welcome'] .inspector__emoji { color: #0369a1; }
    .inspector__hero[data-tone='poll'] .inspector__emoji { color: #4338ca; }
    .inspector__hero[data-tone='input'] .inspector__emoji { color: #047857; }
    .inspector__hero[data-tone='voting'] .inspector__emoji { color: #b45309; }
    .inspector__hero[data-tone='form'] .inspector__emoji { color: #be123c; }
    .inspector__hero[data-tone='breakout'] .inspector__emoji { color: #6d28d9; }
    .inspector__hero[data-tone='end'] .inspector__emoji { color: #334155; }
    .palette-item__copy { display: grid; gap: 0.1rem; }
    .palette-item__copy strong { font-size: 0.9rem; }
    .palette-item__copy small { color: var(--wos-text-muted); font-size: 0.75rem; }
    .palette-preview { padding: 0.25rem; }

    .board {
      background:
        radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.35) 1px, transparent 0) 0 0 / 18px 18px,
        linear-gradient(180deg, #eef2ff 0%, #f8fafc 48%, #f1f5f9 100%);
      display: flex;
      flex-direction: column;
      min-height: 580px;
      min-width: 0;
      overflow: hidden;
      position: relative;
    }
    .board::after {
      background: linear-gradient(90deg, transparent, rgba(248, 250, 252, 0.95));
      content: '';
      height: 100%;
      pointer-events: none;
      position: absolute;
      right: 0;
      top: 0;
      width: 28px;
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
      padding: 0.75rem 0.35rem 1.25rem;
    }
    .lane-item {
      align-items: center;
      display: flex;
      flex: 0 0 auto;
      position: relative;
    }
    .connector {
      align-items: center;
      display: flex;
      flex: 0 0 42px;
      gap: 0;
      justify-content: center;
      margin: 0 0.1rem;
      position: relative;
    }
    .connector__dot {
      background: #64748b;
      border-radius: 50%;
      height: 7px;
      width: 7px;
    }
    .connector__line {
      background: linear-gradient(90deg, #94a3b8, #64748b);
      flex: 1;
      height: 3px;
    }
    .connector__arrow {
      border-bottom: 6px solid transparent;
      border-left: 9px solid #64748b;
      border-top: 6px solid transparent;
      height: 0;
      width: 0;
    }

    .flow-card {
      background: #fff;
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 18px;
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.7) inset,
        0 14px 34px rgba(15, 23, 42, 0.12);
      cursor: pointer;
      display: grid;
      gap: 0.55rem;
      min-height: 286px;
      overflow: hidden;
      padding: 0.85rem;
      position: relative;
      transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
      width: 248px;
    }
    .flow-card:hover {
      box-shadow:
        0 1px 0 rgba(255, 255, 255, 0.8) inset,
        0 18px 40px rgba(15, 23, 42, 0.16);
      transform: translateY(-2px);
    }
    .flow-card--preview {
      min-height: auto;
      width: 220px;
    }
    .flow-card__shine {
      background: linear-gradient(120deg, rgba(255,255,255,0.55), transparent 42%);
      height: 72px;
      left: 0;
      pointer-events: none;
      position: absolute;
      right: 0;
      top: 0;
    }
    .flow-card[data-tone='welcome'] {
      background: linear-gradient(165deg, #dbeafe 0%, #eff6ff 34%, #ffffff 70%);
      border-color: #93c5fd;
    }
    .flow-card[data-tone='poll'] {
      background: linear-gradient(165deg, #ddd6fe 0%, #eef2ff 34%, #ffffff 70%);
      border-color: #a5b4fc;
    }
    .flow-card[data-tone='input'] {
      background: linear-gradient(165deg, #bbf7d0 0%, #ecfdf5 34%, #ffffff 70%);
      border-color: #6ee7b7;
    }
    .flow-card[data-tone='voting'] {
      background: linear-gradient(165deg, #fde68a 0%, #fffbeb 34%, #ffffff 70%);
      border-color: #fcd34d;
    }
    .flow-card[data-tone='form'] {
      background: linear-gradient(165deg, #fecdd3 0%, #fff1f2 34%, #ffffff 70%);
      border-color: #fda4af;
    }
    .flow-card[data-tone='breakout'] {
      background: linear-gradient(165deg, #ddd6fe 0%, #f5f3ff 34%, #ffffff 70%);
      border-color: #c4b5fd;
    }
    .flow-card[data-tone='end'] {
      background: linear-gradient(165deg, #e2e8f0 0%, #f8fafc 34%, #ffffff 70%);
      border-color: #94a3b8;
    }
    .flow-card.is-selected {
      border-color: var(--wos-primary);
      box-shadow:
        0 0 0 3px color-mix(in srgb, var(--wos-primary) 28%, transparent),
        0 18px 40px rgba(15, 23, 42, 0.16);
    }
    .flow-card__head {
      align-items: center;
      display: flex;
      gap: 0.45rem;
      position: relative;
      z-index: 1;
    }
    .grip {
      background: rgba(255, 255, 255, 0.7);
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 8px;
      cursor: grab;
      display: grid;
      gap: 2px;
      padding: 0.35rem 0.3rem;
    }
    .grip span {
      background: #94a3b8;
      border-radius: 99px;
      display: block;
      height: 2px;
      width: 10px;
    }
    .flow-card__badge {
      align-items: center;
      background: rgba(255, 255, 255, 0.85);
      border: 1px solid rgba(15, 23, 42, 0.06);
      border-radius: 12px;
      color: #0f172a;
      display: inline-flex;
      height: 2.1rem;
      justify-content: center;
      width: 2.1rem;
    }
    .flow-card__badge ::ng-deep .bosch-icon,
    .flow-card__badge ::ng-deep .bosch-icon__svg {
      height: 1.05rem;
      width: 1.05rem;
    }
    .flow-card__head-copy {
      display: grid;
      flex: 1;
      gap: 0.05rem;
      min-width: 0;
    }
    .flow-card__type {
      color: var(--wos-text-secondary);
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .flow-card__num {
      color: var(--wos-text-muted);
      font-size: 0.72rem;
      font-weight: 600;
    }
    .flow-card__title {
      font-size: 1.05rem;
      line-height: 1.25;
      position: relative;
      z-index: 1;
    }
    .flow-card__hint {
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      color: var(--wos-text-muted);
      display: -webkit-box;
      font-size: 0.8rem;
      line-height: 1.35;
      margin: 0;
      overflow: hidden;
      position: relative;
      z-index: 1;
    }

    .flow-card__stage {
      background: rgba(255, 255, 255, 0.72);
      border: 1px solid rgba(15, 23, 42, 0.06);
      border-radius: 14px;
      min-height: 92px;
      padding: 0.55rem;
      position: relative;
      z-index: 1;
    }
    .mini { display: grid; gap: 0.4rem; height: 100%; }
    .mini--welcome {
      align-items: center;
      display: grid;
      gap: 0.65rem;
      grid-template-columns: 48px 1fr;
    }
    .mini--end {
      align-items: center;
      display: grid;
      gap: 0.65rem;
      grid-template-columns: 48px 1fr;
    }
    .mini-qr {
      aspect-ratio: 1;
      background:
        linear-gradient(#0f172a 0 0) 0 0 / 35% 35%,
        linear-gradient(#0f172a 0 0) 100% 0 / 35% 35%,
        linear-gradient(#0f172a 0 0) 0 100% / 35% 35%,
        linear-gradient(#0f172a 0 0) 100% 100% / 35% 35%,
        repeating-linear-gradient(90deg, #0f172a 0 2px, transparent 2px 5px),
        #fff;
      background-repeat: no-repeat;
      border: 2px solid #0f172a;
      border-radius: 6px;
    }
    .mini-welcome-copy { display: grid; gap: 0.15rem; font-size: 0.72rem; color: #64748b; }
    .mini-code {
      color: #2563eb;
      font-size: 0.95rem;
      font-weight: 800;
      letter-spacing: 0.08em;
    }
    .mini-bar {
      align-items: center;
      display: grid;
      gap: 0.35rem;
      grid-template-columns: 52px 1fr;
    }
    .mini-bar span {
      color: #475569;
      font-size: 0.68rem;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mini-bar i {
      background: linear-gradient(90deg, #6366f1, #93c5fd);
      border-radius: 999px;
      display: block;
      height: 8px;
    }
    .mini--input {
      display: grid;
      gap: 0.35rem;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .mini-col {
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      display: grid;
      gap: 0.25rem;
      padding: 0.3rem;
    }
    .mini-col em {
      color: #64748b;
      font-size: 0.62rem;
      font-style: normal;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mini-col span {
      background: #fef08a;
      border-radius: 4px;
      display: block;
      height: 14px;
      opacity: 0.9;
    }
    .mini-col span:last-child {
      background: #bbf7d0;
      width: 78%;
    }
    .mini-okr {
      align-items: center;
      display: grid;
      gap: 0.3rem;
      justify-items: center;
    }
    .mini-okr .pill {
      border-radius: 999px;
      color: #fff;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 0.2rem 0.55rem;
    }
    .mini-okr .root { background: #2563eb; }
    .mini-okr .obj { background: #7c3aed; }
    .mini-okr .kr { background: #059669; }
    .mini--voting {
      align-content: center;
      display: grid;
      gap: 0.4rem;
      justify-items: center;
    }
    .dot-row { display: flex; gap: 0.3rem; }
    .dot-row i {
      background: #e2e8f0;
      border-radius: 50%;
      display: block;
      height: 12px;
      width: 12px;
    }
    .dot-row i.on { background: #f59e0b; box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2); }
    .mini--voting > span { color: #92400e; font-size: 0.72rem; font-weight: 700; }
    .mini--form { display: grid; gap: 0.35rem; }
    .mini--breakout {
      display: grid;
      gap: 0.35rem;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .mini-team {
      background: #f5f3ff;
      border-radius: 6px;
      display: grid;
      gap: 0.25rem;
      padding: 0.35rem;
    }
    .mini-team em {
      color: #6d28d9;
      font-size: 0.65rem;
      font-style: normal;
      font-weight: 700;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .mini-team small {
      color: #64748b;
      font-size: 0.58rem;
      line-height: 1.2;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .mini-avatars {
      display: flex;
      gap: 2px;
    }
    .mini-avatars i {
      background: #c4b5fd;
      border-radius: 50%;
      display: inline-block;
      height: 0.55rem;
      width: 0.55rem;
    }
    .mini-field {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      height: 12px;
    }
    .mini-field.short { width: 62%; }
    .mini-tag {
      background: #ffe4e6;
      border-radius: 999px;
      color: #be123c;
      font-size: 0.65rem;
      font-weight: 700;
      justify-self: start;
      padding: 0.15rem 0.45rem;
    }

    .flow-card__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.3rem;
      margin-top: auto;
      position: relative;
      z-index: 1;
    }
    .chip {
      background: rgba(15, 23, 42, 0.06);
      border-radius: 999px;
      color: #334155;
      font-size: 0.68rem;
      font-weight: 700;
      padding: 0.18rem 0.45rem;
    }
    .drag-placeholder {
      background: color-mix(in srgb, var(--wos-primary) 12%, #fff);
      border: 2px dashed var(--wos-primary);
      border-radius: 18px;
      min-height: 286px;
      width: 248px;
    }
    .cdk-drag-preview {
      box-sizing: border-box;
      box-shadow: 0 22px 48px rgba(15, 23, 42, 0.22);
    }
    .cdk-drag-animating { transition: transform 180ms ease; }
    .board__lane.cdk-drop-list-dragging .lane-item:not(.cdk-drag-placeholder) {
      transition: transform 180ms ease;
    }

    .inspector { align-content: start; min-width: 0; }
    .inspector__hero {
      align-items: center;
      border-radius: 14px;
      display: flex;
      gap: 0.65rem;
      margin-bottom: 0.9rem;
      padding: 0.7rem;
    }
    .inspector__hero[data-tone='welcome'] { background: #e0f2fe; }
    .inspector__hero[data-tone='poll'] { background: #e0e7ff; }
    .inspector__hero[data-tone='input'] { background: #d1fae5; }
    .inspector__hero[data-tone='voting'] { background: #fef3c7; }
    .inspector__hero[data-tone='form'] { background: #ffe4e6; }
    .inspector__hero[data-tone='breakout'] { background: #ede9fe; }
    .inspector__hero[data-tone='end'] { background: #f1f5f9; }
    .inspector__emoji {
      align-items: center;
      background: rgba(255,255,255,0.8);
      border-radius: 12px;
      color: #0f172a;
      display: inline-flex;
      height: 2.4rem;
      justify-content: center;
      width: 2.4rem;
    }
    .inspector__emoji ::ng-deep .bosch-icon,
    .inspector__emoji ::ng-deep .bosch-icon__svg {
      height: 1.2rem;
      width: 1.2rem;
    }
    .inspector__type {
      color: var(--wos-primary);
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      margin: 0;
      text-transform: uppercase;
    }
    .inspector textarea {
      border: 1px solid var(--wos-border-strong);
      border-radius: var(--wos-radius);
      font: inherit;
      padding: 0.65rem 0.75rem;
      resize: vertical;
    }
    .sub { display: grid; gap: 0.5rem; margin-top: 0.2rem; }
    .sub-title { font-weight: 700; margin: 0.15rem 0 0; }
    .row {
      align-items: center;
      display: grid;
      gap: 0.5rem;
      grid-template-columns: 1fr auto;
    }
    .breakout-draft {
      display: grid;
      gap: 0.4rem;
      margin-bottom: 0.35rem;
    }
    .breakout-draft > input {
      border: 1px solid var(--wos-border-strong);
      border-radius: var(--wos-radius);
      font: inherit;
      padding: 0.55rem 0.7rem;
      width: 100%;
    }
    .icon-btn {
      align-items: center;
      background: rgba(255, 255, 255, 0.9);
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

    /* Large PC */
    @media (min-width: 1280px) {
      .workspace {
        grid-template-columns: 260px minmax(0, 1fr) 340px;
      }
    }

    /* Laptop / large tablet: board + inspector, palette as horizontal strip */
    @media (max-width: 1200px) {
      .workspace {
        grid-template-columns: minmax(0, 1fr) minmax(260px, 300px);
        grid-template-areas:
          'palette palette'
          'board inspector';
      }
      .palette { grid-area: palette; }
      .board { grid-area: board; min-height: 480px; }
      .inspector {
        grid-area: inspector;
        max-height: calc(100vh - 8rem);
        overflow: auto;
        position: sticky;
        top: 0.75rem;
      }
      .palette__list {
        display: flex;
        flex-wrap: nowrap;
        gap: 0.55rem;
        overflow-x: auto;
        padding-bottom: 0.15rem;
      }
      .palette-item {
        flex: 0 0 190px;
      }
      .meta {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    /* Narrow tablet */
    @media (max-width: 768px) {
      .top__actions { width: 100%; }
      .meta { grid-template-columns: 1fr; }
      .workspace {
        grid-template-areas:
          'palette'
          'board'
          'inspector';
        grid-template-columns: 1fr;
        min-height: 0;
      }
      .board { min-height: 420px; }
      .inspector {
        max-height: none;
        position: static;
      }
      .flow-card {
        width: min(248px, 78vw);
      }
      .drag-placeholder {
        width: min(248px, 78vw);
      }
    }
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
    { value: 'form' as StepType, label: 'Action form', hint: 'Owners & due dates' },
    { value: 'breakout' as StepType, label: 'Group participants', hint: 'Random or manual teams' },
    { value: 'end' as StepType, label: 'End', hint: 'Closing text + QR link' }
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
  private boardUndo: string[] = [];
  private boardRedo: string[] = [];
  private inspectorCaptured = false;

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

  @HostListener('document:keydown', ['$event'])
  onBoardKeydown(ev: KeyboardEvent) {
    const target = ev.target as HTMLElement | null;
    const tag = target?.tagName?.toLowerCase();
    const typing =
      tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;
    // Allow undo/redo even while typing in inspector — app history for the board.
    const mod = ev.metaKey || ev.ctrlKey;
    if (!mod) return;
    const key = ev.key.toLowerCase();
    if (!ev.shiftKey && key === 'z') {
      // Prefer native undo while typing in a field unless stack has board history intent —
      // use board undo when not in a text field, or when explicitly clicking buttons.
      if (typing) return;
      ev.preventDefault();
      this.undoBoard();
      return;
    }
    if (key === 'y' || (ev.shiftKey && key === 'z')) {
      if (typing) return;
      ev.preventDefault();
      this.redoBoard();
    }
  }

  private boardSnapshot() {
    return JSON.stringify({
      steps: this.steps(),
      selectedUid: this.selectedUid(),
      formatName: this.formatName,
      description: this.description,
      workshopTitle: this.workshopTitle
    });
  }

  private restoreBoardSnapshot(raw: string) {
    const parsed = JSON.parse(raw);
    this.steps.set(parsed.steps || []);
    this.selectedUid.set(parsed.selectedUid || null);
    this.formatName = parsed.formatName || '';
    this.description = parsed.description || '';
    this.workshopTitle = parsed.workshopTitle || '';
    this.inspectorCaptured = false;
  }

  private captureBoard() {
    this.boardUndo.push(this.boardSnapshot());
    if (this.boardUndo.length > 50) this.boardUndo.shift();
    this.boardRedo = [];
    this.inspectorCaptured = false;
  }

  beginInspectorEdit() {
    if (this.inspectorCaptured || this.busy()) return;
    this.captureBoard();
    this.inspectorCaptured = true;
  }

  canUndoBoard() {
    return this.boardUndo.length > 0;
  }

  canRedoBoard() {
    return this.boardRedo.length > 0;
  }

  undoBoard() {
    const prev = this.boardUndo.pop();
    if (!prev) return;
    this.boardRedo.push(this.boardSnapshot());
    this.restoreBoardSnapshot(prev);
  }

  redoBoard() {
    const next = this.boardRedo.pop();
    if (!next) return;
    this.boardUndo.push(this.boardSnapshot());
    this.restoreBoardSnapshot(next);
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
    this.inspectorCaptured = false;
    this.selectedUid.set(uid);
  }

  typeLabel(type: StepType) {
    return this.paletteItems.find((t) => t.value === type)?.label || type;
  }

  typeIcon(type: StepType) {
    switch (type) {
      case 'welcome':
        return 'welcome';
      case 'poll':
        return 'poll';
      case 'input':
        return 'input';
      case 'voting':
        return 'voting';
      case 'form':
        return 'form';
      case 'breakout':
        return 'breakout';
      case 'end':
        return 'end';
      default:
        return 'settings';
    }
  }

  stepChips(step: DraftStep): string[] {
    const chips: string[] = [];
    if (step.timerSeconds && step.timerSeconds > 0) {
      const m = Math.floor(step.timerSeconds / 60);
      const s = step.timerSeconds % 60;
      chips.push(m > 0 ? `${m}m${s ? ` ${s}s` : ''} timer` : `${s}s timer`);
    }
    if (step.type === 'poll') {
      chips.push(`${step.options.filter((o) => o.label.trim()).length || 0} options`);
    } else if (step.type === 'input') {
      chips.push(step.linkedBoard ? 'OKR board' : `${step.groups.length} columns`);
      if (step.anonymous) chips.push('Anonymous');
    } else if (step.type === 'voting') {
      chips.push(`${step.votesPerParticipant || 3} votes`);
    } else if (step.type === 'form') {
      chips.push(step.linkActionToKr ? 'KR-linked' : 'Actions');
    } else if (step.type === 'breakout') {
      chips.push(`${step.groups.length} groups`);
    } else if (step.type === 'welcome') {
      chips.push('Lobby / QR');
    } else if (step.type === 'end') {
      chips.push(step.linkUrl?.trim() ? 'Closing QR' : 'Closing');
    }
    return chips;
  }

  miniPollWidth(opt: DraftOption, step: DraftStep, index: number) {
    const weights = [88, 62, 40, 28];
    return weights[index] || 35;
  }

  voteDots(step: DraftStep) {
    const n = Math.min(8, Math.max(1, Number(step.votesPerParticipant) || 3));
    return Array.from({ length: 5 }, (_, i) => i < n);
  }

  addStep(type: StepType) {
    // Ignore the click that follows a successful palette drag.
    if (this.paletteDragging) return;
    this.captureBoard();
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
    this.captureBoard();
    this.steps.update((list) => list.filter((s) => s.uid !== uid));
    if (this.selectedUid() === uid) {
      this.selectedUid.set(this.steps()[0]?.uid || null);
    }
  }

  onBoardDrop(event: CdkDragDrop<DraftStep[]>) {
    this.captureBoard();
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
    this.beginInspectorEdit();
    const n = step.options.length + 1;
    step.options.push({ id: `opt${n}`, label: `Option ${n}` });
  }

  removeOption(step: DraftStep, index: number) {
    this.beginInspectorEdit();
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
    this.beginInspectorEdit();
    step.groups.push({ title: `Column ${step.groups.length + 1}` });
  }

  addBreakoutGroup(step: DraftStep) {
    this.beginInspectorEdit();
    step.groups.push({ title: `Group ${step.groups.length + 1}`, topic: '' });
  }

  removeGroup(step: DraftStep, index: number) {
    this.beginInspectorEdit();
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
    } else if (type === 'breakout') {
      const groups = Array.isArray(step.groups) ? step.groups : [];
      if (groups.length) {
        const ordered = [...groups].sort(
          (a: any, b: any) => (a.groupOrder || 0) - (b.groupOrder || 0)
        );
        draft.groups = ordered.map((g: any) => ({
          title: String(g.title || ''),
          topic: String(g.topic || '')
        }));
      } else {
        draft.groups = [
          { title: 'Group 1', topic: '' },
          { title: 'Group 2', topic: '' },
          { title: 'Group 3', topic: '' }
        ];
      }
    } else if (type === 'end') {
      draft.endText = String(cfg['endText'] || draft.endText);
      draft.linkUrl = String(cfg['linkUrl'] || '');
      draft.backgroundImageUrl = String(cfg['backgroundImageUrl'] || '');
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
    } else if (step.type === 'breakout') {
      base.config = { assignments: {} };
      base.groups = step.groups
        .filter((g) => g.title.trim())
        .map((g) => ({
          title: g.title.trim(),
          ...(String(g.topic || '').trim() ? { topic: String(g.topic).trim() } : {})
        }));
      if (!base.groups.length) {
        base.groups = [{ title: 'Group 1' }, { title: 'Group 2' }, { title: 'Group 3' }];
      }
    } else if (step.type === 'end') {
      base.config = {
        endText: (step.endText || '').trim(),
        backgroundImageUrl: (step.backgroundImageUrl || '').trim(),
        linkUrl: (step.linkUrl || '').trim()
      };
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
      ],
      endText: '',
      linkUrl: '',
      backgroundImageUrl: ''
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
    } else if (type === 'breakout') {
      step.title = 'Breakout groups';
      step.instructions = 'Host will divide participants into groups.';
      step.groups = [
        { title: 'Group 1', topic: '' },
        { title: 'Group 2', topic: '' },
        { title: 'Group 3', topic: '' }
      ];
      step.timerSeconds = 180;
    } else if (type === 'end') {
      step.title = 'Thanks';
      step.instructions = 'Close the session and share next steps.';
      step.endText = 'Thanks for joining — scan the code for next steps.';
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
