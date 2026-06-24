/**
 * Prompts the developer with a text query and returns their trimmed answer.
 */
export function askQuestion(rl, query) {
    return new Promise((resolve) => {
        rl.question(query, (ans) => resolve(ans.trim()));
    });
}
