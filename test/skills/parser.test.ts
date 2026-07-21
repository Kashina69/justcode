import { describe, it, expect } from 'vitest';
import { stripFrontmatter } from '../../src/skills/loader.js';

describe('stripFrontmatter', () => {
  it('should strip YAML frontmatter delimited by ---', () => {
    const raw = `---
name: test
---
body content`;
    expect(stripFrontmatter(raw)).toBe('body content');
  });

  it('should return the whole text if no frontmatter', () => {
    expect(stripFrontmatter('just content')).toBe('just content');
  });

  it('should handle content with no frontmatter start', () => {
    expect(stripFrontmatter('some text')).toBe('some text');
  });
});
