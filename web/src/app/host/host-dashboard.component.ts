import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService, HostSessionRef } from '../core/api.service';
import { HostShellComponent } from './host-shell.component';
import { PRODUCT_CHANGELOG, ChangelogEntry } from './product-changelog';

type Bucket = 'live' | 'completed' | 'prepared';

@Component({
  selector: 'app-host-dashboard',
  standalone: true,
  imports: [RouterLink, HostShellComponent],
  template: `
    <app-host-shell>
      <div class="page">
        <header class="hero">
          <div>
            <p class="eyebrow">Overview</p>
            <h1>Dashboard</h1>
            <p class="lede">Session health for workshops hosted in this browser · Join as a participant anytime</p>
          </div>
          <a class="join-cta" routerLink="/j">Join as participant</a>
        </header>

        <div class="body">
          <div class="main-col">
            <section class="stats">
              <article class="stat-card">
                <p class="stat-label">Live</p>
                <p class="stat-value live">{{ liveCount() }}</p>
                <p class="stat-hint">Welcome / running / actions</p>
              </article>
              <article class="stat-card">
                <p class="stat-label">Completed</p>
                <p class="stat-value done">{{ completedCount() }}</p>
                <p class="stat-hint">Ended workshops</p>
              </article>
              <article class="stat-card">
                <p class="stat-label">Prepared</p>
                <p class="stat-value prep">{{ preparedCount() }}</p>
                <p class="stat-hint">Lobby · not started yet</p>
              </article>
              <article class="stat-card chart-card">
                <p class="stat-label">By status</p>
                @if (totalCount() === 0) {
                  <p class="empty-chart">No sessions yet. Create one under Sessions.</p>
                  <a class="ghost" routerLink="/host">Go to Sessions</a>
                } @else {
                  <div class="chart-row">
                    <svg class="donut" viewBox="0 0 120 120" aria-hidden="true">
                      <circle class="donut-track" cx="60" cy="60" r="42" />
                      @for (seg of donutSegments(); track seg.key) {
                        <circle
                          class="donut-seg"
                          [attr.stroke]="seg.color"
                          cx="60"
                          cy="60"
                          r="42"
                          [attr.stroke-dasharray]="seg.dashArray"
                          [attr.stroke-dashoffset]="seg.dashOffset"
                        />
                      }
                      <text class="donut-total" x="60" y="56" text-anchor="middle">{{ totalCount() }}</text>
                      <text class="donut-sub" x="60" y="72" text-anchor="middle">total</text>
                    </svg>
                    <ul class="legend">
                      <li><span class="swatch live"></span> Live · {{ liveCount() }}</li>
                      <li><span class="swatch done"></span> Completed · {{ completedCount() }}</li>
                      <li><span class="swatch prep"></span> Prepared · {{ preparedCount() }}</li>
                    </ul>
                  </div>
                  <div class="bars" aria-hidden="true">
                    <div class="bar-row">
                      <span>Live</span>
                      <div class="bar-track"><div class="bar-fill live" [style.width.%]="pct(liveCount())"></div></div>
                      <strong>{{ liveCount() }}</strong>
                    </div>
                    <div class="bar-row">
                      <span>Completed</span>
                      <div class="bar-track"><div class="bar-fill done" [style.width.%]="pct(completedCount())"></div></div>
                      <strong>{{ completedCount() }}</strong>
                    </div>
                    <div class="bar-row">
                      <span>Prepared</span>
                      <div class="bar-track"><div class="bar-fill prep" [style.width.%]="pct(preparedCount())"></div></div>
                      <strong>{{ preparedCount() }}</strong>
                    </div>
                  </div>
                }
              </article>
            </section>

            @if (recentLive().length) {
              <section class="panel">
                <div class="panel-head">
                  <p class="section-label">Live now</p>
                  <a class="ghost sm" routerLink="/host">Manage in Sessions</a>
                </div>
                <div class="session-list">
                  @for (s of recentLive(); track s.id) {
                    <a class="session-row" [routerLink]="['/host', s.id]">
                      <div>
                        <strong>{{ s.title || 'Workshop' }}</strong>
                        <p>Code {{ s.code || '—' }} · {{ statusLabel(s.status) }}</p>
                      </div>
                      <span class="pill live">Open</span>
                    </a>
                  }
                </div>
              </section>
            }
          </div>

          <aside class="news-panel" aria-label="What's new">
            <p class="section-label">What's new</p>
            <div class="changelog">
              @for (entry of changelog; track entry.date + entry.title) {
                <article class="change">
                  <time>{{ entry.date }}</time>
                  <h2>{{ entry.title }}</h2>
                  <ul>
                    @for (item of entry.items; track item) {
                      <li>{{ item }}</li>
                    }
                  </ul>
                </article>
              }
            </div>
          </aside>
        </div>
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
      gap: 1.25rem;
      width: 100%;
    }

    .hero {
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

    h1 {
      font-size: 1.85rem;
      margin: 0;
    }

    .lede {
      color: var(--wos-text-muted);
      margin: 0.35rem 0 0;
      max-width: 40rem;
    }

    .join-cta {
      align-items: center;
      background: var(--wos-primary);
      border-radius: var(--wos-radius);
      color: #fff;
      display: inline-flex;
      font-weight: 700;
      padding: 0.7rem 1rem;
      text-decoration: none;
    }

    .join-cta:hover {
      background: var(--wos-primary-hover);
    }

    .body {
      align-items: start;
      display: grid;
      gap: 1.25rem;
      grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
    }

    .main-col {
      display: grid;
      gap: 1.25rem;
      min-width: 0;
    }

    .stats {
      display: grid;
      gap: 0.85rem;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .stat-card {
      background: var(--wos-surface);
      border: 1px solid var(--wos-border);
      border-radius: var(--wos-radius-lg);
      box-shadow: var(--wos-shadow);
      padding: 1.1rem 1.15rem;
    }

    .chart-card {
      grid-column: 1 / -1;
    }

    .stat-label {
      color: var(--wos-text-secondary);
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.03em;
      margin: 0 0 0.35rem;
      text-transform: uppercase;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 800;
      line-height: 1.1;
      margin: 0;
    }

    .stat-value.live { color: var(--wos-success); }
    .stat-value.done { color: var(--wos-text-secondary); }
    .stat-value.prep { color: var(--wos-primary); }

    .stat-hint {
      color: var(--wos-text-muted);
      font-size: 0.8rem;
      margin: 0.35rem 0 0;
    }

    .empty-chart {
      color: var(--wos-text-muted);
      margin: 0.5rem 0 0.85rem;
    }

    .ghost {
      background: var(--wos-surface);
      border: 1px solid var(--wos-border);
      border-radius: var(--wos-radius);
      color: var(--wos-text);
      display: inline-flex;
      font-weight: 600;
      padding: 0.55rem 0.85rem;
      text-decoration: none;
    }

    .ghost.sm {
      font-size: 0.85rem;
      padding: 0.4rem 0.7rem;
    }

    .chart-row {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 1.5rem;
      margin-top: 0.5rem;
    }

    .donut {
      flex: 0 0 auto;
      height: 140px;
      transform: rotate(-90deg);
      width: 140px;
    }

    .donut-track {
      fill: none;
      stroke: #e8eef7;
      stroke-width: 14;
    }

    .donut-seg {
      fill: none;
      stroke-linecap: butt;
      stroke-width: 14;
      transition: stroke-dashoffset 0.35s ease;
    }

    .donut-total,
    .donut-sub {
      fill: var(--wos-text);
      transform: rotate(90deg);
      transform-origin: 60px 60px;
    }

    .donut-total {
      font-size: 1.35rem;
      font-weight: 800;
    }

    .donut-sub {
      fill: var(--wos-text-muted);
      font-size: 0.65rem;
      font-weight: 600;
      text-transform: uppercase;
    }

    .legend {
      display: grid;
      gap: 0.45rem;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .legend li {
      align-items: center;
      color: var(--wos-text-secondary);
      display: flex;
      font-size: 0.9rem;
      font-weight: 600;
      gap: 0.5rem;
    }

    .swatch {
      border-radius: 4px;
      display: inline-block;
      height: 0.75rem;
      width: 0.75rem;
    }

    .swatch.live { background: var(--wos-success); }
    .swatch.done { background: #94a3b8; }
    .swatch.prep { background: var(--wos-primary); }

    .bars {
      display: grid;
      gap: 0.55rem;
      margin-top: 1.15rem;
    }

    .bar-row {
      align-items: center;
      display: grid;
      gap: 0.65rem;
      grid-template-columns: 5.5rem minmax(0, 1fr) 1.5rem;
    }

    .bar-row > span {
      color: var(--wos-text-secondary);
      font-size: 0.85rem;
      font-weight: 600;
    }

    .bar-row > strong {
      text-align: right;
    }

    .bar-track {
      background: #eef2f8;
      border-radius: var(--wos-radius-pill);
      height: 0.55rem;
      overflow: hidden;
    }

    .bar-fill {
      border-radius: inherit;
      height: 100%;
      min-width: 0;
      transition: width 0.35s ease;
    }

    .bar-fill.live { background: var(--wos-success); }
    .bar-fill.done { background: #94a3b8; }
    .bar-fill.prep { background: var(--wos-primary); }

    .panel {
      background: var(--wos-surface);
      border: 1px solid var(--wos-border);
      border-radius: var(--wos-radius-lg);
      box-shadow: var(--wos-shadow);
      padding: 1.25rem;
    }

    .panel-head {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      justify-content: space-between;
      margin-bottom: 0.65rem;
    }

    .panel-head .section-label {
      margin: 0;
    }

    .section-label {
      color: var(--wos-text-secondary);
      font-size: 0.85rem;
      font-weight: 700;
      margin: 0 0 0.85rem;
    }

    .session-list {
      display: grid;
      gap: 0.55rem;
    }

    .session-row {
      align-items: center;
      background: #f8fafc;
      border: 1px solid var(--wos-border);
      border-radius: var(--wos-radius-lg);
      color: inherit;
      display: flex;
      gap: 0.75rem;
      justify-content: space-between;
      padding: 0.85rem 1rem;
      text-decoration: none;
    }

    .session-row:hover {
      border-color: #9db7ef;
    }

    .session-row p {
      color: var(--wos-text-muted);
      margin: 0.2rem 0 0;
    }

    .pill {
      border-radius: var(--wos-radius-pill);
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.55rem;
    }

    .pill.live {
      background: var(--wos-success-soft);
      color: var(--wos-success-ink);
    }

    .news-panel {
      align-self: stretch;
      background: var(--wos-surface);
      border: 1px solid var(--wos-border);
      border-radius: var(--wos-radius-lg);
      box-shadow: var(--wos-shadow);
      max-height: calc(100vh - 8rem);
      overflow-y: auto;
      padding: 1.15rem 1.1rem 1.25rem;
      position: sticky;
      top: 1rem;
    }

    .news-panel .section-label {
      margin-bottom: 0.75rem;
    }

    .changelog {
      display: grid;
      gap: 0;
    }

    .change {
      border-top: 1px solid var(--wos-border);
      padding: 0.95rem 0 0.15rem;
    }

    .change:first-child {
      border-top: 0;
      padding-top: 0;
    }

    .change time {
      color: var(--wos-text-muted);
      display: block;
      font-size: 0.75rem;
      font-weight: 600;
      margin-bottom: 0.2rem;
    }

    .change h2 {
      font-size: 0.95rem;
      line-height: 1.3;
      margin: 0 0 0.45rem;
    }

    .change ul {
      color: var(--wos-text-secondary);
      font-size: 0.88rem;
      margin: 0;
      padding-left: 1.05rem;
    }

    .change li {
      margin: 0.2rem 0;
    }

    @media (max-width: 1100px) {
      .body {
        grid-template-columns: minmax(0, 1fr) minmax(240px, 280px);
      }
    }

    @media (max-width: 900px) {
      .body {
        grid-template-columns: 1fr;
      }

      .news-panel {
        max-height: none;
        position: static;
      }

      .stats {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 560px) {
      .stats {
        grid-template-columns: 1fr;
      }

      .bar-row {
        grid-template-columns: 4.5rem minmax(0, 1fr) 1.25rem;
      }
    }
  `
})
export class HostDashboardComponent implements OnInit {
  private api = inject(ApiService);

