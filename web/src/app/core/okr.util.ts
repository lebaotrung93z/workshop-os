/** OKR / linked-board helpers for Objective → KR → Action trees. */

export type EntryKind = 'objective' | 'kr' | 'sticky';

export function parseStepConfig(step: any): any {
  try {
    if (!step) return {};
    return typeof step.config === 'string' ? JSON.parse(step.config) : step.config || {};
  } catch {
    return {};
  }
}

export function isOkrBoard(step: any): boolean {
  return parseStepConfig(step).boardMode === 'okr';
}

/** True when any input step in the session is an OKR linked board. */
export function sessionHasOkr(session: any): boolean {
  return (session?.steps || []).some((s: any) => s.type === 'input' && isOkrBoard(s));
}

export function okrInputStep(session: any): any | null {
  return (session?.steps || []).find((s: any) => s.type === 'input' && isOkrBoard(s)) || null;
}

/** Voting step used for KR tallies (OKR sessions vote on Key Results). */
export function okrVotingStep(session: any): any | null {
  return (session?.steps || []).find((s: any) => s.type === 'voting') || null;
}

export function formLinksToKr(step: any): boolean {
  return parseStepConfig(step).linkTo === 'kr';
}

/** Sticky / KR authorship hidden when the input board is anonymous. */
export function boardIsAnonymous(session: any): boolean {
  const input =
    okrInputStep(session) || (session?.steps || []).find((s: any) => s.type === 'input') || null;
  return !!parseStepConfig(input).anonymous;
}

export function displayAuthorName(entry: { authorName?: string | null } | null | undefined, anonymous: boolean): string {
  if (anonymous) return 'Anonymous';
  const name = String(entry?.authorName || '').trim();
  return name || 'Anonymous';
}

export function objectivesFrom(entries: any[]): any[] {
  return entries.filter((e) => e.kind === 'objective' || (!e.kind && !e.parentId && e.groupId));
}

export function krsFor(entries: any[], objectiveId: string): any[] {
  return entries.filter((e) => e.parentId === objectiveId || (e.kind === 'kr' && e.parentId === objectiveId));
}

export function allKrs(entries: any[]): any[] {
  return entries.filter((e) => e.kind === 'kr' || !!e.parentId);
}

export function actionsFor(actions: any[], krId: string): any[] {
  return actions.filter((a) => a.sourceEntryId === krId);
}

export function buildOkrTree(entries: any[], actions: any[] = []) {
  const objectives = entries.filter((e) => e.kind === 'objective');
  return objectives.map((obj) => {
    const krs = entries.filter((e) => e.kind === 'kr' && e.parentId === obj.id);
    return {
      ...obj,
      krs: krs.map((kr) => ({
        ...kr,
        actions: actions.filter((a) => a.sourceEntryId === kr.id)
      }))
    };
  });
}
