import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CliSpinner } from '../../src/cli/spinner.js';

describe('CliSpinner', () => {
  let writeSpy: any;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.useFakeTimers();
  });

  afterEach(() => {
    writeSpy.mockRestore();
    vi.useRealTimers();
  });

  it('should start spinner and print frames', () => {
    const spinner = new CliSpinner();
    expect(spinner.active()).toBe(false);

    spinner.start('Test loading');
    expect(spinner.active()).toBe(true);
    expect(writeSpy).toHaveBeenCalledWith('\x1b[?25l');

    vi.advanceTimersByTime(80);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('Test loading'));

    spinner.updateText('New text');
    vi.advanceTimersByTime(80);
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('New text'));

    spinner.stop(true);
    expect(spinner.active()).toBe(false);
    expect(writeSpy).toHaveBeenCalledWith('\x1b[?25h');
    expect(writeSpy).toHaveBeenCalledWith('\r\x1b[K');
  });

  it('should stop and not clear if clear is false', () => {
    const spinner = new CliSpinner();
    spinner.start('Test');
    spinner.stop(false);
    expect(spinner.active()).toBe(false);
    expect(writeSpy).toHaveBeenCalledWith('\n');
  });
});
