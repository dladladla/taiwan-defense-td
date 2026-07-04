'use strict';

/**
 * @file game.js — Complete HTML5 Canvas Tower Defense Game Engine
 * @description Self-contained TD engine with particles, synthesized audio,
 *              sprite rendering, combo system, save/load, screen shake.
 * @version 2.0.0
 */

// ============================================================================
// 1. ParticleEngine — particle system (explosion / spark / smoke / muzzle /
//    upgrade / heal / text_popup)
// ============================================================================

/**
 * @class ParticleEngine
 * @description Manages creation, update, and rendering of visual particles.
 */
class ParticleEngine {
  constructor() {
    /** @type {Object[]} Active particles */
    this.particles = [];
  }

  /**
   * Emit a burst of particles.
   * @param {string}   type   - 'explosion'|'spark'|'smoke'|'muzzle'|'upgrade'|'heal'|'text_popup'
   * @param {number}   x      - origin X
   * @param {number}   y      - origin Y
   * @param {Object}   [opts] - extra overrides
   */
  emit(type, x, y, opts = {}) {
    const count = opts.count || this._defaultCount(type);
    const spread = opts.spread || 3;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (opts.speed || this._defaultSpeed(type)) * (0.4 + Math.random() * 0.6);
      const life = (opts.life || this._defaultLife(type)) * (0.5 + Math.random() * 0.5);
      this.particles.push({
        x: x + (Math.random() - 0.5) * spread,
        y: y + (Math.random() - 0.5) * spread,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: life,
        maxLife: life,
        size: (opts.size || this._defaultSize(type)) * (0.6 + Math.random() * 0.8),
        color: opts.color || this._defaultColor(type),
        alpha: opts.alpha !== undefined ? opts.alpha : 1,
        type: type,
        text: opts.text || null,
        gravity: opts.gravity !== undefined ? opts.gravity : (type === 'smoke' ? -0.3 : 0),
      });
    }
  }

  /** @param {string} type */
  _defaultCount(type) {
    const map = { explosion: 25, spark: 8, smoke: 10, muzzle: 4, upgrade: 16, heal: 8, text_popup: 1 };
    return map[type] || 5;
  }
  /** @param {string} type */
  _defaultSpeed(type) {
    const map = { explosion: 4, spark: 3, smoke: 1.2, muzzle: 2.5, upgrade: 1.8, heal: 1.5, text_popup: 0.8 };
    return map[type] || 2;
  }
  /** @param {string} type */
  _defaultLife(type) {
    const map = { explosion: 35, spark: 20, smoke: 50, muzzle: 8, upgrade: 30, heal: 25, text_popup: 40 };
    return map[type] || 30;
  }
  /** @param {string} type */
  _defaultSize(type) {
    const map = { explosion: 4, spark: 2, smoke: 6, muzzle: 3, upgrade: 3, heal: 4, text_popup: 14 };
    return map[type] || 3;
  }
  /** @param {string} type */
  _defaultColor(type) {
    const map = {
      explosion: '#ff6b35',
      spark: '#ffd700',
      smoke: '#888888',
      muzzle: '#ffffcc',
      upgrade: '#ffd700',
      heal: '#00ff88',
      text_popup: '#ffffff',
    };
    return map[type] || '#ffffff';
  }

  /**
   * Update all active particles (one frame).
   */
  update() {
    this.particles = this.particles.filter(p => p.life > 0);
    // Cap maximum particles to prevent memory / GC pressure
    if (this.particles.length > 500) {
      this.particles = this.particles.slice(-350);
    }
    for (const p of this.particles) {
      p.life--;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      // easing alpha near death
      const ratio = p.life / p.maxLife;
      p.alpha = ratio;
      // shrink near death for certain types
      if (p.type === 'explosion' || p.type === 'spark') {
        p.size *= 0.97;
      } else if (p.type === 'upgrade') {
        p.size += 0.1;
      }
      if (p.type === 'text_popup') {
        p.y -= 0.6;
      }
    }
  }

  /**
   * Render all particles onto the given context.
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      switch (p.type) {
        case 'explosion':
        case 'muzzle':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          // brighter core
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = Math.max(0, p.alpha * 0.6);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'spark':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2);
          ctx.stroke();
          break;
        case 'smoke':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'upgrade':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'heal':
          ctx.fillStyle = p.color;
          const hw = p.size * 0.3;
          ctx.fillRect(p.x - p.size / 2, p.y - hw, p.size, hw * 2);
          ctx.fillRect(p.x - hw, p.y - p.size / 2, hw * 2, p.size);
          break;
        case 'text_popup':
          if (p.text) {
            ctx.font = `bold ${p.size}px "Microsoft YaHei", sans-serif`;
            ctx.fillStyle = p.color;
            ctx.textAlign = 'center';
            ctx.fillText(p.text, p.x, p.y);
          }
          break;
      }
      ctx.restore();
    }
  }
}

// ============================================================================
// 2. EnhancedAudio — Web Audio API synthesized sound effects & music
// ============================================================================

/**
 * @class EnhancedAudio
 * @description Synthesizes all game audio using oscillators and gain nodes.
 */
class EnhancedAudio {
  constructor() {
    /** @type {AudioContext|null} */
    this.ctx = null;
    /** @type {GainNode|null} */
    this.masterGain = null;
    /** @type {OscillatorNode|null} */
    this.bgmOsc = null;
    /** @type {GainNode|null} */
    this.bgmGain = null;
    /** @type {boolean} */
    this.bgmPlaying = false;
    this._initOnInteraction = this._initOnInteraction.bind(this);
  }

  /**
   * Lazy-init AudioContext on first user interaction (browser autoplay policy).
   */
  _initOnInteraction() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio API not available');
    }
    document.removeEventListener('click', this._initOnInteraction);
    document.removeEventListener('keydown', this._initOnInteraction);
  }

  /** Ensure context is ready. */
  _ensure() {
    if (!this.ctx) {
      this._initOnInteraction();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return !!this.ctx;
  }

  // ---- Helpers ----

  /** @param {string} type - 'sine'|'square'|'sawtooth'|'triangle' */
  _osc(type, freq) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return o;
  }

  /** Create a simple noise buffer (white noise). */
  _noiseBuffer(duration = 0.1) {
    const sr = this.ctx.sampleRate;
    const len = sr * duration;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _playTone(freq, duration, type = 'square', volume = 0.15) {
    if (!this._ensure()) return;
    const osc = this._osc(type, freq);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  _playNoise(duration, volume = 0.1) {
    if (!this._ensure()) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(duration);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    src.connect(gain);
    gain.connect(this.masterGain);
    src.start();
  }

  // ---- Public API ----

  /**
   * Play shoot sound.
   * @param {'howitzer'|'coastal'|'missile'|'railgun'} type
   */
  playShoot(type = 'howitzer') {
    const map = { howitzer: 500, coastal: 700, missile: 200, railgun: 150 };
    this._playTone(map[type], 0.20, 'square', 0.16);
    this._playNoise(0.10, 0.08);
  }

  /**
   * Play hit sound.
   * @param {'infantry'|'tank'|'boss'|'fast'|'healer'} type
   */
  playHit(type = 'infantry') {
    const map = { infantry: 300, tank: 200, boss: 120, fast: 500, healer: 350 };
    this._playTone(map[type], 0.14, 'sawtooth', 0.14);
    this._playNoise(0.07, 0.07);
  }

  /** Low-frequency explosion. */
  playExplosion() {
    if (!this._ensure()) return;
    const osc = this._osc('sawtooth', 60);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4);
    osc.frequency.setValueAtTime(120, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.4);
    this._playNoise(0.3, 0.22);
  }

  /** Rising tone for tower upgrade. */
  playUpgrade() {
    if (!this._ensure()) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = this._osc('sine', freq);
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + i * 0.08;
      gain.gain.setValueAtTime(0.20, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  }

  /** Horn-like wave start. */
  playWaveStart() {
    if (!this._ensure()) return;
    const notes = [262, 330, 392, 523];
    notes.forEach((freq, i) => {
      const osc = this._osc('triangle', freq);
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.5);
    });
  }

  /** Victory fanfare. */
  playVictory() {
    if (!this._ensure()) return;
    const notes = [523, 659, 784, 1047, 784, 1047];
    notes.forEach((freq, i) => {
      const osc = this._osc('triangle', freq);
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  /** Defeat sound. */
  playDefeat() {
    if (!this._ensure()) return;
    const notes = [392, 330, 262, 196, 131];
    notes.forEach((freq, i) => {
      const osc = this._osc('sawtooth', freq);
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + i * 0.2;
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  }

  /** Tower deployment success — bright rising chime + click. */
  playDeploy() {
    if (!this._ensure()) return;
    // Rising two-note chime
    const notes = [660, 880];
    notes.forEach((freq, i) => {
      const osc = this._osc('triangle', freq);
      const gain = this.ctx.createGain();
      const t = this.ctx.currentTime + i * 0.07;
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.2);
    });
    // Deployment "click" anchor
    this._playTone(1200, 0.10, 'square', 0.10);
    this._playNoise(0.05, 0.06);
  }

  /** Error / insufficient funds — low buzz. */
  playError() {
    if (!this._ensure()) return;
    const osc = this._osc('square', 90);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.20, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.25);
    this._playNoise(0.08, 0.10);
  }

  /**
   * Start looping background music — C minor military march style.
   */
  startBGM() {
    if (!this._ensure() || this.bgmPlaying) return;
    this.bgmPlaying = true;
    this._bgmLoop();
  }

  /** Internal BGM sequencer — C minor battle march, fast tempo. */
  _bgmLoop() {
    if (!this.bgmPlaying || !this.ctx) return;
    const now = this.ctx.currentTime;

    // C minor battle march — aggressive, leaping intervals
    const melody = [
      // Bar 1-2: ascending arpeggio
      262, 311, 392, 523, 622, 523, 392,
      311, 262, 311, 392, 523, 392, 311,
      // Bar 3-4: leap up to high register
      262, 392, 523, 622, 523, 466, 392,
      349, 311, 349, 392, 466, 523, 392,
      // Bar 5-6: tense, staccato feel
      294, 349, 440, 587, 523, 440, 349,
      294, 349, 440, 587, 622, 587, 523,
      // Bar 7-8: triumphant ending
      392, 466, 523, 622, 466, 523, 392,
      311, 262, 311, 392, 523, 466, 311,
    ];

    // Faster bass line — follows harmony
    const bass = [
      131, 131, 131, 131,  131, 131, 131, 131,
      131, 131, 131, 131,  131, 131, 131, 131,
      156, 156, 156, 156,  156, 156, 156, 156,
      175, 175, 175, 175,  175, 175, 175, 175,
    ];

    const beatTime = 0.13; // faster tempo (~460 bpm feel)

    // --- Melody (square wave, brighter) ---
    melody.forEach((freq, i) => {
      const osc = this._osc('square', freq);
      const gain = this.ctx.createGain();
      const t = now + i * beatTime;
      gain.gain.setValueAtTime(0.10, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + beatTime * 0.8);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + beatTime);
    });

    // --- Bass (triangle, deeper support) ---
    bass.forEach((freq, i) => {
      const osc = this._osc('triangle', freq);
      const gain = this.ctx.createGain();
      const t = now + i * beatTime * 1.75;
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + beatTime * 1.5);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + beatTime * 1.75);
    });

    // --- Snare / marching drum layer (noise burst on each beat) ---
    for (let i = 0; i < melody.length; i++) {
      const t = now + i * beatTime;
      // Snare burst — short noise burst with slight pitch
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.04);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let s = 0; s < bufferSize; s++) {
        data[s] = (Math.random() * 2 - 1) * Math.exp(-s / (bufferSize * 0.15));
      }
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const drumGain = this.ctx.createGain();
      drumGain.gain.setValueAtTime(0.12, t);
      drumGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      src.connect(drumGain);
      drumGain.connect(this.masterGain);
      src.start(t);
      src.stop(t + 0.04);
    }

    const totalDuration = melody.length * beatTime;
    this._bgmTimer = setTimeout(() => this._bgmLoop(), totalDuration * 1000 - 50);
  }

  /** Stop background music. */
  stopBGM() {
    this.bgmPlaying = false;
    if (this._bgmTimer) {
      clearTimeout(this._bgmTimer);
      this._bgmTimer = null;
    }
  }
}

