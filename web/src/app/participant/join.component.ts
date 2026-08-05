import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BoschButtonComponent } from '../bosch-ui/bosch-button/bosch-button.component';
import { BoschCardComponent } from '../bosch-ui/bosch-card/bosch-card.component';
import { BoschLogoComponent } from '../bosch-ui/bosch-logo/bosch-logo.component';
import { BoschAvatarComponent } from '../bosch-ui/bosch-avatar/bosch-avatar.component';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [FormsModule, BoschButtonComponent, BoschCardComponent, BoschLogoComponent, BoschAvatarComponent],
  template: `
    <div class="page">
      <app-bosch-logo />
      <h1>Join workshop</h1>
      <p class="lede">Enter the session code from the host or big screen.</p>

      <app-bosch-card title="Enter session" subtitle="You’ll appear on the live wall with your initials">
        <div class="preview">
          <app-bosch-avatar [name]="name || 'You'" size="lg" />
          <div>
            <strong>{{ name || 'Your name' }}</strong>
            <span>Avatar uses 2 letters from your name</span>
          </div>
        </div>

        <label>
          Session code
          <input [(ngModel)]="code" maxlength="6" placeholder="ABC123" autocomplete="off" />
        </label>
        <label>
          Your name
          <input class="name" [(ngModel)]="name" placeholder="Minh Hoang" autocomplete="name" />
        </label>
        @if (error()) {
          <p class="err">{{ error() }}</p>
        }
        <app-bosch-button [block]="true" [disabled]="!code.trim() || !name.trim()" (click)="join()">Join</app-bosch-button>
      </app-bosch-card>
    </div>
  `,
  styles: `
    .page {
      display: grid;
      gap: 0.85rem;
      margin: 0 auto;
      max-width: 420px;
      padding: 1.5rem 1rem;
    }

    h1 { margin: 0; }

    .lede {
      color: var(--bosch-text-muted);
      margin: 0;
    }

    .preview {
      align-items: center;
      background: var(--bosch-bg-muted);
      display: flex;
      gap: 0.85rem;
      margin-bottom: 1rem;
      padding: 0.85rem;
    }

    .preview strong {
      display: block;
    }

    .preview span {
      color: var(--bosch-text-muted);
      font-size: 0.82rem;
    }

    label {
      display: grid;
      font-weight: 600;
      gap: 0.35rem;
      margin-bottom: 0.85rem;
    }

    input {
      border: 1px solid var(--bosch-border-strong);
      font: inherit;
      padding: 0.75rem;
      text-transform: uppercase;
    }

    input.name {
      text-transform: none;
    }

    .err { color: var(--bosch-error); }
  `
})
export class JoinComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  code = '';
  name = '';
  error = signal('');

  ngOnInit() {
    this.code = (this.route.snapshot.queryParamMap.get('code') || '').toUpperCase();
  }

  join() {
    this.error.set('');
    this.api.join(this.code.trim().toUpperCase(), this.name.trim()).subscribe({
      next: (r) => {
        this.api.setParticipant(r.sessionId, r.participantId, r.joinToken);
        localStorage.setItem('wos_display_name', r.displayName || this.name.trim());
        this.router.navigate(['/p', r.sessionId]);
      },
      error: (e) => this.error.set(e?.error?.message || 'Join failed')
    });
  }
}
