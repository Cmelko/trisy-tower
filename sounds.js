(() => {
  'use strict';

  const Sfx = {
    ctx: null,
    musicTimer: null,
    musicStep: 0,
    musicTheme: 0,
    muted: false,
    sfxOn: true,
    musicOn: true,
    buffers: null,
    loading: null,
    sfxGain: null,
    musicGain: null,
    musicSource: null,
    wantMusic: '',
    rozbehCursor: 0,
    _wallHitStreak: 0,

    prefs() {
      return { sfx: this.sfxOn, music: this.musicOn };
    },

    loadPrefs() {
      try {
        const raw = JSON.parse(localStorage.getItem('trisy-audio') || '{}');
        if (typeof raw.sfx === 'boolean') this.sfxOn = raw.sfx;
        if (typeof raw.music === 'boolean') this.musicOn = raw.music;
      } catch (err) { /* ostane zapnuté */ }
    },

    savePrefs() {
      try {
        localStorage.setItem('trisy-audio', JSON.stringify({ sfx: this.sfxOn, music: this.musicOn }));
      } catch (err) { /* súkromný režim */ }
    },

    ensureGraph() {
      this.init();
      if (!this.ctx || this.sfxGain) return;
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain.connect(this.ctx.destination);
      this.musicGain.connect(this.ctx.destination);
      this.applyGains();
    },

    applyGains() {
      if (this.sfxGain) this.sfxGain.gain.value = this.sfxOn && !this.muted ? 1 : 0;
      if (this.musicGain) this.musicGain.gain.value = this.musicOn && !this.muted ? 1 : 0;
    },

    toggleSfx() {
      this.sfxOn = !this.sfxOn;
      this.applyGains();
      this.savePrefs();
    },

    toggleMusic() {
      this.musicOn = !this.musicOn;
      this.applyGains();
      this.savePrefs();
      if (this.musicOn && this.wantMusic) this.pumpMusic();
      if (!this.musicOn) this.stopSampleMusic();
    },

    unlock() {
      this.loadPrefs();
      this.ensureGraph();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      if (!this.loading) this.loading = this.loadSamples();
      if (!this.wantMusic && document.getElementById('overlay') && !document.getElementById('overlay').classList.contains('hidden')) {
        this.startMenuMusic();
      }
    },

    async loadSamples() {
      const names = [
        'menu_klik', 'menu_ok', 'menu_spat',
        'skok_maly', 'skok_stredny', 'skok_velky',
        'skok_rozbeh_1', 'skok_rozbeh_2', 'skok_rozbeh_3',
        'dopad', 'minca',
        'kombo_1', 'kombo_2', 'kombo_3', 'kombo_4', 'kombo_5',
        'kroky_a', 'kroky_b', 'naraz_do_steny', 'odraz_od_steny',
        'hurry_up', 'game_over', 'rekord', 'zmena_temy',
        'hudba_hra', 'hudba_menu',
      ];
      const version = (window.ArtPack && ArtPack.ART_VERSION) || 'v4';
      this.buffers = {};
      await Promise.all(names.map(async (name) => {
        const buf = await this.fetchClip(name, version);
        this.buffers[name] = buf;
      }));
      this.pumpMusic();
    },

    async fetchClip(name, version) {
      for (const ext of ['ogg', 'mp3']) {
        try {
          const res = await fetch(`assets/sounds/${name}.${ext}?v=${version}`);
          if (!res.ok) continue;
          const data = await res.arrayBuffer();
          if (!this.ctx) return null;
          return await this.ctx.decodeAudioData(data.slice(0));
        } catch (err) { /* ďalší formát */ }
      }
      return null;
    },

    tryClip(name, vol) {
      if (!this.sfxOn || this.muted) return true;
      const buf = this.buffers && this.buffers[name];
      if (!buf || !this.ctx) return false;
      const src = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      gain.gain.value = vol;
      src.buffer = buf;
      src.connect(gain);
      gain.connect(this.sfxGain || this.ctx.destination);
      src.start();
      return true;
    },

    stopSampleMusic() {
      if (this.musicSource) {
        try { this.musicSource.stop(); } catch (err) { /* už skončila */ }
        this.musicSource = null;
      }
    },

    pumpMusic() {
      if (!this.wantMusic || !this.musicOn || !this.ctx) return;
      const buf = this.buffers && this.buffers[this.wantMusic];
      if (!buf) return;
      this.stopMusic();
      this.stopSampleMusic();
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(this.musicGain || this.ctx.destination);
      src.start();
      this.musicSource = src;
    },

    startMenuMusic() {
      this.wantMusic = 'hudba_menu';
      if (this.buffers && this.buffers.hudba_menu) this.pumpMusic();
      else if (!this.musicSource) this.startMusic(0, true);
    },

    onHide() {
      this.stopSampleMusic();
      this.stopMusic();
      if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
    },

    onShow(inGame) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      if (inGame) this.startMusic(this.musicTheme || 0);
      else this.startMenuMusic();
    },

    menuClick() { if (!this.tryClip('menu_klik', 0.45)) this.blip(660, 0.03, 0.04); },
    menuOk() { if (!this.tryClip('menu_ok', 0.55)) this.blip(880, 0.06, 0.05); },
    menuBack() { if (!this.tryClip('menu_spat', 0.5)) this.blip(440, 0.05, 0.04); },
    record() {
      if (this.tryClip('rekord', 0.8)) return;
      [523, 659, 784, 1047].forEach((f, i) => this.blip(f, 0.08, 0.06, i * 0.09));
    },

    wallHit(speedFactor = 0.5, streak = 0) {
      const sf = Math.max(0, Math.min(1, speedFactor));
      const atten = Math.max(0.35, 1 - (streak || 0) * 0.22);
      if (this.tryClip('naraz_do_steny', 0.5 * atten)) return;
      if (!this.ctx || this.muted || !this.sfxOn) return;
      this._wallHitStreak = streak || 0;
      const dur = Math.max(0.04, (0.06 + 0.02 * sf) * (1 - (streak || 0) * 0.12));
      const vol = (0.04 + 0.04 * sf) * atten;
      this.tone(140 + 30 * sf, dur, 'square', vol, 0, 95);
      this.noise(dur * 0.55, (0.012 + 0.01 * sf) * atten);
    },

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
        if (this.tryClip('skok_velky', 0.7)) return;
      } else if (speed > 4.5) {
        if (this.tryClip('skok_stredny', 0.65)) return;
      } else if (this.tryClip('skok_maly', 0.6)) return;
      if (!this.ctx || this.muted || !this.sfxOn) return;
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
      if (this.tryClip('dopad', 0.4)) return;
      this.tone(110, 0.04, 'square', 0.05, 0, 75);
    },

    // kroky „tu-tu-tu“ — variant 0/1 sa strieda
    step(variant = 0) {
      if (this.tryClip(variant ? 'kroky_b' : 'kroky_a', 0.35)) return;
      if (!this.ctx || this.muted || !this.sfxOn) return;
      if (variant === 0) {
        this.tone(210, 0.045, 'square', 0.05, 0, 150);
        this.noise(0.02, 0.012);
      } else {
        this.tone(175, 0.048, 'square', 0.045, 0, 130);
        this.noise(0.022, 0.014);
      }
    },

    // vyšší skok z rozbehu
    powerJump() {
      const clip = ['skok_rozbeh_1', 'skok_rozbeh_2', 'skok_rozbeh_3'][this.rozbehCursor % 3];
      this.rozbehCursor = (this.rozbehCursor + 1) % 3;
      if (this.tryClip(clip, 0.75)) return;
      if (!this.ctx || this.muted || !this.sfxOn) return;
      this.tone(340, 0.09, 'square', 0.085, 0, 980);
      this.noise(0.03, 0.025);
      this.blip(880, 0.04, 0.04, 0.07);
      this.blip(1319, 0.05, 0.035, 0.1);
    },

    // stupňujúce sa kombo (n = dĺžka reťaze po pristátí)
    combo(n = 1) {
      const clipLevel = Math.max(1, Math.min(5, Math.floor(n) || 1));
      const vols = [0.55, 0.6, 0.65, 0.7, 0.75];
      if (this.tryClip('kombo_' + clipLevel, vols[clipLevel - 1])) return;
      if (!this.ctx || this.muted || !this.sfxOn) return;
      const level = Math.max(1, Math.floor(n));
      const base = 440 + Math.min(level - 1, 20) * 35;
      const semis = level >= 4 ? [0, 4, 7, 12] : [0, 4, 7];
      const noteDur = level < 4 ? 0.045 : 0.04;
      const gap = level < 4 ? 0.05 : 0.042;
      const vol = Math.min(0.09, 0.055 + Math.min(level, 10) * 0.004);
      semis.forEach((s, i) => {
        const f = base * (2 ** (s / 12));
        this.blip(f, noteDur, vol, i * gap);
      });
      if (level >= 5) {
        const tipAt = semis.length * gap;
        this.noise(0.025, 0.02, tipAt);
        this.tone(base * 2, 0.06, 'square', 0.05, tipAt + 0.01, base * 2.5);
      }
    },

    // Hurry up! — ostrý dvojtón, asi 1 s. Antispam drží volajúci.
    hurry(urgent = false) {
      if (this.tryClip('hurry_up', urgent ? 0.75 : 0.7)) return;
      if (!this.ctx || this.muted || !this.sfxOn) return;
      const hi = urgent ? 1047 : 880;
      const lo = urgent ? 784 : 659;
      const vol = urgent ? 0.075 : 0.055;
      const period = 0.12;
      for (let i = 0; i < 8; i++) {
        const f = i % 2 === 0 ? hi : lo;
        const fEnd = i % 2 === 0 ? f * 1.15 : f * 0.92;
        this.tone(f, 0.09, 'square', vol, i * period, fEnd);
        if (urgent && i % 2 === 0) this.noise(0.02, 0.012, i * period);
      }
    },

    // odraz od steny, iný než skok
    wallBounce() {
      if (this.tryClip('odraz_od_steny', 0.55)) return;
      if (!this.ctx || this.muted || !this.sfxOn) return;
      this.tone(180, 0.035, 'square', 0.06, 0, 140);
      this.noise(0.018, 0.018);
      this.tone(320, 0.08, 'square', 0.07, 0.02, 640);
      this.tone(520, 0.05, 'triangle', 0.035, 0.055, 780);
    },

    // step + stúpajúci combo tón (staršie volanie, nové kombo ide cez combo())
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
      if (this.tryClip('minca', 0.55)) return;
      this.blip(988, 0.04, 0.065);
      this.blip(1319, 0.07, 0.055, 0.035);
    },

    // menu_change.ogg
    themeChange() {
      if (this.tryClip('zmena_temy', 0.55)) return;
      this.tone(330, 0.07, 'square', 0.05, 0, 660);
      this.blip(880, 0.05, 0.04, 0.06);
    },

    // gameover.ogg
    gameOver() {
      if (this.tryClip('game_over', 0.65)) return;
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

    startMusic(themeIndex = 0, asMenu = false) {
      this.musicTheme = themeIndex || 0;
      this.wantMusic = asMenu ? 'hudba_menu' : 'hudba_hra';
      if (!this.musicOn) {
        this.stopMusic();
        this.stopSampleMusic();
        return;
      }
      if (this.buffers && this.buffers[this.wantMusic]) {
        this.pumpMusic();
        return;
      }
      this.stopSampleMusic();
      this.stopMusic();
      this.musicStep = 0;
      this.musicTimer = setInterval(() => this.tickMusic(), 118);
    },

    stopMusic() {
      if (this.musicTimer) {
        clearInterval(this.musicTimer);
        this.musicTimer = null;
      }
      this.stopSampleMusic();
    },

    setTheme(themeIndex) {
      this.musicTheme = themeIndex;
      if (this.musicTimer && !this.musicSource) this.startMusic(themeIndex);
    },
  };

  window.GameSfx = Sfx;
})();
