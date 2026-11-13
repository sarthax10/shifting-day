declare module 'zzfx' {
  export function zzfx(...parameters: readonly (number | undefined)[]): unknown;
  export const ZZFX: {
    volume: number;
    sampleRate: number;
    audioContext: AudioContext;
    buildSamples(...parameters: readonly (number | undefined)[]): number[];
  };
}
