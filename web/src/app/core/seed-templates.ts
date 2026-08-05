/** Built-in workshop templates seeded into Firestore once. */
export const SEED_TEMPLATES = [
  {
    key: 'retro',
    name: 'Sprint Retrospective',
    description: 'Celebrate wins, surface issues, and prioritize actions.',
    steps: [
      {
        type: 'welcome',
        title: 'Welcome',
        instructions: 'Share the QR code and wait for the team.',
        config: {},
        groups: [],
        timerSeconds: null
      },
      {
        type: 'poll',
        title: 'Check-in',
        instructions: 'How do you feel about this sprint?',
        config: {
          options: [
            { id: 'great', label: 'Great' },
            { id: 'ok', label: 'OK' },
            { id: 'rough', label: 'Rough' }
          ]
        },
        groups: [],
        timerSeconds: 120
      },
      {
        type: 'input',
        title: 'Sprint Reflection',
        instructions: 'Add sticky notes in each column.',
        config: { anonymous: true },
        groups: [
          { title: 'What went well?' },
          { title: 'What to improve?' },
          { title: 'Action ideas' }
        ],
        timerSeconds: 600
      },
      {
        type: 'voting',
        title: 'Prioritize',
        instructions: 'Vote on the most important items.',
        config: { votesPerParticipant: 3 },
        groups: [],
        timerSeconds: 300
      },
      {
        type: 'form',
        title: 'Commitments',
        instructions: 'Owners and due dates for next steps.',
        config: {},
        groups: [],
        timerSeconds: 300
      }
    ]
  },
  {
    key: 'strategy',
    name: 'Strategy Workshop',
    description: 'Align on opportunities, risks, and bets.',
    steps: [
      {
        type: 'welcome',
        title: 'Welcome',
        instructions: 'Strategy session kickoff.',
        config: {},
        groups: [],
        timerSeconds: null
      },
      {
        type: 'poll',
        title: 'Clarity check',
        instructions: 'How clear is our direction?',
        config: {
          options: [
            { id: 'clear', label: 'Clear' },
            { id: 'partial', label: 'Partial' },
            { id: 'unclear', label: 'Unclear' }
          ]
        },
        groups: [],
        timerSeconds: 120
      },
      {
        type: 'input',
        title: 'Strategy board',
        instructions: 'Capture opportunities, risks, and bets.',
        config: { anonymous: false },
        groups: [{ title: 'Opportunities' }, { title: 'Risks' }, { title: 'Bets' }],
        timerSeconds: 600
      },
      {
        type: 'voting',
        title: 'Prioritize bets',
        instructions: 'Vote on the strongest bets.',
        config: { votesPerParticipant: 5 },
        groups: [],
        timerSeconds: 300
      },
      {
        type: 'form',
        title: 'Commitments',
        instructions: 'Owners and due dates for next steps.',
        config: {},
        groups: [],
        timerSeconds: 300
      }
    ]
  },
  {
    key: 'okr-linked',
    name: 'OKR Alignment',
    description: 'Define objectives, attach key results, vote, and commit actions per KR.',
    steps: [
      {
        type: 'welcome',
        title: 'Welcome',
        instructions: 'OKR alignment kickoff. Host will seed Objectives; the team adds Key Results.',
        config: {},
        groups: [],
        timerSeconds: null
      },
      {
        type: 'poll',
        title: 'Confidence',
        instructions: 'How confident are we in this OKR set?',
        config: {
          options: [
            { id: 'high', label: 'High' },
            { id: 'med', label: 'Medium' },
            { id: 'low', label: 'Low' }
          ]
        },
        groups: [],
        timerSeconds: 120
      },
      {
        type: 'input',
        title: 'OKR board',
        instructions: 'Host adds Objectives. Participants attach Key Results under each Objective.',
        config: {
          anonymous: false,
          boardMode: 'okr',
          parentKind: 'objective',
          childKind: 'kr',
          parentLabel: 'Objective',
          childLabel: 'Key Result'
        },
        groups: [{ title: 'Objectives' }],
        timerSeconds: 600
      },
      {
        type: 'voting',
        title: 'Prioritize KRs',
        instructions: 'Vote on the Key Results that matter most.',
        config: { votesPerParticipant: 3 },
        groups: [],
        timerSeconds: 300
      },
      {
        type: 'form',
        title: 'Commitments',
        instructions: 'Pick a Key Result and define one action with owner and due date.',
        config: { linkTo: 'kr', linkLabel: 'Key Result' },
        groups: [],
        timerSeconds: 300
      }
    ]
  }
] as const;
