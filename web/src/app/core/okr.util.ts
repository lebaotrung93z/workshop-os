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

export function formLinksToKr(step: any): boolean {
  return parseStepConfig(step).linkTo === 'kr';
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
