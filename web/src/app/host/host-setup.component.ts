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
        <div>
          <h1>Workshop OS</h1>
          <p class="lede">Host laptop · Participant mobile · Big screen</p>
        </div>
      </header>

      <app-bosch-card title="Create workshop" subtitle="Pick a template and start a hybrid session">
        <label>
          Workshop title
          <input [(ngModel)]="title" placeholder="Sprint Retro – Team Alpha" />
        </label>
        <div class="templates">
          @for (t of templates(); track t.id) {
            <button type="button" class="tpl" [class.active]="selected() === t.id" (click)="selected.set(t.id)">
              <strong>{{ t.name }}</strong>
              <span>{{ t.description }}</span>
              <em>{{ (t.steps?.length || 0) }} steps</em>
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
      </app-bosch-card>
    </div>
  `,
  styles: `
    .page {
      margin: 0 auto;
      max-width: 760px;
      padding: 2rem 1rem;
    }

    .top {
      align-items: center;
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    h1 {
      color: var(--bosch-text);
      font-size: 1.6rem;
      margin: 0;
    }

    .lede {
      color: var(--bosch-text-muted);
      margin: 0.2rem 0 0;
    }

    label {
      display: flex;
      flex-direction: column;
      font-weight: 600;
      gap: 0.35rem;
      margin-bottom: 1rem;
    }

    input {
      border: 1px solid var(--bosch-border-strong);
      font: inherit;
      padding: 0.65rem 0.75rem;
    }

    .templates {
      display: grid;
      gap: 0.75rem;
    }

    .tpl {
      background: var(--bosch-bg-muted);
      border: 1px solid var(--bosch-border);
      border-left: 4px solid transparent;
      cursor: pointer;
      display: grid;
      gap: 0.25rem;
      padding: 0.95rem 1rem;
      text-align: left;
    }

    .tpl.active {
      background: var(--bosch-accent-soft);
      border-color: var(--bosch-accent);
      border-left-color: var(--bosch-accent);
    }

    .tpl span {
      color: var(--bosch-text-muted);
      font-size: 0.9rem;
    }

    .tpl em {
      color: var(--bosch-accent);
      font-size: 0.78rem;
      font-style: normal;
      font-weight: 700;
    }

    .actions {
      align-items: center;
      display: flex;
      gap: 1rem;
      margin-top: 1rem;
    }

    .err {
      color: var(--bosch-error);
    }
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
