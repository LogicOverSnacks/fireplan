/// <reference lib="webworker" />

import { calculateCycles } from './cycle-calculation';

export type CycleData = Parameters<typeof calculateCycles>;

addEventListener('message', ({ data }: MessageEvent<CycleData>) => {
  postMessage(calculateCycles(...data));
});
