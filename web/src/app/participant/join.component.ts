import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BoschButtonComponent } from '../bosch-ui/bosch-button/bosch-button.component';
import { BoschCardComponent } from '../bosch-ui/bosch-card/bosch-card.component';
import { BoschLogoComponent } from '../bosch-ui/bosch-logo/bosch-logo.component';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-join',
  standalone: true,
  imports: [FormsModule, BoschButtonComponent, BoschCardComponent, BoschLogoComponent],
  template: `
    <div class="page">
      <app-bosch-logo />
      <h1>Join workshop</h1>
      <app-bosch-card title="Enter session" subtitle="Use the code from the big screen or host">
        <label>Session code <input [(ngModel)]="code" maxlength="6" /></label>
        <label>Your name <input [(ngModel)]="name" /></label>
        @if (error()) { <p class="err">{{ error() }}</p> }
        <app-bosch-button [block]="true" (click)="join()">Join</app-bosch-button>
      </app-bosch-card>
    </div>
  `,
  styles: `
    .page { max-width: 420px; margin: 0 auto; padding: 1.5rem 1rem; display: grid; gap: 1rem; }
    h1 { margin: 0; }
    label { display: grid; gap: 0.35rem; margin-bottom: 0.85rem; font-weight: 600; }
    input { border: 1px solid var(--bosch-border-strong); padding: 0.75rem; font: inherit; text-transform: uppercase; }
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
    this.api.join(this.code.trim().toUpperCase(), this.name).subscribe({
      next: (r) => {
        this.api.setParticipant(r.sessionId, r.participantId, r.joinToken);
        this.router.navigate(['/p', r.sessionId]);
      },
      error: (e) => this.error.set(e?.error?.message || 'Join failed')
    });
  }
}
