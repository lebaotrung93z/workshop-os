import { Injectable, OnDestroy } from '@angular/core';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class RealtimeService implements OnDestroy {
  private client?: Client;
  readonly events$ = new Subject<{ type: string; data: any }>();

  connect(sessionId: string) {
    this.disconnect();
    this.client = new Client({
      webSocketFactory: () => new SockJS(environment.wsUrl) as any,
      reconnectDelay: 3000,
      onConnect: () => {
        this.client?.subscribe(`/topic/session/${sessionId}`, (msg: IMessage) => {
          try {
            const body = JSON.parse(msg.body);
            this.events$.next(body);
          } catch {
            /* ignore */
          }
        });
      }
    });
    this.client.activate();
  }

  disconnect() {
    this.client?.deactivate();
    this.client = undefined;
  }

  ngOnDestroy() {
    this.disconnect();
  }
}
