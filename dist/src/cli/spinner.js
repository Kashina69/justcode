export class CliSpinner {
    timer = null;
    frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    currentFrame = 0;
    text = '';
    isRunning = false;
    constructor() { }
    /**
     * Starts the terminal loading spinner with the given description.
     *
     * @param text The descriptive text to show next to the spinner.
     */
    start(text) {
        this.text = text;
        this.isRunning = true;
        if (this.timer) {
            clearInterval(this.timer);
        }
        // Hide terminal cursor
        process.stdout.write('\x1b[?25l');
        this.timer = setInterval(() => {
            const frame = this.frames[this.currentFrame];
            this.currentFrame = (this.currentFrame + 1) % this.frames.length;
            process.stdout.write(`\r\x1b[K\x1b[36m${frame}\x1b[0m ${this.text}`);
        }, 80);
    }
    /**
     * Updates the text displayed next to the spinner.
     *
     * @param text The new descriptive text.
     */
    updateText(text) {
        this.text = text;
    }
    /**
     * Stops the spinner and restores terminal state.
     *
     * @param clear If true, wipes the spinner line. Otherwise, starts a newline.
     */
    stop(clear = true) {
        this.isRunning = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        // Show terminal cursor
        process.stdout.write('\x1b[?25h');
        if (clear) {
            process.stdout.write('\r\x1b[K');
        }
        else {
            process.stdout.write('\n');
        }
    }
    /**
     * Returns whether the spinner is currently active.
     */
    active() {
        return this.isRunning;
    }
}
