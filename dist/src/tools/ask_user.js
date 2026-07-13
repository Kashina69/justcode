import readline from 'readline';
import { askQuestion } from '../cli/ask-question.js';
import { selectOption } from '../cli/select-option.js';
import { multiSelect } from '../cli/multi-select.js';
export class AskUserTool {
    rl = null;
    definition = {
        name: 'ask_user',
        description: 'Prompts the user with one or more clarifying questions (free-text, single-choice, or multi-choice) and returns their answers.',
        inputSchema: {
            type: 'object',
            properties: {
                questions: {
                    type: 'array',
                    description: 'A list of questions to ask the user.',
                    items: {
                        type: 'object',
                        properties: {
                            prompt: {
                                type: 'string',
                                description: 'The question text to display to the user.',
                            },
                            type: {
                                type: 'string',
                                enum: ['text', 'single_choice', 'multi_choice'],
                                description: 'The type of question.',
                            },
                            options: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'The list of options for single_choice or multi_choice. Required for those types.',
                            },
                        },
                        required: ['prompt', 'type'],
                    },
                },
            },
            required: ['questions'],
        },
    };
    /**
     * Sets the active readline interface for the tool to use.
     */
    setReadline(rl) {
        this.rl = rl;
    }
    /**
     * Prompts the developer with the specified list of questions and gathers their answers.
     */
    async execute(args) {
        const answers = [];
        // Fallback readline interface if none was set (e.g. in tests)
        const activeRl = this.rl || readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        try {
            for (const q of args.questions) {
                if (q.type === 'text') {
                    // Add a newline before the question for nice spacing
                    console.log('');
                    const answer = await askQuestion(activeRl, `❓ ${q.prompt} `);
                    answers.push({ prompt: q.prompt, answer });
                }
                else if (q.type === 'single_choice') {
                    console.log('');
                    const options = q.options || [];
                    if (options.length === 0) {
                        answers.push({ prompt: q.prompt, answer: null, error: 'No options provided' });
                        continue;
                    }
                    const index = await selectOption(`❓ ${q.prompt}`, options);
                    answers.push({ prompt: q.prompt, answer: options[index] });
                }
                else if (q.type === 'multi_choice') {
                    console.log('');
                    const options = q.options || [];
                    if (options.length === 0) {
                        answers.push({ prompt: q.prompt, answer: [], error: 'No options provided' });
                        continue;
                    }
                    const indices = await multiSelect(`❓ ${q.prompt}`, options);
                    const selected = indices.map((idx) => options[idx]);
                    answers.push({ prompt: q.prompt, answer: selected });
                }
                else {
                    answers.push({ prompt: q.prompt, error: `Unsupported question type: ${q.type}` });
                }
            }
            return JSON.stringify({ answers }, null, 2);
        }
        catch (err) {
            return JSON.stringify({ error: `Failed to prompt user: ${err.message}` }, null, 2);
        }
        finally {
            // Only close if it's our temporary fallback interface
            if (!this.rl) {
                activeRl.close();
            }
        }
    }
}
