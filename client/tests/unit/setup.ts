import '@testing-library/jest-dom';

// global.fetch のモック（各テストで vi.mocked(fetch) を使う）
global.fetch = vi.fn();
