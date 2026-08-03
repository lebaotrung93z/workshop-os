import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-bosch-card',
  standalone: true,
  imports: [],
  template: `
    <section class="bosch-card">
      <header class="bosch-card__header">
        <div class="bosch-card__title-row">
          <h2>{{ title }}</h2>
          @if (subtitle) {
            <span class="bosch-card__subtitle">{{ subtitle }}</span>
          }
          <div class="bosch-card__title-actions">
            <ng-content select="[card-title-actions]" />
          </div>
        </div>
        <div class="bosch-card__actions">
          <ng-content select="[card-actions]" />
        </div>
      </header>
      <div class="bosch-card__content">
        <ng-content />
      </div>
    </section>
  `,
  styles: `
    .bosch-card {
      background: var(--bosch-surface);
      border: 1px solid var(--bosch-border);
      border-radius: var(--bosch-card-radius, 0);
      box-shadow: var(--bosch-card-shadow);
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    .bosch-card__header {
      align-items: center;
      border-bottom: 1px solid var(--bosch-border-strong);
      display: flex;
      gap: 0.75rem;
      justify-content: space-between;
      min-height: var(--bosch-card-header-height);
      padding: 0.85rem 1rem;
    }

    .bosch-card__title-row {
      align-items: baseline;
      display: flex;
      flex: 1;
      flex-wrap: wrap;
      gap: 0.55rem;
      min-width: 0;
    }

    h2 {
      color: var(--bosch-text);
      font-size: 1rem;
      line-height: 1.25;
      margin: 0;
    }

    .bosch-card__subtitle {
      color: var(--bosch-text-muted);
      font-size: 0.85rem;
    }

    .bosch-card__title-actions,
    .bosch-card__actions {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 0.35rem;
    }

    .bosch-card__title-actions:empty,
    .bosch-card__actions:empty {
      display: none;
    }

    .bosch-card__content {
      padding: 1rem;
    }
  `
})
export class BoschCardComponent {
  @Input({ required: true }) title = '';
  @Input() subtitle = '';
}
