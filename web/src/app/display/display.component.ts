import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import QRCode from 'qrcode';
import { BoschAvatarComponent } from '../bosch-ui/bosch-avatar/bosch-avatar.component';
import { BoschAvatarStackComponent } from '../bosch-ui/bosch-avatar/bosch-avatar-stack.component';
import { ApiService } from '../core/api.service';
import { RealtimeService } from '../core/realtime.service';
import { buildJoinUrl } from '../core/join-url';
import { buildOkrTree, isOkrBoard, okrInputStep, okrVotingStep, sessionHasOkr } from '../core/okr.util';

@Component({
  selector: 'app-display',
  standalone: true,
  imports: [BoschAvatarComponent, BoschAvatarStackComponent],
  template: `
    <div class="screen">
      <header>
        <div>
          <p class="brand">Workshop OS</p>
          <h1>{{ session()?.title }}</h1>
          <p class="meta">
            Code <span class="code">{{ session()?.code }}</span>
            · {{ session()?.participantCount || 0 }} online
          </p>
        </div>
        <app-bosch-avatar-stack [people]="participants()" [max]="8" size="lg" />
      </header>

      @if (showJoinScreen()) {
        <section class="hero">
          <h2>{{ joinHeadline() }}</h2>
          @if (qrDataUrl()) {
            <img class="qr" [src]="qrDataUrl()" alt="Scan to join" width="320" height="320" />
          }
          <p class="code-lg">{{ session()?.code }}</p>
          <p class="sub">{{ joinSubline() }}</p>
          <div class="hero__people">
            <app-bosch-avatar-stack [people]="participants()" [max]="12" size="lg" />
          </div>
        </section>
      }

      @if (!showJoinScreen() && session()?.currentStep?.type === 'poll') {
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

      @if (!showJoinScreen() && isOkrSession()) {
        <section class="tree-section">
          <h2>OKR workflow</h2>
          <div class="okr-tree" role="tree">
            <div class="tree-node tree-node--root" role="treeitem">
              <div class="tree-pill tree-pill--root" [class.is-empty]="!rootLabel()">
                {{ rootLabel() || 'Theme (set by host)' }}
              </div>
              @if (objectives().length) {
                <button
                  type="button"
                  class="tree-toggle"
                  [attr.aria-expanded]="isOpen('__root__', objectives().length)"
                  (click)="toggle('__root__')"
                  [attr.aria-label]="isOpen('__root__', objectives().length) ? 'Collapse objectives' : 'Expand objectives'"
                >
                  {{ isOpen('__root__', objectives().length) ? '−' : '+' }}
                </button>
              }
              @if (objectives().length && isOpen('__root__', objectives().length)) {
                <div class="tree-children" role="group">
                  @for (obj of objectives(); track obj.id) {
                    <div class="tree-node" role="treeitem">
                      <div class="tree-pill tree-pill--objective">{{ obj.content }}</div>
                      @if (obj.krs.length) {
                        <button
                          type="button"
                          class="tree-toggle"
                          [attr.aria-expanded]="isOpen(obj.id, obj.krs.length)"
                          (click)="toggle(obj.id)"
                          [attr.aria-label]="isOpen(obj.id, obj.krs.length) ? 'Collapse key results' : 'Expand key results'"
                        >
                          {{ isOpen(obj.id, obj.krs.length) ? '−' : '+' }}
                        </button>
                        @if (isOpen(obj.id, obj.krs.length)) {
                          <div class="tree-children" role="group">
                            @for (kr of obj.krs; track kr.id) {
                              <div class="tree-node" role="treeitem">
                                <div class="tree-pill tree-pill--kr">
                                  <span>{{ kr.content }}</span>
                                  <span class="kr-vote" [attr.aria-label]="voteCount(kr.id) + ' votes'">
                                    <strong>{{ voteCount(kr.id) }}</strong>
                                    <em>{{ voteCount(kr.id) === 1 ? 'vote' : 'votes' }}</em>
                                  </span>
                                </div>
                                @if (kr.actions.length) {
                                  <button
                                    type="button"
                                    class="tree-toggle"
                                    [attr.aria-expanded]="isOpen('kr-' + kr.id, kr.actions.length)"
                                    (click)="toggle('kr-' + kr.id)"
                                    [attr.aria-label]="isOpen('kr-' + kr.id, kr.actions.length) ? 'Collapse actions' : 'Expand actions'"
                                  >
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
              } @else if (!objectives().length) {
                <p class="muted tree-hint">Waiting for Objectives…</p>
              }
            </div>
          </div>
        </section>
      }

      @if (!showJoinScreen() && session()?.currentStep?.type === 'input' && !isOkrSession()) {
        <section>
          <h2>{{ session()?.currentStep?.title }}</h2>
          <div class="columns">
            @for (g of session()?.currentStep?.groups || []; track g.id; let gi = $index) {
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
                    </article>
                  }
                </div>
              </div>
            }
          </div>
        </section>
      }

      @if (!showJoinScreen() && session()?.currentStep?.type === 'voting' && !isOkrSession()) {
        <section>
          <h2>Top issues</h2>
          <div class="vote-bars">
            @for (v of votes(); track v.entryId; let i = $index) {
              <div class="vote-row">
                <span class="rank">{{ i + 1 }}</span>
                <div class="vote-row__body">
                  <div class="vote-row__label">
                    {{ v.content }}
                    @if (i < 3) {
                      <span class="hot">🔥</span>
                    }
                  </div>
                  <div class="track"><div class="fill" [style.width.%]="votePct(v.votes)"></div></div>
                </div>
                <strong>{{ v.votes }}</strong>
              </div>
            }
          </div>
        </section>
      }

      @if (!showJoinScreen() && session()?.currentStep?.type === 'voting' && isOkrSession()) {
        <section class="vote-compact">
          <h2>Prioritize KRs</h2>
          <div class="vote-bars">
            @for (v of votes(); track v.entryId; let i = $index) {
              <div class="vote-row">
                <span class="rank">{{ i + 1 }}</span>
                <div class="vote-row__body">
                  <div class="vote-row__label">{{ v.content }}</div>
                  <div class="track"><div class="fill" [style.width.%]="votePct(v.votes)"></div></div>
                </div>
                <strong>{{ v.votes }}</strong>
              </div>
            }
          </div>
        </section>
      }

      @if (!showJoinScreen() && !isOkrSession() && (session()?.currentStep?.type === 'form' || summary())) {
        <section class="split">
          <div>
            <h2>Action plan</h2>
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
              }
            </div>
          </div>
          @if (summary()?.insights) {
            <div>
              <h2>AI summary</h2>
              <ul class="insights">
                @for (i of summary()?.insights || []; track i) {
                  <li><span class="check">✓</span> {{ i }}</li>
                }
              </ul>
            </div>
          }
        </section>
      }

      @if (!showJoinScreen() && isOkrSession() && summary()?.insights) {
        <section>
          <h2>AI summary</h2>
          <ul class="insights">
            @for (i of summary()?.insights || []; track i) {
              <li><span class="check">✓</span> {{ i }}</li>
            }
          </ul>
        </section>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .screen {
      background: radial-gradient(1200px 600px at 20% -10%, #1a2b4d 0%, transparent 55%), var(--wos-screen-bg);
      color: var(--wos-screen-text);
      min-height: 100vh;
      padding: 2rem 2.5rem 3rem;
    }

    header {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 1.25rem;
      justify-content: space-between;
      margin-bottom: 2rem;
    }

    .brand {
      color: #93c5fd;
      font-size: 0.8rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      margin: 0 0 0.35rem;
      text-transform: uppercase;
    }

    h1 { font-size: 2rem; margin: 0; }
    h2 { font-size: 2rem; margin: 0 0 1rem; }
    .meta { color: var(--wos-screen-muted); margin: 0.35rem 0 0; }
    .code, .code-lg { color: #60a5fa; font-weight: 800; letter-spacing: 0.12em; }
    .code-lg { display: block; font-size: 4rem; margin: 0.5rem 0; }

    .hero {
      display: grid;
      gap: 0.75rem;
      justify-items: center;
      padding: 2rem 1rem 3rem;
      text-align: center;
    }

    .qr {
      background: #fff;
      border-radius: 16px;
      padding: 1rem;
      width: min(320px, 70vw);
    }

    .sub { color: var(--wos-screen-muted); margin: 0; }
    .hero__people { margin-top: 1rem; }

    .bars, .vote-bars { display: grid; gap: 1rem; max-width: 960px; }
    .row, .vote-row {
      align-items: center;
      display: grid;
      font-size: 1.35rem;
      gap: 1rem;
      grid-template-columns: 160px 1fr 60px;
    }
    .vote-row { grid-template-columns: 2.5rem 1fr 3rem; }
    .track { background: #1e293b; border-radius: 999px; height: 28px; overflow: hidden; }
    .fill { background: linear-gradient(90deg, #0056d2, #60a5fa); height: 28px; }
    .rank { color: #60a5fa; font-weight: 800; }
    .vote-row__label { align-items: center; display: flex; font-weight: 600; gap: 0.4rem; margin-bottom: 0.3rem; }
    .hot { font-size: 1rem; }

    .columns { display: grid; gap: 1rem; grid-template-columns: repeat(3, 1fr); }
    .col {
      background: var(--wos-screen-surface);
      border: 1px solid var(--wos-screen-border);
      border-radius: 16px;
      min-height: 14rem;
      overflow: hidden;
    }
    .col header { font-weight: 800; padding: 0.9rem 1rem; }
    .col__body { display: grid; gap: 0.65rem; padding: 0.85rem; }
    .col[data-tone='0'] header { background: rgba(15, 157, 88, 0.18); color: #86efac; }
    .col[data-tone='1'] header { background: rgba(217, 48, 37, 0.18); color: #fca5a5; }
    .col[data-tone='2'] header { background: rgba(26, 115, 232, 0.18); color: #93c5fd; }

    .note {
      background: #182338;
      border: 1px solid var(--wos-screen-border);
      border-radius: 12px;
      padding: 0.85rem;
    }
    .note__head {
      align-items: center;
      color: #cbd5e1;
      display: flex;
      font-size: 0.9rem;
      font-weight: 600;
      gap: 0.45rem;
      margin-bottom: 0.4rem;
    }
    .note p { font-size: 1.15rem; margin: 0; }

    .split { display: grid; gap: 2rem; grid-template-columns: 1.2fr 1fr; }
    .actions { display: grid; gap: 0.85rem; }
    .action {
      background: var(--wos-screen-surface);
      border: 1px solid var(--wos-screen-border);
      border-radius: 12px;
      padding: 1rem;
    }
    .action p { font-size: 1.2rem; font-weight: 600; margin: 0 0 0.55rem; }
    .action__meta {
      align-items: center;
      color: #cbd5e1;
      display: flex;
      gap: 0.5rem;
    }
    .action__meta em { color: var(--wos-screen-muted); font-style: normal; margin-left: auto; }
    .kr-tag { color: #93c5fd; display: block; font-size: 0.85rem; font-weight: 700; margin-bottom: 0.4rem; }

    .okr-tree {
      display: flex;
      justify-content: center;
      overflow-x: auto;
      padding: 1rem 0.5rem 2.5rem;
      width: 100%;
    }

    .tree-node {
      align-items: center;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .tree-pill {
      border-radius: 12px;
      color: #fff;
      font-size: 1.05rem;
      font-weight: 700;
      line-height: 1.35;
      max-width: 280px;
      min-width: 140px;
      padding: 0.85rem 1.15rem;
      text-align: center;
      word-break: break-word;
      z-index: 1;
    }

    /* Session / workshop root */
    .tree-pill--root {
      background: var(--wos-primary);
      box-shadow: 0 8px 24px rgba(0, 86, 210, 0.4);
      font-size: 1.2rem;
      max-width: 360px;
      min-width: 180px;
      padding: 1rem 1.4rem;
    }

    /* Objectives */
    .tree-pill--objective {
      background: var(--wos-purple);
      box-shadow: 0 8px 24px rgba(124, 77, 255, 0.4);
    }

    /* Key Results */
    .tree-pill--kr {
      background: var(--wos-success);
      box-shadow: 0 6px 18px rgba(15, 157, 88, 0.35);
      display: grid;
      font-size: 0.98rem;
      font-weight: 600;
      gap: 0.4rem;
      justify-items: center;
      max-width: 240px;
    }
    .kr-vote {
      align-items: baseline;
      background: rgba(255, 255, 255, 0.95);
      border-radius: var(--wos-radius-pill);
      color: var(--wos-success-ink, #0a7a3e);
      display: inline-flex;
      gap: 0.25rem;
      padding: 0.25rem 0.65rem;
    }
    .kr-vote strong { font-size: 1.1rem; font-weight: 800; line-height: 1; }
    .kr-vote em {
      font-size: 0.72rem;
      font-style: normal;
      font-weight: 700;
      text-transform: uppercase;
    }

    /* Action plan leaves */
    .tree-pill--action {
      background: var(--wos-info);
      box-shadow: 0 6px 18px rgba(26, 115, 232, 0.35);
      display: grid;
      gap: 0.45rem;
      font-size: 0.92rem;
      font-weight: 600;
      max-width: 260px;
      min-width: 180px;
      text-align: left;
    }
    .tree-pill--action .action-title {
      display: block;
      line-height: 1.3;
      text-align: center;
    }
    .tree-pill--action .action-meta {
      border-top: 1px solid rgba(255, 255, 255, 0.25);
      display: grid;
      gap: 0.3rem;
      padding-top: 0.4rem;
    }
    .tree-pill--action .action-meta > div {
      align-items: baseline;
      display: flex;
      gap: 0.4rem;
      justify-content: space-between;
    }
    .tree-pill--action .action-meta em {
      color: rgba(255, 255, 255, 0.75);
      font-size: 0.72rem;
      font-style: normal;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }
    .tree-pill--action .action-meta strong {
      font-size: 0.82rem;
      font-weight: 700;
      text-align: right;
    }

    .tree-pill--root.is-empty {
      background: #334155;
      box-shadow: none;
      color: #cbd5e1;
      font-style: italic;
      font-weight: 600;
    }

    .tree-hint { margin-top: 0.75rem; text-align: center; }

    .vote-compact { margin-top: 1.5rem; }

    .tree-toggle {
      align-items: center;
      background: #0b1220;
      border: 2px solid #94a3b8;
      border-radius: 50%;
      color: #e2e8f0;
      cursor: pointer;
      display: inline-flex;
      font-size: 1.2rem;
      font-weight: 700;
      height: 1.75rem;
      justify-content: center;
      line-height: 1;
      margin-top: 0.75rem;
      padding: 0;
      position: relative;
      width: 1.75rem;
      z-index: 2;
    }
    .tree-toggle::before {
      background: #94a3b8;
      bottom: 100%;
      content: '';
      height: 0.75rem;
      left: 50%;
      position: absolute;
      transform: translateX(-50%);
      width: 2px;
    }
    .tree-toggle:hover {
      border-color: #fff;
      color: #fff;
    }

    .tree-children {
      --tree-gap: 1.75rem;
      display: flex;
      gap: var(--tree-gap);
      justify-content: center;
      margin-top: 0;
      padding-top: 1.35rem;
      position: relative;
    }

    /* Stem from toggle down to the sibling bar */
    .tree-children::before {
      background: #94a3b8;
      content: '';
      height: 1.35rem;
      left: 50%;
      position: absolute;
      top: 0;
      transform: translateX(-50%);
      width: 2px;
    }

    .tree-children > .tree-node {
      padding-top: 1.1rem;
    }

    /* Drop from bar into each child */
    .tree-children > .tree-node::before {
      background: #94a3b8;
      content: '';
      height: 1.1rem;
      left: 50%;
      position: absolute;
      top: 0;
      transform: translateX(-50%);
      width: 2px;
    }

    /* Sibling horizontal connectors */
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

    .tree-section {
      overflow-x: auto;
    }

    .insights { display: grid; gap: 0.75rem; list-style: none; margin: 0; padding: 0; }
    .insights li { align-items: start; display: flex; font-size: 1.25rem; gap: 0.65rem; }
    .check {
      align-items: center;
      background: rgba(15, 157, 88, 0.2);
      border-radius: 50%;
      color: #86efac;
      display: inline-flex;
      flex: 0 0 1.6rem;
      font-weight: 800;
      height: 1.6rem;
      justify-content: center;
      width: 1.6rem;
    }

    .muted { color: var(--wos-screen-muted); }

    @media (max-width: 900px) {
      .columns, .split { grid-template-columns: 1fr; }
      .tree-children { --tree-gap: 1rem; flex-wrap: wrap; }
      .tree-pill { max-width: 220px; }
    }
  `
})
export class DisplayComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private api = inject(ApiService);
  private realtime = inject(RealtimeService);
  private sub?: Subscription;

  id = '';
  joinUrl = '';
  session = signal<any>(null);
  participants = signal<{ id: string; displayName: string }[]>([]);
  qrDataUrl = signal('');
  entries = signal<any[]>([]);
  poll = signal<any[]>([]);
  votes = signal<any[]>([]);
  actions = signal<any[]>([]);
  summary = signal<any>(null);
  expanded = signal<Record<string, boolean>>({});

  isOkr() {
    const step = this.session()?.currentStep;
    if (step?.type === 'input') return isOkrBoard(step);
    return sessionHasOkr(this.session());
  }

  isOkrSession() {
    return sessionHasOkr(this.session());
  }

  rootLabel() {
    return String(this.session()?.treeRootLabel || '').trim();
  }

  actionOwner(a: any) {
    return String(a?.owner || '').trim() || 'Unassigned';
  }

  formatDue(dueDate: string | null | undefined) {
    const raw = String(dueDate || '').trim();
    if (!raw) return 'No due date';
    // HTML date input stores YYYY-MM-DD — show a clearer label.
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
    // Keep workflow visible by default; collapse only very crowded branches.
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

  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('sessionId') || '';
    this.refresh();
    this.realtime.connect(this.id);
    this.sub = this.realtime.events$.subscribe((e) => {
      if (e.type === 'step.changed' || e.type === 'session.ended') {
        this.session.set(e.data);
        this.ensureQr(e.data);
        this.loadExtras();
      }
      if (e.type === 'entry.created' || e.type === 'entry.hidden' || e.type === 'vote.updated' || e.type === 'action.created') {
        this.loadExtras();
      }
      if (e.type === 'summary.ready') this.summary.set(e.data);
      if (e.type === 'participant.joined') {
        this.refreshParticipants();
        this.refresh();
      }
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
    this.realtime.disconnect();
  }

  showJoinScreen() {
    const s = this.session();
    if (!s) return false;
    return s.status === 'LOBBY' || !s.currentStep || s.currentStep?.type === 'welcome';
  }

  joinHeadline() {
    const s = this.session();
    if (s?.currentStep?.type === 'welcome' && s.status !== 'LOBBY') {
      return s.currentStep.title || 'Welcome';
    }
    return 'Scan to join';
  }

  joinSubline() {
    const s = this.session();
    if (s?.currentStep?.type === 'welcome' && s.status !== 'LOBBY') {
      return s.currentStep.instructions || 'Follow along on your phone.';
    }
    return 'Waiting for the host to start…';
  }

  refresh() {
    this.api.getDisplay(this.id).subscribe((s) => {
      this.session.set(s);
      this.ensureQr(s);
      this.loadExtras();
    });
    this.refreshParticipants();
    this.api.getSummary(this.id).subscribe((s) => {
      if (s?.insights) this.summary.set(s);
    });
  }

  refreshParticipants() {
    this.api.listParticipants(this.id).subscribe({
      next: (list) => this.participants.set(list || []),
      error: () => this.participants.set([])
    });
  }

  private ensureQr(session: any) {
    if (!session?.code) return;
    const url = buildJoinUrl(location.origin, session.code);
    if (url === this.joinUrl && this.qrDataUrl()) return;
    this.joinUrl = url;
    QRCode.toDataURL(url, { width: 320, margin: 1, errorCorrectionLevel: 'M' }).then((dataUrl) =>
      this.qrDataUrl.set(dataUrl)
    );
  }

  loadExtras() {
    const s = this.session();
    if (!s?.id) return;
    const stepId = s.currentStepId;
    const okrStep = okrInputStep(s);
    const entryStepId = this.isOkrSession() && okrStep ? okrStep.id : stepId;
    this.api.listEntries(this.id, entryStepId).subscribe((e) => this.entries.set(e));
    this.api.pollTally(this.id, stepId).subscribe((p) => this.poll.set(p));
    const votingStep = okrVotingStep(s);
    const voteStepId = this.isOkrSession() && votingStep ? votingStep.id : stepId;
    this.api.tallyVotes(this.id, voteStepId).subscribe((v) => this.votes.set(v));
    this.api.listActions(this.id).subscribe((a) => this.actions.set(a));
  }

  voteCount(entryId: string) {
    return this.votes().find((v) => v.entryId === entryId)?.votes || 0;
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
}
