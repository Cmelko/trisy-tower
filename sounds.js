(() => {
  'use strict';

  const midi = (n) => 440 * (2 ** ((n - 69) / 12));

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

    tone(freq, dur, type = 'sine', vol = 0.08, when = 0, freqEnd = null) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime + when;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (freqEnd) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t + dur);
      }
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.04);
    },

    arpeggio(notes, step = 0.055, type = 'sine', vol = 0.07) {
      notes.forEach((n, i) => this.tone(midi(n), 0.09, type, vol, i * step));
    },

    noise(dur, vol = 0.04, when = 0) {
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

    jump() {
      this.tone(midi(60), 0.18, 'sine', 0.1, 0, midi(84));
      this.tone(midi(72), 0.12, 'triangle', 0.07, 0.04, midi(79));
      this.arpeggio([79, 84, 88], 0.035, 'sine', 0.05);
    },

    land() {
      this.tone(midi(52), 0.08, 'triangle', 0.07, 0, midi(44));
      this.tone(midi(64), 0.06, 'sine', 0.045, 0.03);
      this.noise(0.04, 0.022);
    },

    coin() {
      this.arpeggio([76, 79, 84, 88, 91, 96], 0.04, 'sine', 0.085);
      this.tone(midi(100), 0.14, 'triangle', 0.055, 0.22);
    },

    platform() {
      this.arpeggio([67, 71, 74, 79], 0.035, 'triangle', 0.065);
      this.tone(midi(84), 0.07, 'sine', 0.04, 0.12);
    },

    themeChange() {
      this.arpeggio([60, 64, 67, 72, 76, 79, 84, 88], 0.06, 'sine', 0.075);
      this.tone(midi(88), 0.2, 'triangle', 0.065, 0.48);
    },

    gameOver() {
      [67, 64, 60, 55, 48].forEach((n, i) => {
        this.tone(midi(n), 0.22, 'triangle', 0.07, i * 0.14, midi(n - 5));
      });
    },

    getTrack(themeIndex) {
      const tracks = [
        { melody: [72, 76, 79, 84, 79, 76, 74, 77, 81, 77, 74, 72, 76, 79, 84, 88], bass: [48, 55, 52, 57] },
        { melody: [69, 72, 76, 79, 76, 72, 71, 74, 77, 74, 71, 69, 72, 76, 79, 83], bass: [45, 52, 48, 55] },
        { melody: [67, 70, 74, 77, 74, 70, 69, 72, 75, 72, 69, 67, 70, 74, 77, 81], bass: [43, 50, 46, 53] },
        { melody: [74, 77, 81, 84, 81, 77, 76, 79, 83, 79, 76, 74, 77, 81, 84, 88], bass: [50, 57, 53, 60] },
        { melody: [70, 74, 77, 81, 77, 74, 72, 75, 79, 75, 72, 70, 74, 77, 81, 84], bass: [46, 53, 49, 56] },
        { melody: [68, 72, 75, 79, 75, 72, 70, 73, 77, 73, 70, 68, 72, 75, 79, 82], bass: [44, 51, 47, 54] },
        { melody: [65, 68, 72, 75, 72, 68, 67, 70, 74, 70, 67, 65, 68, 72, 75, 79], bass: [41, 48, 44, 51] },
        { melody: [76, 79, 83, 86, 83, 79, 78, 81, 85, 81, 78, 76, 79, 83, 86, 90], bass: [52, 59, 55, 62] },
        { melody: [67, 71, 74, 78, 74, 71, 69, 72, 76, 72, 69, 67, 71, 74, 78, 81], bass: [43, 50, 46, 53] },
        { melody: [73, 76, 80, 83, 80, 76, 75, 78, 82, 78, 75, 73, 76, 80, 83, 87], bass: [49, 56, 52, 59] },
        { melody: [75, 78, 82, 85, 82, 78, 77, 80, 84, 80, 77, 75, 78, 82, 85, 89], bass: [51, 58, 54, 61] },
        { melody: [72, 75, 79, 82, 79, 75, 74, 77, 81, 77, 74, 72, 75, 79, 82, 86], bass: [48, 55, 52, 57] },
        { melody: [74, 77, 81, 84, 81, 77, 76, 79, 83, 79, 76, 74, 77, 81, 84, 88], bass: [50, 57, 53, 60] },
        { melody: [71, 74, 78, 81, 78, 74, 73, 76, 80, 76, 73, 71, 74, 78, 81, 85], bass: [47, 54, 50, 57] },
      ];
      return tracks[themeIndex % tracks.length];
    },

    tickMusic() {
      if (!this.ctx || this.muted) return;
      const track = this.getTrack(this.musicTheme);
      const beat = this.musicStep % 16;
      const melNote = track.melody[beat];
      const bassNote = track.bass[Math.floor(beat / 4) % track.bass.length];

      if (beat % 2 === 0) {
        this.tone(midi(melNote), 0.15, 'triangle', 0.038);
      } else {
        this.tone(midi(melNote + 4), 0.1, 'sine', 0.022);
      }

      if (beat % 4 === 0) {
        this.tone(midi(bassNote), 0.22, 'sine', 0.032);
        this.noise(0.04, 0.014);
      }

      if (beat % 4 === 2) {
        this.noise(0.025, 0.008);
      }

      if (beat % 8 === 6) {
        this.tone(midi(melNote - 12), 0.08, 'square', 0.012);
      }

      this.musicStep++;
    },

    startMusic(themeIndex = 0) {
      this.stopMusic();
      this.musicTheme = themeIndex;
      this.musicStep = 0;
      this.musicTimer = setInterval(() => this.tickMusic(), 175);
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
