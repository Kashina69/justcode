export class CliSpinner {
  private timer: NodeJS.Timeout | null = null;
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private currentFrame = 0;
  private text = '';
  private isRunning = false;

  constructor() {}

  /**
   * Starts the terminal loading spinner with the given description.
   * 
   * @param text The descriptive text to show next to the spinner.
   */
  public start(text: string): void {
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
  public updateText(text: string): void {
    this.text = text;
  }

  /**
   * Stops the spinner and restores terminal state.
   * 
   * @param clear If true, wipes the spinner line. Otherwise, starts a newline.
   */
  public stop(clear = true): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    // Show terminal cursor
    process.stdout.write('\x1b[?25h');
    if (clear) {
      process.stdout.write('\r\x1b[K');
    } else {
      process.stdout.write('\n');
    }
  }

  /**
   * Returns whether the spinner is currently active.
   */
  public active(): boolean {
    return this.isRunning;
  }
}
