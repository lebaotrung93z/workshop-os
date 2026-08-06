import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BoschButtonComponent } from '../bosch-ui/bosch-button/bosch-button.component';
import { ApiService, HostSessionRef } from '../core/api.service';
import { HostShellComponent } from './host-shell.component';

@Component({
  selector: 'app-host-setup',
  standalone: true,
  imports: [FormsModule, RouterLink, BoschButtonComponent, HostShellComponent],
  template: `
    <app-host-shell>
      <div class="page">
        <header class="hero">
          <div>
            <p class="eyebrow">New workshop</p>
            <h1>Create a hybrid session</h1>
            <p class="lede">Prepare content first, or go live now · Host laptop · Participant mobile · Big screen</p>
          </div>
          <a class="ghost" routerLink="/host/format">Build custom format</a>
        </header>

        @if (savedSessions().length) {
          <section class="panel">
            <p class="section-label">Saved for later</p>
            <div class="saved">
              @for (s of savedSessions(); track s.id) {
                <article class="saved-card">
                  <div>
                    <strong>{{ s.title || 'Workshop' }}</strong>
                    <p>
                      Code {{ s.code || '—' }}
                      · {{ statusLabel(s.status) }}
                      · {{ relativeTime(s.updatedAt) }}
                    </p>
                  </div>
                  <div class="saved-actions">
                    <app-bosch-button (click)="resume(s)">Resume</app-bosch-button>
                    @if (s.status === 'CLOSED') {
                      <button type="button" class="text-btn" (click)="forget(s.id)">Remove</button>
                    }
                  </div>
                </article>
              }
            </div>
          </section>
        }

        <section class="panel">
          <label>
            Workshop title
            <input [(ngModel)]="title" placeholder="AI Productivity Workshop" />
          </label>

          <p class="section-label">Pick a template</p>
          <div class="templates">
            @for (t of templates(); track t.id) {
              <button type="button" class="tpl" [class.active]="selected() === t.id" (click)="selected.set(t.id)">
                <div class="tpl__top">
                  <strong>{{ t.name }}</strong>
                  <span>{{ (t.steps?.length || 0) }} steps</span>
                </div>
                <p>{{ t.description }}</p>
              </button>
            }
          </div>

          @if (savedNotice()) {
            <p class="ok">{{ savedNotice() }}</p>
          }
          @if (error()) {
            <p class="err">{{ error() }}</p>
          }

          <div class="actions">
            <app-bosch-button [disabled]="!selected() || busy()" (click)="create()">
              Create &amp; prepare
            </app-bosch-button>
            <app-bosch-button
              variant="secondary"
              [disabled]="!selected() || busy()"
              (click)="customize()"
            >
              Customize template
            </app-bosch-button>
            <a routerLink="/j">Join as participant</a>
          </div>
        </section>
      </div>
    </app-host-shell>
  `,
  styles: `
    .page { display: grid; gap: 1.25rem; max-width: 880px; }
    .hero { align-items: end; display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; }
    .eyebrow { color: var(--wos-primary); font-size: 0.8rem; font-weight: 700; letter-spacing: 0.04em; margin: 0 0 0.35rem; text-transform: uppercase; }
    h1 { font-size: 1.85rem; margin: 0; }
    .lede { color: var(--wos-text-muted); margin: 0.35rem 0 0; }
    .ghost { background: var(--wos-surface); border: 1px solid var(--wos-border); border-radius: var(--wos-radius); color: var(--wos-text); font-weight: 600; padding: 0.65rem 0.9rem; text-decoration: none; }
    .panel { background: var(--wos-surface); border: 1px solid var(--wos-border); border-radius: var(--wos-radius-lg); box-shadow: var(--wos-shadow); padding: 1.25rem; }
    label { display: grid; font-weight: 600; gap: 0.4rem; margin-bottom: 1.1rem; }
    input { border: 1px solid var(--wos-border-strong); border-radius: var(--wos-radius); padding: 0.75rem 0.85rem; }
    .section-label { color: var(--wos-text-secondary); font-size: 0.85rem; font-weight: 700; margin: 0 0 0.65rem; }
    .templates { display: grid; gap: 0.75rem; }
    .tpl { background: #f8fafc; border: 1px solid var(--wos-border); border-radius: var(--wos-radius-lg); cursor: pointer; padding: 1rem; text-align: left; transition: border-color 0.15s, box-shadow 0.15s; }
    .tpl:hover { border-color: #9db7ef; }
    .tpl.active { background: var(--wos-primary-soft); border-color: var(--wos-primary); box-shadow: 0 0 0 3px var(--wos-primary-ring); }
    .tpl__top { align-items: center; display: flex; justify-content: space-between; margin-bottom: 0.35rem; }
    .tpl__top span { background: #fff; border-radius: var(--wos-radius-pill); color: var(--wos-primary); font-size: 0.75rem; font-weight: 700; padding: 0.15rem 0.5rem; }
    .tpl p { color: var(--wos-text-muted); margin: 0; }
    .saved { display: grid; gap: 0.65rem; }
    .saved-card {
      align-items: center;
      background: #f8fafc;
      border: 1px solid var(--wos-border);
      border-radius: var(--wos-radius-lg);
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      justify-content: space-between;
      padding: 0.9rem 1rem;
    }
    .saved-card p { color: var(--wos-text-muted); margin: 0.25rem 0 0; }
    .saved-actions { align-items: center; display: flex; gap: 0.65rem; }
    .text-btn {
      background: transparent;
      border: 0;
      color: var(--wos-danger);
      cursor: pointer;
      font-weight: 700;
      padding: 0;
    }
    .actions { align-items: center; display: flex; gap: 1rem; margin-top: 1.15rem; flex-wrap: wrap; }
    .err { color: var(--wos-danger); }
    .ok { color: var(--wos-success, #0a7a3e); font-weight: 600; }
  `
})
export class HostSetupComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  templates = signal<any[]>([]);
  savedSessions = signal<HostSessionRef[]>([]);
  selected = signal<string>('');
  title = '';
  busy = signal(false);
  error = signal('');
  savedNotice = signal('');

  ngOnInit() {
    this.reloadSaved();
    const customId = this.route.snapshot.queryParamMap.get('custom');
    const savedId = this.route.snapshot.queryParamMap.get('saved');
    if (savedId) {
      this.savedNotice.set('Workshop saved for later — resume it below when you are ready.');
    }
    this.api.listTemplates().subscribe({
      next: (t) => {
        this.templates.set(t);
        if (customId && t.some((x) => x.id === customId)) {
          this.selected.set(customId);
          this.savedNotice.set('Custom template saved — selected below.');
        }
      },
      error: (e) => this.error.set(e?.error?.message || 'Failed to load templates')
    });
  }

  reloadSaved() {
    this.savedSessions.set(this.api.listHostSessions().filter((s) => s.status !== 'CLOSED'));
  }

  statusLabel(status: string) {
    if (status === 'LOBBY') return 'Prepared';
    if (status === 'CLOSED') return 'Ended';
    return 'In progress';
  }

  relativeTime(iso: string) {
    if (!iso) return '';
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return '';
    const mins = Math.round((Date.now() - t) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 48) return `${hours}h ago`;
    return `${Math.round(hours / 24)}d ago`;
  }

  resume(s: HostSessionRef) {
    this.api.activateHostSession(s.id);
    this.router.navigate(['/host', s.id]);
  }

  forget(id: string) {
    this.api.removeHostSession(id);
    this.reloadSaved();
  }

  create() {
    this.busy.set(true);
    this.error.set('');
    this.api.createSession(this.selected(), this.title).subscribe({
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
        this.error.set(e?.error?.message || 'Create failed');
      }
    });
  }

  customize() {
    const id = this.selected();
    if (!id) return;
    this.router.navigate(['/host/format'], { queryParams: { from: id } });
  }
}
