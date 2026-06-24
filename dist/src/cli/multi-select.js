import readline from 'readline';
/**
 * Renders an interactive multi-choice option selector (checkbox style)
 * using raw terminal escape sequences and stdin keypress events.
 *
 * - Arrow keys to navigate
 * - Spacebar to toggle checkbox
 * - Enter to submit selection
 *
 * @param question The prompt text to display above the menu list.
 * @param options Array of option strings to select from.
 * @returns Promise resolving to an array of indices of the selected options.
 */
export function multiSelect(question, options) {
    return new Promise((resolve) => {
        let cursorIndex = 0;
        const selectedIndices = new Set();
        // Hide cursor
        process.stdout.write('\x1b[?25l');
        function render() {
            // Clear line and print question
            process.stdout.write('\r\x1b[K' + question + ' \x1b[2m(Space to select, Enter to confirm)\x1b[0m\n');
            for (let i = 0; i < options.length; i++) {
                const isCursor = i === cursorIndex;
                const isChecked = selectedIndices.has(i);
                const cursor = isCursor ? '❯ ' : '  ';
                const checkbox = isChecked ? '\x1b[32m[x]\x1b[0m' : '\x1b[2m[ ]\x1b[0m';
                const itemText = isCursor ? `\x1b[36m\x1b[1m${options[i]}\x1b[0m` : options[i];
                process.stdout.write('\r\x1b[K' + `  ${cursor}${checkbox} ${itemText}\n`);
            }
            // Move cursor back up (options.length + 1 lines)
            process.stdout.write(`\x1b[${options.length + 1}A`);
        }
        render();
        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
        }
        function onKeypress(str, key) {
            if (key) {
                if (key.name === 'up') {
                    cursorIndex = (cursorIndex - 1 + options.length) % options.length;
                    render();
                }
                else if (key.name === 'down') {
                    cursorIndex = (cursorIndex + 1) % options.length;
                    render();
                }
                else if (key.name === 'space') {
                    if (selectedIndices.has(cursorIndex)) {
                        selectedIndices.delete(cursorIndex);
                    }
                    else {
                        selectedIndices.add(cursorIndex);
                    }
                    render();
                }
                else if (key.name === 'return' || key.name === 'enter') {
                    cleanup();
                    // Move cursor back down past the end of the printed lines
                    process.stdout.write(`\x1b[${options.length + 1}B\n`);
                    resolve(Array.from(selectedIndices).sort((a, b) => a - b));
                }
                else if (key.ctrl && key.name === 'c') {
                    cleanup();
                    process.stdout.write('\x1b[?25h');
                    process.exit(0);
                }
            }
        }
        function cleanup() {
            process.stdin.removeListener('keypress', onKeypress);
            if (process.stdin.isTTY) {
                process.stdin.setRawMode(false);
            }
            process.stdout.write('\x1b[?25h');
        }
        process.stdin.on('keypress', onKeypress);
    });
}
