import { Component, computed, input } from '@angular/core';
import { BoschAvatarComponent } from './bosch-avatar.component';

export interface AvatarPerson {
  id?: string;
  displayName: string;
  photoUrl?: string;
}

/** Overlapping avatar row with “+N” overflow, matching the hybrid workshop mockup. */
@Component({
  selector: 'app-bosch-avatar-stack',
  standalone: true,
  imports: [BoschAvatarComponent],
  template: `
    <div class="stack" [attr.aria-label]="label()">
      @for (p of visible(); track p.id || p.displayName; let i = $index) {
        <app-bosch-avatar
          class="stack__item"
          [style.z-index]="visible().length - i"
          [name]="p.displayName"
          [photoUrl]="p.photoUrl"
          [size]="size()"
        />
      }
      @if (overflow() > 0) {
        <span class="stack__more" [class.stack__more--sm]="size() === 'sm'" [class.stack__more--lg]="size() === 'lg'">
          +{{ overflow() }}
        </span>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    .stack {
      align-items: center;
      display: inline-flex;
    }

    .stack__item {
      margin-left: -0.45rem;
    }

    .stack__item:first-child {
      margin-left: 0;
    }

    .stack__more {
      align-items: center;
      background: var(--bosch-gray-85);
      border: 2px solid var(--bosch-surface);
      border-radius: 50%;
      color: var(--bosch-text);
      display: inline-flex;
      font-size: 0.72rem;
      font-weight: 700;
      height: 2.25rem;
      justify-content: center;
      margin-left: -0.45rem;
      min-width: 2.25rem;
      padding: 0 0.35rem;
    }

    .stack__more--sm {
      font-size: 0.6rem;
      height: 1.75rem;
      min-width: 1.75rem;
    }

    .stack__more--lg {
      font-size: 0.85rem;
      height: 3rem;
      min-width: 3rem;
    }
  `
})
export class BoschAvatarStackComponent {
  readonly people = input<AvatarPerson[]>([]);
  readonly max = input(7);
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly label = input('Participants');

  readonly visible = computed(() => this.people().slice(0, this.max()));
  readonly overflow = computed(() => Math.max(0, this.people().length - this.max()));
}
