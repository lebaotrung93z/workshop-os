-- Default workspace + Retro / Strategy / OKR templates
INSERT INTO workspaces (id, name, created_at) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Default Workspace', NOW());

-- RETRO
INSERT INTO templates (id, workspace_id, key, name, description, created_at) VALUES
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111111', 'retro',
   'Sprint Retrospective', 'Hybrid retro with poll, structured input, voting, and actions', NOW());

INSERT INTO step_defs (id, template_id, step_order, type, title, instructions, config, timer_seconds) VALUES
  ('33333333-3333-3333-3333-333333333301', '22222222-2222-2222-2222-222222222201', 1, 'welcome',
   'Welcome', 'Welcome to the retrospective. Please follow the facilitator.', '{}'::jsonb, NULL),
  ('33333333-3333-3333-3333-333333333302', '22222222-2222-2222-2222-222222222201', 2, 'poll',
   'Check-in', 'How do you feel about this sprint?',
   '{"options":[{"id":"great","label":"Great"},{"id":"ok","label":"OK"},{"id":"rough","label":"Rough"}]}'::jsonb, 120),
  ('33333333-3333-3333-3333-333333333303', '22222222-2222-2222-2222-222222222201', 3, 'input',
   'Sprint Reflection', 'Add sticky notes in each column.',
   '{"anonymous":true}'::jsonb, 600),
  ('33333333-3333-3333-3333-333333333304', '22222222-2222-2222-2222-222222222201', 4, 'voting',
   'Prioritize', 'Vote on the most important items.',
   '{"votesPerParticipant":3}'::jsonb, 300),
  ('33333333-3333-3333-3333-333333333305', '22222222-2222-2222-2222-222222222201', 5, 'form',
   'Action Plan', 'Capture concrete actions with owners and due dates.',
   '{}'::jsonb, 300);

INSERT INTO step_groups (id, step_def_id, group_order, title) VALUES
  ('44444444-4444-4444-4444-444444444401', '33333333-3333-3333-3333-333333333303', 1, 'What went well?'),
  ('44444444-4444-4444-4444-444444444402', '33333333-3333-3333-3333-333333333303', 2, 'What to improve?'),
  ('44444444-4444-4444-4444-444444444403', '33333333-3333-3333-3333-333333333303', 3, 'Action ideas');

-- STRATEGY
INSERT INTO templates (id, workspace_id, key, name, description, created_at) VALUES
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111111', 'strategy',
   'Strategy Workshop', 'Align on goals, collect ideas, prioritize, commit', NOW());

INSERT INTO step_defs (id, template_id, step_order, type, title, instructions, config, timer_seconds) VALUES
  ('33333333-3333-3333-3333-333333333311', '22222222-2222-2222-2222-222222222202', 1, 'welcome',
   'Welcome', 'Strategy session — follow the host on the big screen.', '{}'::jsonb, NULL),
  ('33333333-3333-3333-3333-333333333312', '22222222-2222-2222-2222-222222222202', 2, 'poll',
   'Alignment check', 'How clear is our current strategy?',
   '{"options":[{"id":"clear","label":"Clear"},{"id":"partial","label":"Partially clear"},{"id":"unclear","label":"Unclear"}]}'::jsonb, 120),
  ('33333333-3333-3333-3333-333333333313', '22222222-2222-2222-2222-222222222202', 3, 'input',
   'Opportunities & Risks', 'Capture strategic inputs.',
   '{"anonymous":false}'::jsonb, 600),
  ('33333333-3333-3333-3333-333333333314', '22222222-2222-2222-2222-222222222202', 4, 'voting',
   'Prioritize themes', 'Vote on top themes.',
   '{"votesPerParticipant":5}'::jsonb, 300),
  ('33333333-3333-3333-3333-333333333315', '22222222-2222-2222-2222-222222222202', 5, 'form',
   'Commitments', 'Owners and due dates for next steps.',
   '{}'::jsonb, 300);

INSERT INTO step_groups (id, step_def_id, group_order, title) VALUES
  ('44444444-4444-4444-4444-444444444411', '33333333-3333-3333-3333-333333333313', 1, 'Opportunities'),
  ('44444444-4444-4444-4444-444444444412', '33333333-3333-3333-3333-333333333313', 2, 'Risks'),
  ('44444444-4444-4444-4444-444444444413', '33333333-3333-3333-3333-333333333313', 3, 'Bets');

-- OKR
INSERT INTO templates (id, workspace_id, key, name, description, created_at) VALUES
  ('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111111', 'okr',
   'OKR Alignment', 'Align objectives and key results', NOW());

INSERT INTO step_defs (id, template_id, step_order, type, title, instructions, config, timer_seconds) VALUES
  ('33333333-3333-3333-3333-333333333321', '22222222-2222-2222-2222-222222222203', 1, 'welcome',
   'Welcome', 'OKR alignment workshop.', '{}'::jsonb, NULL),
  ('33333333-3333-3333-3333-333333333322', '22222222-2222-2222-2222-222222222203', 2, 'poll',
   'Confidence', 'Confidence in current OKRs?',
   '{"options":[{"id":"high","label":"High"},{"id":"med","label":"Medium"},{"id":"low","label":"Low"}]}'::jsonb, 120),
  ('33333333-3333-3333-3333-333333333323', '22222222-2222-2222-2222-222222222203', 3, 'input',
   'Draft OKRs', 'Propose objectives and key results.',
   '{"anonymous":false}'::jsonb, 600),
  ('33333333-3333-3333-3333-333333333324', '22222222-2222-2222-2222-222222222203', 4, 'voting',
   'Vote on OKRs', 'Prioritize proposed OKRs.',
   '{"votesPerParticipant":3}'::jsonb, 300),
  ('33333333-3333-3333-3333-333333333325', '22222222-2222-2222-2222-222222222203', 5, 'form',
   'Owners', 'Assign OKR owners and review dates.',
   '{}'::jsonb, 300);

INSERT INTO step_groups (id, step_def_id, group_order, title) VALUES
  ('44444444-4444-4444-4444-444444444421', '33333333-3333-3333-3333-333333333323', 1, 'Objectives'),
  ('44444444-4444-4444-4444-444444444422', '33333333-3333-3333-3333-333333333323', 2, 'Key Results'),
  ('44444444-4444-4444-4444-444444444423', '33333333-3333-3333-3333-333333333323', 3, 'Dependencies');
