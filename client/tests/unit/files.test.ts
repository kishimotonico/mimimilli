import { describe, it, expect } from 'vitest';
import {
  classifyFile,
  sortEntries,
  summarizeKinds,
  relSegments,
  joinPath,
  rootLabel,
  type FsEntry,
} from '../../src/features/files/model/types';

function file(name: string, fileType = 'file', size = 100): FsEntry {
  return { name, path: `/root/${name}`, isDir: false, size, fileType, childCount: 0, workId: null, workRelPath: null };
}
function dir(name: string, childCount = 0): FsEntry {
  return { name, path: `/root/${name}`, isDir: true, size: 0, fileType: 'dir', childCount, workId: null, workRelPath: null };
}

describe('classifyFile', () => {
  it('uses backend fileType when it is a known kind', () => {
    expect(classifyFile(file('a.bin', 'audio'))).toBe('audio');
    expect(classifyFile(file('a.bin', 'image'))).toBe('image');
  });

  it('falls back to extension when fileType is generic', () => {
    expect(classifyFile(file('cover.JPG', 'file'))).toBe('image');
    expect(classifyFile(file('script.txt', 'file'))).toBe('text');
    expect(classifyFile(file('clip.webm', 'other'))).toBe('video');
    expect(classifyFile(file('Thumbs.db', 'other'))).toBe('other');
    expect(classifyFile(file('readme', 'file'))).toBe('other');
  });

  it('classifies directories as dir', () => {
    expect(classifyFile(dir('特典'))).toBe('dir');
  });
});

describe('sortEntries', () => {
  it('puts directories first, then natural-sorts names', () => {
    const entries = [
      file('track10.mp3'),
      file('track2.mp3'),
      dir('zsub'),
      dir('asub'),
    ];
    expect(sortEntries(entries).map((e) => e.name)).toEqual(['asub', 'zsub', 'track2.mp3', 'track10.mp3']);
  });

  it('does not mutate the input array', () => {
    const entries = [file('b'), file('a')];
    sortEntries(entries);
    expect(entries.map((e) => e.name)).toEqual(['b', 'a']);
  });
});

describe('summarizeKinds', () => {
  it('counts entries grouped by kind in a stable order', () => {
    const entries = [
      file('a.mp3', 'audio'),
      file('b.mp3', 'audio'),
      file('c.png', 'image'),
      dir('sub', 3),
    ];
    expect(summarizeKinds(entries)).toEqual([
      { kind: 'dir', count: 1 },
      { kind: 'audio', count: 2 },
      { kind: 'image', count: 1 },
    ]);
  });
});

describe('path helpers', () => {
  const root = '/mock/library';

  it('relSegments returns [] for the root itself', () => {
    expect(relSegments(root, '/mock/library')).toEqual([]);
    expect(relSegments(root + '/', '/mock/library')).toEqual([]);
  });

  it('relSegments splits a descendant path', () => {
    expect(relSegments(root, '/mock/library/asmr/2024/12月')).toEqual(['asmr', '2024', '12月']);
  });

  it('relSegments returns [] for paths outside the root', () => {
    expect(relSegments(root, '/etc/passwd')).toEqual([]);
  });

  it('joinPath round-trips with relSegments', () => {
    const abs = '/mock/library/_未整理/download';
    expect(joinPath(root, relSegments(root, abs))).toBe(abs);
    expect(joinPath(root, [])).toBe(root);
  });

  it('rootLabel returns the last segment', () => {
    expect(rootLabel('/mock/library')).toBe('library');
    expect(rootLabel('/')).toBe('/');
  });

  it('handles Windows absolute paths without changing separators', () => {
    const windowsRoot = 'C:\\Users\\nico\\Music';
    const windowsPath = 'C:\\Users\\nico\\Music\\ASMR\\RJ123456';
    expect(relSegments(windowsRoot, windowsPath)).toEqual(['ASMR', 'RJ123456']);
    expect(joinPath(windowsRoot, ['ASMR', 'RJ123456'])).toBe(windowsPath);
    expect(rootLabel(windowsRoot)).toBe('Music');
  });

  it('handles a Windows drive root explicitly', () => {
    expect(relSegments('D:\\', 'D:\\library\\work')).toEqual(['library', 'work']);
    expect(joinPath('D:\\', ['library', 'work'])).toBe('D:\\library\\work');
    expect(joinPath('D:\\', [])).toBe('D:\\');
  });
});
