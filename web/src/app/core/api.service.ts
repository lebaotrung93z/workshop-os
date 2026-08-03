import { Injectable, signal } from '@angular/core';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  orderBy,
  onSnapshot,
  writeBatch,
  type Unsubscribe
} from 'firebase/firestore';
import { Observable, Subject } from 'rxjs';
import { db } from './firebase';
import { SEED_TEMPLATES } from './seed-templates';
import { buildJoinUrl } from './join-url';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomId(): string {
  return crypto.randomUUID();
}

function randomToken(): string {
  return `${randomId()}${randomId()}`.replace(/-/g, '');
}

function randomCode(len = 6): string {
  let out = '';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return out;
}

function nowIso() {
  return new Date().toISOString();
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly hostToken = signal(localStorage.getItem('wos_host_token') || '');
  readonly joinToken = signal(localStorage.getItem('wos_join_token') || '');
  readonly sessionId = signal(localStorage.getItem('wos_session_id') || '');
  readonly participantId = signal(localStorage.getItem('wos_participant_id') || '');

  private events = new Subject<{ type: string; data: any }>();
  readonly events$ = this.events.asObservable();
  private unsubs: Unsubscribe[] = [];

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

  private async ensureTemplates(): Promise<void> {
    const snap = await getDocs(collection(db, 'templates'));
    const existingKeys = new Set(snap.docs.map((d) => d.data()['key']));
    const batch = writeBatch(db);
    let writes = 0;
    for (const t of SEED_TEMPLATES) {
      if (existingKeys.has(t.key)) continue;
      const id = randomId();
      batch.set(doc(db, 'templates', id), {
        key: t.key,
        name: t.name,
        description: t.description,
        steps: t.steps.map((s, i) => ({
          id: randomId(),
          stepOrder: i + 1,
          type: s.type,
          title: s.title,
          instructions: s.instructions,
          config: s.config,
          groups: (s.groups || []).map((g, gi) => ({
            id: randomId(),
            title: g.title,
            groupOrder: gi + 1
          })),
          timerSeconds: s.timerSeconds
        })),
        createdAt: nowIso()
      });
      writes++;
    }
    if (writes) await batch.commit();
  }

  listTemplates(): Observable<any[]> {
    return new Observable((sub) => {
      this.ensureTemplates()
        .then(() => getDocs(query(collection(db, 'templates'), orderBy('name'))))
        .then((snap) => {
          sub.next(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          sub.complete();
        })
        .catch((e) => sub.error(e));
    });
  }

  createTemplate(body: {
    name: string;
    description?: string;
    steps: Array<{
      type: string;
      title: string;
      instructions?: string;
      timerSeconds?: number | null;
      config?: Record<string, unknown>;
      groups?: Array<{ title: string }>;
    }>;
  }): Observable<any> {
    return new Observable((sub) => {
      const id = randomId();
      const payload = {
        key: `custom-${id.slice(0, 8)}`,
        name: body.name,
        description: body.description || 'Custom format',
        steps: body.steps.map((s, i) => ({
          id: randomId(),
          stepOrder: i + 1,
          type: s.type,
          title: s.title,
          instructions: s.instructions || '',
          config: s.config || {},
          groups: (s.groups || []).map((g, gi) => ({
            id: randomId(),
            title: g.title,
            groupOrder: gi + 1
          })),
          timerSeconds: s.timerSeconds ?? null
        })),
        createdAt: nowIso()
      };
      setDoc(doc(db, 'templates', id), payload)
        .then(() => {
          sub.next({ id, ...payload });
          sub.complete();
        })
        .catch((e) => sub.error(e));
    });
  }

  createSession(templateId: string, title?: string): Observable<any> {
    return new Observable((sub) => {
      (async () => {
        const tplSnap = await getDoc(doc(db, 'templates', templateId));
        if (!tplSnap.exists()) throw new Error('Template not found');
        const tpl = tplSnap.data() as any;
        const hostToken = randomToken();
        let code = randomCode();
        for (let i = 0; i < 8; i++) {
          const existing = await getDoc(doc(db, 'sessionCodes', code));
          if (!existing.exists()) break;
          code = randomCode();
        }
        const sessionId = randomId();
        const steps = (tpl.steps || []).map((s: any, i: number) => ({
          id: randomId(),
          stepOrder: s.stepOrder || i + 1,
          type: s.type,
          title: s.title,
          instructions: s.instructions || '',
          config: typeof s.config === 'string' ? JSON.parse(s.config || '{}') : s.config || {},
          groups: (s.groups || []).map((g: any, gi: number) => ({
            id: g.id || randomId(),
            title: g.title,
            groupOrder: g.groupOrder || gi + 1
          })),
          status: 'PENDING',
          timerSeconds: s.timerSeconds ?? null
        }));
        const currentStepId = steps[0]?.id || null;
        const session = {
          code,
          title: title?.trim() || tpl.name,
          status: 'LOBBY',
          hostToken,
          hostUid: hostToken.slice(0, 32),
          templateId,
          currentStepId,
          participantCount: 0,
          steps,
          createdAt: nowIso()
        };
        await setDoc(doc(db, 'sessions', sessionId), session);
        await setDoc(doc(db, 'sessionCodes', code), { sessionId });
        return { id: sessionId, ...session, hostToken };
      })()
        .then((s) => {
          sub.next(s);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Create failed' } }));
    });
  }

  getHostSession(id: string): Observable<any> {
    return this.getSession(id);
  }

  getByCode(code: string): Observable<any> {
    return new Observable((sub) => {
      getDoc(doc(db, 'sessionCodes', code.toUpperCase()))
        .then(async (ref) => {
          if (!ref.exists()) throw new Error('Session not found');
          const sessionId = ref.data()!['sessionId'] as string;
          const s = await getDoc(doc(db, 'sessions', sessionId));
          if (!s.exists()) throw new Error('Session not found');
          sub.next({ id: s.id, ...s.data() });
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Not found' } }));
    });
  }

  getDisplay(id: string): Observable<any> {
    return this.getSession(id);
  }

  private getSession(id: string): Observable<any> {
    return new Observable((sub) => {
      getDoc(doc(db, 'sessions', id))
        .then((s) => {
          if (!s.exists()) throw new Error('Session not found');
          const data = s.data()!;
          const currentStep = (data['steps'] || []).find((st: any) => st.id === data['currentStepId']) || null;
          sub.next({ id: s.id, ...data, currentStep });
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Not found' } }));
    });
  }

  join(code: string, displayName: string): Observable<any> {
    return new Observable((sub) => {
      (async () => {
        const codeSnap = await getDoc(doc(db, 'sessionCodes', code.toUpperCase()));
        if (!codeSnap.exists()) throw new Error('Invalid session code');
        const sessionId = codeSnap.data()!['sessionId'] as string;
        const sessionRef = doc(db, 'sessions', sessionId);
        const sessionSnap = await getDoc(sessionRef);
        if (!sessionSnap.exists()) throw new Error('Session not found');
        const participantId = randomId();
        const joinToken = randomToken();
        await setDoc(doc(db, 'sessions', sessionId, 'participants', participantId), {
          uid: participantId,
          displayName: displayName.trim(),
          joinToken,
          createdAt: nowIso()
        });
        const count = (sessionSnap.data()!['participantCount'] || 0) + 1;
        await updateDoc(sessionRef, { participantCount: count });
        return { sessionId, participantId, joinToken };
      })()
        .then((r) => {
          sub.next(r);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Join failed' } }));
    });
  }

  private async hostUpdate(sessionId: string, patch: Record<string, unknown>) {
    const hostToken = this.hostToken();
    if (!hostToken) throw new Error('Missing host token');
    await updateDoc(doc(db, 'sessions', sessionId), { ...patch, hostToken });
  }

  start(id: string): Observable<any> {
    return new Observable((sub) => {
      (async () => {
        const s = await getDoc(doc(db, 'sessions', id));
        if (!s.exists()) throw new Error('Session not found');
        const data = s.data()!;
        const steps = [...(data['steps'] || [])];
        if (steps[0]) steps[0] = { ...steps[0], status: 'ACTIVE' };
        const status = steps[0]?.type === 'welcome' ? 'WELCOME' : 'RUNNING';
        await this.hostUpdate(id, { status, steps, currentStepId: steps[0]?.id || null });
        return this.snapSession(id);
      })()
        .then((s) => {
          sub.next(s);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Start failed' } }));
    });
  }

  advance(id: string): Observable<any> {
    return this.moveStep(id, 1);
  }

  back(id: string): Observable<any> {
    return this.moveStep(id, -1);
  }

  private moveStep(id: string, delta: number): Observable<any> {
    return new Observable((sub) => {
      (async () => {
        const s = await getDoc(doc(db, 'sessions', id));
        if (!s.exists()) throw new Error('Session not found');
        const data = s.data()!;
        const steps = [...(data['steps'] || [])].sort((a: any, b: any) => a.stepOrder - b.stepOrder);
        const idx = steps.findIndex((st: any) => st.id === data['currentStepId']);
        const next = idx + delta;
        if (next < 0 || next >= steps.length) return this.snapSession(id);
        const updated = steps.map((st: any, i: number) => ({
          ...st,
          status: i === next ? 'ACTIVE' : i < next ? 'DONE' : 'PENDING'
        }));
        const cur = updated[next];
        let status = 'RUNNING';
        if (cur.type === 'welcome') status = 'WELCOME';
        if (cur.type === 'form') status = 'ACTIONS';
        await this.hostUpdate(id, { steps: updated, currentStepId: cur.id, status });
        return this.snapSession(id);
      })()
        .then((s) => {
          sub.next(s);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Failed' } }));
    });
  }

  end(id: string): Observable<any> {
    return new Observable((sub) => {
      this.hostUpdate(id, { status: 'CLOSED' })
        .then(() => this.snapSession(id))
        .then((s) => {
          sub.next(s);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'End failed' } }));
    });
  }

  private async snapSession(id: string): Promise<any> {
    const s = await getDoc(doc(db, 'sessions', id));
    const data = s.data() as any;
    const currentStep = (data['steps'] || []).find((st: any) => st.id === data['currentStepId']) || null;
    return { id: s.id, ...data, currentStep };
  }

  listEntries(id: string, stepId?: string): Observable<any[]> {
    return new Observable((sub) => {
      let qy = query(collection(db, 'sessions', id, 'entries'), orderBy('createdAt'));
      getDocs(qy)
        .then((snap) => {
          let rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          rows = rows.filter((r: any) => !r.hidden);
          if (stepId) rows = rows.filter((r: any) => r.stepId === stepId);
          sub.next(rows);
          sub.complete();
        })
        .catch((e) => sub.error(e));
    });
  }

  submitEntry(
    id: string,
    contentOrBody: string | { stepId: string; groupId?: string; content: string },
    groupId?: string
  ): Observable<any> {
    return new Observable((sub) => {
      (async () => {
        const session = await getDoc(doc(db, 'sessions', id));
        const currentStepId = session.data()?.['currentStepId'] as string;
        let body: { stepId: string; groupId?: string; content: string };
        if (typeof contentOrBody === 'string') {
          body = { stepId: currentStepId, content: contentOrBody, groupId };
        } else {
          body = contentOrBody;
        }
        const participantId = this.participantId();
        const joinToken = this.joinToken();
        const entryId = randomId();
        await setDoc(doc(db, 'sessions', id, 'entries', entryId), {
          stepId: body.stepId,
          groupId: body.groupId || null,
          content: body.content,
          participantId,
          joinToken,
          authorUid: participantId,
          hidden: false,
          createdAt: nowIso()
        });
        return { id: entryId };
      })()
        .then((r) => {
          sub.next(r);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Submit failed' } }));
    });
  }

  hideEntry(id: string, entryId: string): Observable<any> {
    return new Observable((sub) => {
      updateDoc(doc(db, 'sessions', id, 'entries', entryId), {
        hidden: true,
        hostToken: this.hostToken()
      })
        .then(() => {
          sub.next({ ok: true });
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Hide failed' } }));
    });
  }

  castVote(id: string, entryIdOrBody: string | { stepId: string; entryId: string }): Observable<any> {
    return new Observable((sub) => {
      (async () => {
        const participantId = this.participantId();
        const joinToken = this.joinToken();
        const session = await getDoc(doc(db, 'sessions', id));
        const stepId =
          typeof entryIdOrBody === 'string'
            ? (session.data()?.['currentStepId'] as string)
            : entryIdOrBody.stepId;
        const entryId = typeof entryIdOrBody === 'string' ? entryIdOrBody : entryIdOrBody.entryId;
        const step = (session.data()?.['steps'] || []).find((s: any) => s.id === stepId);
        const budget = Number(step?.config?.votesPerParticipant || 3);
        const votesSnap = await getDocs(collection(db, 'sessions', id, 'votes'));
        const mine = votesSnap.docs.filter(
          (d) => d.data()['participantId'] === participantId && d.data()['stepId'] === stepId
        );
        if (mine.length >= budget) throw new Error('No votes remaining');
        const voteId = `${entryId}_${participantId}`;
        await setDoc(doc(db, 'sessions', id, 'votes', voteId), {
          stepId,
          entryId,
          participantId,
          joinToken,
          createdAt: nowIso()
        });
        return { votesRemaining: budget - mine.length - 1 };
      })()
        .then((r) => {
          sub.next(r);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Vote failed' } }));
    });
  }

  tallyVotes(id: string, stepId?: string): Observable<any[]> {
    return new Observable((sub) => {
      getDocs(collection(db, 'sessions', id, 'votes'))
        .then(async (votesSnap) => {
          const entriesSnap = await getDocs(collection(db, 'sessions', id, 'entries'));
          const entries = new Map(entriesSnap.docs.map((d) => [d.id, d.data()]));
          const tallies = new Map<string, { entryId: string; content: string; votes: number }>();
          for (const v of votesSnap.docs) {
            const data = v.data();
            if (stepId && data['stepId'] !== stepId) continue;
            const entryId = data['entryId'];
            const entry = entries.get(entryId);
            if (!entry || entry['hidden']) continue;
            const cur = tallies.get(entryId) || { entryId, content: entry['content'], votes: 0 };
            cur.votes += 1;
            tallies.set(entryId, cur);
          }
          sub.next([...tallies.values()].sort((a, b) => b.votes - a.votes));
          sub.complete();
        })
        .catch((e) => sub.error(e));
    });
  }

  pollTally(id: string, stepId?: string): Observable<any[]> {
    return new Observable((sub) => {
      this.listEntries(id, stepId).subscribe({
        next: async (entries) => {
          const session = await getDoc(doc(db, 'sessions', id));
          const step = (session.data()?.['steps'] || []).find((s: any) => s.id === stepId) || session.data()?.['steps']?.find((s: any) => s.type === 'poll');
          const options = step?.config?.options || [];
          const counts = new Map<string, number>();
          for (const e of entries) counts.set(e.content, (counts.get(e.content) || 0) + 1);
          sub.next(
            options.map((o: any) => ({
              id: o.id,
              label: o.label,
              count: counts.get(o.id) || 0
            }))
          );
          sub.complete();
        },
        error: (e) => sub.error(e)
      });
    });
  }

  listActions(id: string): Observable<any[]> {
    return new Observable((sub) => {
      getDocs(query(collection(db, 'sessions', id, 'actions'), orderBy('createdAt')))
        .then((snap) => {
          sub.next(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          sub.complete();
        })
        .catch((e) => sub.error(e));
    });
  }

  submitAction(id: string, body: { action: string; owner?: string; dueDate?: string }): Observable<any> {
    return new Observable((sub) => {
      const actionId = randomId();
      const payload: any = {
        action: body.action,
        owner: body.owner || '',
        dueDate: body.dueDate || '',
        createdAt: nowIso()
      };
      if (this.hostToken()) {
        payload.hostToken = this.hostToken();
        payload.createdBy = 'host';
      } else {
        payload.participantId = this.participantId();
        payload.joinToken = this.joinToken();
        payload.createdBy = this.participantId();
      }
      setDoc(doc(db, 'sessions', id, 'actions', actionId), payload)
        .then(() => {
          sub.next({ id: actionId, ...payload });
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Action failed' } }));
    });
  }

  generateSummary(id: string): Observable<any> {
    return new Observable((sub) => {
      (async () => {
        const entries = await getDocs(collection(db, 'sessions', id, 'entries'));
        const actions = await getDocs(collection(db, 'sessions', id, 'actions'));
        const votes = await getDocs(collection(db, 'sessions', id, 'votes'));
        const voteCounts = new Map<string, number>();
        votes.forEach((v) => {
          const entryId = v.data()['entryId'];
          voteCounts.set(entryId, (voteCounts.get(entryId) || 0) + 1);
        });
        const top = [...entries.docs]
          .filter((d) => !d.data()['hidden'])
          .map((d) => ({ id: d.id, content: d.data()['content'], votes: voteCounts.get(d.id) || 0 }))
          .sort((a, b) => b.votes - a.votes)
          .slice(0, 5);
        const insights = [
          `${entries.size} sticky notes captured across the workshop.`,
          top.length ? `Top themes: ${top.map((t) => t.content).join(' · ')}` : 'No voted items yet.',
          `${actions.size} action items recorded.`
        ];
        const suggestedActions = actions.docs.slice(0, 5).map((d) => ({
          title: d.data()['action'],
          owner: d.data()['owner'] || 'TBD',
          dueDate: d.data()['dueDate'] || ''
        }));
        const summary = {
          provider: 'heuristic',
          model: 'local',
          insights,
          suggestedActions,
          hostToken: this.hostToken(),
          createdAt: nowIso()
        };
        await setDoc(doc(db, 'sessions', id, 'summary', 'latest'), summary);
        return summary;
      })()
        .then((s) => {
          sub.next(s);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Summary failed' } }));
    });
  }

  getSummary(id: string): Observable<any> {
    return new Observable((sub) => {
      getDoc(doc(db, 'sessions', id, 'summary', 'latest'))
        .then((s) => {
          sub.next(s.exists() ? s.data() : null);
          sub.complete();
        })
        .catch((e) => sub.error(e));
    });
  }

  exportUrl(id: string, kind: 'xlsx' | 'pdf'): string {
    // Client-side export — return a marker consumed by host download helper
    return `client://${kind}/${id}`;
  }

  async exportCsv(id: string): Promise<Blob> {
    const session = await this.snapSession(id);
    const entries = await getDocs(collection(db, 'sessions', id, 'entries'));
    const actions = await getDocs(collection(db, 'sessions', id, 'actions'));
    const lines = ['Section,Field1,Field2,Field3'];
    const q = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    lines.push([q('Session'), q(session.title), q(session.code), q(session.status)].join(','));
    entries.forEach((d) => {
      const e = d.data();
      if (e['hidden']) return;
      lines.push([q('Entry'), q(e['content']), q(e['stepId']), q(e['groupId'])].join(','));
    });
    actions.forEach((d) => {
      const a = d.data();
      lines.push([q('Action'), q(a['action']), q(a['owner']), q(a['dueDate'])].join(','));
    });
    return new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  }

  async exportPdfText(id: string): Promise<Blob> {
    const session = await this.snapSession(id);
    const entries = await getDocs(collection(db, 'sessions', id, 'entries'));
    const actions = await getDocs(collection(db, 'sessions', id, 'actions'));
    const lines = [
      `Workshop OS Report`,
      `${session.title} (${session.code})`,
      '',
      'Entries:',
      ...entries.docs.filter((d) => !d.data()['hidden']).map((d) => `- ${d.data()['content']}`),
      '',
      'Actions:',
      ...actions.docs.map((d) => `- ${d.data()['action']} — ${d.data()['owner']} / ${d.data()['dueDate']}`)
    ];
    return new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  }

  connectRealtime(sessionId: string) {
    this.disconnectRealtime();
    this.unsubs.push(
      onSnapshot(doc(db, 'sessions', sessionId), (snap) => {
        if (!snap.exists()) return;
        const data = { id: snap.id, ...snap.data() } as any;
        data.currentStep = (data.steps || []).find((st: any) => st.id === data.currentStepId) || null;
        if (data.status === 'CLOSED') this.events.next({ type: 'session.ended', data });
        else this.events.next({ type: 'step.changed', data });
      })
    );
    this.unsubs.push(
      onSnapshot(collection(db, 'sessions', sessionId, 'entries'), () => {
        this.events.next({ type: 'entry.created', data: {} });
      })
    );
    this.unsubs.push(
      onSnapshot(collection(db, 'sessions', sessionId, 'votes'), () => {
        this.events.next({ type: 'vote.updated', data: {} });
      })
    );
    this.unsubs.push(
      onSnapshot(collection(db, 'sessions', sessionId, 'actions'), (snap) => {
        const last = snap.docs[snap.docs.length - 1];
        if (last) this.events.next({ type: 'action.created', data: { id: last.id, ...last.data() } });
      })
    );
    this.unsubs.push(
      onSnapshot(doc(db, 'sessions', sessionId, 'summary', 'latest'), (snap) => {
        if (snap.exists()) this.events.next({ type: 'summary.ready', data: snap.data() });
      })
    );
    this.unsubs.push(
      onSnapshot(collection(db, 'sessions', sessionId, 'participants'), () => {
        this.events.next({ type: 'participant.joined', data: {} });
      })
    );
  }

  disconnectRealtime() {
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
  }

  joinUrlFor(code: string) {
    return buildJoinUrl(location.origin, code);
  }
}
