import { describe, it, expect } from 'vitest';
import { parseSkillFile } from '../../src/skills/parser.js';
describe('SkillParser', () => {
    it('should successfully parse a valid skill markdown file', () => {
        const rawContent = `---
name: test-skill
description: descriptive test text
---
# Test Content Header
body lines here`;
        const parsed = parseSkillFile(rawContent);
        expect(parsed).not.toBeNull();
        expect(parsed?.name).toBe('test-skill');
        expect(parsed?.description).toBe('descriptive test text');
        expect(parsed?.content).toBe('# Test Content Header\nbody lines here');
    });
    it('should return null for file missing correct delimiters', () => {
        const rawContent = 'no delimiter frontmatter';
        const parsed = parseSkillFile(rawContent);
        expect(parsed).toBeNull();
    });
});
