/** Product update log shown on the host Dashboard. Newest first. */
export interface ChangelogEntry {
  date: string;
  title: string;
  items: string[];
}

export const PRODUCT_CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-08-07',
    title: 'Big screen text size',
    items: [
      'Host can set Screen text size (S / M / L / XL) — updates the projector live for notes, OKR tree, votes, and more.'
    ]
  },
  {
    date: '2026-08-07',
    title: 'Kick & lock room',
    items: [
      'Host can Lock room to block new joins (Unlock anytime).',
      'Host roster lists participants with Kick — removed phones lose write access immediately.'
    ]
  },
  {
    date: '2026-08-07',
    title: 'Moderation animations & undo',
    items: [
      'Big screen animates when the host hides, unhides, or deletes stickies and OKR nodes.',
      'Host live results include Undo / Redo for hide, unhide, and delete (delete restore brings the item back).'
    ]
  },
  {
    date: '2026-08-07',
    title: 'Big screen focus area',
    items: [
      'Host starts Focus area on big screen, then drags the zone directly on the projector.',
      'Selected zone stays clear; everything else grays out. Clear focus anytime from the host console.'
    ]
  },
  {
    date: '2026-08-07',
    title: 'Hide vs delete',
    items: [
      'Host Hide soft-hides an idea from participants and the big screen; Unhide brings it back.',
      'Delete permanently removes an item. Participant Delete also hard-deletes.',
      'Removed the old preview-based highlight & zoom.'
    ]
  },
  {
    date: '2026-08-06',
    title: 'End activity',
    items: [
      'New End step: closing text and optional background image on the big screen and phones.',
      'Host can paste a link that becomes a QR code on the projector for feedback, slides, or next steps.',
      'Add from Templates board palette or mid-session via Add step.'
    ]
  },
  {
    date: '2026-08-06',
    title: 'Group participants activity',
    items: [
      'New breakout step: host divides joined participants into teams randomly or manually.',
      'Host can assign a discussion topic to each group (settings or live board).',
      'Undo / Redo for step content sits top-right of the step title in Content.',
      'Templates board: Undo / Redo replace the Back button (board + inspector edits).',
      'Participants and big screen show group membership and topics in real time.',
      'Add from Templates board palette or mid-session via Add step.'
    ]
  },
  {
    date: '2026-08-06',
    title: 'Host console navigation',
    items: [
      'Dashboard and Sessions are separate: overview vs create/resume workshops.',
      'Sidebar brand (Workshop OS) links back to the homepage.',
      'Host pages use the full main-pane width on wide screens.'
    ]
  },
  {
    date: '2026-08-05',
    title: 'Responsive host & workflow board',
    items: [
      'Host console adapts for tablet and PC (icon rail, top chrome).',
      'Miro-style drag-and-drop workflow board for custom session formats.',
      'Welcome step supports photo upload via browser compression (no Storage).'
    ]
  },
  {
    date: '2026-08-04',
    title: 'Live facilitation',
    items: [
      'Edit step content while a workshop is live (title, timer, poll options, columns).',
      'Insert new activity steps mid-session without leaving the current step.',
      'Save workshops for later and resume from the Sessions list.'
    ]
  },
  {
    date: '2026-08-01',
    title: 'OKR & participant tools',
    items: [
      'OKR linked board: host Objectives, participant KRs, KR-only voting.',
      'Participants can edit or delete their own stickies, KRs, and actions.',
      'Host live timer: start, pause, resume, and reset synced over Firestore.'
    ]
  }
];
