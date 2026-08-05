import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BoschButtonComponent } from '../bosch-ui/bosch-button/bosch-button.component';
import { ApiService } from '../core/api.service';
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
            <p class="lede">Host laptop · Participant mobile · Big screen</p>
          </div>
          <a class="ghost" routerLink="/host/format">Build custom format</a>
        </header>

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

          @if (error()) {
            <p class="err">{{ error() }}</p>
          }

          <div class="actions">
            <app-bosch-button [disabled]="!selected() || busy()" (click)="create()">Create session</app-bosch-button>
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
    .actions { align-items: center; display: flex; gap: 1rem; margin-top: 1.15rem; }
    .err { color: var(--wos-danger); }
  `
})
export class HostSetupComponent implements OnInit {
  private api = inject(ApiService);
  private router = inject(Router);
  templates = signal<any[]>([]);
  selected = signal<string>('');
  title = '';
  busy = signal(false);
  error = signal('');

  ngOnInit() {
    this.api.listTemplates().subscribe({
      next: (t) => this.templates.set(t),
      error: (e) => this.error.set(e?.error?.message || 'Failed to load templates')
    });
  }

  create() {
    this.busy.set(true);
    this.error.set('');
    this.api.createSession(this.selected(), this.title).subscribe({
      next: (s) => {
        this.api.setHostSession(s.id, s.hostToken);
        this.router.navigate(['/host', s.id]);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(e?.error?.message || 'Create failed');
      }
    });
  }
}
