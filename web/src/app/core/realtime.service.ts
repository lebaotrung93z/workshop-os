import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private api = inject(ApiService);

  get events$(): Observable<{ type: string; data: any }> {
    return this.api.events$;
  }

  connect(sessionId: string) {
    this.api.connectRealtime(sessionId);
  }

  disconnect() {
    this.api.disconnectRealtime();
  }
}
