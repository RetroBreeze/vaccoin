import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioEngine } from "../src/audio";

// The Node runner has no Web Audio implementation. Record the graph and audio
// automation at that browser boundary while exercising the real engine.
class Parameter {
  value = 1;
  targets: { value: number; time: number; constant: number }[] = [];
  setTargetAtTime(value: number, time: number, constant: number) {
    this.targets.push({ value, time, constant });
  }
  cancelScheduledValues(time: number) {
    this.targets = this.targets.filter((event) => event.time < time);
  }
  setValueAtTime(value: number) {
    this.value = value;
  }
  linearRampToValueAtTime() {}
  exponentialRampToValueAtTime() {}
  targetAt(time: number) {
    return (
      this.targets.filter((event) => event.time <= time).at(-1)?.value ??
      this.value
    );
  }
}
class Node {
  outputs: Node[] = [];
  gain = new Parameter();
  frequency = new Parameter();
  connect(node: Node) {
    this.outputs.push(node);
    return node;
  }
  disconnect() {
    this.outputs = [];
  }
  start() {}
  stop() {}
}
class Media {
  static instances: Media[] = [];
  static blockNextPlay = false;
  src = "";
  loop = false;
  muted = false;
  plays = 0;
  // Model iOS: setting HTMLMediaElement.volume has no effect.
  get volume() {
    return 1;
  }
  set volume(_value: number) {}
  constructor() {
    Media.instances.push(this);
  }
  pause() {}
  play() {
    this.plays++;
    if (Media.blockNextPlay) {
      Media.blockNextPlay = false;
      return Promise.reject(new Error("NotAllowedError"));
    }
    return Promise.resolve();
  }
}
class Context {
  static instances: Context[] = [];
  currentTime = 1;
  sampleRate = 48000;
  destination = new Node();
  sources: { media: Media; node: Node }[] = [];
  resumes = 0;
  constructor() {
    Context.instances.push(this);
  }
  createGain() {
    return new Node();
  }
  createDynamicsCompressor() {
    return new Node();
  }
  createBiquadFilter() {
    return new Node();
  }
  createOscillator() {
    return new Node();
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(10) };
  }
  createMediaElementSource(media: Media) {
    if (this.sources.some((source) => source.media === media))
      throw new Error("Media already bound");
    const node = new Node();
    this.sources.push({ media, node });
    return node;
  }
  async resume() {
    this.resumes++;
  }
}
function musicPath() {
  const ctx = Context.instances[0];
  const source = ctx.sources[0];
  expect(
    source,
    "music must enter Web Audio even when media volume is fixed at 1",
  ).toBeDefined();
  const gain = source.node.outputs[0];
  const master = gain.outputs[0];
  expect(master.outputs).toContain(ctx.destination);
  return { ctx, gain: gain.gain, master: master.gain, media: source.media };
}
beforeEach(() => {
  Context.instances = [];
  Media.instances = [];
  Media.blockNextPlay = false;
  vi.stubGlobal("AudioContext", Context);
  vi.stubGlobal("Audio", Media);
});
afterEach(() => vi.unstubAllGlobals());

describe("music and effects mix", () => {
  it("attenuates music through the shared output even when media volume cannot be changed", async () => {
    const audio = new AudioEngine();
    audio.updateMusic(true);
    expect(Media.instances).toHaveLength(0);
    await audio.unlock();
    const { ctx, gain, master } = musicPath();
    const output =
      gain.targetAt(ctx.currentTime + 1) * master.targetAt(ctx.currentTime + 1);
    expect(output).toBeGreaterThan(0);
    expect(output).toBeLessThan(0.05);
  });

  it("smoothly lowers music during suction, then restores it on release", async () => {
    const audio = new AudioEngine();
    audio.updateMusic(true);
    await audio.unlock();
    const { ctx, gain } = musicPath();
    const idle = gain.targetAt(ctx.currentTime + 1);
    ctx.currentTime = 2;
    audio.motorUpdate(true, 120);
    expect(gain.targetAt(2)).toBeLessThan(idle / 2);
    expect(gain.targets.at(-1)?.constant).toBeGreaterThan(0);
    ctx.currentTime = 3;
    audio.motorUpdate(false, 0);
    expect(gain.targetAt(3)).toBe(idle);
  });

  it("ducks coin pickups briefly and keeps suction ducking after the coin tail", async () => {
    const audio = new AudioEngine();
    await audio.unlock();
    const { ctx, gain } = musicPath();
    audio.motorUpdate(true, 100);
    const suction = gain.targetAt(1);
    ctx.currentTime = 2;
    audio.coins(2);
    expect(gain.targetAt(2)).toBeLessThan(suction);
    ctx.currentTime = 2.05;
    audio.motorUpdate(true, 100);
    audio.coins(1);
    expect(gain.targetAt(2.1)).toBeLessThan(suction);
    expect(gain.targetAt(3)).toBe(suction);
    expect(gain.targets.at(-1)?.constant).toBeGreaterThan(0);
  });

  it("applies a saved mute before unlock and restores the entire mix on unmute", async () => {
    const audio = new AudioEngine();
    audio.setMuted(true);
    await audio.unlock();
    const { ctx, master, media } = musicPath();
    expect(master.targetAt(ctx.currentTime)).toBe(0);
    expect(media.muted).toBe(true);
    audio.setMuted(false);
    expect(master.targetAt(ctx.currentTime)).toBeGreaterThan(0);
    expect(media.muted).toBe(false);
  });

  it("retries blocked playback on the same media source without binding it twice", async () => {
    const audio = new AudioEngine();
    Media.blockNextPlay = true;
    await audio.unlock();
    const first = Media.instances[0];
    await audio.unlock();
    audio.updateMusic(true);
    await audio.unlock();
    const { ctx, media } = musicPath();
    expect(Media.instances).toHaveLength(1);
    expect(media).toBe(first);
    expect(ctx.sources).toHaveLength(1);
    expect(media.plays).toBe(3);
    expect(media.src).toContain("Big-Band-Swingin_Looping.mp3");
    expect(ctx.resumes).toBe(3);
  });
});
