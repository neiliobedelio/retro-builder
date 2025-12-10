const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Constants
const GRID_ROWS = 10;
const GRID_COLS = 10;
const BRICK_SIZE = 30;
const GAME_SPEED = 60;

// Game State
const STATE = {
    MENU: 0,
    PLAYING: 1,
    GAME_OVER: 2,
    LEVEL_TRANSITION: 3
};

let currentState = STATE.MENU;
let lastTime = 0;
let score = 0;
let health = 100;
let level = 1;

// Global Game Objects
let launcher;
let bricks = [];
let roadPylons = []; // Renamed from stopOrders
let powerUps = [];
let barriers = [];
let floatingTexts = [];
let particles = [];
let cactuses = [];
let blueprint;
let boss;
let powerUpTimer = 0;

// Input
const input = {
    x: 0,
    y: 0,
    clicked: false,
    keys: { left: false, right: false, space: false }
};

window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') input.keys.left = true;
    if (e.code === 'ArrowRight') input.keys.right = true;
    if (e.code === 'Space') input.keys.space = true;
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') input.keys.left = false;
    if (e.code === 'ArrowRight') input.keys.right = false;
    if (e.code === 'Space') input.keys.space = false;
});

// Touch Controls
let touchStartX = 0;
let touchLauncherX = 0;

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (currentState !== STATE.PLAYING) return;

    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchLauncherX = launcher.x;
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (currentState !== STATE.PLAYING) return;

    const touch = e.touches[0];
    const diff = touch.clientX - touchStartX;
    launcher.x = touchLauncherX + diff;

    // Clamp
    if (launcher.x < 0) launcher.x = 0;
    if (launcher.x + launcher.width > canvas.width) launcher.x = canvas.width - launcher.width;
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (currentState !== STATE.PLAYING) return;

    // Check if it was a tap (small movement)
    const touch = e.changedTouches[0];
    const diff = Math.abs(touch.clientX - touchStartX);

    if (diff < 10) {
        fireBrick();
    }
});

// Sound Manager
class SoundManager {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }

    playTone(freq, type, duration) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playShoot() { this.playTone(440, 'square', 0.1); }
    playHit() { this.playTone(100, 'sawtooth', 0.1); }
    playBossHit() { this.playTone(80, 'square', 0.1); }
    playPowerUp() {
        this.playTone(600, 'sine', 0.1);
        setTimeout(() => this.playTone(800, 'sine', 0.1), 100);
    }
    playFreeze() { this.playTone(150, 'sawtooth', 0.5); }
    playDamage() { this.playTone(100, 'sawtooth', 0.3); }
    playWin() {
        this.playTone(400, 'square', 0.1);
        setTimeout(() => this.playTone(500, 'square', 0.1), 100);
        setTimeout(() => this.playTone(600, 'square', 0.2), 200);
    }
    playGameOver() {
        this.playTone(300, 'sawtooth', 0.3);
        setTimeout(() => this.playTone(200, 'sawtooth', 0.3), 300);
        setTimeout(() => this.playTone(100, 'sawtooth', 0.5), 600);
    }
    playPrize() {
        this.playTone(523.25, 'triangle', 0.1);
        setTimeout(() => this.playTone(659.25, 'triangle', 0.1), 100);
        setTimeout(() => this.playTone(783.99, 'triangle', 0.4), 200);
    }

    playTheme() {
        if (this.themeInterval) return;
        const notes = [
            261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25,
            392.00, 329.63, 261.63, 293.66, 349.23, 293.66, 261.63, 196.00
        ];
        let noteIndex = 0;
        const beat = 130; // Faster/Adjusted

        this.themeInterval = setInterval(() => {
            if (this.ctx.state === 'suspended') this.ctx.resume();

            // Melody
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(notes[noteIndex % notes.length], this.ctx.currentTime);
            gain.gain.setValueAtTime(0.1, this.ctx.currentTime); // Louder
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.12);

            // Bass
            const oscBass = this.ctx.createOscillator();
            const gainBass = this.ctx.createGain();
            oscBass.type = 'triangle';
            const bassFreq = (noteIndex % 2 === 0) ? 130.81 : 98.00;
            oscBass.frequency.setValueAtTime(bassFreq, this.ctx.currentTime);
            gainBass.gain.setValueAtTime(0.1, this.ctx.currentTime); // Louder
            gainBass.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
            oscBass.connect(gainBass);
            gainBass.connect(this.ctx.destination);
            oscBass.start();
            oscBass.stop(this.ctx.currentTime + 0.12);

            noteIndex++;
        }, beat);
    }

    stopTheme() {
        if (this.themeInterval) {
            clearInterval(this.themeInterval);
            this.themeInterval = null;
        }
    }

    playThunderTheme() {
        if (this.ctx.state === 'suspended') this.ctx.resume();

        // Dark Chords
        const playChord = (notes, time, duration) => {
            notes.forEach(freq => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(freq, this.ctx.currentTime + time);

                // Deep and ominous
                gain.gain.setValueAtTime(0, this.ctx.currentTime + time);
                gain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + time + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + time + duration);

                // Lowpass Filter for "muffled" dark sound
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.max = 400;

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(this.ctx.currentTime + time);
                osc.stop(this.ctx.currentTime + time + duration);
            });
        };

        // Thunder Noise
        const playThunder = (time) => {
            const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            const gain = this.ctx.createGain();

            // Violent burst then fade
            gain.gain.setValueAtTime(0, this.ctx.currentTime + time);
            gain.gain.linearRampToValueAtTime(0.8, this.ctx.currentTime + time + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + time + 1.5);

            noise.connect(gain);
            gain.connect(this.ctx.destination);
            noise.start(this.ctx.currentTime + time);
        };

        // Sequence
        playThunder(0);
        playChord([60, 90, 120], 0.2, 3.0); // Deep Cluster
        playThunder(0.5);
        playChord([55, 85, 115], 0.8, 3.0);
    }
}


