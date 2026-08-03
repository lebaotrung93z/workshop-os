import { Component, input } from '@angular/core';
import { BoschIconComponent } from '../../bosch-icon/bosch-icon/bosch-icon.component';

@Component({
  selector: 'app-bosch-button',
  standalone: true,
  imports: [BoschIconComponent],
  host: {
    class: 'bosch-button-host',
    '[class.bosch-button-host--block]': 'block()'
  },
  template: `
    <button
      [attr.type]="type()"
      class="bosch-button"
      [class.bosch-button--primary]="variant() === 'primary'"
      [class.bosch-button--secondary]="variant() === 'secondary'"
      [class.bosch-button--danger]="variant() === 'danger'"
      [class.bosch-button--block]="block()"
      [disabled]="disabled()"
    >
      @if (icon()) {
        <app-bosch-icon [name]="icon()!" class="bosch-button__icon" />
      }
      <span class="bosch-button__label"><ng-content /></span>
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    :host.bosch-button-host--block {
      width: 100%;
    }

    .bosch-button {
      align-items: center;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 0;
      cursor: pointer;
      display: inline-flex;
      font: inherit;
      font-size: 0.92rem;
      font-weight: 700;
      gap: 0.5rem;
      justify-content: center;
      min-height: 2.5rem;
      padding: 0 1rem;
    }

    .bosch-button--block {
      width: 100%;
    }

    .bosch-button--primary {
      background: var(--bosch-accent);
      border-color: var(--bosch-accent);
      color: var(--bosch-on-accent);
    }

    .bosch-button--primary:hover:not(:disabled) {
      background: var(--bosch-accent-hover);
      border-color: var(--bosch-accent-hover);
    }

    .bosch-button--secondary {
      background: transparent;
      border-color: var(--bosch-accent);
      color: var(--bosch-accent);
    }

    .bosch-button--danger {
      background: transparent;
      border-color: var(--bosch-error);
      color: var(--bosch-error);
    }

    .bosch-button:disabled {
      cursor: not-allowed;
      opacity: 0.45;
    }

    .bosch-button__icon {
      display: inline-flex;
      flex: 0 0 1.1rem;
      height: 1.1rem;
      line-height: 0;
      width: 1.1rem;
    }

    ::ng-deep app-bosch-icon.bosch-button__icon .bosch-icon {
      height: 1.1rem;
      width: 1.1rem;
    }

    ::ng-deep app-bosch-icon.bosch-button__icon .bosch-icon__svg {
      height: 1.1rem;
      width: 1.1rem;
    }

    .bosch-button--primary ::ng-deep app-bosch-icon.bosch-button__icon .bosch-icon {
      color: var(--bosch-on-accent);
    }

    .bosch-button--secondary ::ng-deep app-bosch-icon.bosch-button__icon .bosch-icon {
      color: var(--bosch-accent);
    }

    .bosch-button--danger ::ng-deep app-bosch-icon.bosch-button__icon .bosch-icon {
      color: var(--bosch-error);
    }
  `
})
export class BoschButtonComponent {
  readonly variant = input<'primary' | 'secondary' | 'danger'>('primary');
  readonly icon = input<string>();
  readonly disabled = input(false);
  readonly type = input<'button' | 'submit'>('button');
  readonly block = input(false);
}
