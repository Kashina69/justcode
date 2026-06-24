import readline from 'readline';

/**
 * Prompts the developer with a text query and returns their trimmed answer.
 */
export function askQuestion(rl: readline.Interface, query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, (ans) => resolve(ans.trim()));
  });
}
