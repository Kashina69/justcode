/**
 * Searches the loaded memory index by query keywords.
 * Uses substring containment and exact tag matches to calculate relevance scores.
 *
 * @param index The MemoryIndex list.
 * @param query The search query string.
 * @param maxResults Ceiling on the count of returned matches.
 * @returns Array of matches sorted descending by calculated relevance score.
 */
export function searchMemoryIndexByKeyword(index, query, maxResults = 8) {
    const queryLower = query.toLowerCase().trim();
    if (!queryLower) {
        return [];
    }
    const keywords = queryLower
        .split(/[\s,._\-]+/)
        .map((k) => k.replace(/[?()!*"']/g, '').trim())
        .filter((k) => k.length > 1);
    if (keywords.length === 0 && queryLower.length > 0) {
        keywords.push(queryLower);
    }
    const matches = [];
    for (const entry of index) {
        let score = 0;
        const summaryLower = entry.summary.toLowerCase();
        for (const keyword of keywords) {
            if (summaryLower.includes(keyword)) {
                score += 2;
            }
            for (const tag of entry.tags) {
                const tagLower = tag.toLowerCase();
                if (tagLower === keyword) {
                    score += 3;
                }
                else if (tagLower.includes(keyword)) {
                    score += 1;
                }
            }
        }
        if (score > 0) {
            matches.push({
                id: entry.id,
                summary: entry.summary,
                tags: entry.tags,
                score,
            });
        }
    }
    return matches
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults);
}
