/// <reference lib="webworker" />

import { calculateCycle } from './cycle-calculation';

export type CycleData = Parameters<typeof calculateCycle>;

addEventListener('message', ({ data }: MessageEvent<CycleData>) => {
  postMessage(calculateCycle(...data));
});