const audio = new SoundManager();

// Entities
class Launcher {
    constructor() {
        this.width = 80;
        this.height = 50;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - 70;
        this.color = '#0f0';
        this.cooldown = 0;
        this.frozen = 0;
        this.fireRate = 0.2;
        this.speed = 400;
        this.animTimer = 0;
    }

    update(dt) {
        this.animTimer += dt;
        if (this.frozen > 0) {
            this.frozen -= dt;
            return;
        }
        if (input.keys.left) this.x -= this.speed * dt;
        if (input.keys.right) this.x += this.speed * dt;
        if (input.keys.space) fireBrick();

        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;
        if (this.cooldown > 0) this.cooldown -= dt;
    }

    activateRapidFire() {
        this.fireRate = 0.05;
        setTimeout(() => this.fireRate = 0.2, 5000);
    }

    draw(ctx) {
        // PIXEL-PERFECT SPRITE (From Image)
        const p = 5; // Scale up (16px * 5 = 80px width)
        const ox = this.x;
        const oy = this.y;

        let facingRight = true;
        if (input.keys.left) facingRight = false;

        // ANIMATION: Bob
        let bob = Math.sin(this.animTimer * 15) * 1;
        if (!input.keys.left && !input.keys.right) bob = 0;

        // LEGS ANIMATION
        let legFrame = 0;
        if (input.keys.left || input.keys.right) {
            legFrame = Math.floor(this.animTimer * 10) % 2;
        }

        // Palette
        const _ = null; // Transparent
        const D = '#2F4F4F'; // Dark Teal (Body/Head) 
        const G = '#6B8E23'; // Green (Wing/Chest)
        const O = '#FF8C00'; // Orange (Beak/Legs)
        const W = '#FFFFFF'; // White (Eye)
        const B = '#000000'; // Black (Pupil)
        const H = '#FFD700'; // Gold (Hat)
        const R = '#DAA520'; // Dark Gold (Rim)

        // 16x16 Grid
        const sprite = [
            [_, _, _, _, H, H, H, H, _, _, _, _, _, _, _, _], // Hat Dome (Centered)
            [_, _, _, H, H, H, H, H, _, _, _, _, _, _, _, _], // Hat Brim (Centered)
            [_, _, H, H, H, H, H, H, H, _, _, _, _, _, _, _], // Hat Brim (Centered)
            [_, _, _, D, D, W, W, D, _, _, _, _, _, _, G, _], // Eye row
            [_, O, O, D, D, B, W, _, _, _, _, _, _, G, G, _], // Beak/Eye
            [_, _, _, _, D, D, D, _, _, _, _, _, _, G, G, _], // Beak/Neck
            [_, _, _, _, D, D, _, _, _, _, _, _, D, G, D], // Neck / Tail tip
            [_, _, _, _, D, D, D, D, D, D, D, D, D, G, D], // Body top
            [_, _, _, _, D, D, D, G, G, G, G, G, G, D, D],
            [_, _, _, _, D, D, G, G, G, G, G, G, G, D, _], // Wing
            [_, _, _, _, _, D, G, G, G, D, G, G, D, _, _],
            [_, _, _, _, _, _, G, G, G, D, D, D, _, _, _],
            [_, _, _, _, _, _, D, D, D, D, D, _, _, _, _], // Body bottom
            [_, _, _, _, _, _, G, _, G, _, _, _, _, _, _, _], // Legs 1
            [_, _, _, _, _, _, O, _, O, _, _, _, _, _, _, _], // Legs 2
            [_, _, _, _, _, O, O, _, O, O, _, _, _, _, _, _]  // Feet
        ];
        const startY = oy + (this.height - (sprite.length * p)) / 2 + bob * p;
        const startX = ox + (this.width - (sprite[0].length * p)) / 2;

        for (let r = 0; r < sprite.length; r++) {
            for (let c = 0; c < sprite[r].length; c++) {
                let color = sprite[r][c];
                if (color) {
                    // Check for Leg logic (simple toggle)
                    // If this is a leg pixel (Orange in last 3 rows) and animating
                    // LEGS are now at rows 13, 14, 15 (indices) due to added gap row
                    if (r >= 13 && color === O && legFrame === 1) {
                        // Simple "run" check: shift legs or hide one
                        if (c === 6) continue; // Hide left leg frame 1
                    }
                    if (r >= 13 && color === O && legFrame === 0) {
                        if (c === 8) continue; // Hide right leg frame 0
                    }

                    let drawX = c;
                    // Default sprite is Left-Facing.
                    // Flip X if facing Right.
                    if (facingRight) {
                        drawX = (sprite[0].length - 1) - c;
                    }

                    ctx.fillStyle = color;
                    ctx.fillRect(startX + drawX * p, startY + r * p, p, p);
                }
            }
        }

        // FROZEN / STUNNED STARS
        if (this.frozen > 0) {
            // ROTATING STARS (No Box)
            const time = Date.now() / 150;
            const starRadius = 20;
            const headX = startX + (facingRight ? 11 * p : 5 * p); // Approx head center
            const headY = startY + 2 * p;

            ctx.fillStyle = '#FFFF00';
            for (let i = 0; i < 4; i++) {
                const angle = time + (i * Math.PI / 2);
                const sx = headX + Math.cos(angle) * starRadius;
                const sy = headY + Math.sin(angle) * 8;

                ctx.beginPath();
                ctx.moveTo(sx, sy - 3);
                ctx.lineTo(sx + 3, sy);
                ctx.lineTo(sx, sy + 3);
                ctx.lineTo(sx - 3, sy);
                ctx.fill();
            }
        }
    }
}


