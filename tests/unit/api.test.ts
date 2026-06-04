import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '../../src/api';

const mockFetch = vi.mocked(fetch);

function makeResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response;
}

describe('api', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('getRootFolder fetches /api/settings and returns rootFolder', async () => {
    mockFetch.mockResolvedValue(makeResponse({ rootFolder: '/test/path', lastScanTime: null }));
    const result = await api.getRootFolder();
    expect(mockFetch).toHaveBeenCalledWith('/api/settings');
    expect(result).toBe('/test/path');
  });

  it('setRootFolder POSTs to /api/settings', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve(undefined) } as Response);
    await api.setRootFolder('/new/path');
    expect(mockFetch).toHaveBeenCalledWith('/api/settings', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ rootFolder: '/new/path' }),
    }));
  });

  it('scanLibrary POSTs to /api/scan', async () => {
    const mockResult = { registered: 5, newlyGenerated: 2, errors: 0, missing: 0, newWorkIds: [] };
    mockFetch.mockResolvedValue(makeResponse(mockResult));
    const result = await api.scanLibrary();
    expect(mockFetch).toHaveBeenCalledWith('/api/scan', expect.objectContaining({ method: 'POST' }));
    expect(result).toEqual(mockResult);
  });

  it('updateWorkTags PUTs to /api/works/:id/tags', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve(undefined) } as Response);
    await api.updateWorkTags('work-1', ['tag1', 'tag2']);
    expect(mockFetch).toHaveBeenCalledWith('/api/works/work-1/tags', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ tags: ['tag1', 'tag2'] }),
    }));
  });

  it('toggleBookmark POSTs and returns bookmarked state', async () => {
    mockFetch.mockResolvedValue(makeResponse({ bookmarked: true }));
    const result = await api.toggleBookmark('work-1');
    expect(mockFetch).toHaveBeenCalledWith('/api/works/work-1/bookmark', expect.objectContaining({ method: 'POST' }));
    expect(result).toBe(true);
  });

  it('saveResumePosition POSTs to /api/works/:id/resume', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve(undefined) } as Response);
    await api.saveResumePosition('work-1', 42.5, 2);
    expect(mockFetch).toHaveBeenCalledWith('/api/works/work-1/resume', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ position: 42.5, trackIndex: 2 }),
    }));
  });

  it('saveSearchPreset POSTs to /api/presets and returns id', async () => {
    mockFetch.mockResolvedValue(makeResponse({ id: 1 }));
    const result = await api.saveSearchPreset('preset1', 'query', ['tag'], 'added-desc');
    expect(mockFetch).toHaveBeenCalledWith('/api/presets', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ name: 'preset1', query: 'query', tagFilters: ['tag'], sortId: 'added-desc' }),
    }));
    expect(result).toBe(1);
  });

  it('exportLibrary POSTs to /api/export and returns data string', async () => {
    mockFetch.mockResolvedValue(makeResponse({ data: '{"version":1}' }));
    const result = await api.exportLibrary();
    expect(result).toBe('{"version":1}');
  });

  it('fetchDlsiteInfo POSTs to /api/dlsite/:workId/fetch', async () => {
    const mockInfo = { rjCode: 'RJ123456', title: 'test', circle: null, cvs: [], genreTags: [], coverUrl: null, url: '' };
    mockFetch.mockResolvedValue(makeResponse(mockInfo));
    const result = await api.fetchDlsiteInfo('work-1');
    expect(mockFetch).toHaveBeenCalledWith('/api/dlsite/work-1/fetch', expect.objectContaining({ method: 'POST' }));
    expect(result).toEqual(mockInfo);
  });

  it('getCoverImageUrl returns correct URL', () => {
    expect(api.getCoverImageUrl('RJ001001')).toBe('/api/works/RJ001001/cover');
  });

  it('getAudioUrl returns correct URL', () => {
    expect(api.getAudioUrl('RJ001001', 'track01.mp3')).toBe('/api/audio/RJ001001/track01.mp3');
  });
});
