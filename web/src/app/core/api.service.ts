import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly hostToken = signal(localStorage.getItem('wos_host_token') || '');
  readonly joinToken = signal(localStorage.getItem('wos_join_token') || '');
  readonly sessionId = signal(localStorage.getItem('wos_session_id') || '');
  readonly participantId = signal(localStorage.getItem('wos_participant_id') || '');

  constructor(private http: HttpClient) {}

  setHostSession(sessionId: string, hostToken: string) {
    localStorage.setItem('wos_session_id', sessionId);
    localStorage.setItem('wos_host_token', hostToken);
    this.sessionId.set(sessionId);
    this.hostToken.set(hostToken);
  }

  setParticipant(sessionId: string, participantId: string, joinToken: string) {
    localStorage.setItem('wos_session_id', sessionId);
    localStorage.setItem('wos_participant_id', participantId);
    localStorage.setItem('wos_join_token', joinToken);
    this.sessionId.set(sessionId);
    this.participantId.set(participantId);
    this.joinToken.set(joinToken);
  }

  private hostHeaders() {
    return new HttpHeaders({ 'X-Host-Token': this.hostToken() });
  }

  private joinHeaders() {
    return new HttpHeaders({ 'X-Join-Token': this.joinToken() });
  }

  listTemplates(): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/templates`);
  }

  createSession(templateId: string, title?: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/sessions`, { templateId, title });
  }

  getHostSession(id: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/sessions/${id}`, { headers: this.hostHeaders() });
  }

  getByCode(code: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/sessions/by-code/${code}`);
  }

  getDisplay(id: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/sessions/${id}/display`);
  }

  join(code: string, displayName: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/sessions/${code}/join`, { displayName });
  }

  start(id: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/sessions/${id}/start`, {}, { headers: this.hostHeaders() });
  }

  advance(id: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/sessions/${id}/advance`, {}, { headers: this.hostHeaders() });
  }

  back(id: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/sessions/${id}/back`, {}, { headers: this.hostHeaders() });
  }

  end(id: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/sessions/${id}/end`, {}, { headers: this.hostHeaders() });
  }

  listEntries(id: string, stepId?: string): Observable<any[]> {
    const q = stepId ? `?stepId=${stepId}` : '';
    return this.http.get<any[]>(`${environment.apiUrl}/sessions/${id}/entries${q}`);
  }

  submitEntry(id: string, content: string, groupId?: string): Observable<any> {
    return this.http.post(
      `${environment.apiUrl}/sessions/${id}/entries`,
      { content, groupId },
      { headers: this.joinHeaders() }
    );
  }

  hideEntry(id: string, entryId: string): Observable<any> {
    return this.http.delete(`${environment.apiUrl}/sessions/${id}/entries/${entryId}`, {
      headers: this.hostHeaders()
    });
  }

  castVote(id: string, entryId: string): Observable<any> {
    return this.http.post(
      `${environment.apiUrl}/sessions/${id}/votes`,
      { entryId },
      { headers: this.joinHeaders() }
    );
  }

  tallyVotes(id: string, stepId?: string): Observable<any[]> {
    const q = stepId ? `?stepId=${stepId}` : '';
    return this.http.get<any[]>(`${environment.apiUrl}/sessions/${id}/votes/tally${q}`);
  }

  pollTally(id: string, stepId?: string): Observable<any[]> {
    const q = stepId ? `?stepId=${stepId}` : '';
    return this.http.get<any[]>(`${environment.apiUrl}/sessions/${id}/poll/tally${q}`);
  }

  listActions(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${environment.apiUrl}/sessions/${id}/actions`);
  }

  submitAction(id: string, body: { action: string; owner?: string; dueDate?: string }, asHost = false): Observable<any> {
    const headers = asHost ? this.hostHeaders() : this.joinHeaders();
    return this.http.post(`${environment.apiUrl}/sessions/${id}/actions`, body, { headers });
  }

  generateSummary(id: string): Observable<any> {
    return this.http.post(`${environment.apiUrl}/sessions/${id}/summary`, {}, { headers: this.hostHeaders() });
  }

  getSummary(id: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/sessions/${id}/summary`);
  }

  exportUrl(id: string, kind: 'xlsx' | 'pdf'): string {
    return `${environment.apiUrl}/sessions/${id}/export.${kind}`;
  }
}
