import { StrictMode, createElement, useMemo, type ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Provider as JotaiProvider, createStore, useAtomValue } from 'jotai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatTime, formatDuration, formatFileSize } from '../../src/shared/lib/format';
import { usePlayer } from '../../src/features/player/model/usePlayer';
import { playerCurrentTimeAtom, playerDurationAtom } from '../../src/features/player/model/atoms';
import type { Track, WorkSummary } from '../../src/entities/work/model';

vi.mock('../../src/features/player/api', () => ({
  saveResumePosition: vi.fn(() => Promise.resolve()),
  updateLastPlayed: vi.fn(() => Promise.resolve()),
}));

class FakeAudio extends EventTarget {
  currentTime = 0;
  duration = 0;
  error: MediaError | null = null;
  playbackRate = 1;
  readyState = 0;
  src = '';
  volume = 1;

  play = vi.fn(() => {
    if (nextPlayError) {
      return Promise.reject(nextPlayError);
    }
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });

  pause = vi.fn(() => {
    this.dispatchEvent(new Event('pause'));
  });
}

const audioInstances: FakeAudio[] = [];
let nextPlayError: unknown = null;

function installFakeAudio() {
  vi.stubGlobal('Audio', vi.fn(function FakeAudioConstructor() {
    const audio = new FakeAudio();
    audioInstances.push(audio);
    return audio;
  }) as unknown as typeof Audio);
}

function latestAudio() {
  const audio = audioInstances.at(-1);
  if (!audio) throw new Error('FakeAudio was not created');
  return audio;
}

function makeWrapper({ strict = false }: { strict?: boolean } = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    const store = useMemo(() => createStore(), []);
    const tree = createElement(JotaiProvider, { store }, children);
    return strict ? createElement(StrictMode, null, tree) : tree;
  };
}

function usePlayerWithClock() {
  const player = usePlayer();
  const currentTime = useAtomValue(playerCurrentTimeAtom);
  const duration = useAtomValue(playerDurationAtom);
  return { player, currentTime, duration };
}

const track: Track = {
  title: 'Track 1',
  file: 'audio/track-1.wav',
};

const work: WorkSummary = {
  id: 'work-1',
  title: 'Work 1',
  coverImage: null,
  status: 'ok',
  physicalPath: '/audio/work-1',
  totalDurationSec: 120,
  addedAt: '2026-01-01T00:00:00.000Z',
  errorMessage: null,
  urls: [],
  tags: [],
  trackCount: 1,
  bookmarked: false,
  lastPlayedAt: null,
};

beforeEach(() => {
  audioInstances.length = 0;
  nextPlayError = null;
  installFakeAudio();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('formatTime', () => {
  it('formats 0 seconds', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('formats seconds only', () => {
    expect(formatTime(45)).toBe('0:45');
  });

  it('formats minutes and seconds', () => {
    expect(formatTime(125)).toBe('2:05');
  });

  it('formats hours', () => {
    expect(formatTime(3661)).toBe('1:01:01');
  });

  it('handles NaN', () => {
    expect(formatTime(NaN)).toBe('0:00');
  });

  it('handles Infinity', () => {
    expect(formatTime(Infinity)).toBe('0:00');
  });
});

describe('formatDuration', () => {
  it('formats 0', () => {
    expect(formatDuration(0)).toBe('0:00');
  });

  it('delegates to formatTime', () => {
    expect(formatDuration(90)).toBe('1:30');
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B');
  });

  it('formats KB', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats MB', () => {
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});

describe('usePlayer audio engine lifecycle', () => {
  it('keeps audio callbacks alive after StrictMode effect cleanup and remount', async () => {
    const { result } = renderHook(() => usePlayerWithClock(), {
      wrapper: makeWrapper({ strict: true }),
    });

    await waitFor(() => expect(audioInstances.length).toBeGreaterThanOrEqual(1));

    act(() => {
      result.current.player.play(work, [track]);
    });

    await waitFor(() => expect(latestAudio().play).toHaveBeenCalled());

    act(() => {
      const audio = latestAudio();
      audio.currentTime = 42;
      audio.duration = 120;
      audio.dispatchEvent(new Event('timeupdate'));
      audio.dispatchEvent(new Event('durationchange'));
      audio.dispatchEvent(new Event('pause'));
    });

    expect(result.current.currentTime).toBe(42);
    expect(result.current.duration).toBe(120);
    expect(result.current.player.state.isPlaying).toBe(false);
  });

  it('sets playback error and resets isPlaying when audio.play rejects', async () => {
    nextPlayError = new DOMException('User activation required', 'NotAllowedError');

    const { result } = renderHook(() => usePlayerWithClock(), {
      wrapper: makeWrapper(),
    });

    act(() => {
      result.current.player.play(work, [track]);
    });

    await waitFor(() => {
      expect(result.current.player.state.playbackError).toMatchObject({
        source: 'play',
        name: 'NotAllowedError',
        message: 'User activation required',
      });
    });
    expect(result.current.player.state.isPlaying).toBe(false);
  });
});
