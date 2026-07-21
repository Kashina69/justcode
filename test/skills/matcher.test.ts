import { describe, it, expect } from 'vitest';
import { matchSkills } from '../../src/skills/matcher.js';
import { Skill } from '../../src/skills/types.js';

describe('matchSkills', () => {
  it('should return all skills unchanged', () => {
    const skills: Skill[] = [
      { name: 'coding-efficiency', content: 'efficient' },
      { name: 'other-skill', content: 'other-rules' },
    ];

    const matched = matchSkills(skills);

    expect(matched).toEqual(skills);
  });
});