class Brick {
    constructor(x, y) {
        this.x = x; this.y = y; this.width = 15; this.height = 10; this.speed = 400; this.active = true;
    }
    update(dt) {
        this.y -= this.speed * dt;
        if (this.y < 0) this.active = false;
    }
    draw(ctx) {
        // Red Brick Look
        const cBase = '#B22222'; // Firebrick
        const cLight = '#CD5C5C'; // IndianRed (Highlight)
        const cDark = '#8B0000'; // DarkRed (Shadow)
        const cHole = '#600000'; // Darker for holes

        // Base
        ctx.fillStyle = cBase;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Highlight (Top/Left)
        ctx.fillStyle = cLight;
        ctx.fillRect(this.x, this.y, this.width, 2);
        ctx.fillRect(this.x, this.y, 2, this.height);

        // Shadow (Bottom/Right)
        ctx.fillStyle = cDark;
        ctx.fillRect(this.x, this.y + this.height - 2, this.width, 2);
        ctx.fillRect(this.x + this.width - 2, this.y, 2, this.height);

        // Holes (Classic brick holes)
        ctx.fillStyle = cHole;
        const holeSize = 2;
        ctx.fillRect(this.x + 4, this.y + 3, holeSize, holeSize);
        ctx.fillRect(this.x + 9, this.y + 3, holeSize, holeSize);
    }
}

class RoadPylon {
    constructor(x, y) {
        this.x = x; this.y = y; this.width = 20; this.height = 20; this.speed = 200; this.active = true;
        this.wobble = Math.random() * Math.PI * 2;
        this.angle = 0;
        this.rotationSpeed = (Math.random() - 0.5) * 5; // Rotate left or right
    }
    update(dt) {
        this.y += this.speed * dt;
        this.x += Math.sin(this.wobble) * 2; this.wobble += dt * 5;
        this.angle += this.rotationSpeed * dt;
        if (this.y > canvas.height) this.active = false;
    }
    draw(ctx) {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(this.angle);

        // Draw centered at (0,0) due to translation
        // Triangle Top: (0, -height/2)
        // Bottom Left: (-width/2, height/2)
        // Bottom Right: (width/2, height/2)

        const h = this.height;
        const w = this.width;

        // Orange Cone
        ctx.fillStyle = '#FF8C00';
        ctx.beginPath();
        ctx.moveTo(0, -h / 2);
        ctx.lineTo(w / 2, h / 2);
        ctx.lineTo(-w / 2, h / 2);
        ctx.closePath();
        ctx.fill();

        // White stripes
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 3;
        // Stripe 1
        ctx.beginPath();
        ctx.moveTo(-3, -h / 2 + 6);
        ctx.lineTo(3, -h / 2 + 6);
        ctx.stroke();
        // Stripe 2
        ctx.beginPath();
        ctx.moveTo(-6, -h / 2 + 12);
        ctx.lineTo(6, -h / 2 + 12);
        ctx.stroke();

        // Base Rect
        ctx.fillStyle = '#FF4500';
        ctx.fillRect(-w / 2 - 2, h / 2 - 3, w + 4, 3);

        ctx.restore();
    }
}

class Barrier {
    constructor(x, y) {
        this.x = x; this.y = y; this.width = 60; this.height = 20; this.hp = 3; this.active = true;
    }
    draw(ctx) {
        if (this.hp === 3) ctx.fillStyle = '#FFD700';
        else if (this.hp === 2) ctx.fillStyle = '#DAA520';
        else ctx.fillStyle = '#B8860B';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = '#F00'; // RED Stripes
        for (let i = 0; i < this.width; i += 10) ctx.fillRect(this.x + i, this.y, 2, this.height);
    }
    takeDamage() {
        this.hp--;
        if (this.hp <= 0) this.active = false;
    }
}

class PowerUp {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.width = 20; this.height = 20; this.speed = 150; this.type = type; this.active = true;
    }
    update(dt) {
        this.y += this.speed * dt;
        if (this.y > canvas.height) this.active = false;
    }
    draw(ctx) {
        ctx.font = 'bold 30px "Press Start 2P", monospace';
        if (this.type === 'MONEY') { ctx.fillStyle = '#ffd700'; ctx.fillText('$', this.x, this.y + 25); }
        else { ctx.fillStyle = '#0ff'; ctx.fillText('+', this.x, this.y + 25); }
    }
}

