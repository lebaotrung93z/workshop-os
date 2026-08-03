import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BoschButtonComponent } from '../bosch-ui/bosch-button/bosch-button.component';
import { BoschCardComponent } from '../bosch-ui/bosch-card/bosch-card.component';
import { BoschLogoComponent } from '../bosch-ui/bosch-logo/bosch-logo.component';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-host-setup',
  standalone: true,
  imports: [FormsModule, RouterLink, BoschButtonComponent, BoschCardComponent, BoschLogoComponent],
  template: `
    <div class="page">
      <header class="top">
        <app-bosch-logo />
        <h1>Workshop OS</h1>
      </header>
      <app-bosch-card title="Create workshop" subtitle="Pick a template or build your own format">
        <label>
          Workshop title
          <input [(ngModel)]="title" placeholder="Sprint Retro – Team Alpha" />
        </label>
        <div class="templates">
          @for (t of templates(); track t.id) {
            <button type="button" class="tpl" [class.active]="selected() === t.id" (click)="selected.set(t.id)">
              <strong>{{ t.name }}</strong>
              <span>{{ t.description }}</span>
            </button>
          }
        </div>
        @if (error()) {
          <p class="err">{{ error() }}</p>
        }
        <div class="actions">
          <app-bosch-button [disabled]="!selected() || busy()" (click)="create()">Create session</app-bosch-button>
          <a routerLink="/host/format">Create manual format</a>
          <a routerLink="/j">Join as participant</a>
        </div>
      </app-bosch-card>
    </div>
  `,
  styles: `
    .page { max-width: 720px; margin: 0 auto; padding: 2rem 1rem; }
    .top { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
    h1 { margin: 0; font-size: 1.5rem; color: var(--bosch-text); }
    label { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem; font-weight: 600; }
    input { border: 1px solid var(--bosch-border-strong); padding: 0.65rem 0.75rem; font: inherit; }
    .templates { display: grid; gap: 0.75rem; }
    .tpl { text-align: left; border: 1px solid var(--bosch-border); background: var(--bosch-bg-muted); padding: 0.9rem; cursor: pointer; display: grid; gap: 0.25rem; }
    .tpl.active { border-color: var(--bosch-accent); background: var(--bosch-accent-soft); }
    .tpl span { color: var(--bosch-text-muted); font-size: 0.9rem; }
    .actions { display: flex; align-items: center; gap: 1rem; margin-top: 1rem; flex-wrap: wrap; }
    .actions a { color: var(--bosch-accent); font-weight: 700; }
    .err { color: var(--bosch-error); }
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
