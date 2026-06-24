import readline from 'readline';

/**
 * Renders an interactive list option selector using raw terminal escape sequences and stdin keypress events.
 *
 * @param question The prompt text to display above the menu list.
 * @param options Array of option strings to select from.
 * @returns Promise resolving to the index of the selected option.
 */
export function selectOption(question: string, options: string[]): Promise<number> {
  return new Promise((resolve) => {
    let selectedIndex = 0;

    // Hide cursor
    process.stdout.write('\x1b[?25l');

    function render() {
      process.stdout.write('\r\x1b[K' + question + '\n');
      for (let i = 0; i < options.length; i++) {
        const isSelected = i === selectedIndex;
        const cursor = isSelected ? '❯ ' : '  ';
        const color = isSelected ? '\x1b[36m\x1b[1m' : '\x1b[2m';
        process.stdout.write('\r\x1b[K' + `  ${cursor}${color}${options[i]}\x1b[0m\n`);
      }
      process.stdout.write(`\x1b[${options.length + 1}A`);
    }

    render();

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    function onKeypress(str: string, key: any) {
      if (key) {
        if (key.name === 'up') {
          selectedIndex = (selectedIndex - 1 + options.length) % options.length;
          render();
        } else if (key.name === 'down') {
          selectedIndex = (selectedIndex + 1) % options.length;
          render();
        } else if (key.name === 'return' || key.name === 'enter') {
          cleanup();
          process.stdout.write(`\x1b[${options.length + 1}B\n`);
          resolve(selectedIndex);
        } else if (key.ctrl && key.name === 'c') {
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
