import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-bosch-icon',
  standalone: true,
  imports: [],
  template: `
    <span class="bosch-icon" [class.bosch-icon--star]="isStarIcon()" aria-hidden="true">
      @if (iconHtml(); as html) {
        <span class="bosch-icon__svg" [innerHTML]="html"></span>
      }
    </span>
  `,
  styles: `
    .bosch-icon {
      align-items: center;
      background: transparent;
      color: currentColor;
      display: inline-flex;
      font-size: 0.75rem;
      font-weight: 700;
      height: 1.75rem;
      justify-content: center;
      letter-spacing: 0.02em;
      line-height: 1;
      width: 1.75rem;
    }

    .bosch-icon--star {
      color: var(--bosch-star);
    }

    .bosch-icon__svg {
      align-items: center;
      display: inline-flex;
      height: 1rem;
      justify-content: center;
      width: 1rem;
    }

    .bosch-icon__svg ::ng-deep svg {
      display: block;
      fill: currentColor;
      height: 100%;
      width: 100%;
    }

    .bosch-icon__svg ::ng-deep path {
      fill: currentColor;
    }
  `
})
export class BoschIconComponent {
  readonly name = input.required<string>();

  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);

  private static readonly iconFiles: Record<string, string> = {
    user: 'user',
    edit: 'edit',
    delete: 'recycle-bin',
    download: 'download',
    export: 'export',
    search: 'search',
    close: 'close',
    save: 'save',
    settings: 'settings',
    add: 'add',
    plus: 'add',
    copy: 'copy',
    feedback: 'livechat-help',
    star: 'favorites',
    'chevron-left': 'arrow-left',
    'chevron-right': 'arrow-right',
    'chevron-down': 'down',
    dashboard: 'desktop-dashboard',
    welcome: 'qr-code',
    poll: 'poll',
    input: 'sticky-note',
    voting: 'favorites',
    form: 'checklist',
    breakout: 'user',
    'qr-code': 'qr-code',
    'sticky-note': 'sticky-note',
    checklist: 'checklist'
  };

  private static readonly starIconNames = new Set(['star', 'voting']);
  private static readonly cache = new Map<string, SafeHtml>();

  protected readonly iconHtml = signal<SafeHtml | null>(null);
  protected readonly isStarIcon = computed(() => BoschIconComponent.starIconNames.has(this.name()));
  private readonly fileName = computed(() => BoschIconComponent.iconFiles[this.name()] ?? this.name());

  constructor() {
    effect(
      () => {
        const file = this.fileName();
        if (!file) {
          this.iconHtml.set(null);
          return;
        }

        const cached = BoschIconComponent.cache.get(file);
        if (cached) {
          this.iconHtml.set(cached);
          return;
        }

        this.http
          .get(`asset/bosch-icons/${file}.svg`, { responseType: 'text' })
          .pipe(catchError(() => of('')))
          .subscribe((raw) => {
            if (!raw) {
              this.iconHtml.set(null);
              return;
            }
            const safe = this.sanitizer.bypassSecurityTrustHtml(this.normalize(raw));
            BoschIconComponent.cache.set(file, safe);
            this.iconHtml.set(safe);
          });
      },
      { allowSignalWrites: true }
    );
  }

  private normalize(raw: string): string {
    return raw
      .replace(/<\?xml[^>]*\?>/g, '')
      .replace(/\sstyle="[^"]*"/g, '')
      .replace(/\sfill="[^"]*"/g, ' fill="currentColor"')
      .trim();
  }
}