class Blueprint {
    constructor(rows, cols) {
        this.rows = rows; this.cols = cols; this.grid = [];
        this.sideMargin = 50; // Margin to keep buildings away from edges
        this.brickWidth = (canvas.width - (this.sideMargin * 2)) / cols;
        this.brickHeight = 20;
        for (let r = 0; r < rows; r++) { this.grid[r] = []; for (let c = 0; c < cols; c++) this.grid[r][c] = 0; }
        for (let c = 0; c < cols; c++) {
            let startRow = Math.floor(Math.random() * (rows - 2));
            for (let r = 0; r < startRow; r++) this.grid[r][c] = -1;
        }
        this.columnFlashes = new Array(cols).fill(0);
    }
    update(dt) {
        let filled = 0; let total = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] !== -1) total++;
                if (this.grid[r][c] === 1) filled++;
            }
        }
        // Update Flashes
        for (let c = 0; c < this.cols; c++) {
            if (this.columnFlashes[c] > 0) this.columnFlashes[c] -= dt;
        }
        if (total > 0 && filled === total) nextLevel();
    }
    draw(ctx) {
        for (let c = 0; c < this.cols; c++) {
            let topBlockY = (this.rows) * this.brickHeight + 50;
            for (let r = 0; r < this.rows; r++) {
                if (this.grid[r][c] === 1) { topBlockY = r * this.brickHeight + 50; break; }
            }
            let bx = this.sideMargin + c * this.brickWidth; // Offset by margin
            let roofY = topBlockY;
            ctx.beginPath(); ctx.moveTo(bx + 2, roofY); ctx.lineTo(bx + (this.brickWidth - 8) / 2 + 2, roofY - 15);
            ctx.lineTo(bx + this.brickWidth - 6, roofY); ctx.closePath(); ctx.fillStyle = '#3a3a3a'; ctx.fill();
            ctx.fillStyle = '#555'; ctx.fillRect(bx + this.brickWidth / 2 - 2, roofY - 25, 2, 25);
            ctx.fillStyle = '#f00'; if (Math.floor(Date.now() / 500) % 2 === 0) ctx.fillRect(bx + this.brickWidth / 2 - 3, roofY - 27, 4, 4);

            for (let r = 0; r < this.rows; r++) {
                if (this.grid[r][c] === -1) continue;
                let brickY = r * this.brickHeight + 50; let bHeight = this.brickHeight;
                ctx.fillStyle = '#1a1a1a'; ctx.fillRect(bx + this.brickWidth - 6, brickY + 4, 6, bHeight - 4);
                if (this.grid[r][c] === 0) { ctx.strokeStyle = '#2a2a2a'; ctx.strokeRect(bx + 2, brickY, this.brickWidth - 8, bHeight); }
                if (this.grid[r][c] === 1) {
                    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(bx + 2, brickY, this.brickWidth - 8, bHeight);
                    let paneCols = 2; let paneRows = 2; let margin = 4;
                    let wWidth = (this.brickWidth - 8 - (margin * (paneCols + 1))) / paneCols;
                    let wHeight = (bHeight - (margin * (paneRows + 1))) / paneRows;
                    for (let pr = 0; pr < paneRows; pr++) {
                        for (let pc = 0; pc < paneCols; pc++) {
                            let hue = 120 - (r / this.rows) * 60; hue += (c * 13) % 10;
                            if (Math.random() > 0.98) ctx.fillStyle = '#fff'; else ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
                            ctx.shadowBlur = 5; ctx.shadowColor = '#ff0';
                            let wx = bx + 2 + margin + (pc * (wWidth + margin)); let wy = brickY + margin + (pr * (wHeight + margin));
                            ctx.fillRect(wx, wy, wWidth, wHeight);
                        }
                    }
                    ctx.shadowBlur = 0;
                }
            }

            // White Flash Overlay
            if (this.columnFlashes[c] > 0) {
                ctx.save();
                ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, this.columnFlashes[c])})`; // Fade out
                // Draw over entire column area (from margin to bottom)
                const colX = this.sideMargin + c * this.brickWidth;
                const colY = 50; // Top margin
                const colH = this.rows * this.brickHeight;
                ctx.fillRect(colX, colY, this.brickWidth, colH);
                ctx.restore();
            }
        }
    }
    checkCollision(brick) {
        let cx = brick.x + brick.width / 2;
        let cy = brick.y + brick.height / 2;
        let col = Math.floor((cx - this.sideMargin) / this.brickWidth);
        let row = Math.floor((cy - 50) / this.brickHeight);

        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
            if (this.grid[row][col] === 0) {
                this.grid[row][col] = 1;
                score += 50;
                audio.playPrize();
                floatingTexts.push(new FloatingText("BUILT!", brick.x, brick.y));

                // Check if Column Completed
                let colComplete = true;
                for (let r = 0; r < this.rows; r++) {
                    if (this.grid[r][col] === 0) { colComplete = false; break; }
                }

                if (colComplete) {
                    this.columnFlashes[col] = 1.0; // 1 Second Flash
                    audio.playWin(); // Nice sound
                    floatingTexts.push(new FloatingText("DONE!", brick.x, brick.y - 30));
                }

                return true;
            }
        }
        return false;
    }
}

class Boss {
    constructor() {
        this.width = 120; this.height = 80;
        this.x = canvas.width / 2 - 60; this.y = 80;
        this.speed = 100; this.hp = 2500; this.maxHp = 2500;
        this.state = 'IDLE'; this.timer = 0;
        this.rageTimer = 0;
    }
    update(dt) {
        // Simple float
        this.x += Math.sin(Date.now() / 500) * 2;

        // Attack logic
        this.timer += dt;
        let attackInterval = 3.0 - (level * 0.2);
        if (this.rageTimer > 0) attackInterval = 0.8; // Very fast fire rate in Rage
        if (this.timer > attackInterval) {
            this.attack();
            this.timer = 0;
        }

        // Rage timer decrement
        if (this.rageTimer > 0) this.rageTimer -= dt;

        // Hit effect
        if (this.hitFlash > 0) this.hitFlash -= dt;
    }
    attack() {
        // Spawn RoadPylon
        let order = new RoadPylon(this.x + this.width / 2, this.y + this.height);
        order.speed = 200 + (level * 50);
        roadPylons.push(order);
    }
    draw(ctx) {
        // ULTRA-HIGH FIDELITY Boss (Restored)
        const p = 2; // Pixel Scale
        const ox = this.x;
        let stomp = (this.rageTimer > 0) ? Math.sin(Date.now() / 50) * 5 : 0;
        const oy = this.y + stomp;
        const rage = (this.rageTimer > 0 && Math.floor(Date.now() / 100) % 2 === 0);

        const fill = (x, y, w, h, c) => {
            ctx.fillStyle = c;
            ctx.fillRect(ox + x * p, oy + y * p, w * p, h * p);
        };

        // Palette (Lighter Skin Tone)
        const cFur = rage ? '#FF4500' : '#D2691E';
        const cFurShadow = rage ? '#8B0000' : '#8B4513';
        const cMask = rage ? '#00008B' : '#009ACD'; // DeepSkyBlue
        const cMaskRed = rage ? '#FFD700' : '#DC143C';
        const cCape = '#DC143C';
        const cWhite = '#FFFFFF';
        const cBlack = '#000000';

        // Center X ~ 30 (relative to 60px half-width in 2x scale = 120px total)
        const cx = 30;

        // --- CAPE ---
        fill(cx - 16, 12, 32, 28, cCape);

        // --- LEGS ---
        fill(cx - 10, 30, 8, 8, cFur);
        fill(cx + 2, 30, 8, 8, cFur);

        // Boots
        fill(cx - 11, 38, 9, 8, cMaskRed);
        fill(cx + 2, 38, 9, 8, cMaskRed);
        fill(cx - 11, 38, 9, 2, cWhite); // Trim
        fill(cx + 2, 38, 9, 2, cWhite);

        // --- TORSO ---
        fill(cx - 13, 12, 26, 18, cFur);
        // Chest
        fill(cx - 10, 14, 9, 6, cFurShadow);
        fill(cx + 1, 14, 9, 6, cFurShadow);
        // Abs
        fill(cx - 4, 22, 3, 2, cFurShadow); fill(cx + 1, 22, 3, 2, cFurShadow);

        // Trunks
        fill(cx - 12, 28, 24, 4, cMask);
        fill(cx - 8, 29, 4, 2, cMaskRed);
        fill(cx + 4, 29, 4, 2, cMaskRed);

        // --- ARMS ---
        // Shoulders
        fill(cx - 19, 11, 8, 8, cFur);
        fill(cx + 11, 11, 8, 8, cFur);
        // Forearms
        fill(cx - 20, 19, 6, 9, cFur);
        fill(cx + 14, 19, 6, 9, cFur);
        // Wristbands
        fill(cx - 21, 28, 7, 3, cMaskRed);
        fill(cx + 14, 28, 7, 3, cMaskRed);
        // Hands
        fill(cx - 21, 31, 7, 5, cFur);
        fill(cx + 14, 31, 7, 5, cFur);

        // --- HEAD ---
        // Mask Base
        fill(cx - 11, -4, 22, 16, cMask);
        // Ears
        fill(cx - 10, -9, 6, 6, cFur);
        fill(cx + 4, -9, 6, 6, cFur);
        fill(cx - 8, -7, 2, 4, cFurShadow);
        fill(cx + 6, -7, 2, 4, cFurShadow);

        // Mask Patterns
        fill(cx - 3, -4, 6, 16, cMaskRed);
        fill(cx - 8, 2, 6, 5, cFur); // Eye holes
        fill(cx + 2, 2, 6, 5, cFur);

        // Eyes
        fill(cx - 6, 3, 2, 3, cBlack);
        fill(cx + 4, 3, 2, 3, cBlack);
        fill(cx - 6, 3, 1, 1, cWhite);

        // Snout
        fill(cx - 5, 8, 10, 6, cFur);
        fill(cx - 2, 9, 4, 3, cBlack); // Nose
        fill(cx - 2, 10, 1, 1, cWhite);

        // Mouth
        if (rage) {
            fill(cx - 3, 13, 6, 2, cBlack);
            fill(cx - 3, 13, 1, 1, cWhite);
            fill(cx + 2, 13, 1, 1, cWhite);
        }
    }
    takeDamage(amount) {
        this.hp -= amount;
        this.hitFlash = 0.1;
        this.rageTimer = 4.0; // Longer Rage (was 1.0)
        // Permanent Rage if low health
        if (this.hp < this.maxHp * 0.3) this.rageTimer = 5.0;

        audio.playBossHit();
        if (this.hp <= 0) {
            score += 5000;
            nextLevel();
        }
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y; this.vx = (Math.random() - 0.5) * 200; this.vy = (Math.random() - 0.5) * 200;
        this.life = 0.5; this.color = color; this.size = Math.random() * 4 + 2;
    }
    update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt; }
    draw(ctx) { ctx.fillStyle = this.color; ctx.fillRect(this.x, this.y, this.size, this.size); }
}

class FloatingText {
    constructor(text, x, y) {
        this.text = text; this.x = x; this.y = y; this.life = 1.0;
    }
    update(dt) {
        this.y -= 30 * dt;
        this.life -= dt;
    }
    draw(ctx) {
        ctx.fillStyle = `rgba(255, 255, 0, ${this.life})`;
        ctx.font = '12px "Press Start 2P"';
        ctx.fillText(this.text, this.x, this.y);
    }
}

class Javelina {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.startX = x;
        this.width = 60; // Bigger
        this.height = 45;
        this.type = 'JAVELINA';
        this.hp = 3;
        this.timer = 0;
        this.direction = 1;
    }
    update(dt) {
        // Slow Patrol
        this.timer += dt;
        this.x = this.startX + Math.sin(this.timer) * 50; // Move +/- 50px

        // Face direction
        const dx = Math.cos(this.timer);
        this.direction = dx > 0 ? 1 : -1;
    }
    draw(ctx) {
        // DETAILED PIXEL ART (Collared Peccary)
        // Scaled up to be physically bigger and chunkier
        const p = 4;

        // Palette
        const B = '#3e2b22'; // Dark Body
        const L = '#5C4033'; // Light Brown (Highlights/Fur)
        const W = '#E0E0E0'; // White Collar
        const S = '#1a1a1a'; // Snout/Hooves/Ears
        const P = '#D2B48C'; // Pinkish/Tan (Inner Ear/Snout tip)
        const _ = null;

        // 16x11 Sprite (to fit ~64x44 box)
        const sprite = [
            [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
            [_, _, _, S, S, _, _, _, _, _, _, _, _, _, _, _], // Ears
            [_, _, S, P, S, B, B, B, B, B, B, _, _, _, _, _], // Head/Back
            [_, _, S, B, B, B, B, B, B, L, B, B, _, _, _, _], // Fur Texture
            [_, _, S, S, B, W, W, B, B, B, L, B, B, _, _, _], // Eye/Collar
            [P, S, S, B, W, W, W, B, B, B, B, L, B, _, _, _], // Snout/Collar
            [S, P, S, B, B, B, B, B, B, B, B, B, B, _, _, _], // Jaw/Body
            [_, S, B, B, B, B, B, B, B, B, B, B, B, _, _, _], // Body
            [_, _, _, B, B, B, B, B, B, B, B, B, _, _, _, _], // Belly
            [_, _, _, S, S, _, S, S, _, S, S, _, S, S, _, _], // Legs
            [_, _, _, S, S, _, S, S, _, S, S, _, S, S, _, _]
        ];

        let drawX = this.x;
        // Flip if moving left (basic check on direction)
        // Note: Sin wave moves right when slope positive.
        // cos(timer) is velocity. If > 0, moving right.

        const facingRight = this.direction > 0;

        for (let r = 0; r < sprite.length; r++) {
            for (let c = 0; c < sprite[r].length; c++) {
                let color = sprite[r][c];
                if (color) {
                    // Sprite is Left-Facing.
                    // If facingRight (direction > 0), we HIT FLIP (draw form end).
                    // If !facingRight (direction < 0), we draw NORMAL.
                    let col = facingRight ? (sprite[0].length - 1 - c) : c;
                    ctx.fillStyle = color;
                    ctx.fillRect(drawX + col * p, this.y + r * p, p, p);
                }
            }
        }
    }
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 10; i++) particles.push(new Particle(x, y, color));
}

function initGame() {
    console.log("Initializing Game...");
    resize();
    try {
        launcher = new Launcher();

        let rows = 5, cols = 5;
        if (level === 2) { rows = 8; cols = 8; }
        if (level === 3) { rows = 12; cols = 10; }

        blueprint = new Blueprint(rows, cols);
        boss = new Boss();
        // Restore dynamic Boss positioning and difficulty
        boss.y = 150 + (level * 20);
        boss.width = 120;
        boss.height = 80;
        boss.x = canvas.width / 2 - boss.width / 2;

        // Note: Boss class handles attack interval internally now, but we set position here.

        bricks = []; roadPylons = []; powerUps = []; barriers = []; floatingTexts = []; cactuses = []; particles = [];

        // Calculate safe zone for cacti (below the lowest possible building block)
        // Rows * BrickHeight + TopMargin(50) = Bottom of grid
        let gridBottom = (rows * 20) + 50;
        let safeYStart = gridBottom + 20; // 20px buffer

        let cactusCount = 2 + Math.floor(Math.random() * 3);

        // Spawn Javelina
        cactuses.push(new Javelina(
            Math.random() * (canvas.width - 100) + 50,
            safeYStart + Math.random() * (canvas.height - 150 - safeYStart)
        ));

        // Spawn Cacti
        for (let i = 0; i < cactusCount; i++) {
            // Ensure they don't spawn too low (on top of player)
            let maxY = canvas.height - 150;
            let spawnY = safeYStart + Math.random() * (maxY - safeYStart);

            if (spawnY > maxY) spawnY = maxY;

            cactuses.push({
                x: Math.random() * (canvas.width - 50), y: spawnY,
                width: 30, height: 60, scale: 1.0 + Math.random() * 0.5, type: 'CACTUS', hp: 3
            });
        }

        let barrierCount = 3;
        let spacing = canvas.width / (barrierCount + 1);
        for (let i = 1; i <= barrierCount; i++) barriers.push(new Barrier(i * spacing - 30, 350));

        if (level === 1) health = 100;

        const lifeFill = document.getElementById('life-bar-fill');
        if (lifeFill) { lifeFill.style.width = `${health}%`; lifeFill.style.backgroundColor = '#0f0'; }

        document.getElementById('level').innerText = `LEVEL: ${level}`;
        console.log("Game Initialized.");
    } catch (err) {
        console.error("Error in initGame:", err);
    }
}

function nextLevel() {
    if (level < 3) {
        level++;
        audio.playWin();
        const transScreen = document.getElementById('level-transition-screen');
        const nextText = document.getElementById('next-level-text');
        nextText.innerText = `LEVEL ${level}... BEGIN!`;
        transScreen.classList.remove('hidden');
        currentState = STATE.LEVEL_TRANSITION;
        setTimeout(() => {
            transScreen.classList.add('hidden');
            currentState = STATE.PLAYING;
            initGame();
        }, 3000);
    } else {
        currentState = STATE.GAME_OVER;
        const goScreen = document.getElementById('game-over-screen');
        goScreen.classList.remove('hidden');

        // WINNING STATE
        document.getElementById('go-title').innerText = "YOU WIN\n...THIS TIME)!";
        document.getElementById('go-title').style.color = "#ff0000"; // Red
        document.getElementById('go-title').style.fontSize = "40px";

        document.getElementById('final-score').innerHTML = `You have defeated the mighty LUCHACABRA<br>and have made your city a better city.<br><br>FINAL SCORE: ${score}`;

        // Hide Try Again, Show New Buttons is default in HTML now? 
        // We'll manage buttons in update if needed, but for now assuming HTML change.
        audio.playWin();
    }
}

function resize() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    // Recalculate brick width with margin on resize
    if (blueprint) blueprint.brickWidth = (canvas.width - (blueprint.sideMargin * 2)) / blueprint.cols;
}

window.addEventListener('resize', resize);

function fireBrick() {
    if (launcher.frozen > 0) return;
    if (launcher.cooldown <= 0) {
        bricks.push(new Brick(launcher.x + launcher.width / 2 - 5, launcher.y));
        launcher.cooldown = launcher.fireRate;
        audio.playShoot();
    }
}

function startGame() {
    console.log("startGame() called");
    audio.stopTheme(); // Stop menu music
    document.getElementById('start-screen').classList.add('hidden');
    currentState = STATE.PLAYING;
    score = 0; health = 100; level = 1;
    initGame();
}

function resetGame() {
    document.getElementById('game-over-screen').classList.add('hidden');
    currentState = STATE.MENU;
    document.getElementById('start-screen').classList.remove('hidden');
}

function gameLoop(timestamp) {
    try {
        const deltaTime = (timestamp - lastTime) / 1000;
        lastTime = timestamp;
        update(deltaTime);
        draw();
        requestAnimationFrame(gameLoop);
    } catch (e) {
        console.error("Game Loop Error:", e);
    }
}

function update(dt) {
    if (currentState !== STATE.PLAYING) return;
    if (health <= 0) {
        currentState = STATE.GAME_OVER;
        document.getElementById('game-over-screen').classList.remove('hidden');

        // LOSING STATE
        document.getElementById('go-title').innerText = "GAME OVER";
        document.getElementById('go-title').style.color = "#fff";
        document.getElementById('final-score').innerText = `SCORE: ${score}`;

        audio.playGameOver();
        return;
    }

    launcher.update(dt);
    boss.update(dt);
    blueprint.update(dt);

    powerUpTimer -= dt;
    if (powerUpTimer <= 0) {
        // 100% Chance
        let type = Math.random() < 0.5 ? 'MONEY' : 'VOLUNTEER';
        powerUps.push(new PowerUp(Math.random() * (canvas.width - 20), 0, type));

        powerUpTimer = Math.random() * 4 + 8; // 8 to 12 seconds
    }

    // Update PowerUps (make them fall)
    powerUps.forEach(p => p.update(dt));

    // PowerUp Collision
    for (let i = powerUps.length - 1; i >= 0; i--) {
        let p = powerUps[i];
        if (p.x < launcher.x + launcher.width && p.x + p.width > launcher.x &&
            p.y < launcher.y + launcher.height && p.y + p.height > launcher.y) {

            p.active = false;
            audio.playPowerUp();

            if (p.type === 'MONEY') {
                score += 500;
                createExplosion(p.x, p.y, '#FFD700'); // Gold particles
                floatingTexts.push(new FloatingText("+$500", p.x, p.y));
            } else {
                health = Math.min(health + 20, 100);
                const lifeFill = document.getElementById('life-bar-fill');
                if (lifeFill) {
                    lifeFill.style.width = `${health}%`;
                    if (health > 30) lifeFill.style.backgroundColor = '#0f0';
                }
                createExplosion(p.x, p.y, '#00FF00'); // Green particles
                floatingTexts.push(new FloatingText("+20 HP", p.x, p.y));
            }
            powerUps.splice(i, 1);
        }
    }

    for (let i = roadPylons.length - 1; i >= 0; i--) {
        let s = roadPylons[i]; s.update(dt);
        // Collision with launcher
        if (s.x < launcher.x + launcher.width && s.x + s.width > launcher.x &&
            s.y < launcher.y + launcher.height && s.y + s.height > launcher.y) {

            health -= 10;
            const lifeFill = document.getElementById('life-bar-fill');
            if (lifeFill) {
                lifeFill.style.width = `${health}%`;
                if (health < 30) lifeFill.style.backgroundColor = '#f00';
            }
            audio.playDamage();
            audio.playFreeze(); // Play freeze sound
            launcher.frozen = 1.5; // Stun player for 1.5s
            // Visual Impact
            createExplosion(launcher.x + launcher.width / 2, launcher.y + launcher.height / 2, '#FF8C00');
            // Floating text
            floatingTexts.push(new FloatingText("STUNNED!", launcher.x, launcher.y - 20));

            roadPylons.splice(i, 1); continue;
        }
        if (!s.active) roadPylons.splice(i, 1);
    }

    for (let i = bricks.length - 1; i >= 0; i--) {
        let b = bricks[i]; b.update(dt);
        let hitBarrier = false;
        for (let j = 0; j < cactuses.length; j++) {
            let c = cactuses[j];
            if (b.x < c.x + c.width && b.x + b.width > c.x && b.y < c.y + c.height && b.y + b.height > c.y) {
                bricks.splice(i, 1);
                hitBarrier = true;
                audio.playHit();

                // Javelina Reaction
                if (c.type === 'JAVELINA') {
                    floatingTexts.push(new FloatingText("grr!", c.x, c.y));
                }

                c.hp--;
                if (c.hp <= 0) {
                    cactuses.splice(j, 1);
                    audio.playDamage();
                }
                break;
            }
        }
        if (hitBarrier) continue;
        for (let j = barriers.length - 1; j >= 0; j--) {
            let bar = barriers[j]; if (!bar.active) continue;
            if (b.x < bar.x + bar.width && b.x + b.width > bar.x && b.y < bar.y + bar.height && b.y + b.height > bar.y) {
                bar.takeDamage(); bricks.splice(i, 1); hitBarrier = true; audio.playHit(); break;
            }
        }
        if (b.active && !hitBarrier) {
            // Check collision with blueprint
            if (blueprint.checkCollision(b)) {
                bricks.splice(i, 1);
            } else if (b.y < boss.y + boss.height && b.x > boss.x && b.x < boss.x + boss.width) {
                // Hit Boss
                boss.takeDamage(10);
                bricks.splice(i, 1);
                floatingTexts.push(new FloatingText("¡Ay!", boss.x, boss.y));
            }
        }
    }
    // Remove inactive bricks
    bricks = bricks.filter(b => b.active);
    powerUps = powerUps.filter(p => p.active);
    barriers = barriers.filter(bar => bar.active);

    // Update Cactuses/Enemies
    cactuses.forEach(c => {
        if (c.update) c.update(dt);
    });

    // Floating text update
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        let ft = floatingTexts[i]; ft.update(dt);
        if (ft.life <= 0) floatingTexts.splice(i, 1);
    }

    // Update UI Score
    const scoreEl = document.getElementById('score');
    if (scoreEl) scoreEl.innerText = `SCORE: ${score}`;
    particles.forEach(p => p.update(dt));
    particles = particles.filter(p => p.life > 0);
}

function draw() {
    if (currentState !== STATE.PLAYING) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear

    // Draw Entities
    blueprint.draw(ctx);

    cactuses.forEach(c => {
        if (c.draw) {
            c.draw(ctx);
        } else {
            // Cactus art (Generic objects)
            const p = 3;
            // Palette
            const G = '#228B22'; // Green
            const D = '#006400'; // Dark Green (Shadow/Ribs)
            const _ = null;

            // 11x14
            const sprite = [
                [_, _, _, _, G, G, G, _, _, _, _],
                [_, _, _, _, G, D, G, _, _, _, _],
                [_, G, G, _, G, D, G, _, _, _, _], // Left Arm Start
                [G, G, G, _, G, D, G, _, _, _, _],
                [G, D, G, G, G, D, G, _, _, _, _], // Arms Join
                [G, D, G, _, G, D, G, _, G, G, _], // Right Arm Start
                [_, _, _, _, G, D, G, G, G, G, _],
                [_, _, _, _, G, D, G, _, G, D, G],
                [_, _, _, _, G, D, G, _, G, D, G],
                [_, _, _, _, G, D, G, _, _, _, _],
                [_, _, _, _, G, D, G, _, _, _, _],
                [_, _, _, _, G, D, G, _, _, _, _],
                [_, _, _, _, G, D, G, _, _, _, _],
            ];

            let drawX = c.x;
            let drawY = c.y;

            for (let r = 0; r < sprite.length; r++) {
                for (let col = 0; col < sprite[r].length; col++) {
                    if (sprite[r][col]) {
                        ctx.fillStyle = sprite[r][col];
                        ctx.fillRect(drawX + col * p, drawY + r * p, p, p);
                    }
                }
            }
        }
    });

    launcher.draw(ctx);
    boss.draw(ctx);

    barriers.forEach(bar => bar.draw(ctx));
    powerUps.forEach(p => p.draw(ctx));
    bricks.forEach(b => b.draw(ctx)); roadPylons.forEach(s => s.draw(ctx));
    floatingTexts.forEach(ft => ft.draw(ctx));
    particles.forEach(p => p.draw(ctx));
}

// Instruction Screen Helpers
function instructionUnderstand() {
    console.log("Instruction understood. Switching to Start Screen.");
    document.getElementById('instruction-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');

    if (audio.ctx.state === 'suspended') audio.ctx.resume();

    // Trigger Effects
    audio.playThunderTheme();
    const title = document.getElementById('main-title');
    if (title) title.classList.add('shake');

    resize();
    initGame();
    currentState = STATE.MENU;
}

const startScreen = document.getElementById('start-screen');
const startAction = (e) => {
    if (e.cancelable && e.type === 'touchstart') e.preventDefault();
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    audio.playTheme(); // Start theme on interaction
    if (currentState === STATE.MENU) startGame();
};

startScreen.addEventListener('touchstart', startAction, { passive: false });
startScreen.addEventListener('click', startAction);

const instructionBtn = document.getElementById('instruction-btn');
if (instructionBtn) instructionBtn.addEventListener('click', instructionUnderstand);

// New Button Listeners
// Note: We'll wait for DOM to load potentially, but these IDs will exist after HTML update.
// We use delegation or just direct attachment if elements exist.
setTimeout(() => {
    const playAgainBtn = document.getElementById('play-again-btn');
    if (playAgainBtn) playAgainBtn.addEventListener('click', resetGame);

    const planFunBtn = document.getElementById('plan-fun-btn');
    if (planFunBtn) planFunBtn.addEventListener('click', () => {
        window.open('https://www.gordleygroup.com/contact', '_blank');
    });
}, 500);

// Start
resize();
initGame(); // Ensure objects exist for Menu background
requestAnimationFrame(gameLoop);
