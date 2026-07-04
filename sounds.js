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
      const roots = [262, 247, 220, 294, 277, 196, 330, 349, 233, 311, 370, 392, 440, 415];
      const root = roots[themeIndex % roots.length];
      const pattern = [0, 4, 7, 12, 7, 4, 2, 5, 9, 5, 2, 0, 4, 7, 12, 16];
      const bassPat = [0, 0, -5, -5, 0, 0, -7, -5];
      return {
        melody: pattern.map(s => this.noteFromRoot(root, s)),
        bass: bassPat.map(s => this.noteFromRoot(root / 2, s)),
      };
    },

    tickMusic() {
      if (!this.ctx || this.muted) return;
      const track = this.getTrack(this.musicTheme);
      const beat = this.musicStep % 16;

      if (beat % 2 === 0) {
        this.tone(track.melody[beat], 0.09, 'square', 0.026);
      }

      if (beat % 4 === 0) {
        this.tone(track.bass[Math.floor(beat / 2) % track.bass.length], 0.12, 'square', 0.02);
      }

      if (beat % 2 === 1) {
        this.noise(0.012, 0.005);
      }

      this.musicStep++;
    },

    startMusic(themeIndex = 0) {
      this.stopMusic();
      this.musicTheme = themeIndex;
      this.musicStep = 0;
      this.musicTimer = setInterval(() => this.tickMusic(), 135);
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
