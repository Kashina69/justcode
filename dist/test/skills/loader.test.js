import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillLoader } from '../../src/skills/loader.js';
import fs from 'fs';
import path from 'path';
describe('SkillLoader', () => {
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
    it('should recursively load skills from directories', async () => {
        // Setup test folder layout
        const builtInSkillsDir = path.join(testRoot, 'skills', 'test-cave');
        fs.mkdirSync(builtInSkillsDir, { recursive: true });
        fs.writeFileSync(path.join(builtInSkillsDir, 'SKILL.md'), '---\nname: test-cave\ndescription: test desc\n---\nbody text', 'utf-8');
        const projectSkillsDir = path.join(testRoot, '.agent', 'skills', 'test-pony');
        fs.mkdirSync(projectSkillsDir, { recursive: true });
        fs.writeFileSync(path.join(projectSkillsDir, 'SKILL.md'), '---\nname: test-pony\ndescription: pony desc\n---\nbody pony', 'utf-8');
        const loader = new SkillLoader(testRoot);
        const skills = await loader.loadSkills();
        expect(skills).toHaveLength(2);
        const names = skills.map((s) => s.name);
        expect(names).toContain('test-cave');
        expect(names).toContain('test-pony');
    });
});
