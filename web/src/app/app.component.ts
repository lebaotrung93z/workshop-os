import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { readJoinCodeFromLocation } from './core/join-url';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  styles: ``
})
export class AppComponent implements OnInit {
  private router = inject(Router);

  ngOnInit() {
    // QR encodes /?code=ABC — route into the hash join page after the SPA boots.
    const code = readJoinCodeFromLocation();
    if (!code) return;

    const onJoinAlready =
      (location.hash || '').startsWith('#/j') || (location.hash || '').startsWith('#/p/');
    if (onJoinAlready) return;

    void this.router.navigate(['/j'], {
      queryParams: { code },
      replaceUrl: true
    });
  }
}
