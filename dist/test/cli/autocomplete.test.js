import { describe, it, expect } from 'vitest';
import { buildCompleter } from '../../src/cli/autocomplete.js';
describe('buildCompleter', () => {
    const getSkillNames = () => ['ponytail', 'caveman', 'chef'];
    const isIgnored = (p) => p.includes('ignored');
    it('should autocomplete slash commands when typing "/"', () => {
        const completer = buildCompleter(getSkillNames, isIgnored);
        completer('/', (err, result) => {
            expect(err).toBeNull();
            const [hits, line] = result;
            expect(line).toBe('/');
            expect(hits).toContain('/help');
            expect(hits).toContain('/list');
            expect(hits).toContain('/config');
            expect(hits).toContain('/models');
        });
    });
    it('should autocomplete subcommands for "/skill"', () => {
        const completer = buildCompleter(getSkillNames, isIgnored);
        completer('/skill', (err, result) => {
            expect(err).toBeNull();
            const [hits, line] = result;
            expect(line).toBe('/skill');
            expect(hits).toContain('/skill list');
            expect(hits).toContain('/skill pin ');
            expect(hits).toContain('/skill mute ');
            expect(hits).toContain('/skill reset');
        });
    });
    it('should autocomplete skill names in "/skill pin pony"', () => {
        const completer = buildCompleter(getSkillNames, isIgnored);
        completer('/skill pin pony', (err, result) => {
            expect(err).toBeNull();
            const [hits, line] = result;
            expect(line).toBe('/skill pin pony');
            expect(hits).toEqual(['/skill pin ponytail']);
        });
    });
    it('should autocomplete skill names starting with "@"', () => {
        const completer = buildCompleter(getSkillNames, isIgnored);
        completer('@pon', (err, result) => {
            expect(err).toBeNull();
            const [hits, line] = result;
            expect(line).toBe('@pon');
            expect(hits).toContain('@ponytail');
        });
    });
    it('should autocomplete skill names starting with "!@"', () => {
        const completer = buildCompleter(getSkillNames, isIgnored);
        completer('!@cav', (err, result) => {
            expect(err).toBeNull();
            const [hits, line] = result;
            expect(line).toBe('!@cav');
            expect(hits).toContain('!@caveman');
        });
    });
    it('should autocomplete files in current directory', () => {
        const completer = buildCompleter(getSkillNames, isIgnored);
        completer('pack', (err, result) => {
            expect(err).toBeNull();
            const [hits, line] = result;
            expect(line).toBe('pack');
            expect(hits).toContain('package.json');
        });
    });
    it('should autocomplete files starting with "@"', () => {
        const completer = buildCompleter(getSkillNames, isIgnored);
        completer('@pack', (err, result) => {
            expect(err).toBeNull();
            const [hits, line] = result;
            expect(line).toBe('@pack');
            expect(hits).toContain('@package.json');
        });
    });
});
