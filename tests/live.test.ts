import { it, expect, vi } from 'vitest';
import { Leaderboard } from '../src/supagame';
import type { GameServices, LiveOptions } from '@supagame/sdk-ts';
it('consumes live snapshots, status, notifications and cleans up exactly once', () => {
  let callbacks: LiveOptions;
  const unsubscribe = vi.fn();
  const subscribe = vi.fn((_id, options) => { callbacks = options; return {unsubscribe}; });
  const board = new Leaderboard(undefined, {leaderboards:{subscribe}} as unknown as GameServices);
  board.startLive(); board.startLive();
  expect(subscribe).toHaveBeenCalledTimes(1);
  callbacks!.onUpdate({entries:[{playerId:'p',displayName:'PIXEL',score:100,rank:1,achievedAt:'2026-11-10T00:00:00Z'}],nextCursor:null});
  expect(board.liveEntries[0].name).toBe('PIXEL');
  callbacks!.onStatus?.('reconnecting'); expect(board.liveStatus).toBe('RECONNECTING');
  callbacks!.onRankChange?.({type:'entered_top',boardId:'vaccoin',previousRank:11,rank:10,topN:10});
  expect(board.rankNotice).toContain('TOP 10');
  callbacks!.onError?.(new Error('API failed')); expect(board.liveStatus).toBe('REQUEST FAILED');
  board.stopLive(); board.stopLive(); expect(unsubscribe).toHaveBeenCalledTimes(1);
});
