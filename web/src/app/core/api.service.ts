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
  type Unsubscribe
} from 'firebase/firestore';
import { Observable, Subject } from 'rxjs';
import { db } from './firebase';
import { SEED_TEMPLATES } from './seed-templates';
import { clearTimerPatch } from './timer.util';
import { buildJoinUrl } from './join-url';
import { okrInputStep } from './okr.util';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const HOST_SESSIONS_KEY = 'wos_host_sessions';

export interface HostSessionRef {
  id: string;
  hostToken: string;
  title: string;
  code: string;
  status: string;
  updatedAt: string;
}

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

/** Participant identity is per-tab (sessionStorage) so two joins in the same browser do not clobber each other. */
function readParticipantStore(key: string): string {
  try {
    return sessionStorage.getItem(key) || localStorage.getItem(key) || '';
  } catch {
    return localStorage.getItem(key) || '';
  }
}

function writeParticipantStore(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
    // Remove shared localStorage copy so another tab's join cannot clobber this identity.
    localStorage.removeItem(key);
  } catch {
    localStorage.setItem(key, value);
  }
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly hostToken = signal(localStorage.getItem('wos_host_token') || '');
  readonly joinToken = signal(readParticipantStore('wos_join_token'));
  readonly sessionId = signal(localStorage.getItem('wos_session_id') || '');
  readonly participantId = signal(readParticipantStore('wos_participant_id'));
  readonly displayName = signal(readParticipantStore('wos_display_name'));

  private events = new Subject<{ type: string; data: any }>();
  readonly events$ = this.events.asObservable();
  private unsubs: Unsubscribe[] = [];

  setHostSession(sessionId: string, hostToken: string, meta?: Partial<HostSessionRef>) {
    localStorage.setItem('wos_session_id', sessionId);
    localStorage.setItem('wos_host_token', hostToken);
    this.sessionId.set(sessionId);
    this.hostToken.set(hostToken);
    this.upsertHostSessionRef({
      id: sessionId,
      hostToken,
      title: meta?.title || '',
      code: meta?.code || '',
      status: meta?.status || 'LOBBY',
      updatedAt: nowIso()
    });
  }

  /** Local registry of workshops this browser has hosted (for resume / save for later). */
  listHostSessions(): HostSessionRef[] {
    try {
      const raw = localStorage.getItem(HOST_SESSIONS_KEY);
      const list = raw ? (JSON.parse(raw) as HostSessionRef[]) : [];
      return Array.isArray(list)
        ? [...list].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
        : [];
    } catch {
      return [];
    }
  }

  rememberHostSession(meta: Partial<HostSessionRef> & { id: string; hostToken: string }) {
    const prev = this.listHostSessions().find((s) => s.id === meta.id);
    // Metadata refresh must not replace a stored token with another session's global token.
    const hostToken = prev?.hostToken || meta.hostToken;
    this.upsertHostSessionRef({
      id: meta.id,
      hostToken,
      title: meta.title || '',
      code: meta.code || '',
      status: meta.status || 'LOBBY',
      updatedAt: nowIso()
    });
  }

  removeHostSession(sessionId: string) {
    const next = this.listHostSessions().filter((s) => s.id !== sessionId);
    localStorage.setItem(HOST_SESSIONS_KEY, JSON.stringify(next));
  }

  activateHostSession(sessionId: string): HostSessionRef | null {
    const found = this.listHostSessions().find((s) => s.id === sessionId);
    if (!found) return null;
    localStorage.setItem('wos_session_id', found.id);
    localStorage.setItem('wos_host_token', found.hostToken);
    this.sessionId.set(found.id);
    this.hostToken.set(found.hostToken);
    return found;
  }

  private upsertHostSessionRef(ref: HostSessionRef) {
    const prev = this.listHostSessions().find((s) => s.id === ref.id);
    const list = this.listHostSessions().filter((s) => s.id !== ref.id);
    list.unshift({
      id: ref.id,
      // Never blank out a known token; prefer explicit token from create/resume.
      hostToken: ref.hostToken || prev?.hostToken || '',
      title: ref.title || prev?.title || 'Workshop',
      code: ref.code || prev?.code || '',
      status: ref.status || prev?.status || 'LOBBY',
      updatedAt: ref.updatedAt || nowIso()
    });
    localStorage.setItem(HOST_SESSIONS_KEY, JSON.stringify(list.slice(0, 40)));
  }

  setParticipant(sessionId: string, participantId: string, joinToken: string, displayName = '') {
    localStorage.setItem('wos_session_id', sessionId);
    writeParticipantStore('wos_participant_id', participantId);
    writeParticipantStore('wos_join_token', joinToken);
    if (displayName) writeParticipantStore('wos_display_name', displayName);
    this.sessionId.set(sessionId);
    this.participantId.set(participantId);
    this.joinToken.set(joinToken);
    if (displayName) this.displayName.set(displayName);
  }

  private mapSeedSteps(t: (typeof SEED_TEMPLATES)[number]) {
    return t.steps.map((s, i) => ({
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
    }));
  }

  private async ensureTemplates(): Promise<void> {
    const seedRevision = 4; // bump when SEED_TEMPLATES structure changes
    const snap = await getDocs(collection(db, 'templates'));
    const byKey = new Map(snap.docs.map((d) => [d.data()['key'] as string, d]));

    // Creates and updates separately so a blocked update cannot prevent seeding a new template.
    for (const t of SEED_TEMPLATES) {
      const existing = byKey.get(t.key);
      if (!existing) {
        try {
          const id = randomId();
          await setDoc(doc(db, 'templates', id), {
            key: t.key,
            name: t.name,
            description: t.description,
            seedRevision,
            steps: this.mapSeedSteps(t),
            createdAt: nowIso()
          });
        } catch {
          // Ignore create failures (offline / rules); list still returns existing templates.
        }
        continue;
      }
      const data = existing.data();
      if ((data['seedRevision'] || 0) < seedRevision) {
        try {
          await updateDoc(doc(db, 'templates', existing.id), {
            name: t.name,
            description: t.description,
            seedRevision,
            steps: this.mapSeedSteps(t)
          });
        } catch {
          // Rules may still deny updates until firestore.rules are deployed.
        }
      }
    }
  }

  listTemplates(): Observable<any[]> {
    return new Observable((sub) => {
      this.ensureTemplates()
        .then(() => getDocs(query(collection(db, 'templates'), orderBy('name'))))
        .then((snap) => {
          const hidden = new Set(['probe', 'okr', 'okr-linked']);
          const byKey = new Map<string, any>();
          for (const d of snap.docs) {
            const row = { id: d.id, ...d.data() } as any;
            if (!row.key || hidden.has(row.key)) continue;
            const prev = byKey.get(row.key);
            if (!prev || (row.seedRevision || 0) >= (prev.seedRevision || 0)) {
              byKey.set(row.key, row);
            }
          }
          const list = [...byKey.values()].sort((a, b) =>
            String(a.name || '').localeCompare(String(b.name || ''))
          );
          sub.next(list);
          sub.complete();
        })
        .catch((e) => sub.error(e));
    });
  }

  getTemplate(id: string): Observable<any> {
    return new Observable((sub) => {
      getDoc(doc(db, 'templates', id))
        .then((snap) => {
          if (!snap.exists()) throw new Error('Template not found');
          sub.next({ id: snap.id, ...snap.data() });
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Failed to load template' } }));
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
          treeRootLabel: '',
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

  listParticipants(id: string): Observable<{ id: string; displayName: string; createdAt?: string }[]> {
    return new Observable((sub) => {
      getDocs(query(collection(db, 'sessions', id, 'participants'), orderBy('createdAt')))
        .then((snap) => {
          sub.next(
            snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                displayName: (data['displayName'] as string) || 'Participant',
                createdAt: data['createdAt'] as string | undefined
              };
            })
          );
          sub.complete();
        })
        .catch(async () => {
          // Fallback without orderBy if index missing
          try {
            const snap = await getDocs(collection(db, 'sessions', id, 'participants'));
            sub.next(
              snap.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  displayName: (data['displayName'] as string) || 'Participant',
                  createdAt: data['createdAt'] as string | undefined
                };
              })
            );
            sub.complete();
          } catch (e: any) {
            sub.error({ error: { message: e?.message || 'Failed to list participants' } });
          }
        });
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
        return {
          sessionId,
          participantId,
          joinToken,
          displayName: displayName.trim()
        };
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
        await this.hostUpdate(id, {
          status,
          steps,
          currentStepId: steps[0]?.id || null,
          ...clearTimerPatch()
        });
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
        await this.hostUpdate(id, {
          steps: updated,
          currentStepId: cur.id,
          status,
          ...clearTimerPatch()
        });
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
      this.hostUpdate(id, { status: 'CLOSED', ...clearTimerPatch() })
        .then(() => this.snapSession(id))
        .then((s) => {
          sub.next(s);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'End failed' } }));
    });
  }

  /**
   * Insert a new step into a live/prepared session without changing the current step.
   * position: 'afterCurrent' (default) or 'end'
   */
  insertStep(
    id: string,
    type: 'welcome' | 'poll' | 'input' | 'voting' | 'form',
    position: 'afterCurrent' | 'end' = 'afterCurrent',
    opts?: { title?: string; instructions?: string }
  ): Observable<any> {
    return new Observable((sub) => {
      (async () => {
        const s = await getDoc(doc(db, 'sessions', id));
        if (!s.exists()) throw new Error('Session not found');
        const data = s.data()!;
        if (data['status'] === 'CLOSED') throw new Error('Session is closed');
        const steps = [...(data['steps'] || [])].sort((a: any, b: any) => a.stepOrder - b.stepOrder);
        const newStep = this.defaultLiveStep(type, opts);
        let insertAt = steps.length;
        if (position === 'afterCurrent') {
          const idx = steps.findIndex((st: any) => st.id === data['currentStepId']);
          insertAt = idx >= 0 ? idx + 1 : steps.length;
        }
        steps.splice(insertAt, 0, newStep);
        const updated = steps.map((st: any, i: number) => ({ ...st, stepOrder: i + 1 }));
        await this.hostUpdate(id, { steps: updated });
        return this.snapSession(id);
      })()
        .then((s) => {
          sub.next(s);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Add step failed' } }));
    });
  }

  /**
   * Update allowlisted fields on a step (title, instructions, timer, config, groups).
   * Type / id / status / stepOrder are locked. Optionally clear/restart the live timer.
   */
  updateStep(
    id: string,
    stepId: string,
    patch: {
      title?: string;
      instructions?: string;
      timerSeconds?: number | null;
      config?: Record<string, unknown>;
      groups?: Array<{ id?: string; title: string; groupOrder?: number }>;
    },
    opts?: { restartTimer?: boolean }
  ): Observable<any> {
    return new Observable((sub) => {
      (async () => {
        const s = await getDoc(doc(db, 'sessions', id));
        if (!s.exists()) throw new Error('Session not found');
        const data = s.data()!;
        if (data['status'] === 'CLOSED') throw new Error('Session is closed');
        const steps = [...(data['steps'] || [])];
        const idx = steps.findIndex((st: any) => st.id === stepId);
        if (idx < 0) throw new Error('Step not found');
        const cur = { ...steps[idx] };
        if (patch.title != null) cur.title = String(patch.title).trim() || cur.title;
        if (patch.instructions != null) cur.instructions = String(patch.instructions);
        if (patch.timerSeconds !== undefined) {
          const n = Number(patch.timerSeconds);
          cur.timerSeconds = Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
        }
        if (patch.config != null) cur.config = patch.config;
        if (patch.groups != null) {
          cur.groups = patch.groups.map((g, gi) => ({
            id: g.id || randomId(),
            title: String(g.title || '').trim() || `Column ${gi + 1}`,
            groupOrder: g.groupOrder || gi + 1
          }));
        }
        steps[idx] = cur;
        const update: Record<string, unknown> = { steps };
        if (opts?.restartTimer && stepId === data['currentStepId'] && cur.timerSeconds) {
          update['timerEndsAt'] = new Date(Date.now() + cur.timerSeconds * 1000).toISOString();
          update['timerPausedRemaining'] = null;
        } else if (patch.timerSeconds !== undefined) {
          // Duration changed — drop any running countdown so Start uses the new value.
          Object.assign(update, clearTimerPatch());
        }
        await this.hostUpdate(id, update);
        return this.snapSession(id);
      })()
        .then((s) => {
          sub.next(s);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Update step failed' } }));
    });
  }

  private defaultLiveStep(
    type: 'welcome' | 'poll' | 'input' | 'voting' | 'form',
    opts?: { title?: string; instructions?: string }
  ) {
    const base: any = {
      id: randomId(),
      stepOrder: 0,
      type,
      title: opts?.title || '',
      instructions: opts?.instructions || '',
      config: {},
      groups: [] as Array<{ id: string; title: string; groupOrder: number }>,
      status: 'PENDING',
      timerSeconds: null as number | null
    };
    if (type === 'welcome') {
      base.title = base.title || 'Welcome';
      base.instructions = base.instructions || 'Share the join code and wait for participants.';
    } else if (type === 'poll') {
      base.title = base.title || 'Check-in';
      base.instructions = base.instructions || 'Pick the option that fits best.';
      base.config = {
        options: [
          { id: 'great', label: 'Great' },
          { id: 'ok', label: 'OK' },
          { id: 'rough', label: 'Rough' }
        ]
      };
      base.timerSeconds = 120;
    } else if (type === 'input') {
      base.title = base.title || 'Collect ideas';
      base.instructions = base.instructions || 'Add sticky notes in each column.';
      base.config = { anonymous: true };
      base.groups = [
        { id: randomId(), title: 'Column A', groupOrder: 1 },
        { id: randomId(), title: 'Column B', groupOrder: 2 },
        { id: randomId(), title: 'Column C', groupOrder: 3 }
      ];
      base.timerSeconds = 600;
    } else if (type === 'voting') {
      base.title = base.title || 'Prioritize';
      base.instructions = base.instructions || 'Vote on the most important items.';
      base.config = { votesPerParticipant: 3 };
      base.timerSeconds = 300;
    } else if (type === 'form') {
      base.title = base.title || 'Commitments';
      base.instructions = base.instructions || 'Owners and due dates for next steps.';
      base.timerSeconds = 300;
    }
    return base;
  }

  /** Start or restart countdown from current step duration (or explicit seconds). */
  startTimer(id: string, seconds?: number): Observable<any> {
    return new Observable((sub) => {
      (async () => {
        const s = await getDoc(doc(db, 'sessions', id));
        if (!s.exists()) throw new Error('Session not found');
        const data = s.data()!;
        const steps = data['steps'] || [];
        const cur = steps.find((st: any) => st.id === data['currentStepId']);
        const duration =
          seconds != null && seconds > 0
            ? Math.floor(seconds)
            : Math.floor(Number(cur?.timerSeconds) || 0);
        if (!duration) throw new Error('This step has no timer duration');
        const timerEndsAt = new Date(Date.now() + duration * 1000).toISOString();
        await this.hostUpdate(id, { timerEndsAt, timerPausedRemaining: null });
        return this.snapSession(id);
      })()
        .then((s) => {
          sub.next(s);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Timer start failed' } }));
    });
  }

  pauseTimer(id: string): Observable<any> {
    return new Observable((sub) => {
      (async () => {
        const s = await getDoc(doc(db, 'sessions', id));
        if (!s.exists()) throw new Error('Session not found');
        const data = s.data()!;
        const endsAt = data['timerEndsAt'];
        if (!endsAt) return this.snapSession(id);
        const remaining = Math.max(0, Math.floor((Date.parse(String(endsAt)) - Date.now()) / 1000));
        await this.hostUpdate(id, { timerEndsAt: null, timerPausedRemaining: remaining });
        return this.snapSession(id);
      })()
        .then((s) => {
          sub.next(s);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Timer pause failed' } }));
    });
  }

  resumeTimer(id: string): Observable<any> {
    return new Observable((sub) => {
      (async () => {
        const s = await getDoc(doc(db, 'sessions', id));
        if (!s.exists()) throw new Error('Session not found');
        const data = s.data()!;
        const remaining = Math.floor(Number(data['timerPausedRemaining']) || 0);
        if (!remaining) return this.snapSession(id);
        const timerEndsAt = new Date(Date.now() + remaining * 1000).toISOString();
        await this.hostUpdate(id, { timerEndsAt, timerPausedRemaining: null });
        return this.snapSession(id);
      })()
        .then((s) => {
          sub.next(s);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Timer resume failed' } }));
    });
  }

  clearTimer(id: string): Observable<any> {
    return new Observable((sub) => {
      this.hostUpdate(id, clearTimerPatch())
        .then(() => this.snapSession(id))
        .then((s) => {
          sub.next(s);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Timer clear failed' } }));
    });
  }

  /** Host-editable workshop title. */
  updateTitle(id: string, title: string): Observable<any> {
    return new Observable((sub) => {
      this.hostUpdate(id, { title: title.trim() || 'Workshop' })
        .then(() => this.snapSession(id))
        .then((s) => {
          this.rememberHostSession({
            id,
            hostToken: this.hostToken(),
            title: s.title,
            code: s.code,
            status: s.status
          });
          sub.next(s);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Update failed' } }));
    });
  }

  /** Host-editable label for the OKR tree root node (theme / focus). */
  updateTreeRootLabel(id: string, label: string): Observable<any> {
    return new Observable((sub) => {
      this.hostUpdate(id, { treeRootLabel: label.trim() })
        .then(() => this.snapSession(id))
        .then((s) => {
          sub.next(s);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Update failed' } }));
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
      (async () => {
        const sessionSnap = await getDoc(doc(db, 'sessions', id));
        const sessionData = sessionSnap.data() || {};
        const steps = (sessionData['steps'] || []) as any[];
        const resolvedStepId = stepId || (sessionData['currentStepId'] as string | undefined);
        const targetStep = steps.find((st) => st.id === resolvedStepId) || null;

        const [entrySnap, people] = await Promise.all([
          getDocs(query(collection(db, 'sessions', id, 'entries'), orderBy('createdAt'))),
          new Promise<Map<string, string>>((resolve) => {
            this.listParticipants(id).subscribe({
              next: (list) => {
                const map = new Map<string, string>();
                list.forEach((p) => map.set(p.id, p.displayName));
                resolve(map);
              },
              error: () => resolve(new Map())
            });
          })
        ]);
        let rows = entrySnap.docs.map((d) => {
          const data = d.data() as any;
          // Prefer roster lookup by participant id — stored authorName can be wrong when
          // multiple participants join in the same browser (shared localStorage).
          const authorName =
            (data.participantId ? people.get(data.participantId) : null) ||
            (data.authorUid ? people.get(data.authorUid) : null) ||
            data.authorName ||
            null;
          return { id: d.id, ...data, authorName };
        });
        rows = rows.filter((r: any) => !r.hidden);

        // Voting lists stickies from input steps (not the voting step itself).
        // See docs/FLOWS.md — matches legacy Spring ActivityService.listEntries.
        if (targetStep?.type === 'voting') {
          const inputSteps = steps.filter((st) => st.type === 'input');
          const inputStepIds = new Set(inputSteps.map((st) => st.id));
          rows = rows.filter((r: any) => inputStepIds.has(r.stepId));
          // OKR mode: vote on Key Results only.
          const okrInput = inputSteps.some((st) => {
            const cfg = typeof st.config === 'string' ? (() => { try { return JSON.parse(st.config); } catch { return {}; } })() : st.config || {};
            return cfg.boardMode === 'okr';
          });
          if (okrInput) {
            rows = rows.filter((r: any) => r.kind === 'kr' || !!r.parentId);
          }
        } else if (resolvedStepId) {
          rows = rows.filter((r: any) => r.stepId === resolvedStepId);
        }
        return rows;
      })()
        .then((rows) => {
          sub.next(rows);
          sub.complete();
        })
        .catch((e) => sub.error(e));
    });
  }

  submitEntry(
    id: string,
    contentOrBody:
      | string
      | {
          stepId: string;
          groupId?: string;
          content: string;
          parentId?: string | null;
          kind?: 'objective' | 'kr' | 'sticky';
        },
    groupId?: string
  ): Observable<any> {
    return new Observable((sub) => {
      (async () => {
        const session = await getDoc(doc(db, 'sessions', id));
        const currentStepId = session.data()?.['currentStepId'] as string;
        let body: {
          stepId: string;
          groupId?: string;
          content: string;
          parentId?: string | null;
          kind?: 'objective' | 'kr' | 'sticky';
        };
        if (typeof contentOrBody === 'string') {
          body = { stepId: currentStepId, content: contentOrBody, groupId };
        } else {
          body = contentOrBody;
        }
        const participantId = this.participantId();
        const joinToken = this.joinToken();
        const authorName = this.displayName() || readParticipantStore('wos_display_name') || '';
        if (!participantId || !joinToken) {
          throw new Error('Join the session before submitting');
        }
        const entryId = randomId();
        const kind = body.kind || (body.parentId ? 'kr' : 'sticky');
        await setDoc(doc(db, 'sessions', id, 'entries', entryId), {
          stepId: body.stepId,
          groupId: body.groupId || null,
          content: body.content,
          parentId: body.parentId || null,
          kind,
          participantId,
          joinToken,
          authorUid: participantId,
          authorName: authorName || null,
          hidden: false,
          createdAt: nowIso()
        });
        return { id: entryId, authorName: authorName || null, kind, parentId: body.parentId || null };
      })()
        .then((r) => {
          sub.next(r);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Submit failed' } }));
    });
  }

  /** Host seeds an Objective on the current (or given) input step. */
  createHostObjective(
    id: string,
    body: { content: string; stepId?: string; groupId?: string | null }
  ): Observable<any> {
    return new Observable((sub) => {
      (async () => {
        const hostToken = this.hostToken();
        if (!hostToken) throw new Error('Missing host token');
        const session = await getDoc(doc(db, 'sessions', id));
        if (!session.exists()) throw new Error('Session not found');
        const data = session.data()!;
        if (data['hostToken'] !== hostToken) throw new Error('Host token mismatch');
        const stepId =
          body.stepId ||
          okrInputStep({ steps: data['steps'] })?.id ||
          (data['currentStepId'] as string);
        const step = (data['steps'] || []).find((s: any) => s.id === stepId);
        const groupId = body.groupId ?? step?.groups?.[0]?.id ?? null;

        // Ensure a durable host participant so entry creates pass participant rules
        // (works even before updated hostToken entry rules are deployed).
        const hostParticipantId = `host-${id}`;
        const existing = await getDoc(doc(db, 'sessions', id, 'participants', hostParticipantId));
        let joinToken = (existing.data()?.['joinToken'] as string) || '';
        if (!existing.exists() || !joinToken) {
          joinToken = randomToken();
          await setDoc(doc(db, 'sessions', id, 'participants', hostParticipantId), {
            uid: hostParticipantId,
            displayName: 'Host',
            joinToken,
            createdAt: nowIso()
          });
        }

        const entryId = randomId();
        await setDoc(doc(db, 'sessions', id, 'entries', entryId), {
          stepId,
          groupId,
          content: body.content.trim(),
          parentId: null,
          kind: 'objective',
          participantId: hostParticipantId,
          joinToken,
          authorUid: hostParticipantId,
          authorName: 'Host',
          hostToken,
          hidden: false,
          createdAt: nowIso()
        });
        return { id: entryId, kind: 'objective', content: body.content.trim() };
      })()
        .then((r) => {
          sub.next(r);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Create objective failed' } }));
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

  /** Owner (or host for objectives) updates entry text / parent. */
  updateEntry(
    id: string,
    entryId: string,
    patch: { content: string; parentId?: string | null; groupId?: string | null },
    opts?: { role?: 'host' | 'participant' }
  ): Observable<any> {
    return new Observable((sub) => {
      (async () => {
        const payload: any = {
          content: patch.content.trim(),
          updatedAt: nowIso()
        };
        const asHost =
          opts?.role === 'host' ||
          (opts?.role !== 'participant' && !!this.hostToken() && !this.participantId());
        if (asHost) {
          if (!this.hostToken()) throw new Error('Missing host token');
          payload.hostToken = this.hostToken();
        } else {
          const participantId = this.participantId();
          const joinToken = this.joinToken();
          if (!participantId || !joinToken) throw new Error('Join the session before editing');
          payload.participantId = participantId;
          payload.joinToken = joinToken;
          if (patch.parentId !== undefined) payload.parentId = patch.parentId;
          if (patch.groupId !== undefined) payload.groupId = patch.groupId;
        }
        await updateDoc(doc(db, 'sessions', id, 'entries', entryId), payload);
        return { id: entryId, ...payload };
      })()
        .then((r) => {
          sub.next(r);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Update failed' } }));
    });
  }

  /** Owner soft-deletes their own entry (sets hidden). Host should use hideEntry. */
  removeOwnEntry(id: string, entryId: string): Observable<any> {
    return new Observable((sub) => {
      (async () => {
        const participantId = this.participantId();
        const joinToken = this.joinToken();
        if (!participantId || !joinToken) throw new Error('Join the session before deleting');
        await updateDoc(doc(db, 'sessions', id, 'entries', entryId), {
          hidden: true,
          participantId,
          joinToken,
          updatedAt: nowIso()
        });
        return { ok: true };
      })()
        .then((r) => {
          sub.next(r);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Delete failed' } }));
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
      (async () => {
        const session = await getDoc(doc(db, 'sessions', id));
        const votingStepId = stepId || (session.data()?.['currentStepId'] as string);
        const [votable, votesSnap] = await Promise.all([
          new Promise<any[]>((resolve, reject) => {
            this.listEntries(id, votingStepId).subscribe({ next: resolve, error: reject });
          }),
          getDocs(collection(db, 'sessions', id, 'votes'))
        ]);
        const counts = new Map<string, number>();
        for (const v of votesSnap.docs) {
          const data = v.data();
          if (votingStepId && data['stepId'] !== votingStepId) continue;
          const entryId = data['entryId'] as string;
          counts.set(entryId, (counts.get(entryId) || 0) + 1);
        }
        const tallies = votable.map((e) => ({
          entryId: e.id,
          content: e.content,
          groupId: e.groupId || null,
          parentId: e.parentId || null,
          kind: e.kind || null,
          authorName: e.authorName || null,
          votes: counts.get(e.id) || 0
        }));
        tallies.sort((a, b) => b.votes - a.votes || String(a.content).localeCompare(String(b.content)));
        return tallies;
      })()
        .then((rows) => {
          sub.next(rows);
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
          sub.next(
            snap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((a: any) => !a.hidden)
          );
          sub.complete();
        })
        .catch((e) => sub.error(e));
    });
  }

  submitAction(
    id: string,
    body: { action: string; owner?: string; dueDate?: string; sourceEntryId?: string; sourceLabel?: string }
  ): Observable<any> {
    return new Observable((sub) => {
      const actionId = randomId();
      const payload: any = {
        action: body.action,
        owner: body.owner || '',
        dueDate: body.dueDate || '',
        sourceEntryId: body.sourceEntryId || null,
        sourceLabel: body.sourceLabel || null,
        hidden: false,
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

  updateAction(
    id: string,
    actionId: string,
    body: { action: string; owner?: string; dueDate?: string; sourceEntryId?: string; sourceLabel?: string }
  ): Observable<any> {
    return new Observable((sub) => {
      (async () => {
        // Prefer participant credentials so host+participant in one browser still works.
        const participantId = this.participantId();
        const joinToken = this.joinToken();
        const payload: any = {
          action: body.action.trim(),
          owner: body.owner || '',
          dueDate: body.dueDate || '',
          updatedAt: nowIso()
        };
        if (body.sourceEntryId !== undefined) payload.sourceEntryId = body.sourceEntryId || null;
        if (body.sourceLabel !== undefined) payload.sourceLabel = body.sourceLabel || null;
        if (participantId && joinToken) {
          payload.participantId = participantId;
          payload.joinToken = joinToken;
        } else if (this.hostToken()) {
          payload.hostToken = this.hostToken();
        } else {
          throw new Error('Join the session before editing');
        }
        await updateDoc(doc(db, 'sessions', id, 'actions', actionId), payload);
        return { id: actionId, ...payload };
      })()
        .then((r) => {
          sub.next(r);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Update failed' } }));
    });
  }

  removeOwnAction(id: string, actionId: string): Observable<any> {
    return new Observable((sub) => {
      (async () => {
        const participantId = this.participantId();
        const joinToken = this.joinToken();
        const payload: any = {
          hidden: true,
          updatedAt: nowIso()
        };
        if (participantId && joinToken) {
          payload.participantId = participantId;
          payload.joinToken = joinToken;
        } else if (this.hostToken()) {
          payload.hostToken = this.hostToken();
        } else {
          throw new Error('Join the session before deleting');
        }
        await updateDoc(doc(db, 'sessions', id, 'actions', actionId), payload);
        return { ok: true };
      })()
        .then((r) => {
          sub.next(r);
          sub.complete();
        })
        .catch((e) => sub.error({ error: { message: e?.message || 'Delete failed' } }));
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