  sessions = signal<HostSessionRef[]>([]);
  changelog: ChangelogEntry[] = PRODUCT_CHANGELOG;

  liveCount = computed(() => this.sessions().filter((s) => this.bucket(s.status) === 'live').length);
  completedCount = computed(() => this.sessions().filter((s) => this.bucket(s.status) === 'completed').length);
  preparedCount = computed(() => this.sessions().filter((s) => this.bucket(s.status) === 'prepared').length);
  totalCount = computed(() => this.sessions().length);

  recentLive = computed(() =>
    this.sessions()
      .filter((s) => this.bucket(s.status) === 'live')
      .slice(0, 5)
  );

  donutSegments = computed(() => {
    const counts: Array<{ key: Bucket; count: number; color: string }> = [
      { key: 'live', count: this.liveCount(), color: '#0f9d58' },
      { key: 'completed', count: this.completedCount(), color: '#94a3b8' },
      { key: 'prepared', count: this.preparedCount(), color: '#0056d2' }
    ];
    const total = Math.max(1, this.totalCount());
    const circumference = 2 * Math.PI * 42;
    let offset = 0;
    return counts
      .filter((c) => c.count > 0)
      .map((c) => {
        const len = (c.count / total) * circumference;
        const seg = {
          key: c.key,
          color: c.color,
          dashArray: `${len} ${circumference - len}`,
          dashOffset: -offset
        };
        offset += len;
        return seg;
      });
  });

  ngOnInit() {
    this.sessions.set(this.api.listHostSessions());
  }

  pct(n: number) {
    const t = this.totalCount();
    if (!t) return 0;
    return Math.round((n / t) * 100);
  }

  bucket(status: string): Bucket {
    if (status === 'CLOSED') return 'completed';
    if (status === 'LOBBY' || status === 'DRAFT' || !status) return 'prepared';
    return 'live';
  }

  statusLabel(status: string) {
    if (status === 'LOBBY') return 'Prepared';
    if (status === 'CLOSED') return 'Ended';
    if (status === 'WELCOME') return 'Welcome';
    if (status === 'ACTIONS') return 'Actions';
    return 'In progress';
  }
}
