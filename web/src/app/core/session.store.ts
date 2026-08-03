import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  readonly session = signal<any | null>(null);
  readonly entries = signal<any[]>([]);
  readonly pollTally = signal<any[]>([]);
  readonly voteTally = signal<any[]>([]);
  readonly actions = signal<any[]>([]);
  readonly summary = signal<any | null>(null);

  patchSession(session: any) {
    this.session.set(session);
  }
}
