import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BoschButtonComponent } from '../bosch-ui/bosch-button/bosch-button.component';
import { BoschCardComponent } from '../bosch-ui/bosch-card/bosch-card.component';
import { BoschLogoComponent } from '../bosch-ui/bosch-logo/bosch-logo.component';
import { ApiService } from '../core/api.service';
import { readJoinCodeFromLocation } from '../core/join-url';

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [FormsModule, BoschButtonComponent, BoschCardComponent, BoschLogoComponent],
  template: `
    <div class="page">
      <app-bosch-logo />
      <h1>Join workshop</h1>
      <app-bosch-card
        title="Enter session"
        [subtitle]="sessionTitle() || 'Scan the big-screen QR or type the code from the host'"
      >
        <label>Session code <input [(ngModel)]="code" maxlength="6" autocomplete="off" /></label>
        <label>Your name <input [(ngModel)]="name" name="displayName" autocomplete="name" /></label>
        @if (error()) {
          <p class="err">{{ error() }}</p>
        }
        <app-bosch-button [block]="true" [disabled]="busy()" (click)="join()">Join</app-bosch-button>
      </app-bosch-card>
    </div>
  `,
  styles: `
    .page { max-width: 420px; margin: 0 auto; padding: 1.5rem 1rem; display: grid; gap: 1rem; }
    h1 { margin: 0; }
    label { display: grid; gap: 0.35rem; margin-bottom: 0.85rem; font-weight: 600; }
    input { border: 1px solid var(--bosch-border-strong); padding: 0.75rem; font: inherit; text-transform: uppercase; }
    input[name='displayName'] { text-transform: none; }
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
    if (!code) {
      this.error.set('Enter the session code');
      return;
    }
    if (!name) {
      this.error.set('Enter your name');
      return;
    }
    this.busy.set(true);
    this.api.join(code, name).subscribe({
      next: (r) => {
        this.api.setParticipant(r.sessionId, r.participantId, r.joinToken);
        this.router.navigate(['/p', r.sessionId]);
      },
      error: (e) => {
        this.busy.set(false);
        this.error.set(e?.error?.message || 'Join failed');
      }
    });
  }
}
