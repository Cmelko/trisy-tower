(() => {
  'use strict';

  const Sfx = {
    ctx: null,
    musicTimer: null,
    musicStep: 0,
    muted: false,

    init() {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },

    tone(freq, dur, type = 'square', vol = 0.08, when = 0) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime + when;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },

    noise(dur, vol = 0.04) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * dur;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const src = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      src.buffer = buffer;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(gain);
      gain.connect(this.ctx.destination);
      src.start(t);
    },

    jump() {
      this.tone(440, 0.08, 'square', 0.06);
      this.tone(660, 0.06, 'square', 0.04, 0.04);
    },

    land() {
      this.tone(180, 0.06, 'triangle', 0.07);
      this.noise(0.04, 0.02);
    },

    coin() {
      this.tone(880, 0.05, 'square', 0.06);
      this.tone(1320, 0.08, 'square', 0.05, 0.05);
    },

    platform() {
      this.tone(523, 0.04, 'square', 0.04);
    },

    themeChange() {
      [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'square', 0.05, i * 0.1));
    },

    gameOver() {
      [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.2, 'sawtooth', 0.06, i * 0.15));
    },

    startMusic(themeIndex = 0) {
      this.stopMusic();
      const scales = [
        [262, 294, 330, 392],
        [220, 247, 277, 330],
        [196, 220, 247, 277],
        [330, 370, 415, 494],
        [247, 277, 311, 370],
        [196, 233, 277, 311],
      ];
      const scale = scales[themeIndex % scales.length];
      this.musicStep = 0;
      this.musicTimer = setInterval(() => {
        if (!this.ctx || this.muted) return;
        const note = scale[this.musicStep % scale.length];
        this.tone(note, 0.15, 'triangle', 0.025);
        if (this.musicStep % 4 === 0) {
          this.tone(note / 2, 0.2, 'triangle', 0.015);
        }
        this.musicStep++;
      }, 280);
    },

    stopMusic() {
      if (this.musicTimer) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
    },

    setTheme(themeIndex) {
      if (this.musicTimer) this.startMusic(themeIndex);
    },
  };

  window.GameSfx = Sfx;
})();
