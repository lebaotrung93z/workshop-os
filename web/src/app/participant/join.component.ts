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
        <div class="brand">Workshop OS</div>
        <h1>Join workshop</h1>
        <p class="lede">{{ sessionTitle() || 'Enter the code from the big screen' }}</p>

        <div class="preview">
          <app-bosch-avatar [name]="name || 'You'" size="lg" />
          <div>
            <strong>{{ name || 'Your name' }}</strong>
            <span>Avatar uses 2 letters from your name</span>
          </div>
        </div>

        <label>
          Enter session code
          <input [(ngModel)]="code" maxlength="6" placeholder="AIOS12" autocomplete="off" />
        </label>
        <label>
          Your name
          <input class="name" [(ngModel)]="name" placeholder="Minh Hoang" autocomplete="name" />
        </label>

        @if (error()) {
          <p class="err">{{ error() }}</p>
        }

        <app-bosch-button [block]="true" [disabled]="busy() || !code.trim() || !name.trim()" (click)="join()">
          Join
        </app-bosch-button>
      </div>
    </div>
  `,
  styles: `
    .page {
      align-items: center;
      background: linear-gradient(180deg, #dbe7ff 0%, var(--wos-bg) 45%, var(--wos-bg) 100%);
      display: flex;
      justify-content: center;
      min-height: 100vh;
      padding: 1.25rem;
    }

    .phone {
      background: #fff;
      border: 1px solid var(--wos-border);
      border-radius: 24px;
      box-shadow: var(--wos-shadow-lg);
      display: grid;
      gap: 0.85rem;
      max-width: 390px;
      padding: 1.5rem 1.25rem 1.75rem;
      width: 100%;
    }

    .brand {
      color: var(--wos-primary);
      font-size: 0.8rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    h1 { font-size: 1.55rem; margin: 0; }
    .lede { color: var(--wos-text-muted); margin: 0; }

    .preview {
      align-items: center;
      background: var(--wos-primary-soft);
      border-radius: var(--wos-radius-lg);
      display: flex;
      gap: 0.85rem;
      padding: 0.85rem;
    }

    .preview strong { display: block; }
    .preview span { color: var(--wos-text-muted); font-size: 0.8rem; }

    label { display: grid; font-weight: 600; gap: 0.35rem; }
    input {
      border: 1px solid var(--wos-border-strong);
      border-radius: var(--wos-radius);
      padding: 0.8rem 0.85rem;
      text-transform: uppercase;
    }
    input.name { text-transform: none; }
    .err { color: var(--wos-danger); margin: 0; }
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
        next: (s) => this.sessionTitle.set(s?.title || ''),
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
