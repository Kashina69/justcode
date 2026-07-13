import fsSync from 'fs';
import path from 'path';
import { SLASH_COMMANDS } from './constants.js';
/**
 * Builds the readline tab-completer function.
 *
 * @param getSkillNames Getter function retrieving active skill name strings.
 * @param isIgnored Filter checking if a path is ignored.
 * @returns Completer function for readline.
 */
export function buildCompleter(getSkillNames, isIgnored) {
    return function completer(line, callback) {
        const skillNames = getSkillNames();
        // Find the last word and the prefix of the line before it
        let lastWord = '';
        let linePrefix = line;
        const match = line.match(/(\S+)$/);
        if (match) {
            lastWord = match[1];
            linePrefix = line.slice(0, line.length - lastWord.length);
        }
        // 1. /skill subcommand autocompletion
        const skillArgMatch = line.match(/^\/(skill)\s+(pin|mute)\s+(\S*)$/);
        if (skillArgMatch) {
            const partial = skillArgMatch[3];
            const prefix = line.slice(0, line.length - partial.length);
            const hits = skillNames
                .filter((n) => n.toLowerCase().startsWith(partial.toLowerCase()))
                .map((n) => prefix + n);
            return callback(null, [hits.length ? hits : [], line]);
        }
        if (/^\/skill\s*$/.test(line)) {
            return callback(null, [
                ['/skill list', '/skill pin ', '/skill mute ', '/skill reset'],
                line,
            ]);
        }
        // 2. Slash commands autocompletion (first word starts with /)
        if (line.startsWith('/') && !line.includes(' ')) {
            const hits = SLASH_COMMANDS.filter((c) => c.startsWith(line));
            return callback(null, [hits, line]);
        }
        // 3. Skill & File context autocomplete starting with @ or !@
        const isAtRef = lastWord.startsWith('@');
        const isMuteAtRef = lastWord.startsWith('!@');
        if (isAtRef || isMuteAtRef) {
            const prefixSymbol = isAtRef ? '@' : '!@';
            const query = lastWord.slice(prefixSymbol.length);
            const skillHits = [];
            const pathHits = [];
            // Complete matching skill names (only if query doesn't contain a path separator)
            if (!query.includes('/') && !query.includes('\\')) {
                const matches = skillNames.filter((name) => name.toLowerCase().startsWith(query.toLowerCase()));
                for (const name of matches) {
                    skillHits.push(linePrefix + prefixSymbol + name);
                }
            }
            // Complete matching files/directories
            const relativeHits = completePaths(query, isIgnored);
            for (const relPath of relativeHits) {
                pathHits.push(linePrefix + prefixSymbol + relPath);
            }
            const hits = [...skillHits, ...pathHits];
            return callback(null, [hits, line]);
        }
        // 4. Fallback general file completion (for any word)
        const hits = completePaths(lastWord, isIgnored).map((relPath) => linePrefix + relPath);
        return callback(null, [hits, line]);
    };
}
/**
 * Helper to get matching relative paths starting with a partial input.
 */
function completePaths(partial, isIgnored) {
    try {
        let dir = '.';
        let base = partial;
        if (partial.includes('/') || partial.includes('\\')) {
            const normalized = partial.replace(/\\/g, '/');
            const lastSlash = normalized.lastIndexOf('/');
            dir = normalized.slice(0, lastSlash);
            base = normalized.slice(lastSlash + 1);
            if (dir === '') {
                dir = '/';
            }
        }
        const absDir = path.resolve(process.cwd(), dir);
        if (!fsSync.existsSync(absDir) || !fsSync.statSync(absDir).isDirectory()) {
            return [];
        }
        const entries = fsSync.readdirSync(absDir, { withFileTypes: true });
        const results = [];
        for (const e of entries) {
            if (e.name.toLowerCase().startsWith(base.toLowerCase())) {
                const relPath = dir === '.' ? e.name : `${dir}/${e.name}`;
                if (!isIgnored(relPath)) {
                    const suffix = e.isDirectory() ? '/' : '';
                    results.push(relPath + suffix);
                }
            }
        }
        return results;
    }
    catch {
        return [];
    }
}
