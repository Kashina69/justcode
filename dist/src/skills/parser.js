/**
 * Parses raw text from a SKILL.md file, extracting frontmatter fields
 * (name, description) and standardizing the remaining markdown body content.
 *
 * @param fileContent The raw text read from the skill file.
 * @returns A parsed Skill object, or null if the structure is invalid.
 */
export function parseSkillFile(fileContent) {
    const parts = fileContent.split('---');
    if (parts.length < 3) {
        return null;
    }
    let frontmatter = '';
    let content = '';
    if (parts[0].trim() === '') {
        frontmatter = parts[1];
        content = parts.slice(2).join('---').trim();
    }
    else {
        // Skills must start with a frontmatter block
        return null;
    }
    let name = '';
    let description = '';
    const lines = frontmatter.split('\n');
    for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
            const key = line.substring(0, colonIndex).trim();
            const val = line.substring(colonIndex + 1).trim();
            if (key === 'name') {
                name = val.replace(/^["']|["']$/g, '');
            }
            else if (key === 'description') {
                description = val.replace(/^["']|["']$/g, '');
            }
        }
    }
    if (!name || !description) {
        return null;
    }
    return {
        name,
        description,
        content,
    };
}
