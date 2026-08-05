import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import QRCode from 'qrcode';
import { BoschLogoComponent } from '../bosch-ui/bosch-logo/bosch-logo.component';
import { BoschAvatarComponent } from '../bosch-ui/bosch-avatar/bosch-avatar.component';
import { BoschAvatarStackComponent } from '../bosch-ui/bosch-avatar/bosch-avatar-stack.component';
import { ApiService } from '../core/api.service';
import { RealtimeService } from '../core/realtime.service';
import { buildJoinUrl } from '../core/join-url';

@Component({
  selector: 'app-display',
  standalone: true,
  imports: [BoschLogoComponent, BoschAvatarComponent, BoschAvatarStackComponent],
  template: `
    <div class="screen">
      <header>
        <app-bosch-logo />
        <div class="header__meta">
          <h1>{{ session()?.title }}</h1>
          <p>
            Code <span class="code">{{ session()?.code }}</span>
            · {{ session()?.participantCount || 0 }} online
          </p>
        </div>
        <app-bosch-avatar-stack [people]="participants()" [max]="8" size="md" />
      </header>

      @if (showJoinScreen()) {
        <section class="hero">
          <h2>{{ joinHeadline() }}</h2>
          @if (qrDataUrl()) {
            <img class="qr" [src]="qrDataUrl()" alt="Scan to join workshop" width="360" height="360" />
          }
          <p class="code-lg">{{ session()?.code }}</p>
          <p class="join-url">{{ joinUrl }}</p>
          <p>{{ joinSubline() }}</p>
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

      @if (!showJoinScreen() && session()?.currentStep?.type === 'input') {
        <section>
          <h2>{{ session()?.currentStep?.title }}</h2>
          <div class="columns">
            @for (g of session()?.currentStep?.groups || []; track g.id; let gi = $index) {
              <div class="col" [attr.data-tone]="gi % 3">
                <h3>{{ g.title }}</h3>
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
            }
          </div>
        </section>
      }

      @if (!showJoinScreen() && session()?.currentStep?.type === 'voting') {
        <section>
          <h2>Top issues (by votes)</h2>
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

      @if (!showJoinScreen() && (session()?.currentStep?.type === 'form' || summary())) {
        <section class="split">
          <div>
            <h2>Action plan</h2>
            <div class="actions">
              @for (a of actions(); track a.id) {
                <article class="action">
                  <p class="action__text">{{ a.action }}</p>
                  <div class="action__meta">
                    @if (a.owner) {
                      <app-bosch-avatar [name]="a.owner" size="sm" />
                      <span>Owner: {{ a.owner }}</span>
                    }
                    @if (a.dueDate) {
                      <span class="due">Due {{ a.dueDate }}</span>
                    }
                  </div>
                </article>
              }
            </div>
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
    .screen { background: linear-gradient(180deg, #fff 0%, var(--bosch-gray-95) 100%); color: var(--bosch-text); min-height: 100vh; padding: 2rem 2.5rem; }
    header { align-items: center; display: flex; flex-wrap: wrap; gap: 1.25rem; margin-bottom: 2rem; }
    .header__meta { flex: 1; min-width: 200px; }
    h1 { font-size: 2rem; margin: 0; }
    h2 { font-size: 2.2rem; margin: 0 0 1rem; }
    h3 { color: var(--bosch-text); margin: 0 0 0.75rem; }
    .code, .code-lg { color: var(--bosch-accent); font-weight: 800; letter-spacing: 0.12em; }
    .code-lg { display: block; font-size: 4rem; margin: 0.75rem 0 0.35rem; }
    .hero { display: grid; gap: 0.5rem; justify-items: center; padding: 2.5rem 1rem 4rem; text-align: center; }
    .qr { background: #fff; border: 1px solid var(--bosch-border); height: auto; padding: 1rem; width: min(360px, 70vw); }
    .join-url { color: var(--bosch-text-muted); font-size: 1.05rem; margin: 0; max-width: 36rem; word-break: break-all; }
    .hero__people { display: flex; justify-content: center; margin-top: 1rem; }
    .bars, .vote-bars { display: grid; gap: 1rem; max-width: 960px; }
    .row { align-items: center; display: grid; font-size: 1.4rem; gap: 1rem; grid-template-columns: 160px 1fr 60px; }
    .vote-row { align-items: center; display: grid; font-size: 1.25rem; gap: 1rem; grid-template-columns: 2.5rem 1fr 3rem; }
    .vote-row__body { display: grid; gap: 0.35rem; }
    .vote-row__label { font-weight: 600; }
    .track { background: var(--bosch-gray-90); height: 28px; }
    .fill { background: var(--bosch-accent); height: 28px; }
    .columns { display: grid; gap: 1rem; grid-template-columns: repeat(3, 1fr); }
    .col { background: var(--bosch-surface); border: 1px solid var(--bosch-border); border-top: 6px solid var(--bosch-accent); min-height: 12rem; padding: 1rem; }
    .col[data-tone='0'] { border-top-color: var(--bosch-positive); }
    .col[data-tone='1'] { border-top-color: var(--bosch-error); }
    .col[data-tone='2'] { border-top-color: var(--bosch-accent); }
    .note { background: var(--bosch-yellow-95); border: 1px solid var(--bosch-border); margin-bottom: 0.65rem; padding: 0.85rem; }
    .note__head { align-items: center; display: flex; font-size: 0.9rem; font-weight: 600; gap: 0.45rem; margin-bottom: 0.4rem; }
    .note p { font-size: 1.15rem; margin: 0; }
    .rank { color: var(--bosch-accent); font-weight: 800; }
    .split { display: grid; gap: 2rem; grid-template-columns: 1.2fr 1fr; }
    .actions { display: grid; gap: 0.85rem; }
    .action { background: var(--bosch-surface); border: 1px solid var(--bosch-border); padding: 1rem; }
    .action__text { font-size: 1.25rem; font-weight: 600; margin: 0 0 0.65rem; }
    .action__meta { align-items: center; color: var(--bosch-text-secondary); display: flex; flex-wrap: wrap; font-size: 1.05rem; gap: 0.55rem; }
    .due { margin-left: auto; }
    ul { font-size: 1.35rem; }
    .muted { color: var(--bosch-text-muted); }
    @media (max-width: 900px) { .columns, .split { grid-template-columns: 1fr; } }
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
      return s.currentStep.instructions || 'Scan the QR code or enter the code on your phone.';
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
    QRCode.toDataURL(url, { width: 360, margin: 1, errorCorrectionLevel: 'M' }).then((dataUrl) =>
      this.qrDataUrl.set(dataUrl)
    );
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

  votePct(count: number) {
    const max = Math.max(1, ...this.votes().map((v) => Number(v.votes) || 0));
    return (Number(count) / max) * 100;
  }
}
