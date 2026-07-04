(() => {
  'use strict';

  const Sfx = {
    ctx: null,
    musicTimer: null,
    musicStep: 0,
    musicTheme: 0,
    muted: false,

    init() {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    },

    tone(freq, dur, type = 'square', vol = 0.07, when = 0, freqEnd = null) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime + when;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(40, freq), t);
      if (freqEnd) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t + dur);
      }
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },

    blip(freq, dur = 0.055, vol = 0.065, when = 0) {
      this.tone(freq, dur, 'square', vol, when);
    },

    noise(dur, vol = 0.03, when = 0) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime + when;
      const bufferSize = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const src = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      src.buffer = buffer;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(gain);
      gain.connect(this.ctx.destination);
      src.start(t);
    },

    // jump_lo / jump_mid / jump_hi — krátky upward sweep
    jump(speed = 5) {
      if (speed > 7) {
        this.tone(340, 0.07, 'square', 0.075, 0, 920);
      } else if (speed > 4.5) {
        this.tone(270, 0.065, 'square', 0.07, 0, 680);
      } else {
        this.tone(210, 0.06, 'square', 0.065, 0, 480);
      }
    },

    // step.ogg — krátky úder pri dopade
    land() {
      this.tone(110, 0.04, 'square', 0.05, 0, 75);
    },

    // step + stúpajúci combo tón (ako Icy Tower)
    platform(combo = 1) {
      const f = 440 + Math.min(combo - 1, 30) * 20;
      this.blip(f, 0.05, 0.07);
      if (combo === 5) {
        [523, 659, 784].forEach((n, i) => this.blip(n, 0.045, 0.055, i * 0.05));
      } else if (combo === 10) {
        [587, 740, 880, 1047].forEach((n, i) => this.blip(n, 0.04, 0.05, i * 0.045));
      } else if (combo === 20) {
        [659, 831, 988, 1175, 1319].forEach((n, i) => this.blip(n, 0.04, 0.048, i * 0.04));
      }
    },

    // ring.ogg
    coin() {
      this.blip(988, 0.04, 0.065);
      this.blip(1319, 0.07, 0.055, 0.035);
    },

    // menu_change.ogg
    themeChange() {
      this.tone(330, 0.07, 'square', 0.05, 0, 660);
      this.blip(880, 0.05, 0.04, 0.06);
    },

    // gameover.ogg
    gameOver() {
      [392, 330, 262, 220, 165].forEach((f, i) => {
        this.tone(f, 0.13, 'square', 0.06, i * 0.11, f * 0.72);
      });
    },

    noteFromRoot(root, semitones) {
      return root * (2 ** (semitones / 12));
    },

    getTrack(themeIndex) {
      const roots = [262, 294, 330, 392, 370, 349, 440, 466, 311, 415, 392, 440, 494, 523];
      const root = roots[themeIndex % roots.length];
      const melSteps = [0, 2, 4, 7, 9, 7, 4, 2, 0, 4, 7, 11, 9, 7, 4, 0];
      const bassSteps = [0, 0, -3, -3, 5, 5, 0, -3];
      const harmonySteps = [4, 4, 7, 7, 4, 4, 2, 2];
      return {
        root,
        melody: melSteps.map((s) => this.noteFromRoot(root, s)),
        bass: bassSteps.map((s) => this.noteFromRoot(root / 2, s)),
        harmony: harmonySteps.map((s) => this.noteFromRoot(root, s)),
      };
    },

    tickMusic() {
      if (!this.ctx || this.muted) return;
      const track = this.getTrack(this.musicTheme);
      const beat = this.musicStep % 16;
      const bar = Math.floor(beat / 4);

      this.tone(track.melody[beat], 0.11, 'triangle', 0.034);

      if (beat % 2 === 1) {
        this.tone(track.harmony[beat % track.harmony.length], 0.07, 'sine', 0.016);
      }

      if (beat % 4 === 0) {
        this.tone(track.bass[bar % track.bass.length], 0.14, 'square', 0.024);
      }

      if (beat % 4 === 2) {
        this.noise(0.018, 0.007);
      }

      if (beat === 0 || beat === 8) {
        this.tone(track.root * 2, 0.06, 'square', 0.012);
      }

      this.musicStep++;
    },

    startMusic(themeIndex = 0) {
      this.stopMusic();
      this.musicTheme = themeIndex;
      this.musicStep = 0;
      this.musicTimer = setInterval(() => this.tickMusic(), 118);
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
