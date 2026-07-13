import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { colors, THEMES, applyTheme, saveTheme } from '../../src/cli/colors.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('CLI Color Themes', () => {
  const originalCyan = colors.cyan;
  const THEME_FILE = path.join(os.homedir(), '.agent', 'theme.json');

  beforeEach(() => {
    // Reset to default colors
    applyTheme('Default');
  });

  afterEach(() => {
    // Cleanup theme file if created during test
    try {
      if (fs.existsSync(THEME_FILE)) {
        fs.unlinkSync(THEME_FILE);
      }
    } catch {}
    applyTheme('Default');
  });

  it('should list all predefined themes', () => {
    expect(THEMES['Default']).toBeDefined();
    expect(THEMES['One Dark']).toBeDefined();
    expect(THEMES['Catppuccin']).toBeDefined();
    expect(THEMES['Material']).toBeDefined();
    expect(THEMES['Hackerman']).toBeDefined();
    expect(THEMES['Vilnius Purple']).toBeDefined();
  });

  it('should apply theme colors correctly', () => {
    applyTheme('One Dark');
    expect(colors.cyan).toBe('\x1b[38;2;86;182;194m');
    expect(colors.green).toBe('\x1b[38;2;152;195;121m');
  });

  it('should save theme configuration to user directory', () => {
    saveTheme('Catppuccin');
    expect(colors.cyan).toBe('\x1b[38;2;137;220;235m');
    expect(fs.existsSync(THEME_FILE)).toBe(true);

    const content = JSON.parse(fs.readFileSync(THEME_FILE, 'utf-8'));
    expect(content.theme).toBe('Catppuccin');
  });
});