// ============================================================================
// 3. TowerDefenseGame — main game engine
// ============================================================================

/**
 * @class TowerDefenseGame
 * @description Core TD game engine handling map, towers, enemies, projectiles,
 *              rendering, input, save/load, and game loop.
 */
class TowerDefenseGame {
  constructor() {
    // ---- Canvas ----
    /** @type {HTMLCanvasElement} */
    this.canvas = document.getElementById('game-canvas');
    /** @type {CanvasRenderingContext2D} */
    this.ctx = this.canvas.getContext('2d');
    this.width = 960;
    this.height = 640;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // ---- Grid ----
    this.gridCols = 24;
    this.gridRows = 16;
    this.cellSize = 40;

    // ---- Map ----
    /** 0=grass, 1=path, 2=start, 3=end */
    this.mapData = [];

    // ---- Entities ----
    /** @type {Object[]} */
    this.towers = [];
    /** @type {Object[]} */
    this.enemies = [];
    /** @type {Object[]} */
    this.projectiles = [];

    // ---- Resources ----
    this.gold = 200;
    this.health = 100;
    this.maxHealth = 100;
    this.score = 0;

    // ---- Level / Wave ----
    this.currentLevel = 1;
    this.currentWave = 0;
    this.totalWaves = 4;
    /** @type {Object|null} */
    this.levelConfig = null;
    this.waveActive = false;
    this.enemiesRemainingInWave = 0;
    this.enemiesSpawnedInWave = 0;
    this.spawnTimer = 0;
    this.spawnInterval = 2800;

    // ---- Tower selection ----
    this.selectedTowerType = null; // 'basic' | 'rocket' | 'missile'
    this.isDragging = false;
    /** @type {{type:string, x:number, y:number, col:number, row:number}|null} */
    this.dragTower = null;

    // ---- Combo ----
    this.killCount = 0;
    this.comboCount = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.comboPulse = 0;

    // ---- Game state ----
    /** @type {'idle'|'playing'|'paused'|'victory'|'defeat'} */
    this.gameState = 'idle';

    // ---- Screen shake ----
    this.shakeTimer = 0;
    this.shakeIntensity = 0;

    // ---- Wave banner ----
    this.waveBannerText = '';
    this.waveBannerTimer = 0;

    // ---- Engines ----
    this.particleEngine = new ParticleEngine();
    this.audioEngine = new EnhancedAudio();

    // ---- Frame timing ----
    this.lastTime = 0;
    this.frameAccum = 0;
    this.FRAME_DURATION = 1000 / 60;

    // ---- Save ----
    this.lastSaveTime = 0;

    // ---- Drag preview ----
    this._dragCol = -1;
    this._dragRow = -1;

    // ---- Mouse ----
    this._mouseX = 0;
    this._mouseY = 0;

    // ---- Levels cache ----
    this.levels = null;
    this.defaultLevels = this._buildDefaultLevels();

    // ---- Init ----
    this._initMapData();
    this._bindEvents();
    this._checkSave();
    this._initAudioInteraction();
  }

  // ==========================================================================
  // 3.1 Map / Level
  // ==========================================================================

  /** Initialize empty map. */
  _initMapData() {
    this.mapData = [];
    for (let r = 0; r < this.gridRows; r++) {
      this.mapData[r] = new Array(this.gridCols).fill(0);
    }
  }

  /**
   * Build hardcoded default levels (used if levels.json fails to load).
   * @returns {Object[]}
   */
  _buildDefaultLevels() {
    return [
      {
        id: 1, name: '高雄港', description: '解放南台湾第一站，突破高雄港防线',
        startingGold: 250, startingHealth: 100, enemyWaves: 4, enemiesPerWave: 6,
        enemyTypes: ['infantry', 'fast'], spawnInterval: 2800, reward: 60,
        map: { start: { x: 0, y: 2 }, end: { x: 23, y: 13 },
          path: [
            { x: 0, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 11 }, { x: 12, y: 11 },
            { x: 12, y: 4 }, { x: 18, y: 4 }, { x: 18, y: 13 }, { x: 23, y: 13 },
          ],
        },
      },
      {
        id: 2, name: '台南城', description: '攻克历史文化名城台南',
        startingGold: 300, startingHealth: 100, enemyWaves: 5, enemiesPerWave: 7,
        enemyTypes: ['infantry', 'fast', 'tank'], spawnInterval: 2500, reward: 80,
        map: { start: { x: 0, y: 1 }, end: { x: 23, y: 14 },
          path: [
            { x: 0, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 6 }, { x: 10, y: 6 },
            { x: 10, y: 14 }, { x: 16, y: 14 }, { x: 16, y: 1 }, { x: 20, y: 1 },
            { x: 20, y: 8 }, { x: 23, y: 8 },
          ],
        },
      },
      {
        id: 3, name: '台中防线', description: '突破中部最坚固防线',
        startingGold: 350, startingHealth: 100, enemyWaves: 6, enemiesPerWave: 8,
        enemyTypes: ['infantry', 'fast', 'tank', 'healer'], spawnInterval: 2200, reward: 100,
        map: { start: { x: 0, y: 0 }, end: { x: 23, y: 15 },
          path: [
            { x: 0, y: 0 }, { x: 0, y: 3 }, { x: 8, y: 3 }, { x: 8, y: 11 },
            { x: 16, y: 11 }, { x: 16, y: 2 }, { x: 20, y: 2 }, { x: 20, y: 8 },
            { x: 12, y: 8 }, { x: 12, y: 15 }, { x: 23, y: 15 },
          ],
        },
      },
      {
        id: 4, name: '新竹基地', description: '摧毁绿蛙军事基地',
        startingGold: 400, startingHealth: 100, enemyWaves: 7, enemiesPerWave: 9,
        enemyTypes: ['infantry', 'fast', 'tank', 'healer'], spawnInterval: 2000, reward: 150,
        map: { start: { x: 0, y: 7 }, end: { x: 23, y: 7 },
          path: [
            { x: 0, y: 7 }, { x: 3, y: 7 }, { x: 3, y: 2 }, { x: 8, y: 2 },
            { x: 8, y: 12 }, { x: 13, y: 12 }, { x: 13, y: 3 }, { x: 18, y: 3 },
            { x: 18, y: 13 }, { x: 21, y: 13 }, { x: 21, y: 7 }, { x: 23, y: 7 },
          ],
        },
      },
      {
        id: 5, name: '台北决战', description: '终结之战！攻克台北，实现祖国统一',
        startingGold: 500, startingHealth: 100, enemyWaves: 10, enemiesPerWave: 12,
        enemyTypes: ['infantry', 'fast', 'tank', 'healer', 'boss'], spawnInterval: 1500, reward: 300,
        map: { start: { x: 0, y: 0 }, end: { x: 12, y: 7 },
          path: [
            { x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 14, y: 4 },
            { x: 14, y: 12 }, { x: 2, y: 12 }, { x: 2, y: 8 }, { x: 8, y: 8 },
            { x: 8, y: 2 }, { x: 18, y: 2 }, { x: 18, y: 10 }, { x: 22, y: 10 },
            { x: 22, y: 5 }, { x: 16, y: 5 }, { x: 16, y: 15 }, { x: 10, y: 15 },
            { x: 10, y: 10 }, { x: 12, y: 10 },
          ],
        },
      },
    ];
  }

