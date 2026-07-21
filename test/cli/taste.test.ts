import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  loadProjectTaste,
  saveProjectTaste,
  loadGlobalTaste,
  saveGlobalTaste,
  mergeIntoProjectTaste,
  mergeIntoGlobalTaste,
  getTasteContext,
  TasteEntry,
} from '../../src/cli/taste.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Taste Manager', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'taste-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
    // Also clean up global taste file
    const globalTaste = path.join(os.homedir(), '.justcode', 'taste', 'global-taste.md');
    try { fs.unlinkSync(globalTaste); } catch {}
  });

  it('should save and load project taste', async () => {
    const entries: TasteEntry[] = [
      { preference: 'uses TypeScript', confidence: 0.98, source: 'detected from config', category: 'code-style' },
      { preference: 'uses Tailwind CSS', confidence: 0.85, source: 'detected from tailwind.config', category: 'ui' },
    ];

    await saveProjectTaste(entries, tmpRoot);
    const loaded = await loadProjectTaste(tmpRoot);

    expect(loaded).toHaveLength(2);
    expect(loaded[0].preference).toBe('uses TypeScript');
    expect(loaded[0].confidence).toBeCloseTo(0.98, 1);
    expect(loaded[0].category).toBe('code-style');
  });

  it('should return empty array when no taste file exists', async () => {
    const entries = await loadProjectTaste(tmpRoot);
    expect(entries).toEqual([]);
  });

  it('should enforce max entries limit (20)', async () => {
    const entries: TasteEntry[] = [];
    for (let i = 0; i < 25; i++) {
      entries.push({ preference: `pref ${i}`, confidence: 1 - i * 0.04, source: 'test' });
    }

    await saveProjectTaste(entries, tmpRoot);
    const loaded = await loadProjectTaste(tmpRoot);
    expect(loaded).toHaveLength(20);
    // Highest confidence entries should be kept
    expect(loaded[0].preference).toBe('pref 0');
    expect(loaded[0].confidence).toBe(1);
  });

  it('should merge new entries with existing ones, boosting confidence on match', async () => {
    const existing: TasteEntry[] = [
      { preference: 'uses React', confidence: 0.7, source: 'initial scan' },
      { preference: 'uses TypeScript', confidence: 0.8, source: 'initial scan' },
    ];
    await saveProjectTaste(existing, tmpRoot);

    const detected: TasteEntry[] = [
      { preference: 'uses React', confidence: 0.95, source: 'confirmed in package.json' },
      { preference: 'prefers functional components', confidence: 0.75, source: 'detected from patterns' },
    ];

    const merged = await mergeIntoProjectTaste(detected, tmpRoot);
    expect(merged).toHaveLength(3);

    // React confidence should increase
    const reactEntry = merged.find(e => e.preference === 'uses React')!;
    expect(reactEntry.confidence).toBeGreaterThan(0.7);

    // TypeScript should remain unchanged
    const tsEntry = merged.find(e => e.preference === 'uses TypeScript')!;
    expect(tsEntry.confidence).toBe(0.8);
  });

  it('should save and load global taste', async () => {
    const entries: TasteEntry[] = [
      { preference: 'prefers functional components', confidence: 0.9, source: 'manual' },
    ];

    await saveGlobalTaste(entries);
    const loaded = await loadGlobalTaste();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].preference).toBe('prefers functional components');
  });

  it('should create global taste file on first access if missing', async () => {
    const globalPath = path.join(os.homedir(), '.justcode', 'taste', 'global-taste.md');
    try { fs.unlinkSync(globalPath); } catch {}

    const loaded = await loadGlobalTaste();
    expect(loaded).toEqual([]);
    expect(fs.existsSync(globalPath)).toBe(true);
  });

  it('should merge into global taste', async () => {
    const existing: TasteEntry[] = [
      { preference: 'prefers tabs over spaces', confidence: 0.6, source: 'initial' },
    ];
    await saveGlobalTaste(existing);

    const detected: TasteEntry[] = [
      { preference: 'prefers tabs over spaces', confidence: 0.8, source: 'confirmed in user code' },
      { preference: 'dislikes semicolons', confidence: 0.7, source: 'detected from patterns' },
    ];

    const merged = await mergeIntoGlobalTaste(detected);
    expect(merged).toHaveLength(2);

    const tabsEntry = merged.find(e => e.preference === 'prefers tabs over spaces')!;
    expect(tabsEntry.confidence).toBeGreaterThan(0.6);
  });

  it('getTasteContext should return formatted string with both project and global tastes', async () => {
    await saveProjectTaste([
      { preference: 'uses React', confidence: 0.95, source: 'detected', category: 'framework' },
    ], tmpRoot);

    await saveGlobalTaste([
      { preference: 'prefers functional components', confidence: 0.85, source: 'manual', category: 'code-style' },
    ]);

    const context = await getTasteContext(tmpRoot);
    expect(context).toContain('User Taste Preferences');
    expect(context).toContain('uses React');
    expect(context).toContain('prefers functional components');
    expect(context).toContain('confidence: 95%');
    expect(context).toContain('confidence: 85%');
  });

  it('getTasteContext should return empty string when no tastes exist', async () => {
    const context = await getTasteContext(tmpRoot);
    expect(context).toBe('');
  });
});
