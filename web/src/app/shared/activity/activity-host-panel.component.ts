import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BoschButtonComponent } from '../../bosch-ui/bosch-button/bosch-button.component';
import { BoschAvatarComponent } from '../../bosch-ui/bosch-avatar/bosch-avatar.component';
import { ApiService } from '../../core/api.service';
import { buildOkrTree, boardIsAnonymous, displayAuthorName, isOkrBoard, okrInputStep, okrVotingStep, sessionHasOkr } from '../../core/okr.util';

@Component({
  selector: 'app-activity-host-panel',
  standalone: true,
  imports: [FormsModule, BoschButtonComponent, BoschAvatarComponent],
  template: `
    <div class="panel">
      <div class="mod-bar">
        <button
          type="button"
          class="mod-btn"
          [disabled]="!canUndoMod()"
          title="Undo hide / unhide / delete"
          (click)="undoModeration()"
        >
          Undo
        </button>
        <button
          type="button"
          class="mod-btn"
          [disabled]="!canRedoMod()"
          title="Redo hide / unhide / delete"
          (click)="redoModeration()"
        >
          Redo
        </button>
      </div>
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

      @if (isOkrSession()) {
        <div class="okr-head">
          <h3>OKR workflow</h3>
          <span>{{ objectives().length }} objectives</span>
        </div>
        <label class="root-edit">
          Tree theme (root)
          <div class="root-edit__row">
            <input
              [(ngModel)]="treeRootDraft"
              placeholder="Edit root theme…"
              (keyup.enter)="saveTreeRoot()"
            />
            <app-bosch-button [disabled]="busy()" (click)="saveTreeRoot()">Save</app-bosch-button>
          </div>
        </label>
        @if (session?.currentStep?.type === 'input' || canPrepObjectives()) {
          <div class="add-obj">
            <input [(ngModel)]="newObjective" placeholder="Add an Objective…" (keyup.enter)="addObjective()" />
            <app-bosch-button [disabled]="!newObjective.trim() || busy()" (click)="addObjective()">Add Objective</app-bosch-button>
          </div>
          @if (canPrepObjectives() && session?.currentStep?.type !== 'input') {
            <p class="hint">Prep Objectives now — participants add Key Results after you start.</p>
          }
        }
        <div class="host-tree">
          <div class="host-tree__canvas" role="tree">
          <div class="tree-node tree-node--root" role="treeitem">
            <div class="tree-pill tree-pill--root" [class.is-empty]="!rootLabel()">
              {{ rootLabel() || 'Theme (edit above)' }}
            </div>
            @if (objectives().length) {
              <button type="button" class="tree-toggle" (click)="toggle('__root__')">
                {{ isOpen('__root__', objectives().length) ? '−' : '+' }}
              </button>
            }
            @if (objectives().length && isOpen('__root__', objectives().length)) {
              <div class="tree-children" role="group">
                @for (obj of objectives(); track obj.id) {
                  <div class="tree-node" role="treeitem">
                    <div class="tree-pill tree-pill--objective" [class.is-hidden]="obj.hidden">
                      @if (editingObjectiveId === obj.id) {
                        <input class="obj-edit" [(ngModel)]="editObjectiveText" (keyup.enter)="saveObjective(obj)" />
                        <div class="obj-edit-actions">
                          <button type="button" class="hide-inline" (click)="saveObjective(obj)">Save</button>
                          <button type="button" class="hide-inline" (click)="cancelObjectiveEdit()">Cancel</button>
                        </div>
                      } @else {
                        <span>{{ obj.content }}</span>
                        <div class="obj-edit-actions">
                          <button type="button" class="hide-inline" (click)="startObjectiveEdit(obj)">Edit</button>
                          @if (obj.hidden) {
                            <button type="button" class="hide-inline" (click)="unhide(obj.id)">Unhide</button>
                          } @else {
                            <button type="button" class="hide-inline" (click)="hide(obj.id)">Hide</button>
                          }
                          <button type="button" class="hide-inline danger" (click)="remove(obj.id)">Delete</button>
                        </div>
                      }
                    </div>
                    @if (obj.krs.length) {
                      <button type="button" class="tree-toggle" (click)="toggle(obj.id)">
                        {{ isOpen(obj.id, obj.krs.length) ? '−' : '+' }}
                      </button>
                      @if (isOpen(obj.id, obj.krs.length)) {
                        <div class="tree-children" role="group">
                          @for (kr of obj.krs; track kr.id) {
                            <div class="tree-node" role="treeitem">
                              <div class="tree-pill tree-pill--kr" [class.is-hidden]="kr.hidden">
                                <span>{{ kr.content }}</span>
                                <span class="kr-vote" [attr.aria-label]="voteCount(kr.id) + ' votes'">
                                  <strong>{{ voteCount(kr.id) }}</strong>
                                  <em>{{ voteCount(kr.id) === 1 ? 'vote' : 'votes' }}</em>
                                </span>
                                @if (kr.hidden) {
                                  <button type="button" class="hide-inline" (click)="unhide(kr.id)">Unhide</button>
                                } @else {
                                  <button type="button" class="hide-inline" (click)="hide(kr.id)">Hide</button>
                                }
                                <button type="button" class="hide-inline danger" (click)="remove(kr.id)">Delete</button>
                              </div>
                              @if (kr.actions.length) {
                                <button type="button" class="tree-toggle" (click)="toggle('kr-' + kr.id)">
                                  {{ isOpen('kr-' + kr.id, kr.actions.length) ? '−' : '+' }}
                                </button>
                                @if (isOpen('kr-' + kr.id, kr.actions.length)) {
                                  <div class="tree-children" role="group">
                                    @for (a of kr.actions; track a.id) {
                                      <div class="tree-node tree-node--leaf" role="treeitem">
                                        <div class="tree-pill tree-pill--action">
                                          <span class="action-title">{{ a.action }}</span>
                                          <div class="action-meta">
                                            <div>
                                              <em>Owner</em>
                                              <strong>{{ actionOwner(a) }}</strong>
                                            </div>
                                            <div>
                                              <em>Due</em>
                                              <strong>{{ formatDue(a.dueDate) }}</strong>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    }
                                  </div>
                                }
                              }
                            </div>
                          }
                        </div>
                      }
                    }
                  </div>
                }
              </div>
            } @else {
              <p class="empty tree-hint">Add an Objective to grow the tree.</p>
            }
          </div>
          </div>
        </div>
      }

      @if (session?.currentStep?.type === 'input' && !isOkrSession()) {
        <h3>Live wall</h3>
        <div class="columns">
          @for (g of session?.currentStep?.groups || []; track g.id; let gi = $index) {
            <div class="col" [attr.data-tone]="gi % 3">
              <header>{{ g.title }}</header>
              <div class="col__body">
                @for (e of entriesFor(g.id); track e.id) {
                  <article class="note" [class.note--hidden]="e.hidden">
                    <div class="note__head">
                      @if (e.authorName) {
                        <app-bosch-avatar [name]="e.authorName" size="sm" />
                        <span>{{ e.authorName }}</span>
                      } @else {
                        <span class="muted">Anonymous</span>
                      }
                      @if (e.hidden) {
                        <span class="hidden-tag">Hidden</span>
                      }
                    </div>
                    <p>{{ e.content }}</p>
                    <div class="note__actions">
                      @if (e.hidden) {
                        <button type="button" class="hide" (click)="unhide(e.id)">Unhide</button>
                      } @else {
                        <button type="button" class="hide" (click)="hide(e.id)">Hide</button>
                      }
                      <button type="button" class="hide danger" (click)="remove(e.id)">Delete</button>
                    </div>
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
          <h3>{{ isOkrSession() ? (session?.currentStep?.title || 'Prioritize KRs') : 'Voting results' }}</h3>
          <span>{{ totalVotes() }} total votes · {{ session?.participantCount || 0 }} participants</span>
        </div>
        @if (isOkrSession()) {
          <div class="kr-vote-cards">
            @for (v of votes(); track v.entryId; let i = $index) {
              <article class="kr-vote-card">
                <span class="kr-vote-card__rank">{{ i + 1 }}</span>
                <div class="kr-vote-card__body">
                  <p class="kr-vote-card__content">{{ v.content }}</p>
                  <div class="kr-vote-card__author">
                    <app-bosch-avatar [name]="voteAuthor(v)" size="sm" />
                    <span>{{ voteAuthor(v) }}</span>
                  </div>
                </div>
                <div class="kr-vote-card__votes">
                  <strong>{{ v.votes }}</strong>
                  <em>{{ v.votes === 1 ? 'vote' : 'votes' }}</em>
                </div>
              </article>
            } @empty {
              <p class="empty">Waiting for Key Results…</p>
            }
          </div>
        } @else {
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
      }

      @if (session?.currentStep?.type === 'breakout') {
        <div class="breakout-head">
          <div>
            <h3>Divide into groups</h3>
            <p class="hint">{{ people().length }} joined · {{ assignedCount() }} assigned · {{ unassigned().length }} waiting</p>
          </div>
          <div class="breakout-actions">
            <app-bosch-button
              variant="secondary"
              [disabled]="busy() || people().length === 0 || breakoutGroups().length === 0"
              (click)="shuffleBreakout()"
            >
              Shuffle randomly
            </app-bosch-button>
            <app-bosch-button
              variant="secondary"
              [disabled]="busy() || assignedCount() === 0"
              (click)="clearBreakout()"
            >
              Clear
            </app-bosch-button>
          </div>
        </div>

        <div class="breakout-board">
          <div class="breakout-col breakout-col--wait">
            <header>Unassigned <span>{{ unassigned().length }}</span></header>
            <div class="breakout-col__body">
              @if (people().length === 0) {
                <p class="empty">Waiting for participants to join…</p>
              } @else {
                @for (p of unassigned(); track p.id) {
                  <button
                    type="button"
                    class="person"
                    [class.on]="pickingId() === p.id"
                    (click)="togglePick(p.id)"
                  >
                    <app-bosch-avatar [name]="p.displayName" size="sm" />
                    <span>{{ p.displayName }}</span>
                  </button>
                } @empty {
                  <p class="empty">Everyone is assigned</p>
                }
              }
            </div>
          </div>

          @for (g of breakoutGroups(); track g.id; let gi = $index) {
            <div class="breakout-col" [attr.data-tone]="gi % 3">
              <header>
                {{ g.title }}
                <span>{{ membersOf(g.id).length }}</span>
              </header>
              <div class="breakout-col__body">
                <label class="topic-field">
                  Topic
                  <input
                    [ngModel]="topicDraft(g.id)"
                    (ngModelChange)="setTopicDraft(g.id, $event)"
                    (blur)="saveTopics()"
                    (keyup.enter)="$any($event.target).blur()"
                    placeholder="Assign a topic…"
                  />
                </label>
                @if (pickingId()) {
                  <button type="button" class="drop-here" (click)="assignPicked(g.id)">
                    Move here
                  </button>
                }
                @for (p of membersOf(g.id); track p.id) {
                  <button
                    type="button"
                    class="person"
                    [class.on]="pickingId() === p.id"
                    (click)="togglePick(p.id)"
                  >
                    <app-bosch-avatar [name]="p.displayName" size="sm" />
                    <span>{{ p.displayName }}</span>
                  </button>
                } @empty {
                  @if (!pickingId() && people().length) {
                    <p class="empty">Empty — pick someone, then Move here</p>
                  }
                }
              </div>
            </div>
          }
        </div>
        <p class="hint">Assign a topic per group, then shuffle or tap a participant and <strong>Move here</strong>.</p>
      }

      @if (!isOkrSession() && (session?.currentStep?.type === 'form' || actions().length)) {
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
    .mod-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.45rem;
      justify-content: flex-end;
    }
    .mod-btn {
      background: #fff;
      border: 1px solid var(--wos-border-strong);
      border-radius: var(--wos-radius);
      color: var(--wos-text);
      cursor: pointer;
      font: inherit;
      font-size: 0.8rem;
      font-weight: 700;
      padding: 0.35rem 0.7rem;
    }
    .mod-btn:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }
    h3 { font-size: 0.95rem; margin: 0; }
    .bars, .vote-bars { display: grid; gap: 0.65rem; }
    .bar-row, .vote-row {
      align-items: center;
      display: grid;
      gap: 0.65rem;
      grid-template-columns: minmax(72px, 110px) minmax(0, 1fr) 40px;
    }
    .vote-row { grid-template-columns: 2rem minmax(0, 1fr) 2.5rem; }
    .track { background: #e8eef8; border-radius: 999px; height: 12px; overflow: hidden; }
    .fill { background: linear-gradient(90deg, var(--wos-primary), #3d7dff); height: 12px; }
    .fill--purple { background: linear-gradient(90deg, #7c4dff, #5b8def); }
    .columns {
      display: grid;
      gap: 0.75rem;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }
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
    .note--hidden { opacity: 0.55; }
    .note__head { align-items: center; display: flex; font-size: 0.78rem; font-weight: 600; gap: 0.35rem; flex-wrap: wrap; }
    .note__actions { display: flex; flex-wrap: wrap; gap: 0.65rem; }
    .hidden-tag {
      background: #e2e8f0;
      border-radius: 999px;
      color: var(--wos-text-secondary);
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      padding: 0.15rem 0.45rem;
      text-transform: uppercase;
    }
    .note p { margin: 0; }
    .hide, .link, .hide-inline { background: transparent; border: 0; cursor: pointer; font-size: 0.78rem; font-weight: 700; padding: 0; }
    .hide { color: var(--wos-text-secondary); text-align: left; }
    .hide.danger, .hide-inline.danger { color: var(--wos-danger); }
    .link { color: var(--wos-primary); }
    .tree-pill.is-hidden { opacity: 0.55; }
    .empty, .muted, .hint { color: var(--wos-text-muted); margin: 0; }
    .hint { font-size: 0.85rem; margin: 0.35rem 0 0.65rem; }
    .breakout-head {
      align-items: start;
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      justify-content: space-between;
    }
    .breakout-head .hint { margin: 0.25rem 0 0; }
    .breakout-actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .breakout-board {
      display: grid;
      gap: 0.75rem;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }
    .breakout-col {
      border-radius: var(--wos-radius-lg);
      min-height: 9rem;
      overflow: hidden;
    }
    .breakout-col header {
      align-items: center;
      display: flex;
      font-weight: 700;
      gap: 0.5rem;
      justify-content: space-between;
      padding: 0.65rem 0.8rem;
    }
    .breakout-col header span {
      background: rgba(255, 255, 255, 0.7);
      border-radius: var(--wos-radius-pill);
      font-size: 0.75rem;
      padding: 0.1rem 0.45rem;
    }
    .breakout-col__body { display: grid; gap: 0.4rem; padding: 0.55rem; }
    .breakout-col--wait { background: #f1f5f9; }
    .breakout-col--wait header { background: #e2e8f0; color: #334155; }
    .breakout-col[data-tone='0'] { background: var(--wos-success-soft); }
    .breakout-col[data-tone='0'] header { background: rgba(15, 157, 88, 0.12); color: var(--wos-success-ink); }
    .breakout-col[data-tone='1'] { background: var(--wos-danger-soft); }
    .breakout-col[data-tone='1'] header { background: rgba(217, 48, 37, 0.1); color: var(--wos-danger-ink); }
    .breakout-col[data-tone='2'] { background: var(--wos-info-soft); }
    .breakout-col[data-tone='2'] header { background: rgba(26, 115, 232, 0.1); color: var(--wos-info-ink); }
    .person {
      align-items: center;
      background: #fff;
      border: 1px solid var(--wos-border);
      border-radius: var(--wos-radius);
      cursor: pointer;
      display: flex;
      gap: 0.45rem;
      padding: 0.45rem 0.55rem;
      text-align: left;
      width: 100%;
    }
    .person.on {
      border-color: var(--wos-primary);
      box-shadow: 0 0 0 2px var(--wos-primary-ring);
    }
    .person span {
      font-size: 0.85rem;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .drop-here {
      background: rgba(255, 255, 255, 0.75);
      border: 1px dashed var(--wos-primary);
      border-radius: var(--wos-radius);
      color: var(--wos-primary);
      cursor: pointer;
      font-weight: 700;
      padding: 0.55rem;
    }
    .topic-field {
      display: grid;
      font-size: 0.75rem;
      font-weight: 700;
      gap: 0.25rem;
      color: var(--wos-text-secondary);
    }
    .topic-field input {
      border: 1px solid var(--wos-border-strong);
      border-radius: var(--wos-radius);
      font-size: 0.85rem;
      font-weight: 600;
      padding: 0.45rem 0.55rem;
      width: 100%;
    }
    .vote-head, .okr-head { align-items: baseline; display: flex; flex-wrap: wrap; gap: 0.65rem; justify-content: space-between; }
    .vote-head span, .okr-head span { color: var(--wos-text-muted); font-size: 0.85rem; }
    .rank { color: var(--wos-primary); font-weight: 800; }
    .vote-row__label { font-weight: 600; margin-bottom: 0.25rem; }

    .kr-vote-cards {
      display: grid;
      gap: 0.65rem;
    }
    .kr-vote-card {
      align-items: start;
      background: #fff;
      border: 1px solid var(--wos-border);
      border-radius: 12px;
      display: grid;
      gap: 0.75rem;
      grid-template-columns: auto 1fr auto;
      padding: 0.85rem 0.9rem;
    }
    .kr-vote-card__rank {
      align-items: center;
      background: var(--wos-primary-soft);
      border-radius: 999px;
      color: var(--wos-primary);
      display: inline-flex;
      font-size: 0.85rem;
      font-weight: 800;
      height: 1.85rem;
      justify-content: center;
      min-width: 1.85rem;
    }
    .kr-vote-card__body { display: grid; gap: 0.45rem; min-width: 0; }
    .kr-vote-card__content {
      font-size: 0.95rem;
      font-weight: 650;
      line-height: 1.4;
      margin: 0;
      word-break: break-word;
    }
    .kr-vote-card__author {
      align-items: center;
      color: var(--wos-text-muted);
      display: flex;
      font-size: 0.8rem;
      font-weight: 600;
      gap: 0.4rem;
    }
    .kr-vote-card__votes {
      align-items: center;
      background: var(--wos-purple-soft);
      border-radius: 10px;
      color: var(--wos-purple);
      display: grid;
      justify-items: center;
      min-width: 3rem;
      padding: 0.4rem 0.5rem;
    }
    .kr-vote-card__votes strong { font-size: 1.05rem; font-weight: 800; line-height: 1; }
    .kr-vote-card__votes em {
      font-size: 0.65rem;
      font-style: normal;
      font-weight: 700;
      text-transform: uppercase;
    }
    .actions { display: grid; gap: 0.55rem; }
    .action { background: #f8fafc; border: 1px solid var(--wos-border); border-radius: var(--wos-radius); padding: 0.75rem; }
    .action p { font-weight: 600; margin: 0 0 0.45rem; }
    .action__meta { align-items: center; color: var(--wos-text-secondary); display: flex; gap: 0.4rem; }
    .action__meta em { color: var(--wos-text-muted); font-style: normal; margin-left: auto; }
    .kr-tag { color: var(--wos-primary); display: block; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.35rem; }
    .add-obj { display: grid; gap: 0.5rem; grid-template-columns: minmax(0, 1fr) auto; }
    .add-obj input, .root-edit input {
      border: 1px solid var(--wos-border-strong);
      border-radius: var(--wos-radius);
      max-width: 100%;
      padding: 0.7rem 0.8rem;
    }
    .root-edit { display: grid; font-size: 0.85rem; font-weight: 700; gap: 0.4rem; }
    .root-edit__row { display: grid; gap: 0.5rem; grid-template-columns: minmax(0, 1fr) auto; }

    @media (max-width: 640px) {
      .bar-row, .vote-row { grid-template-columns: 1fr; }
      .add-obj, .root-edit__row { grid-template-columns: 1fr; }
    }

    .host-tree {
      -webkit-overflow-scrolling: touch;
      overflow-x: auto;
      overflow-y: visible;
      padding: 0.5rem 0.75rem 1rem;
      width: 100%;
    }
    /* max-content canvas: full tree is scrollable; centers when narrower than viewport */
    .host-tree__canvas {
      box-sizing: border-box;
      margin-inline: auto;
      min-width: 100%;
      padding-inline: 0.5rem;
      width: max-content;
    }
    .host-tree__canvas > .tree-node--root {
      min-width: 100%;
      width: max-content;
    }
    .tree-node { align-items: center; display: flex; flex-direction: column; position: relative; }
    .tree-pill {
      border-radius: 10px;
      color: #fff;
      font-size: 0.92rem;
      font-weight: 700;
      line-height: 1.3;
      max-width: 220px;
      min-width: 120px;
      padding: 0.65rem 0.85rem;
      text-align: center;
      word-break: break-word;
      z-index: 1;
    }
    .tree-pill--root { background: var(--wos-primary); box-shadow: 0 6px 16px rgba(0, 86, 210, 0.28); }
    .tree-pill--root.is-empty { background: #94a3b8; font-style: italic; font-weight: 600; }
    .tree-pill--objective { background: var(--wos-purple); position: relative; }
    .tree-pill--kr {
      background: var(--wos-success);
      display: grid;
      font-weight: 600;
      gap: 0.35rem;
      justify-items: center;
      position: relative;
    }
    .kr-vote {
      align-items: baseline;
      background: rgba(255, 255, 255, 0.95);
      border-radius: var(--wos-radius-pill);
      color: var(--wos-success-ink, #0a7a3e);
      display: inline-flex;
      gap: 0.22rem;
      padding: 0.2rem 0.55rem;
    }
    .kr-vote strong { font-size: 0.95rem; font-weight: 800; line-height: 1; }
    .kr-vote em {
      font-size: 0.65rem;
      font-style: normal;
      font-weight: 700;
      text-transform: uppercase;
    }
    .tree-pill--action {
      background: var(--wos-info);
      display: grid;
      font-size: 0.85rem;
      font-weight: 600;
      gap: 0.4rem;
      max-width: 240px;
      min-width: 170px;
      text-align: left;
    }
    .tree-pill--action .action-title { display: block; text-align: center; }
    .tree-pill--action .action-meta {
      border-top: 1px solid rgba(255,255,255,0.25);
      display: grid;
      gap: 0.25rem;
      padding-top: 0.35rem;
    }
    .tree-pill--action .action-meta > div {
      align-items: baseline;
      display: flex;
      gap: 0.35rem;
      justify-content: space-between;
    }
    .tree-pill--action .action-meta em {
      color: rgba(255,255,255,0.8);
      font-size: 0.68rem;
      font-style: normal;
      font-weight: 700;
      text-transform: uppercase;
    }
    .tree-pill--action .action-meta strong { font-size: 0.78rem; font-weight: 700; text-align: right; }
    .hide-inline {
      background: rgba(0,0,0,0.18);
      border: 0;
      border-radius: 999px;
      color: #fff;
      cursor: pointer;
      display: block;
      font-size: 0.68rem;
      font-weight: 700;
      margin: 0.35rem auto 0;
      padding: 0.15rem 0.45rem;
    }
    .hide-inline.danger {
      background: rgba(217, 48, 37, 0.92);
      color: #fff;
    }
    .tree-toggle {
      align-items: center;
      background: #fff;
      border: 2px solid #94a3b8;
      border-radius: 50%;
      color: #334155;
      cursor: pointer;
      display: inline-flex;
      font-size: 1rem;
      font-weight: 700;
      height: 1.5rem;
      justify-content: center;
      margin-top: 0.55rem;
      padding: 0;
      position: relative;
      width: 1.5rem;
      z-index: 2;
    }
    .tree-toggle::before {
      background: #94a3b8;
      bottom: 100%;
      content: '';
      height: 0.55rem;
      left: 50%;
      position: absolute;
      transform: translateX(-50%);
      width: 2px;
    }
    .tree-children {
      --tree-gap: 1rem;
      display: flex;
      gap: var(--tree-gap);
      justify-content: center;
      padding-top: 1.1rem;
      position: relative;
    }
    .tree-children::before {
      background: #94a3b8;
      content: '';
      height: 1.1rem;
      left: 50%;
      position: absolute;
      top: 0;
      transform: translateX(-50%);
      width: 2px;
    }
    .tree-children > .tree-node { padding-top: 0.9rem; }
    .tree-children > .tree-node::before {
      background: #94a3b8;
      content: '';
      height: 0.9rem;
      left: 50%;
      position: absolute;
      top: 0;
      transform: translateX(-50%);
      width: 2px;
    }
    .tree-children > .tree-node:not(:only-child)::after {
      background: #94a3b8;
      content: '';
      height: 2px;
      position: absolute;
      top: 0;
    }
    .tree-children > .tree-node:first-child:not(:only-child)::after {
      left: 50%;
      width: calc(50% + var(--tree-gap) / 2);
    }
    .tree-children > .tree-node:last-child:not(:only-child)::after {
      left: auto;
      right: 50%;
      width: calc(50% + var(--tree-gap) / 2);
    }
    .tree-children > .tree-node:not(:first-child):not(:last-child)::after {
      left: calc(var(--tree-gap) / -2);
      width: calc(100% + var(--tree-gap));
    }
    .tree-hint { margin-top: 0.75rem; text-align: center; }
    .obj-edit {
      border: 0;
      border-radius: 6px;
      font: inherit;
      font-weight: 700;
      padding: 0.35rem 0.45rem;
      width: 100%;
    }
    .obj-edit-actions { display: flex; gap: 0.35rem; justify-content: center; margin-top: 0.35rem; }
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
  people = signal<{ id: string; displayName: string }[]>([]);
  pickingId = signal('');
  topicDrafts = signal<Record<string, string>>({});
  private topicDirty = false;
  expanded = signal<Record<string, boolean>>({});
  newObjective = '';
  treeRootDraft = '';
  editingObjectiveId = '';
  editObjectiveText = '';
  busy = signal(false);
  private modUndo: Array<{ action: 'hide' | 'unhide' | 'delete'; entryId: string; snapshot: any }> = [];
  private modRedo: Array<{ action: 'hide' | 'unhide' | 'delete'; entryId: string; snapshot: any }> = [];
  private applyingModHistory = false;

  ngOnChanges() {
    if (!this.session?.id) return;
    const stepId = this.session.currentStepId;
    const okrStep = okrInputStep(this.session);
    const entryStepId = this.isOkrSession() && okrStep ? okrStep.id : stepId;
    this.treeRootDraft = String(this.session.treeRootLabel || '');
    this.api.listEntries(this.session.id, entryStepId, { includeHidden: true }).subscribe((e) => this.entries.set(e));
    this.api.pollTally(this.session.id, stepId).subscribe((p) => this.poll.set(p));
    const votingStep = okrVotingStep(this.session);
    const voteStepId = this.isOkrSession() && votingStep ? votingStep.id : stepId;
    this.api.tallyVotes(this.session.id, voteStepId).subscribe((v) => this.votes.set(v));
    this.api.listActions(this.session.id).subscribe((a) => this.actions.set(a));
    if (this.session.currentStep?.type === 'breakout') {
      this.syncTopicDrafts();
      this.api.listParticipants(this.session.id).subscribe({
        next: (list) =>
          this.people.set(
            list.filter((p) => p.id && !String(p.id).startsWith('host-'))
          ),
        error: () => this.people.set([])
      });
    }
  }

  private syncTopicDrafts() {
    if (this.topicDirty) return;
    const next: Record<string, string> = {};
    for (const g of this.breakoutGroups()) {
      next[g.id] = String(g.topic || '');
    }
    this.topicDrafts.set(next);
  }

  topicDraft(groupId: string) {
    return this.topicDrafts()[groupId] ?? '';
  }

  setTopicDraft(groupId: string, value: string) {
    this.topicDirty = true;
    this.topicDrafts.update((m) => ({ ...m, [groupId]: value }));
  }

  saveTopics() {
    const stepId = this.session?.currentStep?.id || this.session?.currentStepId;
    if (!this.session?.id || !stepId || !this.topicDirty) return;
    const drafts = this.topicDrafts();
    const groups = this.breakoutGroups().map((g: any) => ({
      id: g.id,
      title: g.title,
      groupOrder: g.groupOrder,
      topic: drafts[g.id] ?? g.topic ?? ''
    }));
    this.busy.set(true);
    this.api.updateStep(this.session.id, stepId, { groups }).subscribe({
      next: (s) => {
        this.session = s;
        this.topicDirty = false;
        this.busy.set(false);
        this.syncTopicDrafts();
      },
      error: () => this.busy.set(false)
    });
  }

  breakoutGroups() {
    return [...(this.session?.currentStep?.groups || [])].sort(
      (a: any, b: any) => (a.groupOrder || 0) - (b.groupOrder || 0)
    );
  }

  assignments(): Record<string, string> {
    const cfg = this.session?.currentStep?.config || {};
    const map = cfg.assignments;
    return map && typeof map === 'object' ? { ...map } : {};
  }

  assignedCount() {
    const ids = new Set(this.people().map((p) => p.id));
    return Object.entries(this.assignments()).filter(([pid, gid]) => ids.has(pid) && !!gid).length;
  }

  unassigned() {
    const map = this.assignments();
    const groupIds = new Set(this.breakoutGroups().map((g: any) => g.id));
    return this.people().filter((p) => !map[p.id] || !groupIds.has(map[p.id]));
  }

  membersOf(groupId: string) {
    const map = this.assignments();
    return this.people().filter((p) => map[p.id] === groupId);
  }

  togglePick(participantId: string) {
    this.pickingId.set(this.pickingId() === participantId ? '' : participantId);
  }

  assignPicked(groupId: string) {
    const pid = this.pickingId();
    if (!pid || !groupId) return;
    const next = { ...this.assignments(), [pid]: groupId };
    this.persistAssignments(next);
    this.pickingId.set('');
  }

  shuffleBreakout() {
    const groups = this.breakoutGroups();
    const roster = [...this.people()];
    if (!groups.length || !roster.length) return;
    for (let i = roster.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [roster[i], roster[j]] = [roster[j], roster[i]];
    }
    const next: Record<string, string> = {};
    roster.forEach((p, i) => {
      next[p.id] = groups[i % groups.length].id;
    });
    this.persistAssignments(next);
    this.pickingId.set('');
  }

  clearBreakout() {
    this.persistAssignments({});
    this.pickingId.set('');
  }

  private persistAssignments(assignments: Record<string, string>) {
    const stepId = this.session?.currentStep?.id || this.session?.currentStepId;
    if (!this.session?.id || !stepId) return;
    this.busy.set(true);
    this.api.setBreakoutAssignments(this.session.id, stepId, assignments).subscribe({
      next: (s) => {
        this.session = s;
        this.busy.set(false);
      },
      error: () => this.busy.set(false)
    });
  }

  voteCount(entryId: string) {
    return this.votes().find((v) => v.entryId === entryId)?.votes || 0;
  }

  isOkr() {
    return isOkrBoard(this.session?.currentStep);
  }

  isOkrSession() {
    return sessionHasOkr(this.session);
  }

  /** Allow seeding Objectives before Start (LOBBY) on OKR workshops. */
  canPrepObjectives() {
    return this.isOkrSession() && this.session?.status === 'LOBBY';
  }

  voteAuthor(v: { authorName?: string | null }) {
    return displayAuthorName(v, boardIsAnonymous(this.session));
  }

  rootLabel() {
    return String(this.session?.treeRootLabel || '').trim();
  }

  actionOwner(a: any) {
    return String(a?.owner || '').trim() || 'Unassigned';
  }

  formatDue(dueDate: string | null | undefined) {
    const raw = String(dueDate || '').trim();
    if (!raw) return 'No due date';
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return raw;
  }

  objectives() {
    return buildOkrTree(this.entries(), this.actions());
  }

  isOpen(id: string, childCount: number) {
    const map = this.expanded();
    if (id in map) return map[id];
    if (id === '__root__') return true;
    return childCount < 6;
  }

  toggle(id: string) {
    let childCount = 0;
    if (id === '__root__') {
      childCount = this.objectives().length;
    } else if (id.startsWith('kr-')) {
      const krId = id.slice(3);
      for (const obj of this.objectives()) {
        const kr = obj.krs.find((k: any) => k.id === krId);
        if (kr) {
          childCount = kr.actions.length;
          break;
        }
      }
    } else {
      childCount = this.objectives().find((o) => o.id === id)?.krs.length || 0;
    }
    const open = this.isOpen(id, childCount);
    this.expanded.update((m) => ({ ...m, [id]: !open }));
  }

  saveTreeRoot() {
    if (!this.session?.id) return;
    this.busy.set(true);
    this.api.updateTreeRootLabel(this.session.id, this.treeRootDraft).subscribe({
      next: (s) => {
        this.session = { ...this.session, ...s };
        this.treeRootDraft = String(s.treeRootLabel || '');
        this.busy.set(false);
      },
      error: () => this.busy.set(false)
    });
  }

  addObjective() {
    const content = this.newObjective.trim();
    if (!content || !this.session?.id) return;
    this.busy.set(true);
    const okrStep = okrInputStep(this.session);
    this.api
      .createHostObjective(this.session.id, {
        content,
        stepId: okrStep?.id
      })
      .subscribe({
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

  startObjectiveEdit(obj: any) {
    this.editingObjectiveId = obj.id;
    this.editObjectiveText = obj.content || '';
  }

  cancelObjectiveEdit() {
    this.editingObjectiveId = '';
    this.editObjectiveText = '';
  }

  saveObjective(obj: any) {
    const content = this.editObjectiveText.trim();
    if (!content || !this.session?.id) return;
    this.busy.set(true);
    this.api.updateEntry(this.session.id, obj.id, { content }, { role: 'host' }).subscribe({
      next: () => {
        this.busy.set(false);
        this.cancelObjectiveEdit();
        this.ngOnChanges();
      },
      error: () => this.busy.set(false)
    });
  }

  hide(entryId: string) {
    const snap = this.entries().find((e) => e.id === entryId);
    this.api.hideEntry(this.session.id, entryId).subscribe({
      next: (r) => {
        this.pushMod({ action: 'hide', entryId, snapshot: r.snapshot || snap });
        this.ngOnChanges();
      }
    });
  }

  unhide(entryId: string) {
    const snap = this.entries().find((e) => e.id === entryId);
    this.api.unhideEntry(this.session.id, entryId).subscribe({
      next: (r) => {
        this.pushMod({ action: 'unhide', entryId, snapshot: r.snapshot || snap });
        this.ngOnChanges();
      }
    });
  }

  remove(entryId: string) {
    if (!confirm('Permanently delete this item?')) return;
    const snap = this.entries().find((e) => e.id === entryId);
    this.api.deleteEntry(this.session.id, entryId).subscribe({
      next: (r) => {
        this.pushMod({ action: 'delete', entryId, snapshot: r.snapshot || snap });
        this.ngOnChanges();
      }
    });
  }

  canUndoMod() {
    return this.modUndo.length > 0 && !this.busy();
  }

  canRedoMod() {
    return this.modRedo.length > 0 && !this.busy();
  }

  undoModeration() {
    const op = this.modUndo.pop();
    if (!op || this.applyingModHistory) return;
    this.modRedo.push(op);
    this.applyInverse(op);
  }

  redoModeration() {
    const op = this.modRedo.pop();
    if (!op || this.applyingModHistory) return;
    this.modUndo.push(op);
    this.applyForward(op);
  }

  private pushMod(op: { action: 'hide' | 'unhide' | 'delete'; entryId: string; snapshot: any }) {
    if (this.applyingModHistory) return;
    this.modUndo.push(op);
    if (this.modUndo.length > 40) this.modUndo.shift();
    this.modRedo = [];
  }

  private applyInverse(op: { action: 'hide' | 'unhide' | 'delete'; entryId: string; snapshot: any }) {
    this.applyingModHistory = true;
    this.busy.set(true);
    const done = () => {
      this.busy.set(false);
      this.applyingModHistory = false;
      this.ngOnChanges();
    };
    if (op.action === 'hide') {
      this.api.unhideEntry(this.session.id, op.entryId).subscribe({ next: done, error: done });
    } else if (op.action === 'unhide') {
      this.api.hideEntry(this.session.id, op.entryId).subscribe({ next: done, error: done });
    } else {
      this.api.restoreEntry(this.session.id, op.snapshot || { id: op.entryId }).subscribe({
        next: done,
        error: done
      });
    }
  }

  private applyForward(op: { action: 'hide' | 'unhide' | 'delete'; entryId: string; snapshot: any }) {
    this.applyingModHistory = true;
    this.busy.set(true);
    const done = () => {
      this.busy.set(false);
      this.applyingModHistory = false;
      this.ngOnChanges();
    };
    if (op.action === 'hide') {
      this.api.hideEntry(this.session.id, op.entryId).subscribe({ next: done, error: done });
    } else if (op.action === 'unhide') {
      this.api.unhideEntry(this.session.id, op.entryId).subscribe({ next: done, error: done });
    } else {
      this.api.deleteEntry(this.session.id, op.entryId).subscribe({ next: done, error: done });
    }
  }
}