  /**
   * Load level configuration.
   * @param {number} levelId - 1-based level ID
   * @returns {Promise<void>}
   */
  async loadLevel(levelId) {
    // Prefer built-in defaultLevels; try external levels.json as optimisation
    const cfg = this.defaultLevels.find(l => l.id === levelId);
    if (!this.levels) {
      try {
        const resp = await fetch('levels.json');
        if (resp.ok) {
          const data = await resp.json();
          this.levels = data.levels;
        }
      } catch (_) {
        // fetch blocked under file:// (Firefox) — silently use defaults
        this.levels = [];
      }
    }
    // Use external level if available and has target id, otherwise fallback to default
    if (this.levels && this.levels.length > 0) {
      const extCfg = this.levels.find(l => l.id === levelId);
      if (extCfg) {
        this._applyLevelConfig(extCfg);
        return;
      }
    }
    if (cfg) {
      this._applyLevelConfig(cfg);
    } else {
      this._applyLevelConfig(this.defaultLevels[0]);
    }
  }

  /**
   * Apply a level configuration object to the game.
   * @param {Object} cfg
   */
  _applyLevelConfig(cfg) {
    this.levelConfig = cfg;
    this.currentLevel = cfg.id;
    this.gold = cfg.startingGold;
    this.health = cfg.startingHealth;
    this.maxHealth = cfg.startingHealth;
    this.totalWaves = cfg.enemyWaves;
    this.spawnInterval = cfg.spawnInterval;
    this.currentWave = 0;
    this.score = 0;
    this.killCount = 0;
    this.comboCount = 0;
    this.maxCombo = 0;
    this.comboTimer = 0;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.waveActive = false;
    this.gameState = 'idle';
    this.waveBannerTimer = 0;
    this.shakeTimer = 0;
    this.particleEngine.particles = [];
    this._initMapData();
    this.generateMapFromPath(cfg.map.start, cfg.map.end, cfg.map.path);
    this._updateHUD();
  }

