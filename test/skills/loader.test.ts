import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadSkills } from '../../src/skills/loader.js';
import fs from 'fs';
import path from 'path';

describe('loadSkills', () => {
  const testRoot = path.resolve('test_skills_temp');

  beforeEach(() => {
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testRoot)) {
      fs.rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it('should load skills from subdirectories containing SKILL.md', async () => {
    fs.mkdirSync(path.join(testRoot, 'test-skill'), { recursive: true });
    fs.writeFileSync(
      path.join(testRoot, 'test-skill', 'SKILL.md'),
      '---\nname: test-skill\ndescription: test\n---\nbody text',
      'utf-8'
    );

    const skills = await loadSkills(testRoot);

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe('test-skill');
    expect(skills[0].content).toBe('body text');
  });

  it('should return empty array if directory does not exist', async () => {
    const skills = await loadSkills('/nonexistent/path');
    expect(skills).toEqual([]);
  });
});
