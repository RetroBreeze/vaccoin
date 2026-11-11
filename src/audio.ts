export class AudioEngine {
  private ctx?: AudioContext;
  private master?: GainNode;
  private motorGain?: GainNode;
  private motor?: OscillatorNode;
  private turbine?: OscillatorNode;
  private lastCoin = 0;
  private note = 0;
  private noise?: AudioBuffer;
  private music?: HTMLAudioElement;
  private musicSource?: MediaElementAudioSourceNode;
  private musicGain?: GainNode;
  private musicGameplay = false;
  private musicTrack?: boolean;
  private musicUnlocked = false;
  private musicAttempt = 0;
  private motorActive = false;
  private coinDuckUntil = 0;
  muted = false;
  updateMusic(gameplay: boolean) {
    const changed = this.musicGameplay !== gameplay;
    this.musicGameplay = gameplay;
    if (!this.musicUnlocked || (!changed && this.music)) return;
    this.playMusic();
  }
  private playMusic() {
    if (!this.ctx || !this.master) return;
    if (!this.music) {
      this.music = new Audio();
      this.music.loop = true;
      this.music.muted = this.muted;
    }
    if (!this.musicSource) {
      // Media-element volume is not adjustable on some mobile browsers.
      // Bind this element once and mix music through Web Audio instead.
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.master);
      this.musicSource = this.ctx.createMediaElementSource(this.music);
      this.musicSource.connect(this.musicGain);
    }
    if (this.musicTrack !== this.musicGameplay) {
      this.musicTrack = this.musicGameplay;
      this.music.src = `${import.meta.env.BASE_URL}assets/music/${this.musicGameplay ? "Big-Band-Swingin_Looping.mp3" : "Mellow-Mind_Looping.mp3"}`;
    }
    this.updateMusicGain();
    const attempt = ++this.musicAttempt;
    void this.music.play().catch(() => {
      // Ignore an old track's aborted play promise after switching tracks.
      if (attempt === this.musicAttempt) this.musicUnlocked = false;
    });
  }
  private updateMusicGain() {
    if (!this.ctx || !this.musicGain) return;
    const t = this.ctx.currentTime;
    const level = this.motorActive ? 0.025 : this.musicGameplay ? 0.07 : 0.1;
    const ducked = this.coinDuckUntil > t;
    const gain = this.musicGain.gain;
    gain.cancelScheduledValues(t);
    gain.setTargetAtTime(
      ducked ? 0.012 : level,
      t,
      ducked || this.motorActive ? 0.025 : 0.18,
    );
    if (ducked) gain.setTargetAtTime(level, this.coinDuckUntil, 0.18);
  }
  async unlock() {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        const ctx = this.ctx;
        this.master = ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.55;
        this.master.connect(ctx.destination);
        const compressor = ctx.createDynamicsCompressor();
        compressor.connect(this.master);
        this.motorGain = ctx.createGain();
        this.motorGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 650;
        this.motorGain.connect(filter);
        filter.connect(compressor);
        this.motor = ctx.createOscillator();
        this.motor.type = "sawtooth";
        this.motor.frequency.value = 52;
        this.motor.connect(this.motorGain);
        this.motor.start();
        this.turbine = ctx.createOscillator();
        this.turbine.type = "sine";
        this.turbine.frequency.value = 108;
        this.turbine.connect(this.motorGain);
        this.turbine.start();
        this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.35, ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < data.length; i++)
          data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      // Both calls stay inside the gesture, before any asynchronous boundary.
      const resumed = this.ctx.resume();
      if (!this.musicUnlocked) {
        this.musicUnlocked = true;
        this.playMusic();
      }
      await resumed;
    } catch {
      this.musicUnlocked = false;
      /* Audio may be unavailable: the round still works. */
    }
  }
  setMuted(value: boolean) {
    this.muted = value;
    if (this.music) this.music.muted = value;
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(
        value ? 0 : 0.55,
        this.ctx.currentTime,
        0.025,
      );
  }
  motorUpdate(active: boolean, rate: number) {
    if (this.motorActive !== active) {
      this.motorActive = active;
      this.updateMusicGain();
    }
    if (!this.ctx || !this.motorGain || !this.motor || !this.turbine) return;
    const t = this.ctx.currentTime;
    this.motorGain.gain.setTargetAtTime(active ? 0.045 : 0, t, 0.06);
    this.motor.frequency.setTargetAtTime(
      active ? 70 + Math.min(rate, 180) * 0.14 : 45,
      t,
      0.08,
    );
    this.turbine.frequency.setTargetAtTime(
      active ? 145 + Math.min(rate, 180) * 0.4 : 95,
      t,
      0.08,
    );
  }
  tone(
    freq: number,
    duration: number,
    volume = 0.1,
    type: OscillatorType = "sine",
    delay = 0,
  ) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay,
      o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.85, t + duration);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(volume, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + duration + 0.01);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  coins(count: number) {
    if (!this.ctx || count === 0) return;
    const t = this.ctx.currentTime;
    if (t - this.lastCoin < 0.038) return;
    this.lastCoin = t;
    this.coinDuckUntil = t + 0.16;
    this.updateMusicGain();
    const notes = [784, 988, 1175, 1319, 1568, 1760];
    this.tone(
      notes[this.note++ % notes.length] * (0.98 + Math.random() * 0.04),
      0.085,
      0.065,
    );
    if (count > 12) this.tone(2093, 0.06, 0.025, "sine", 0.025);
  }
  burst() {
    if (!this.ctx || !this.master || !this.noise) return;
    const source = this.ctx.createBufferSource(),
      g = this.ctx.createGain();
    source.buffer = this.noise;
    g.gain.value = 0.23;
    source.connect(g);
    g.connect(this.master);
    source.start();
    source.onended = () => {
      source.disconnect();
      g.disconnect();
    };
    this.tone(110, 0.22, 0.18, "triangle");
    for (let i = 0; i < 5; i++)
      this.tone(660 + i * 160, 0.1, 0.045, "sine", i * 0.045);
  }
  countdown(second: number) {
    this.tone(second <= 3 ? 880 : 660, 0.12, 0.1, "triangle");
  }
  finish() {
    [523, 659, 784, 1047].forEach((n, i) =>
      this.tone(n, 0.3, 0.11, "triangle", i * 0.12),
    );
  }
  start() {
    this.note = 0;
    this.tone(523, 0.12, 0.1, "triangle");
    this.tone(1047, 0.18, 0.1, "triangle", 0.1);
  }
}
