import { Component, computed, input } from '@angular/core';
import { avatarToneFromName, initialsFromName } from './avatar.util';

/**
 * Bosch avatar: photo when provided, otherwise 2-letter initials from the name.
 */
@Component({
  selector: 'app-bosch-avatar',
  standalone: true,
  template: `
    <span
      class="bosch-avatar"
      [class.bosch-avatar--sm]="size() === 'sm'"
      [class.bosch-avatar--md]="size() === 'md'"
      [class.bosch-avatar--lg]="size() === 'lg'"
      [class.bosch-avatar--xl]="size() === 'xl'"
      [style.background]="photoUrl() ? 'transparent' : tone()"
      [attr.title]="name() || 'Participant'"
      [attr.aria-label]="name() || 'Participant'"
    >
      @if (photoUrl()) {
        <img [src]="photoUrl()!" [alt]="name() || ''" />
      } @else {
        <span class="bosch-avatar__initials">{{ initials() }}</span>
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-shrink: 0;
      line-height: 0;
    }

    .bosch-avatar {
      align-items: center;
      border: 2px solid var(--bosch-surface);
      border-radius: 50%;
      box-sizing: border-box;
      color: var(--bosch-on-accent);
      display: inline-flex;
      font-weight: 700;
      justify-content: center;
      letter-spacing: 0.02em;
      overflow: hidden;
      text-transform: uppercase;
      user-select: none;
    }

    .bosch-avatar--sm {
      font-size: 0.65rem;
      height: 1.75rem;
      width: 1.75rem;
    }

    .bosch-avatar--md {
      font-size: 0.8rem;
      height: 2.25rem;
      width: 2.25rem;
    }

    .bosch-avatar--lg {
      font-size: 1rem;
      height: 3rem;
      width: 3rem;
    }

    .bosch-avatar--xl {
      font-size: 1.35rem;
      height: 4rem;
      width: 4rem;
    }

    .bosch-avatar img {
      height: 100%;
      object-fit: cover;
      width: 100%;
    }

    .bosch-avatar__initials {
      line-height: 1;
    }
  `
})
export class BoschAvatarComponent {
  readonly name = input<string>('');
  readonly photoUrl = input<string | undefined>(undefined);
  readonly size = input<'sm' | 'md' | 'lg' | 'xl'>('md');

  readonly initials = computed(() => initialsFromName(this.name()));
  readonly tone = computed(() => avatarToneFromName(this.name()));
}
