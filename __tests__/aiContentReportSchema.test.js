import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '202605260001_ai_content_reports.sql',
);

describe('AI content report database contract', () => {
  test('creates constrained, write-only report storage for app clients', () => {
    const source = fs.readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(source).toContain('create table public.ai_content_reports');
    expect(source).toContain("'chat_response'");
    expect(source).toContain("'generated_image'");
    expect(source).toContain("'edited_image'");
    expect(source).toContain("'sexual'");
    expect(source).toContain("'violence_self_harm'");
    expect(source).toContain("'hate_harassment'");
    expect(source).toContain("'child_safety'");
    expect(source).toContain("'scam_deceptive'");
    expect(source).toContain("'other'");
    expect(source).toContain("'pending'");
    expect(source).toContain("'reviewed'");
    expect(source).toContain("'dismissed'");
    expect(source).toContain("'action_taken'");
    expect(source).toContain('enable row level security');
    expect(source).toContain('for insert');
    expect(source).toContain('to anon, authenticated');
    expect(source).toContain("request.headers");
    expect(source).toContain("'x-device-id'");
    expect(source).toContain('grant insert (');
    expect(source).not.toMatch(/grant\s+insert\s*\([^)]*user_id[^)]*\)/s);
    expect(source).not.toMatch(/grant\s+insert\s*\([^)]*status[^)]*\)/s);
    expect(source).not.toMatch(/grant\s+select\s+on\s+public\.ai_content_reports\s+to\s+(anon|authenticated)/);
    expect(source).not.toMatch(/for\s+select\s+to\s+(anon|authenticated)/);
  });
});
