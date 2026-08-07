import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BoschButtonComponent } from '../bosch-ui/bosch-button/bosch-button.component';
import { BoschAvatarComponent } from '../bosch-ui/bosch-avatar/bosch-avatar.component';
import { ApiService } from '../core/api.service';
import { readJoinCodeFromLocation } from '../core/join-url';

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [FormsModule, BoschButtonComponent, BoschAvatarComponent],
  template: `
    <div class="page">
      <div class="phone">
        <header class="hero">
          <p class="brand">Workshop OS</p>
          <h1>Join workshop</h1>
          <p class="lede">{{ sessionTitle() || 'Enter the code from the big screen' }}</p>
        </header>

        <div class="preview">
          <app-bosch-avatar [name]="name || 'You'" size="lg" />
          <div class="preview__copy">
            <strong>{{ name || 'Your name' }}</strong>
            <span>Avatar uses 2 letters from your name</span>
          </div>
        </div>

        <div class="fields">
          <label class="field">
            <span class="field__label">Session code</span>
            <input [(ngModel)]="code" maxlength="6" placeholder="AIOS12" autocomplete="off" />
          </label>
          <label class="field">
            <span class="field__label">Your name</span>
            <input class="name" [(ngModel)]="name" placeholder="Minh Hoang" autocomplete="name" />
          </label>
        </div>

        @if (error()) {
          <p class="err" role="alert">{{ error() }}</p>
        }

        <div class="actions">
          <app-bosch-button [block]="true" [disabled]="busy() || !code.trim() || !name.trim()" (click)="join()">
            Join
          </app-bosch-button>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      --gap-xs: 0.25rem;
      --gap-sm: 0.5rem;
      --gap-md: 0.75rem;
      --gap-lg: 1.25rem;
      --gap-xl: 1.75rem;
    }

    .page {
      align-items: center;
      background: linear-gradient(180deg, #dbe7ff 0%, #eef3fb 45%, var(--wos-bg) 100%);
      display: flex;
      justify-content: center;
      min-height: 100vh;
      padding: 0.75rem;
    }

    .phone {
      background: #fff;
      border: 1px solid var(--wos-border);
      border-radius: 28px;
      box-shadow: var(--wos-shadow-lg);
      display: flex;
      flex-direction: column;
      gap: var(--gap-md);
      max-width: 390px;
      padding: 1.35rem 1.15rem 1.5rem;
      width: 100%;
    }

    .hero {
      display: flex;
      flex-direction: column;
      gap: var(--gap-xs);
      margin-bottom: var(--gap-xs);
    }

    .brand {
      color: var(--wos-primary);
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.06em;
      margin: 0;
      text-transform: uppercase;
    }

    h1 {
      font-size: 1.55rem;
      font-weight: 750;
      letter-spacing: -0.02em;
      line-height: 1.2;
      margin: 0;
    }

    .lede {
      color: var(--wos-text-muted);
      font-size: 0.95rem;
      line-height: 1.4;
      margin: 0.15rem 0 0;
    }

    .preview {
      align-items: center;
      background: var(--wos-primary-soft);
      border-radius: 14px;
      display: flex;
      gap: 0.85rem;
      padding: 0.95rem 1rem;
    }

    .preview__copy {
      display: flex;
      flex-direction: column;
      gap: 0.15rem;
      min-width: 0;
    }

    .preview strong {
      display: block;
      font-size: 1rem;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .preview span {
      color: var(--wos-text-muted);
      font-size: 0.8rem;
      line-height: 1.35;
    }

    .fields {
      display: flex;
      flex-direction: column;
      gap: var(--gap-md);
      margin-top: var(--gap-xs);
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin: 0;
    }

    .field__label {
      color: var(--wos-text-secondary);
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    input {
      border: 1px solid var(--wos-border-strong);
      border-radius: var(--wos-radius);
      font: inherit;
      letter-spacing: 0.08em;
      padding: 0.85rem 0.9rem;
      text-transform: uppercase;
    }

    input.name {
      letter-spacing: normal;
      text-transform: none;
    }

    input:focus {
      border-color: var(--wos-primary);
      box-shadow: 0 0 0 3px var(--wos-primary-ring);
      outline: none;
    }

    .err {
      background: var(--wos-danger-soft);
      border-radius: var(--wos-radius);
      color: var(--wos-danger-ink);
      font-size: 0.9rem;
      font-weight: 600;
      margin: 0;
      padding: 0.7rem 0.85rem;
    }

    .actions {
      margin-top: var(--gap-sm);
    }

    @media (max-width: 480px) {
      .page {
        padding: 0;
      }

      .phone {
        border: none;
        border-radius: 0;
        box-shadow: none;
        max-width: none;
        min-height: 100vh;
        padding: 1.35rem 1.1rem 1.6rem;
      }
    }
  `
})
export class JoinComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  code = '';
  name = '';
  error = signal('');
  busy = signal(false);
  sessionTitle = signal('');

  ngOnInit() {
    const fromRoute = (this.route.snapshot.queryParamMap.get('code') || '').toUpperCase();
    this.code = fromRoute || readJoinCodeFromLocation();
    if (this.code) {
      this.api.getByCode(this.code).subscribe({
        next: (s) => {
          this.sessionTitle.set(s?.title || '');
          if (s?.status === 'CLOSED') {
            this.error.set('This workshop has ended');
          } else if (s?.joinsLocked) {
            this.error.set('This room is locked — ask the host to unlock before joining');
          }
        },
        error: () => this.sessionTitle.set('')
      });
    }
  }

  join() {
    this.error.set('');
    const code = this.code.trim().toUpperCase();
    const name = this.name.trim();
    if (!code || !name) {
      this.error.set(!code ? 'Enter the session code' : 'Enter your name');
      return;
    }
    this.busy.set(true);
    this.api.join(code, name).subscribe({
      next: (r) => {
        this.api.setParticipant(r.sessionId, r.participantId, r.joinToken, r.displayName || name);
        this.router.navigate(['/p', r.sessionId]);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(e?.error?.message || 'Join failed');
      }
    });
  }
}