  /**
   * Generate the grid map from a path of waypoints.
   * @param {{x:number,y:number}} start
   * @param {{x:number,y:number}} end
   * @param {{x:number,y:number}[]} path
   */
  generateMapFromPath(start, end, path) {
    // Reset
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        this.mapData[r][c] = 0;
      }
    }
    // Fill path cells between consecutive waypoints
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      this._fillLine(a.x, a.y, b.x, b.y);
    }
    // Mark start and end
    const sx = Math.min(start.x, this.gridCols - 1);
    const sy = Math.min(start.y, this.gridRows - 1);
    const ex = Math.min(end.x, this.gridCols - 1);
    const ey = Math.min(end.y, this.gridRows - 1);
    this.mapData[sy][sx] = 2;
    this.mapData[ey][ex] = 3;
  }

  /**
   * Bresenham-like line fill for path cells (axis-aligned).
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   */
  _fillLine(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    let x = x1, y = y1;
    while (true) {
      if (x >= 0 && x < this.gridCols && y >= 0 && y < this.gridRows) {
        if (this.mapData[y][x] === 0) this.mapData[y][x] = 1;
      }
      if (x === x2 && y === y2) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  }

  // ==========================================================================
  // 3.2 Audio initialization (user gesture latch)
  // ==========================================================================

  _initAudioInteraction() {
    document.addEventListener('click', () => this.audioEngine._initOnInteraction(), { once: true });
    document.addEventListener('keydown', () => this.audioEngine._initOnInteraction(), { once: true });
  }

  // ==========================================================================
  // 3.3 Input / Events
  // ==========================================================================

  _bindEvents() {
    // Buttons
    const btnStart = document.getElementById('btn-start');
    if (btnStart) btnStart.addEventListener('click', () => this.startGame());
    const btnPause = document.getElementById('btn-pause');
    if (btnPause) btnPause.addEventListener('click', () => this.togglePause());
    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) btnRestart.addEventListener('click', () => this.restartGame());

    // Tower selection cards
    document.querySelectorAll('.tower-card[data-type]').forEach(card => {
      card.addEventListener('click', () => {
        const type = card.dataset.type;
        this.selectedTowerType = this.selectedTowerType === type ? null : type;
        this._updateTowerSelectionUI();
      });
    });

    // Upgrade card
    const upgradeCard = document.getElementById('upgrade-card');
    if (upgradeCard) {
      upgradeCard.addEventListener('click', () => {
        if (this.selectedTowerType !== 'upgrade') {
          this.selectedTowerType = 'upgrade';
          this._updateTowerSelectionUI();
        } else {
          this.selectedTowerType = null;
          this._updateTowerSelectionUI();
        }
      });
    }

    // Canvas mouse events (drag & drop tower placement)
    this.canvas.addEventListener('mousedown', e => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', e => this._onMouseMove(e));
    this.canvas.addEventListener('mouseup', e => this._onMouseUp(e));
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.canvas.addEventListener('mouseleave', () => { this._dragCol = -1; this._dragRow = -1; });

    // Keyboard
    document.addEventListener('keydown', e => this._onKeyDown(e));

    // Overlay button: hide overlay AND start game
    const overlayBtn = document.getElementById('overlay-btn');
    if (overlayBtn) overlayBtn.addEventListener('click', () => {
      document.getElementById('game-overlay').classList.add('hidden');
      this.startGame();
    });
  }

  /** @param {KeyboardEvent} e */
  _onKeyDown(e) {
    switch (e.key) {
      case ' ':
        e.preventDefault();
        this.togglePause();
        break;
      case 'r':
      case 'R':
        e.preventDefault();
        this.restartGame();
        break;
      case '1':
        this.selectedTowerType = this.selectedTowerType === 'howitzer' ? null : 'howitzer';
        this._updateTowerSelectionUI();
        break;
      case '2':
        this.selectedTowerType = this.selectedTowerType === 'coastal' ? null : 'coastal';
        this._updateTowerSelectionUI();
        break;
      case '3':
        this.selectedTowerType = this.selectedTowerType === 'missile' ? null : 'missile';
        this._updateTowerSelectionUI();
        break;
      case '4':
        this.selectedTowerType = this.selectedTowerType === 'railgun' ? null : 'railgun';
        this._updateTowerSelectionUI();
        break;
    }
  }

  _updateTowerSelectionUI() {
    document.querySelectorAll('.tower-card').forEach(c => {
      c.classList.remove('selected');
      c.style.boxShadow = '';
    });
    if (this.selectedTowerType) {
      const card = document.querySelector(`.tower-card[data-type="${this.selectedTowerType}"]`);
      if (card) {
        card.classList.add('selected');
        card.style.boxShadow = '0 0 18px 3px rgba(255,215,0,0.7)';
      }
    }
  }

  /** @param {MouseEvent} e */
  _onMouseDown(e) {
    if (this.gameState !== 'playing' && this.gameState !== 'idle') return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.width / rect.width;
    const scaleY = this.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const col = Math.floor(mx / this.cellSize);
    const row = Math.floor(my / this.cellSize);

    // Left-click: place tower if a type is selected
    if (e.button === 0 && this.selectedTowerType) {
      if (this.selectedTowerType === 'upgrade') {
        this._tryUpgradeTower(col, row);
      } else {
        this._tryPlaceTower(col, row, this.selectedTowerType);
        // Deploy one then deselect (one-click deploy)
        this.selectedTowerType = null;
        this._updateTowerSelectionUI();
      }
      return;
    }

    // Right-click: cancel tower selection OR upgrade existing tower
    if (e.button === 2) {
      e.preventDefault();
      if (this.selectedTowerType) {
        this.selectedTowerType = null;
        this._updateTowerSelectionUI();
      } else {
        this._tryUpgradeTower(col, row);
      }
      return;
    }
  }

  /** @param {MouseEvent} e */
  _onMouseMove(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.width / rect.width;
    const scaleY = this.height / rect.height;
    this._mouseX = (e.clientX - rect.left) * scaleX;
    this._mouseY = (e.clientY - rect.top) * scaleY;
    // Always track grid cell for placement preview
    this._dragCol = Math.floor(this._mouseX / this.cellSize);
    this._dragRow = Math.floor(this._mouseY / this.cellSize);
  }

  /** @param {MouseEvent} e */
  _onMouseUp(e) {
    // Placement is handled by click in _onMouseDown; no drag logic needed.
  }

  // ==========================================================================
  // 3.4 Tower placement / upgrade
  // ==========================================================================

  /**
   * Try placing a tower at grid position.
   * @param {number} col
   * @param {number} row
   * @param {string} type
   */
  _tryPlaceTower(col, row, type) {
    if (col < 0 || col >= this.gridCols || row < 0 || row >= this.gridRows) {
      this.audioEngine.playError();
      return;
    }
    if (this.mapData[row][col] !== 0) {
      this.audioEngine.playError();
      return;
    }
    // Check no existing tower
    if (this.towers.some(t => t.col === col && t.row === row)) {
      this.audioEngine.playError();
      return;
    }

    const costs = { howitzer: 40, coastal: 25, missile: 120, railgun: 80 };
    const cost = costs[type] || 40;
    if (this.gold < cost) {
      this._flashGold();
      this.audioEngine.playError();
      return;
    }

    this.gold -= cost;
    const cx = col * this.cellSize + this.cellSize / 2;
    const cy = row * this.cellSize + this.cellSize / 2;
    this.towers.push({
      type, col, row, x: cx, y: cy,
      level: 1,
      angle: 0,
      cooldown: 0,
      target: null,
      kills: 0,
      autoUpgrade: true,
    });
    this.mapData[row][col] = 4; // occupied

    // Enhanced deploy feedback
    this.audioEngine.playDeploy();
    this.particleEngine.emit('muzzle', cx, cy, { count: 6, speed: 2.5, life: 8, size: 3 });
    this.particleEngine.emit('upgrade', cx, cy, { count: 12, speed: 3, life: 25, size: 4, color: '#ffd700' });
    this.screenShake(3, 1.5);
    this._updateHUD();
  }

  /**
   * Try upgrading a tower at grid position.
   * @param {number} col
   * @param {number} row
   */
  _tryUpgradeTower(col, row) {
    const tower = this.towers.find(t => t.col === col && t.row === row);
    if (!tower) return;
    if (tower.level >= 3) return;
    const costs = { howitzer: { 2: 60, 3: 120 }, coastal: { 2: 40, 3: 80 }, missile: { 2: 180, 3: 300 }, railgun: { 2: 120, 3: 200 } };
    const cost = (costs[tower.type] || {})[tower.level + 1];
    if (!cost || this.gold < cost) {
      this._flashGold();
      this.audioEngine.playError();
      return;
    }
    this.gold -= cost;
    tower.level++;
    this.audioEngine.playUpgrade();
    this.particleEngine.emit('upgrade', tower.x, tower.y, { count: 18, speed: 2, life: 30, size: 3 });
    this.screenShake(5, 2);
    this._updateHUD();
  }

  /**
   * Check if a tower qualifies for auto-upgrade based on kills.
   * @param {Object} tower
   */
  _checkAutoUpgrade(tower) {
    if (!tower.autoUpgrade || tower.level >= 3) return;
    const killsNeeded = tower.level === 1 ? 8 : 20;
    if (tower.kills >= killsNeeded) {
      tower.level += 1;
      tower.kills = 0;
      this.particleEngine.emit('upgrade', tower.x, tower.y, { count: 18, speed: 2, life: 30, size: 3 });
      this.particleEngine.emit('text_popup', tower.x, tower.y - 20, {
        count: 1,
        text: 'UP!',
        color: '#ffd700',
        size: 16,
        life: 60,
        speed: 0.5,
      });
      this.screenShake(5, 2);
      this.audioEngine.playShoot('basic');
      this._updateHUD();
    }
  }

  /** Flash gold counter to indicate insufficient funds. */
  _flashGold() {
    const el = document.getElementById('gold-value');
    if (el) {
      el.style.color = '#ff4444';
      setTimeout(() => { el.style.color = '#ffd700'; }, 300);
    }
  }

  // ==========================================================================
  // 3.5 Game controls
  // ==========================================================================

  startGame() {
    if (this.gameState === 'playing') return;
    this.gameState = 'playing';
    if (this.currentWave === 0) {
      this.startWave();
    }
    this.audioEngine.startBGM();
    this._updateHUD();
  }

  togglePause() {
    if (this.gameState === 'playing') {
      this.gameState = 'paused';
      this.audioEngine.stopBGM();
      this._showOverlay('战斗暂停', '按空格键或点击继续');
    } else if (this.gameState === 'paused') {
      this.gameState = 'playing';
      this.audioEngine.startBGM();
      document.getElementById('game-overlay').classList.add('hidden');
    }
    this._updateHUD();
  }

  async restartGame() {
    this.audioEngine.stopBGM();
    this.gameState = 'idle';
    await this.loadLevel(this.currentLevel);
    this._updateHUD();
  }

  /**
   * Load a specific level by ID.
   * @param {number} levelId
   */
  async loadSpecificLevel(levelId) {
    this.audioEngine.stopBGM();
    this.gameState = 'idle';
    await this.loadLevel(levelId);
    this._updateHUD();
    this._showOverlay(
      this.levelConfig ? this.levelConfig.name : `关卡 ${levelId}`,
      this.levelConfig ? this.levelConfig.description : '准备战斗',
    );
  }

  _showOverlay(title, message) {
    const overlay = document.getElementById('game-overlay');
    document.getElementById('overlay-title').textContent = title;
    document.getElementById('overlay-message').textContent = message;
    overlay.classList.remove('hidden');
  }

  // ==========================================================================
  // 3.6 Wave system
  // ==========================================================================

  startWave() {
    if (this.gameState === 'defeat' || this.gameState === 'victory') return;
    this.currentWave++;
    this.enemiesRemainingInWave = this.levelConfig.enemiesPerWave;
    this.enemiesSpawnedInWave = 0;
    this.spawnTimer = 0;
    this.waveActive = true;
    this.waveBannerText = `第 ${this.currentWave} / ${this.totalWaves} 波进攻`;
    this.waveBannerTimer = 120;
    this.audioEngine.playWaveStart();
    this._updateHUD();
  }

  _spawnEnemy() {
    if (!this.waveActive || this.enemiesSpawnedInWave >= this.levelConfig.enemiesPerWave) return;
    const types = this.levelConfig.enemyTypes;
    const type = types[Math.floor(Math.random() * types.length)];
    const startPos = this.levelConfig.map.start;
    const sx = startPos.x * this.cellSize + this.cellSize / 2;
    const sy = startPos.y * this.cellSize + this.cellSize / 2;
    const stats = this._enemyStats(type);
    // Scale HP per wave
    const waveScale = 1 + (this.currentWave - 1) * 0.15;
    const enemy = {
      type,
      x: sx,
      y: sy,
      hp: Math.floor(stats.hp * waveScale),
      maxHp: Math.floor(stats.hp * waveScale),
      speed: stats.speed,
      reward: stats.reward,
      pathIndex: 0,
      targetX: sx,
      targetY: sy,
      frameCounter: Math.floor(Math.random() * 60),
      slowTimer: 0,
      alive: true,
    };
    // Set initial path target
    if (this.levelConfig.map.path.length > 1) {
      const wp = this.levelConfig.map.path[1];
      enemy.targetX = wp.x * this.cellSize + this.cellSize / 2;
      enemy.targetY = wp.y * this.cellSize + this.cellSize / 2;
      enemy.pathIndex = 1;
    }
    this.enemies.push(enemy);
    this.enemiesSpawnedInWave++;
    this.enemiesRemainingInWave = this.levelConfig.enemiesPerWave - this.enemiesSpawnedInWave + this.enemies.filter(e => e.alive).length;
  }

  /**
   * Get base stats for an enemy type.
   * @param {string} type
   * @returns {{hp:number, speed:number, reward:number}}
   */
  _enemyStats(type) {
    const map = {
      infantry: { hp: 50, speed: 1.0, reward: 10 },
      fast:     { hp: 30, speed: 1.8, reward: 8 },
      tank:     { hp: 120, speed: 0.6, reward: 25 },
      boss:     { hp: 350, speed: 0.4, reward: 80 },
      healer:   { hp: 60, speed: 0.9, reward: 15 },
    };
    return map[type] || map.infantry;
  }

  /**
   * Get tower weapon stats.
   * @param {string} type
   * @param {number} level
   * @returns {{damage:number, range:number, cooldown:number}}
   */
  _towerStats(type, level) {
    const levelMult = [1, 1.5, 2.2];
    const mult = levelMult[Math.min(level - 1, 2)] || 1;
    const base = {
      howitzer: { damage: 35, range: 180, cooldown: 45 },
      coastal:  { damage: 15, range: 140, cooldown: 18 },
      missile:  { damage: 120,range: 300, cooldown: 80 },
      railgun:  { damage: 80, range: 240, cooldown: 70 },
    };
    const b = base[type] || base.howitzer;
    return {
      damage: Math.floor(b.damage * mult),
      range: b.range,
      cooldown: b.cooldown,
    };
  }

  /** Check if wave is complete. */
  checkWaveCompletion() {
    if (!this.waveActive) return;
    const alive = this.enemies.filter(e => e.alive).length;
    this.enemiesRemainingInWave = alive + (this.levelConfig.enemiesPerWave - this.enemiesSpawnedInWave);
    if (this.enemiesSpawnedInWave >= this.levelConfig.enemiesPerWave && alive === 0) {
      this.waveActive = false;
      // Reward
      this.gold += this.levelConfig.reward || 50;
      this.comboCount = 0;
      this.comboTimer = 0;
      this._updateHUD();
      this._autoSave();

      if (this.currentWave >= this.totalWaves) {
        this._onLevelComplete();
      } else {
        // Short delay then next wave
        setTimeout(() => {
          if (this.gameState === 'playing') {
            this.startWave();
          }
        }, 2000);
      }
    }
  }

  _onLevelComplete() {
    this.gameState = 'victory';
    this.audioEngine.stopBGM();
    this.audioEngine.playVictory();
    if (this.levelConfig && this.levelConfig.id < 5) {
      this._showOverlay('城市解放！',
        `${this.levelConfig.name} 已解放！获得 ${this.levelConfig.reward} 金币奖励。即将进入下一关...`);
      setTimeout(() => {
        this.loadSpecificLevel(this.currentLevel + 1);
      }, 3000);
    } else {
      this._showOverlay('祖国统一！',
        '台湾全境解放！五星红旗飘扬在台北上空，中华民族实现伟大复兴！');
    }
  }

  // ==========================================================================
  // 3.7 Screen shake
  // ==========================================================================

  /**
   * Trigger screen shake effect.
   * @param {number} duration - frames
   * @param {number} intensity - pixels
   */
  screenShake(duration, intensity) {
    this.shakeTimer = Math.max(this.shakeTimer, duration);
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  // ==========================================================================
  // 3.8 Save / Load
  // ==========================================================================

  _autoSave() {
    try {
      const data = {
        gameState: this.gameState,
        gold: this.gold,
        health: this.health,
        maxHealth: this.maxHealth,
        currentLevel: this.currentLevel,
        currentWave: this.currentWave,
        totalWaves: this.totalWaves,
        towers: this.towers.map(t => ({ type: t.type, col: t.col, row: t.row, level: t.level })),
        score: this.score,
        maxCombo: this.maxCombo,
        killCount: this.killCount,
        timestamp: Date.now(),
      };
      localStorage.setItem('td_game_save', JSON.stringify(data));
      this.lastSaveTime = Date.now();
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }

  loadGame() {
    try {
      const raw = localStorage.getItem('td_game_save');
      if (!raw) return false;
      const data = JSON.parse(raw);
      return data;
    } catch (e) {
      return false;
    }
  }

  deleteSave() {
    localStorage.removeItem('td_game_save');
  }

  _checkSave() {
    const save = this.loadGame();
    if (save) {
      const age = Date.now() - (save.timestamp || 0);
      if (age < 86400000) { // within 24 hours
        setTimeout(() => {
          this._showOverlay('存档恢复',
            `关卡 ${save.currentLevel}，波次 ${save.currentWave}，金币 ${save.gold}。加载关卡可继续游戏。`);
        }, 500);
      }
    }
  }

  // ==========================================================================
  // 3.9 Update logic
  // ==========================================================================

  /**
   * Update all game state for one tick.
   * @param {number} dt - delta time in ms
   */
  update(dt) {
    if (this.gameState !== 'playing') return;

    const dtFactor = dt / this.FRAME_DURATION;

    // Screen shake
    if (this.shakeTimer > 0) this.shakeTimer--;

    // Wave banner
    if (this.waveBannerTimer > 0) this.waveBannerTimer--;

    // Combo timer
    if (this.comboTimer > 0) {
      this.comboTimer -= dtFactor;
      if (this.comboTimer <= 0) {
        this.comboTimer = 0;
        this.comboCount = 0;
      }
    }
    this.comboPulse += dtFactor * 0.1;

    // Spawn enemies
    if (this.waveActive) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= this.spawnInterval && this.enemiesSpawnedInWave < this.levelConfig.enemiesPerWave) {
        this.spawnTimer -= this.spawnInterval;
        this._spawnEnemy();
      }
    }

    // Update enemies
    this._updateEnemies(dtFactor);

    // Target finding & tower firing
    this._updateTowers(dtFactor);

    // Update projectiles
    this._updateProjectiles(dtFactor);

    // Update particles
    this.particleEngine.update();

    // Check wave completion
    this.checkWaveCompletion();

    // Update HUD
    this._updateHUD();
  }

  /**
   * @param {number} dtFactor
   */
  _updateEnemies(dtFactor) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      enemy.frameCounter += dtFactor;

      // Healer: heal nearby enemies
      if (enemy.type === 'healer' && Math.floor(enemy.frameCounter) % 60 === 0) {
        for (const other of this.enemies) {
          if (!other.alive || other === enemy) continue;
          const dx = other.x - enemy.x;
          const dy = other.y - enemy.y;
          if (Math.hypot(dx, dy) < 80) {
            other.hp = Math.min(other.maxHp, other.hp + 3);
            this.particleEngine.emit('heal', other.x, other.y, { count: 3, speed: 1.5, life: 15, size: 3 });
          }
        }
      }

      // Movement
      const speed = enemy.speed * (enemy.slowTimer > 0 ? 0.5 : 1) * dtFactor;
      const dx = enemy.targetX - enemy.x;
      const dy = enemy.targetY - enemy.y;
      const dist = Math.hypot(dx, dy);
      if (dist < speed) {
        enemy.x = enemy.targetX;
        enemy.y = enemy.targetY;
        // Advance to next waypoint
        const path = this.levelConfig.map.path;
        if (enemy.pathIndex >= path.length - 1) {
          // Reached end
          enemy.alive = false;
          const dmg = enemy.type === 'boss' ? 30 : enemy.type === 'tank' ? 10 : 5;
          this.health -= dmg;
          this.screenShake(8, 3);
          this.particleEngine.emit('explosion', enemy.x, enemy.y, { count: 10, speed: 3 });
          if (this.health <= 0) {
            this.health = 0;
            this.gameState = 'defeat';
            this.audioEngine.stopBGM();
            this.audioEngine.playDefeat();
            this._showOverlay('阵地失守', '绿娃已突破防线！重新集结部队再战！');
          }
        } else {
          enemy.pathIndex++;
          const wp = path[enemy.pathIndex];
          enemy.targetX = wp.x * this.cellSize + this.cellSize / 2;
          enemy.targetY = wp.y * this.cellSize + this.cellSize / 2;
        }
      } else {
        enemy.x += (dx / dist) * speed;
        enemy.y += (dy / dist) * speed;
      }

      // Slow timer
      if (enemy.slowTimer > 0) enemy.slowTimer -= dtFactor;
    }

    // Remove dead or end-reached enemies
    this.enemies = this.enemies.filter(e => e.alive && e.hp > 0);
  }

  /**
   * @param {number} dtFactor
   */
  _updateTowers(dtFactor) {
    for (const tower of this.towers) {
      tower.cooldown = Math.max(0, tower.cooldown - dtFactor);
      // Find target
      const stats = this._towerStats(tower.type, tower.level);
      let bestTarget = null;
      let bestDist = stats.range;
      // Prioritize: boss > tank > healer > closest
      const priority = { boss: 0, tank: 1, healer: 2, fast: 3, infantry: 4 };
      for (const enemy of this.enemies) {
        if (!enemy.alive || enemy.hp <= 0) continue;
        const dx = enemy.x - tower.x;
        const dy = enemy.y - tower.y;
        const d = Math.hypot(dx, dy);
        if (d > stats.range) continue;
        const p = priority[enemy.type] !== undefined ? priority[enemy.type] : 5;
        if (!bestTarget ||
            p < priority[bestTarget.type] ||
            (p === priority[bestTarget.type] && d < bestDist)) {
          bestTarget = enemy;
          bestDist = d;
        }
      }
      tower.target = bestTarget;
      if (bestTarget) {
        tower.angle = Math.atan2(bestTarget.y - tower.y, bestTarget.x - tower.x);
      }

      // Fire
      if (bestTarget && tower.cooldown <= 0) {
        tower.cooldown = stats.cooldown;
        this._fireProjectile(tower, bestTarget, stats);
        this.audioEngine.playShoot(tower.type);
        this.particleEngine.emit('muzzle', tower.x, tower.y, {
          count: tower.type === 'missile' ? 10 : tower.type === 'railgun' ? 6 : 5,
          speed: tower.type === 'missile' ? 4 : tower.type === 'coastal' ? 1.5 : 2.5,
          life: 8,
          size: tower.type === 'missile' ? 4 : tower.type === 'coastal' ? 1.5 : 3,
        });
      }
    }
  }

  /**
   * @param {Object} tower
   * @param {Object} target
   * @param {{damage:number, range:number, cooldown:number}} stats
   */
  _fireProjectile(tower, target, stats) {
    const typeMap = {
      howitzer: { radius: 4, color: '#ff8c00', splashing: true, splashRadius: 50, homing: false, speed: 5 },
      coastal:  { radius: 2, color: '#ffdd44', splashing: false, splashRadius: 0, homing: false, speed: 8 },
      missile:  { radius: 5, color: '#ff3333', splashing: false, splashRadius: 0, homing: true, speed: 5.5 },
      railgun:  { radius: 2, color: '#00ccff', splashing: false, splashRadius: 0, homing: false, speed: 12, piercing: true },
    };
    const cfg = typeMap[tower.type] || typeMap.howitzer;
    const p = {
      x: tower.x,
      y: tower.y,
      target: target,
      damage: stats.damage,
      speed: cfg.speed,
      type: tower.type,
      radius: cfg.radius,
      color: cfg.color,
      splashing: cfg.splashing,
      splashRadius: cfg.splashRadius,
      homing: cfg.homing,
      piercing: cfg.piercing || false,
      hitEnemies: [],
      towerRef: tower,
    };
    // Set initial velocity toward target
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    p.vx = (dx / d) * p.speed;
    p.vy = (dy / d) * p.speed;
    this.projectiles.push(p);
  }

  /**
   * @param {number} dtFactor
   */
  _updateProjectiles(dtFactor) {
    const toRemove = [];
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      // Homing update
      if (p.homing && p.target && p.target.alive) {
        const dx = p.target.x - p.x;
        const dy = p.target.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const lerp = 0.08;
        p.vx += (dx / d * p.speed - p.vx) * lerp;
        p.vy += (dy / d * p.speed - p.vy) * lerp;
        const spd = Math.hypot(p.vx, p.vy);
        if (spd > 0) {
          p.vx = p.vx / spd * p.speed;
          p.vy = p.vy / spd * p.speed;
        }
      }
      p.x += p.vx * dtFactor;
      p.y += p.vy * dtFactor;

      // Check bounds
      if (p.x < -20 || p.x > this.width + 20 || p.y < -20 || p.y > this.height + 20) {
        toRemove.push(i);
        continue;
      }

      // Hit detection
      if (p.splashing) {
        // Howitzer: check all enemies within splash
        let hit = false;
        for (const enemy of this.enemies) {
          if (!enemy.alive || enemy.hp <= 0) continue;
          const dx = enemy.x - p.x;
          const dy = enemy.y - p.y;
          if (Math.hypot(dx, dy) < p.splashRadius) {
            this._damageEnemy(enemy, Math.floor(p.damage * 0.7), p.towerRef);
            hit = true;
          }
        }
        // Also check direct hit
        if (p.target && p.target.alive) {
          const dx = p.target.x - p.x;
          const dy = p.target.y - p.y;
          if (Math.hypot(dx, dy) < 20) {
            this._damageEnemy(p.target, p.damage, p.towerRef);
            hit = true;
            this.particleEngine.emit('explosion', p.x, p.y, { count: 20, speed: 3, size: 3, color: '#ff8c00' });
            this.particleEngine.emit('smoke', p.x, p.y, { count: 8, speed: 1, size: 6 });
            this.screenShake(6, 3);
            this.audioEngine.playExplosion();
          }
        }
        if (hit) toRemove.push(i);
      } else if (p.piercing) {
        // Railgun: penetrate all enemies in a line, only remove when out of bounds
        let hitAny = false;
        for (const enemy of this.enemies) {
          if (!enemy.alive || enemy.hp <= 0) continue;
          if (p.hitEnemies.includes(enemy)) continue;
          const dx = enemy.x - p.x;
          const dy = enemy.y - p.y;
          // Piercing beam: wider hit radius
          if (Math.hypot(dx, dy) < 20) {
            this._damageEnemy(enemy, Math.floor(p.damage * 0.8), p.towerRef);
            p.hitEnemies.push(enemy);
            hitAny = true;
          }
        }
        // Railgun beam trail particle
        this.particleEngine.emit('spark', p.x, p.y, { count: 3, speed: 1, size: 2, color: '#00ccff' });
        if (hitAny) {
          this.particleEngine.emit('muzzle', p.x, p.y, { count: 4, speed: 2, size: 2, color: '#00ccff' });
        }
      } else {
        // Direct hit on target
        if (p.target && p.target.alive) {
          const dx = p.target.x - p.x;
          const dy = p.target.y - p.y;
          if (Math.hypot(dx, dy) < 16) {
            this._damageEnemy(p.target, p.damage, p.towerRef);
            toRemove.push(i);
            this.particleEngine.emit('spark', p.x, p.y, { count: 6, speed: 2, size: 2, color: '#ffd700' });
          }
        }
      }
    }
    // Remove in reverse to preserve indices
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.projectiles.splice(toRemove[i], 1);
    }
  }

  /**
   * Apply damage to an enemy, handle death & combo.
   * @param {Object} enemy
   * @param {number} damage
   * @param {Object|null} killerTower
   */
  _damageEnemy(enemy, damage, killerTower = null) {
    enemy.hp -= damage;
    this.particleEngine.emit('text_popup', enemy.x, enemy.y - 10, {
      count: 1,
      text: Math.floor(damage).toString(),
      color: '#ff4444',
      size: 13,
      life: 30,
      speed: 0.8,
    });
    this.audioEngine.playHit(enemy.type);

    if (enemy.hp <= 0) {
      enemy.alive = false;

      // Kill attribution for auto-upgrade
      if (killerTower && killerTower.autoUpgrade && killerTower.level < 3) {
        killerTower.kills += 1;
        this._checkAutoUpgrade(killerTower);
      }

      // Combo
      this.comboCount++;
      this.comboTimer = 120; // 2 seconds at 60fps
      if (this.comboCount > this.maxCombo) this.maxCombo = this.comboCount;
      this.comboPulse = 0;

      // Gold reward with combo multiplier
      let reward = enemy.reward;
      if (this.comboCount >= 20) reward *= 3;
      else if (this.comboCount >= 10) reward *= 2;
      else if (this.comboCount >= 5) reward = Math.floor(reward * 1.5);
      this.gold += reward;
      this.score += reward;
      this.killCount++;

      // Boss death: big explosion
      if (enemy.type === 'boss') {
        this.particleEngine.emit('explosion', enemy.x, enemy.y, { count: 40, speed: 5, size: 5, color: '#ff2222' });
        this.particleEngine.emit('smoke', enemy.x, enemy.y, { count: 20, speed: 1.5, size: 10 });
        this.screenShake(15, 6);
        this.audioEngine.playExplosion();
      } else {
        this.particleEngine.emit('explosion', enemy.x, enemy.y, { count: 15, speed: 3, size: 3, color: '#ff6b35' });
        this.particleEngine.emit('smoke', enemy.x, enemy.y, { count: 5, speed: 1, size: 5, color: '#777777' });
      }
      this.particleEngine.emit('text_popup', enemy.x, enemy.y - 5, {
        count: 1,
        text: `+${reward}`,
        color: '#ffd700',
        size: 14,
        life: 40,
        speed: 0.9,
      });
    }
  }

  // ==========================================================================
  // 3.10 Rendering
  // ==========================================================================

  render() {
    const ctx = this.ctx;
    ctx.save();

    // Screen shake offset
    let sx = 0, sy = 0;
    if (this.shakeTimer > 0) {
      sx = (Math.random() - 0.5) * this.shakeIntensity * 2;
      sy = (Math.random() - 0.5) * this.shakeIntensity * 2;
      ctx.translate(sx, sy);
    }

    // Clear
    ctx.fillStyle = '#0a2a0a';
    ctx.fillRect(-5, -5, this.width + 10, this.height + 10);

    // Render order: map → enemies → towers → projectiles → particles → HUD
    this._renderMap(ctx);
    this._renderEnemies(ctx);
    this._renderTowers(ctx);
    this._renderProjectiles(ctx);
    this._renderDragPreview(ctx);
    this.particleEngine.render(ctx);
    this._renderHUD(ctx);

    ctx.restore();
  }

  /**
   * Render the map grid.
   * @param {CanvasRenderingContext2D} ctx
   */
  _renderMap(ctx) {
    const cs = this.cellSize;
    // Pseudorandom seed per cell for grass texture
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        const v = this.mapData[r][c];
        const x = c * cs;
        const y = r * cs;
        const seed = (r * 31 + c * 17) % 100;

        if (v === 0) {
          // Grass with variation
          const b = 30 + (seed % 18);
          ctx.fillStyle = `rgb(${20 + seed % 15}, ${b + 20}, ${10 + seed % 8})`;
          ctx.fillRect(x, y, cs, cs);
          // Noise dots
          ctx.fillStyle = `rgba(${30 + seed % 20}, ${b + 30}, ${15 + seed % 10}, 0.3)`;
          ctx.fillRect(x + (seed % 20), y + ((seed * 3) % 20), 2, 2);
        } else if (v === 1) {
          // Path: sand/brown
          const b = 140 + seed % 30;
          ctx.fillStyle = `rgb(${b}, ${b - 30}, ${b - 60})`;
          ctx.fillRect(x, y, cs, cs);
          // Path edge
          ctx.fillStyle = `rgba(${b - 20}, ${b - 50}, ${b - 80}, 0.3)`;
          ctx.fillRect(x, y, cs, 2);
          ctx.fillRect(x, y + cs - 2, cs, 2);
        } else if (v === 2) {
          // Start: green glow
          ctx.fillStyle = '#1a5c1a';
          ctx.fillRect(x, y, cs, cs);
          ctx.fillStyle = '#00ff44';
          ctx.font = 'bold 22px "Microsoft YaHei", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('S', x + cs / 2, y + cs / 2);
        } else if (v === 3) {
          // End: red glow
          ctx.fillStyle = '#5c1a1a';
          ctx.fillRect(x, y, cs, cs);
          ctx.fillStyle = '#ff4444';
          ctx.font = 'bold 22px "Microsoft YaHei", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('E', x + cs / 2, y + cs / 2);
        } else if (v === 4) {
          // Occupied by tower (grass underneath with marker)
          const b = 30 + (seed % 15);
          ctx.fillStyle = `rgb(${20 + seed % 10}, ${b + 18}, ${10 + seed % 5})`;
          ctx.fillRect(x, y, cs, cs);
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= this.gridRows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cs);
      ctx.lineTo(this.gridCols * cs, r * cs);
      ctx.stroke();
    }
    for (let c = 0; c <= this.gridCols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cs, 0);
      ctx.lineTo(c * cs, this.gridRows * cs);
      ctx.stroke();
    }

    // Path connection lines
    if (this.levelConfig && this.levelConfig.map.path) {
      const path = this.levelConfig.map.path;
      ctx.strokeStyle = 'rgba(210,180,140,0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const px = path[i].x * cs + cs / 2;
        const py = path[i].y * cs + cs / 2;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }

  /**
   * Render enemies with sprite animations.
   * @param {CanvasRenderingContext2D} ctx
   */
  _renderEnemies(ctx) {
    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.hp <= 0) continue;
      this._drawEnemy(ctx, enemy);
    }
  }

  /**
   * Draw a single enemy sprite.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} enemy
   */
  _drawEnemy(ctx, enemy) {
    const frame = Math.floor(enemy.frameCounter / 15) % 4;
    const x = enemy.x;
    const y = enemy.y;
    const hpRatio = enemy.hp / enemy.maxHp;

    ctx.save();
    ctx.translate(x, y);

    // Slow effect tint
    const tint = enemy.slowTimer > 0 ? 'rgba(0,150,255,0.3)' : 'transparent';

    switch (enemy.type) {
      case 'infantry': {
        // Small green frog
        const bob = Math.sin(frame * 0.8) * 2;
        // Body
        ctx.fillStyle = '#3d8b37';
        ctx.beginPath();
        ctx.ellipse(0, -3 + bob, 9, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        // Head
        ctx.fillStyle = '#4caf50';
        ctx.beginPath();
        ctx.ellipse(0, -11 + bob, 7, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Eyes (bulging)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(-3.5, -13 + bob, 3, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(3.5, -13 + bob, 3, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(-3.5, -13 + bob, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(3.5, -13 + bob, 1.8, 0, Math.PI * 2);
        ctx.fill();
        // Mouth line
        ctx.strokeStyle = '#2a5a20';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, -8.5 + bob, 3.5, 0.1, Math.PI - 0.1);
        ctx.stroke();
        // Legs
        ctx.fillStyle = '#2d6b28';
        const legOff = [0, 2, 0, -2][frame];
        ctx.fillRect(-5, 4 + bob, 4, 5 - legOff);
        ctx.fillRect(1, 4 + bob, 4, 5 + legOff);
        break;
      }
      case 'fast': {
        // Slim orange-green dart frog
        const bob = Math.sin(frame * 1.2) * 1.5;
        ctx.fillStyle = '#e67e22';
        ctx.beginPath();
        ctx.ellipse(0, -1 + bob, 8, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f5a623';
        ctx.beginPath();
        ctx.ellipse(0, -8 + bob, 5.5, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-2.5, -9.5 + bob, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(2.5, -9.5 + bob, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(-2.5, -9.5 + bob, 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(2.5, -9.5 + bob, 1.3, 0, Math.PI * 2);
        ctx.fill();
        // Speed lines
        ctx.strokeStyle = 'rgba(255,180,50,0.5)';
        ctx.lineWidth = 1;
        for (let l = 0; l < 3; l++) {
          ctx.beginPath();
          ctx.moveTo(-14 + l * 3, -3 + bob + l * 2);
          ctx.lineTo(-10 + l * 3, -3 + bob + l * 2);
          ctx.stroke();
        }
        break;
      }
      case 'tank': {
        // Large armored toad
        const bob = Math.sin(frame * 0.5) * 1;
        // Body
        ctx.fillStyle = '#2d5016';
        ctx.beginPath();
        ctx.ellipse(0, 0 + bob, 12, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        // Armor plates
        ctx.fillStyle = '#3a6b1e';
        ctx.beginPath();
        ctx.ellipse(0, -3 + bob, 10, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        // Head
        ctx.fillStyle = '#4a7a2e';
        ctx.beginPath();
        ctx.ellipse(0, -10 + bob, 8, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#ff0';
        ctx.beginPath();
        ctx.arc(-4, -12 + bob, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(4, -12 + bob, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-4, -12 + bob, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(4, -12 + bob, 2, 0, Math.PI * 2);
        ctx.fill();
        // Spiky back
        ctx.fillStyle = '#1d3510';
        for (let s = -3; s <= 3; s++) {
          ctx.beginPath();
          ctx.moveTo(s * 3 - 1, -2 + bob);
          ctx.lineTo(s * 3, -6 + bob + (s % 2) * 2);
          ctx.lineTo(s * 3 + 1, -2 + bob);
          ctx.fill();
        }
        break;
      }
      case 'boss': {
        // Giant demon frog (red-green)
        const bob = Math.sin(frame * 0.3) * 2;
        // Body
        ctx.fillStyle = '#1b5e20';
        ctx.fillRect(-16, -12 + bob, 32, 24);
        ctx.fillStyle = '#2e7d32';
        ctx.beginPath();
        ctx.ellipse(0, -8 + bob, 15, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        // Head
        ctx.fillStyle = '#388e3c';
        ctx.beginPath();
        ctx.ellipse(0, -18 + bob, 12, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        // Glowing red eyes
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(-5, -20 + bob, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(5, -20 + bob, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(-5, -20 + bob, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(5, -20 + bob, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Wide mouth
        ctx.fillStyle = '#4a0000';
        ctx.beginPath();
        ctx.ellipse(0, -14 + bob, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        // Teeth
        ctx.fillStyle = '#ffffff';
        for (let t = -3; t <= 3; t++) {
          ctx.fillRect(t * 2.5 - 1.5, -14.5 + bob, 3, 2);
        }
        // Horns
        ctx.fillStyle = '#1a3a1a';
        ctx.beginPath();
        ctx.moveTo(-6, -26 + bob);
        ctx.lineTo(-8, -32 + bob);
        ctx.lineTo(-3, -26 + bob);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(6, -26 + bob);
        ctx.lineTo(8, -32 + bob);
        ctx.lineTo(3, -26 + bob);
        ctx.fill();
        break;
      }
      case 'healer': {
        // Light green healing frog
        const bob = Math.sin(frame * 0.6) * 1.5;
        ctx.fillStyle = '#81c784';
        ctx.beginPath();
        ctx.ellipse(0, -2 + bob, 9, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#a5d6a7';
        ctx.beginPath();
        ctx.ellipse(0, -10 + bob, 7, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-3, -12 + bob, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(3, -12 + bob, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(-3, -12 + bob, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(3, -12 + bob, 1.5, 0, Math.PI * 2);
        ctx.fill();
        // White cross (medic)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-1.5, -6 + bob, 3, 10);
        ctx.fillRect(-5, -3 + bob, 10, 3);
        // Healing glow
        ctx.strokeStyle = 'rgba(0,255,136,0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -2 + bob, 13, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
    }

    // Slow tint overlay
    if (enemy.slowTimer > 0) {
      ctx.fillStyle = tint;
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // HP bar (above enemy)
    if (hpRatio < 1) {
      const barW = 22;
      const barH = 3;
      const bx = x - barW / 2;
      const by = y - 22;
      ctx.fillStyle = '#333333';
      ctx.fillRect(bx, by, barW, barH);
      const hpColor = hpRatio > 0.5 ? '#00d4aa' : hpRatio > 0.25 ? '#ffd700' : '#ff4444';
      ctx.fillStyle = hpColor;
      ctx.fillRect(bx, by, barW * hpRatio, barH);
    }
  }

  /**
   * Render towers.
   * @param {CanvasRenderingContext2D} ctx
   */
  _renderTowers(ctx) {
    for (const tower of this.towers) {
      this._drawTower(ctx, tower.x, tower.y, tower.type, tower.level, tower.angle);
      // Experience bar for auto-upgrade (only when level < 3 and autoUpgrade enabled)
      if (tower.autoUpgrade && tower.level < 3) {
        const killsNeeded = tower.level === 1 ? 8 : 20;
        const barW = 20;
        const barH = 3;
        const bx = tower.x - barW / 2;
        const by = tower.y - 26;
        // Background
        ctx.fillStyle = '#4a3020';
        ctx.fillRect(bx, by, barW, barH);
        // Fill
        const ratio = Math.min(1, tower.kills / killsNeeded);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(bx, by, barW * ratio, barH);
        // Border
        ctx.strokeStyle = '#886633';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(bx, by, barW, barH);
        // Tiny text
        ctx.fillStyle = '#ffffff';
        ctx.font = '7px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${tower.kills}/${killsNeeded}`, tower.x, by - 1);
      }
    }
  }

  /**
   * Draw a single tower sprite with military-style graphics.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {string} type
   * @param {number} level
   * @param {number} angle
   */
  _drawTower(ctx, x, y, type, level, angle) {
    ctx.save();
    ctx.translate(x, y);

    // Base shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 14, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    switch (type) {
      case 'howitzer': {
        // === 155mm Howitzer ===
        // Circular dark green base
        ctx.fillStyle = '#3d5a1e';
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#2a4010';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Lv2: camo stripes on base
        if (level >= 2) {
          ctx.fillStyle = '#4a6b26';
          for (let i = 0; i < 4; i++) {
            const a = (i * Math.PI / 2) + 0.3;
            ctx.beginPath();
            ctx.ellipse(Math.cos(a) * 5, Math.sin(a) * 5, 7, 3, a, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Lv3: widened barrel + heat vents
        const barrelLen = 14 + level * 2;
        const barrelW = level >= 3 ? 8 : 6;
        ctx.save();
        ctx.rotate(angle);
        // Barrel body - military green
        ctx.fillStyle = '#4a5c28';
        ctx.fillRect(2, -barrelW / 2, barrelLen - 2, barrelW);
        // Barrel highlight
        ctx.fillStyle = '#5c6e36';
        ctx.fillRect(2, -barrelW / 2, barrelLen - 2, barrelW / 3);
        // Muzzle brake
        ctx.fillStyle = '#2a3018';
        ctx.fillRect(barrelLen - 4, -barrelW / 2 - 2, 6, barrelW + 4);
        ctx.fillStyle = '#1a2010';
        ctx.fillRect(barrelLen - 2, -barrelW / 2 - 1, 2, barrelW + 2);

        // Lv3: heat vent holes on barrel
        if (level >= 3) {
          ctx.fillStyle = '#1a1a0a';
          for (let v = 0; v < 3; v++) {
            ctx.fillRect(6 + v * 4, -barrelW / 2 + 1, 2, barrelW - 2);
          }
        }
        ctx.restore();
        break;
      }
      case 'coastal': {
        // === Coastal Rapid-Fire ===
        // Octagonal gray base
        ctx.fillStyle = '#778899';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI / 4) - Math.PI / 8;
          const r = 12;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#556677';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Lv2: shield plate
        if (level >= 2) {
          ctx.fillStyle = '#889999';
          ctx.beginPath();
          ctx.arc(0, 0, 10, -Math.PI * 0.6, Math.PI * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#667777';
          ctx.stroke();
        }

        // Twin/Four barrels with ring reinforcement
        const barrelCount = level >= 3 ? 4 : 2;
        const barrelLen = 11 + level;
        const barrelGap = level >= 3 ? 4 : 6;
        ctx.save();
        ctx.rotate(angle);
        ctx.fillStyle = '#555555';
        for (let i = 0; i < barrelCount; i++) {
          const offY = (i - (barrelCount - 1) / 2) * barrelGap;
          // Main barrel
          ctx.fillStyle = '#4a4a4a';
          ctx.fillRect(0, offY - 1.5, barrelLen, 3);
          // Ring reinforcements
          ctx.fillStyle = '#666666';
          ctx.fillRect(barrelLen * 0.3, offY - 2, 2, 4);
          ctx.fillRect(barrelLen * 0.6, offY - 2, 2, 4);
        }
        ctx.restore();
        break;
      }
      case 'missile': {
        // === HQ-9 Missile Launcher ===
        // Camo launch box
        ctx.fillStyle = '#5a6040';
        ctx.fillRect(-8, -6, 16, 12);
        ctx.strokeStyle = '#3a4020';
        ctx.lineWidth = 1;
        ctx.strokeRect(-8, -6, 16, 12);
        // Camo pattern on box
        ctx.fillStyle = '#4a5030';
        ctx.fillRect(-8, -6, 8, 4);
        ctx.fillRect(4, 2, 4, 4);
        ctx.fillStyle = '#6a7040';
        ctx.fillRect(-2, -6, 4, 3);

        // Missile tubes
        const tubeCount = level === 1 ? 1 : level === 2 ? 2 : 4;
        const tubeW = level >= 3 ? 4 : 5;
        const tubeH = 10;
        ctx.save();
        ctx.rotate(angle);
        for (let i = 0; i < tubeCount; i++) {
          const offY = (i - (tubeCount - 1) / 2) * (tubeW + 2);
          // Tube body
          ctx.fillStyle = '#8a8888';
          ctx.fillRect(2, offY - tubeW / 2, 14, tubeW);
          ctx.strokeStyle = '#666666';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(2, offY - tubeW / 2, 14, tubeW);
          // Red missile tip protruding
          ctx.fillStyle = '#ff2222';
          ctx.beginPath();
          ctx.moveTo(15, offY - tubeW / 2);
          ctx.lineTo(19, offY);
          ctx.lineTo(15, offY + tubeW / 2);
          ctx.closePath();
          ctx.fill();
          // Missile body visible inside
          ctx.fillStyle = '#e8e8e8';
          ctx.fillRect(4, offY - tubeW / 2 + 1, 11, tubeW - 2);
        }
        ctx.restore();
        break;
      }
      case 'railgun': {
        // === Electromagnetic Railgun ===
        // Tech-blue rectangular base
        ctx.fillStyle = '#335577';
        ctx.fillRect(-12, -3, 24, 14);
        ctx.strokeStyle = '#225588';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-12, -3, 24, 14);
        // Inner energy core
        ctx.fillStyle = '#1a6a8a';
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1199bb';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();

        // Dual energy rails with arc effect
        const railLen = 15 + level * 3;
        const railGap = level >= 2 ? 5 : 4;
        ctx.save();
        ctx.rotate(angle);
        // Upper rail
        ctx.fillStyle = '#44aadd';
        ctx.fillRect(2, -railGap - 1.5, railLen - 2, 2);
        // Lower rail
        ctx.fillStyle = '#44aadd';
        ctx.fillRect(2, railGap - 0.5, railLen - 2, 2);
        // Arc effect between rails
        if (level >= 2) {
          ctx.strokeStyle = 'rgba(100,200,255,0.5)';
          ctx.lineWidth = 1;
          for (let a = 0; a < 3; a++) {
            const ax = 5 + a * 5;
            ctx.beginPath();
            ctx.moveTo(ax, -railGap);
            ctx.lineTo(ax + 2, 0);
            ctx.lineTo(ax, railGap);
            ctx.stroke();
          }
        }

        // Energy glow at muzzle
        const glowR = 2 + level;
        ctx.fillStyle = 'rgba(0,200,255,0.5)';
        ctx.beginPath();
        ctx.arc(railLen, 0, glowR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(180,240,255,0.7)';
        ctx.beginPath();
        ctx.arc(railLen, 0, glowR * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Lv3: capacitor ring
        if (level >= 3) {
          ctx.strokeStyle = '#22ccff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 12, -Math.PI * 0.3, Math.PI * 0.3);
          ctx.stroke();
          // Capacitor nodes
          ctx.fillStyle = '#00ddff';
          for (let n = 0; n < 3; n++) {
            const na = -Math.PI * 0.3 + n * Math.PI * 0.3;
            ctx.beginPath();
            ctx.arc(Math.cos(na) * 12, Math.sin(na) * 12, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }
    }

    // Level star indicator above tower
    if (level > 1) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 10px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★'.repeat(level - 1), 0, -18);
    }

    ctx.restore();
  }

  /**
   * Render projectiles.
   * @param {CanvasRenderingContext2D} ctx
   */
  _renderProjectiles(ctx) {
    for (const p of this.projectiles) {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      // Glow
      ctx.fillStyle = 'rgba(255,255,200,0.4)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  /**
   * Render placement preview (follows mouse when a tower type is selected).
   * @param {CanvasRenderingContext2D} ctx
   */
  _renderDragPreview(ctx) {
    if (!this.selectedTowerType || this.selectedTowerType === 'upgrade') return;
    const col = this._dragCol;
    const row = this._dragRow;
    if (col < 0 || col >= this.gridCols || row < 0 || row >= this.gridRows) return;
    const cx = col * this.cellSize + this.cellSize / 2;
    const cy = row * this.cellSize + this.cellSize / 2;

    // Check validity: grass + no existing tower
    const isGrass = this.mapData[row][col] === 0;
    const hasTower = this.towers.some(t => t.col === col && t.row === row);
    const isValid = isGrass && !hasTower;

    // Range circle
    const stats = this._towerStats(this.selectedTowerType, 1);
    ctx.strokeStyle = isValid ? 'rgba(0,255,100,0.4)' : 'rgba(255,50,50,0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, stats.range, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Cell highlight fill
    ctx.fillStyle = isValid ? 'rgba(0,255,100,0.15)' : 'rgba(255,50,50,0.2)';
    ctx.fillRect(col * this.cellSize, row * this.cellSize, this.cellSize, this.cellSize);

    // Cell border highlight
    ctx.strokeStyle = isValid ? '#00ff64' : '#ff3232';
    ctx.lineWidth = 2;
    ctx.strokeRect(col * this.cellSize + 1, row * this.cellSize + 1, this.cellSize - 2, this.cellSize - 2);

    // Valid/invalid icon indicator
    if (isValid) {
      // Green check circle
      ctx.fillStyle = 'rgba(0,200,80,0.6)';
      ctx.beginPath();
      ctx.arc(cx, cy - 24, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('OK', cx, cy - 24);
    } else {
      // Red X circle
      ctx.fillStyle = 'rgba(200,30,30,0.6)';
      ctx.beginPath();
      ctx.arc(cx, cy - 24, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('X', cx, cy - 24);
    }

    // Ghost tower (semi-transparent)
    ctx.globalAlpha = isValid ? 0.6 : 0.35;
    this._drawTower(ctx, cx, cy, this.selectedTowerType, 1, 0);
    ctx.globalAlpha = 1;
  }

  /**
   * Render wave banner, pause overlay effects on Canvas.
   * @param {CanvasRenderingContext2D} ctx
   */
  _renderHUD(ctx) {
    // Wave banner
    if (this.waveBannerTimer > 0) {
      const alpha = Math.min(1, this.waveBannerTimer / 40);
      const scale = 1 + (120 - this.waveBannerTimer) * 0.002;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.floor(36 * scale)}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'center';
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(this.waveBannerText, this.width / 2 + 2, this.height / 2 + 2);
      ctx.fillStyle = '#ffd700';
      ctx.fillText(this.waveBannerText, this.width / 2, this.height / 2);
      ctx.restore();
    }

    // Combo display
    if (this.comboCount >= 3 && this.gameState === 'playing') {
      const pulse = 1 + Math.sin(this.comboPulse * 2) * 0.15;
      const comboAlpha = this.comboTimer > 30 ? 1 : this.comboTimer / 30;
      ctx.save();
      ctx.globalAlpha = comboAlpha;
      ctx.font = `bold ${Math.floor(22 * pulse)}px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'right';
      const comboColor = this.comboCount >= 20 ? '#ff4444' : this.comboCount >= 10 ? '#ff8c00' : '#00d4aa';
      ctx.fillStyle = comboColor;
      ctx.fillText(`${this.comboCount} COMBO`, this.width - 16, 42);
      ctx.restore();
    }

    // Game over / pause overlay
    if (this.gameState === 'paused') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 40px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('游戏暂停', this.width / 2, this.height / 2);
    }

    if (this.gameState === 'defeat') {
      ctx.fillStyle = 'rgba(80,0,0,0.5)';
      ctx.fillRect(0, 0, this.width, this.height);
    }
    if (this.gameState === 'victory') {
      ctx.fillStyle = 'rgba(0,80,0,0.5)';
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  // ==========================================================================
  // 3.11 HUD update (HTML elements)
  // ==========================================================================

  _updateHUD() {
    // Gold
    const goldEl = document.getElementById('gold-value');
    if (goldEl) goldEl.textContent = this.gold;

    // Health bar + value
    const healthBar = document.getElementById('health-bar');
    if (healthBar) healthBar.style.width = Math.max(0, (this.health / this.maxHealth) * 100) + '%';
    const healthVal = document.getElementById('health-value');
    if (healthVal) healthVal.textContent = this.health;

    // Score
    const scoreEl = document.getElementById('score-value');
    if (scoreEl) scoreEl.textContent = this.score;

    // Level name
    const levelEl = document.getElementById('level-name');
    if (levelEl && this.levelConfig) levelEl.textContent = this.levelConfig.name;

    // Wave text + progress
    const waveText = document.getElementById('wave-text');
    if (waveText) waveText.textContent = `${this.currentWave} / ${this.totalWaves}`;
    const waveBar = document.getElementById('wave-progress');
    if (waveBar && this.totalWaves > 0) {
      waveBar.style.width = (this.currentWave / this.totalWaves * 100) + '%';
    }

    // Kill count (status bar)
    const killsEl = document.getElementById('kill-count');
    if (killsEl) killsEl.textContent = this.killCount;

    // Combo count (status bar)
    const ccEl = document.getElementById('combo-count');
    if (ccEl) ccEl.textContent = 'x' + this.comboCount;

    // Battle stats panel
    const statKills = document.getElementById('stat-kills');
    if (statKills) statKills.textContent = this.killCount;
    const statMaxCombo = document.getElementById('stat-max-combo');
    if (statMaxCombo) statMaxCombo.textContent = this.maxCombo;
    const statWave = document.getElementById('stat-wave');
    if (statWave) statWave.textContent = `${this.currentWave}/${this.totalWaves}`;
    const statEnemies = document.getElementById('stat-enemies');
    if (statEnemies) statEnemies.textContent = this.enemies.filter(e => e.alive).length;
    const statTowers = document.getElementById('stat-towers');
    if (statTowers) statTowers.textContent = this.towers.length;

    // Pause button text
    const pauseBtn = document.getElementById('btn-pause');
    if (pauseBtn) pauseBtn.textContent = this.gameState === 'paused' ? '继续' : '暂停';
  }

  // ==========================================================================
  // 3.12 Game loop
  // ==========================================================================

  /**
   * Main game loop driven by requestAnimationFrame.
   * @param {number} timestamp - DOMHighResTimeStamp
   */
  gameLoop(timestamp) {
    if (!this.lastTime) this.lastTime = timestamp;
    let dt = timestamp - this.lastTime;
    this.lastTime = timestamp;

    // Cap dt to avoid spiral of death
    if (dt > 200) dt = 200;

    try {
      // Fixed timestep accumulator
      this.frameAccum += dt;
      let updates = 0;
      while (this.frameAccum >= this.FRAME_DURATION && updates < 5) {
        this.update(this.FRAME_DURATION);
        this.frameAccum -= this.FRAME_DURATION;
        updates++;
      }

      this.render();
    } catch (e) {
      console.error('Game loop error — frame skipped:', e);
    }

    requestAnimationFrame(ts => this.gameLoop(ts));
  }

  /**
   * Initialize and start the game.
   * @returns {Promise<void>}
   */
  async init() {
    // Dynamically generate level selector buttons
    this._buildLevelSelector();
    await this.loadLevel(1);
    this._updateHUD();
    requestAnimationFrame(ts => this.gameLoop(ts));
  }

  /**
   * Build level selector inside #level-selector.
   */
  _buildLevelSelector() {
    const container = document.getElementById('level-selector');
    if (!container) return;
    container.innerHTML = '';
    const levels = this.defaultLevels;
    for (const lvl of levels) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary btn-block level-btn';
      btn.textContent = `关卡 ${lvl.id}: ${lvl.name}`;
      btn.title = lvl.description;
      btn.addEventListener('click', () => this.loadSpecificLevel(lvl.id));
      container.appendChild(btn);
    }
  }
}

// ============================================================================
// 4. Bootstrap
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  const game = new TowerDefenseGame();
  game.init();
});
