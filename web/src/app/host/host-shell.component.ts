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
          <div class="brand__copy">
            <strong>Workshop OS</strong>
            <small>Host console</small>
          </div>
        </div>
        <nav>
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" title="Dashboard">
            <app-bosch-icon name="dashboard" />
            <span class="nav-label">Dashboard</span>
          </a>
          <a routerLink="/host" routerLinkActive="active" title="Sessions">
            <app-bosch-icon name="user" />
            <span class="nav-label">Sessions</span>
          </a>
          <a routerLink="/host/format" routerLinkActive="active" title="Templates">
            <app-bosch-icon name="edit" />
            <span class="nav-label">Templates</span>
          </a>
          <a class="disabled" aria-disabled="true" title="Reports">
            <app-bosch-icon name="download" />
            <span class="nav-label">Reports</span>
          </a>
          <a class="disabled" aria-disabled="true" title="Settings">
            <app-bosch-icon name="settings" />
            <span class="nav-label">Settings</span>
          </a>
        </nav>
        <a class="join-link" routerLink="/j">
          <span class="nav-label">Join as participant</span>
          <span class="join-link__short">Join</span>
        </a>
      </aside>
      <main class="main">
        <ng-content />
      </main>
    </div>
  `,
  styles: `
    .shell {
      display: grid;
      grid-template-columns: var(--wos-sidebar-width) minmax(0, 1fr);
      min-height: 100vh;
    }

    .sidebar {
      background: var(--wos-sidebar);
      color: var(--wos-sidebar-text);
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      height: 100vh;
      overflow-x: hidden;
      overflow-y: auto;
      padding: 1.25rem 0.9rem;
      position: sticky;
      top: 0;
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
      flex: 0 0 auto;
      font-weight: 800;
      height: 2.25rem;
      justify-content: center;
      width: 2.25rem;
    }

    .brand__copy strong {
      color: #fff;
      display: block;
      font-size: 0.95rem;
    }

    .brand__copy small {
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
      white-space: nowrap;
    }

    nav a:hover {
      background: rgba(255, 255, 255, 0.06);
      color: #fff;
    }

    nav a.active {
      background: var(--wos-sidebar-active);
      box-shadow: inset 3px 0 0 var(--wos-primary);
      color: #fff;
    }

    nav a.disabled {
      cursor: default;
      opacity: 0.45;
      pointer-events: none;
    }

    .join-link {
      align-items: center;
      color: #93c5fd;
      display: flex;
      font-size: 0.85rem;
      font-weight: 600;
      margin-top: auto;
      padding: 0.75rem;
      text-decoration: none;
    }

    .join-link__short { display: none; }

    .main {
      background: var(--wos-bg);
      min-width: 0;
      padding: 1.25rem 1.5rem 2rem;
    }

    /* Laptop / large tablet: compact icon rail keeps content wide */
    @media (max-width: 1024px) and (min-width: 769px) {
      .shell {
        grid-template-columns: var(--wos-sidebar-rail) minmax(0, 1fr);
      }

      .sidebar {
        align-items: center;
        gap: 0.85rem;
        padding: 1rem 0.55rem;
      }

      .brand {
        justify-content: center;
        padding: 0.25rem 0 0.5rem;
      }

      .brand__copy,
      .nav-label {
        display: none;
      }

      nav {
        width: 100%;
      }

      nav a {
        justify-content: center;
        padding: 0.75rem 0.4rem;
      }

      .join-link {
        justify-content: center;
        padding: 0.55rem 0.35rem;
      }

      .join-link__short {
        display: inline;
        font-size: 0.72rem;
      }

      .main {
        padding: 1rem 1.15rem 1.75rem;
      }
    }

    /* Narrow tablet / small screens: sticky top chrome */
    @media (max-width: 768px) {
      .shell {
        grid-template-columns: 1fr;
      }

      .sidebar {
        flex-direction: row;
        flex-wrap: nowrap;
        gap: 0.5rem;
        height: auto;
        overflow-x: auto;
        padding: 0.65rem 0.75rem;
        position: sticky;
        top: 0;
        z-index: 20;
      }

      .brand {
        flex: 0 0 auto;
        padding: 0;
      }

      .brand__copy {
        display: none;
      }

      nav {
        display: flex;
        flex: 1 1 auto;
        flex-wrap: nowrap;
        gap: 0.2rem;
        min-width: 0;
        overflow-x: auto;
      }

      nav a {
        flex: 0 0 auto;
        padding: 0.55rem 0.65rem;
      }

      .join-link {
        flex: 0 0 auto;
        margin-top: 0;
        padding: 0.55rem 0.65rem;
      }

      .join-link__short {
        display: none;
      }

      .main {
        padding: 1rem 0.9rem 1.5rem;
      }
    }

    @media (min-width: 1280px) {
      .main {
        padding: 1.35rem 1.75rem 2.25rem;
      }
    }
  `
})
export class HostShellComponent {
  @Input() active = 'dashboard';
}
