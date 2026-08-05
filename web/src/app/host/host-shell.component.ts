import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { BoschIconComponent } from '../bosch-icon/bosch-icon/bosch-icon.component';

@Component({
  selector: 'app-host-shell',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, BoschIconComponent],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand__mark">W</span>
          <div>
            <strong>Workshop OS</strong>
            <small>Host console</small>
          </div>
        </div>
        <nav>
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
            <app-bosch-icon name="dashboard" />
            Dashboard
          </a>
          <a routerLink="/host" routerLinkActive="active">
            <app-bosch-icon name="user" />
            Sessions
          </a>
          <a routerLink="/host/format" routerLinkActive="active">
            <app-bosch-icon name="edit" />
            Templates
          </a>
          <a class="disabled" aria-disabled="true">
            <app-bosch-icon name="download" />
            Reports
          </a>
          <a class="disabled" aria-disabled="true">
            <app-bosch-icon name="settings" />
            Settings
          </a>
        </nav>
        <a class="join-link" routerLink="/j">Join as participant</a>
      </aside>
      <main class="main">
        <ng-content />
      </main>
    </div>
  `,
  styles: `
    .shell {
      display: grid;
      grid-template-columns: 232px 1fr;
      min-height: 100vh;
    }

    .sidebar {
      background: var(--wos-sidebar);
      color: var(--wos-sidebar-text);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      padding: 1.25rem 0.9rem;
    }

    .brand {
      align-items: center;
      display: flex;
      gap: 0.75rem;
      padding: 0.35rem 0.55rem 0.85rem;
    }

    .brand__mark {
      align-items: center;
      background: var(--wos-primary);
      border-radius: 10px;
      color: #fff;
      display: inline-flex;
      font-weight: 800;
      height: 2.25rem;
      justify-content: center;
      width: 2.25rem;
    }

    .brand strong {
      color: #fff;
      display: block;
      font-size: 0.95rem;
    }

    .brand small {
      color: #94a3b8;
      font-size: 0.75rem;
    }

    nav {
      display: grid;
      gap: 0.25rem;
    }

    nav a {
      align-items: center;
      border-radius: var(--wos-radius);
      color: inherit;
      display: flex;
      font-size: 0.92rem;
      font-weight: 600;
      gap: 0.65rem;
      padding: 0.7rem 0.75rem;
      text-decoration: none;
    }

    nav a:hover {
      background: rgba(255, 255, 255, 0.06);
      color: #fff;
    }

    nav a.active {
      background: var(--wos-sidebar-active);
      color: #fff;
      box-shadow: inset 3px 0 0 var(--wos-primary);
    }

    nav a.disabled {
      cursor: default;
      opacity: 0.45;
      pointer-events: none;
    }

    .join-link {
      color: #93c5fd;
      font-size: 0.85rem;
      font-weight: 600;
      margin-top: auto;
      padding: 0.75rem;
      text-decoration: none;
    }

    .main {
      background: var(--wos-bg);
      min-width: 0;
      padding: 1.25rem 1.5rem 2rem;
    }

    @media (max-width: 900px) {
      .shell {
        grid-template-columns: 1fr;
      }

      .sidebar {
        flex-direction: row;
        flex-wrap: wrap;
        gap: 0.5rem;
        padding: 0.75rem;
      }

      nav {
        display: flex;
        flex: 1;
        flex-wrap: wrap;
        gap: 0.25rem;
      }

      .join-link {
        margin-top: 0;
      }
    }
  `
})
export class HostShellComponent {
  @Input() active = 'dashboard';
}
