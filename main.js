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
let stopOrders = [];
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

    draw(ctx) {
        // SIDE-VIEW Roadrunner (Tiny & Connected)
        const p = 1; // Native 1:1 pixel scale for small size
        const ox = this.x;
        const oy = this.y;

        // Facing direction?
        let facingRight = true;
        if (input.keys.left) facingRight = false;

        const cx = 40; // Center of 80 width

        const r = (x, y, w, h, col) => {
            let drawX = x;
            if (!facingRight) {
                // Flip X relative to center
                drawX = cx - (x - cx) - w;
            }
            ctx.fillStyle = col;
            ctx.fillRect(ox + drawX * p, oy + y * p, w * p, h * p);
        };

        // NEW PALETTE (Reference Image)
        const cBody = '#2F4F4F'; // Dark Slate Gray
        const cWing = '#6B8E23'; // Olive Drab
        const cTail = '#6B8E23';
        const cBeak = '#FF8C00'; // Dark Orange
        const cLegs = '#FFA500'; // Orange
        const cEyeBg = '#FFF';
        const cEyePupil = '#000';
        const cCrest = '#2F4F4F';

        // Animation Bob
        let bob = Math.sin(this.animTimer * 20) * 1;
        if (!input.keys.left && !input.keys.right) bob = 0;

        const by = 25 + bob; // Body Y offset

        // LEGS (Running animation)
        let legOffset = 0;
        if (input.keys.left || input.keys.right) {
            legOffset = Math.sin(this.animTimer * 20) * 6;
        }

        // --- CONNECTED ANATOMY (Overlapping Rects) ---

        // Back Leg (Behind body, overlaps into body area)
        r(cx - 5 + legOffset, by + 5, 3, 20, cLegs);
        r(cx - 8 + legOffset, by + 23, 8, 3, cLegs); // Foot

        // Front Leg
        r(cx + 6 - legOffset, by + 5, 3, 20, cLegs);
        r(cx + 3 - legOffset, by + 23, 8, 3, cLegs);

        // TAIL (Spiked fan, Overlaps into body back)
        // Body ends approx at x=cx-10. Tail starts x=cx-15
        r(cx - 30, by - 10, 15, 4, cTail);
        r(cx - 28, by - 14, 15, 4, cTail);
        r(cx - 25, by - 18, 12, 4, cTail);

        // BODY (Oval, drawn as stack)
        // Main core: x -12 to +12
        r(cx - 15, by - 4, 30, 14, cBody); // Main Box
        r(cx - 18, by - 2, 4, 10, cBody);  // Rear round
        r(cx + 12, by - 2, 4, 10, cBody);  // Front round

        // WING (On top of body)
        r(cx - 8, by - 1, 16, 7, cWing);

        // NECK (Long, enters body)
        // Starts DEEP in body at by+0, goes up to by-25
        // Slanted forward slightly
        r(cx + 12, by - 15, 6, 20, cBody); // Base
        r(cx + 14, by - 25, 5, 12, cBody); // Upper Neck

        // HEAD (Overlaps Upper Neck)
        // Upper Neck ends x+19, y-25. Head starts x+12
        r(cx + 12, by - 33, 16, 12, cBody);

        // CREST (Connected to Head)
        r(cx + 10, by - 36, 4, 6, cCrest);
        r(cx + 6, by - 34, 4, 6, cCrest);
        r(cx + 14, by - 38, 4, 6, cCrest);

        // BEAK (Connected to Head)
        r(cx + 26, by - 30, 14, 4, cBeak); // Upper
        r(cx + 26, by - 26, 10, 3, cBeak); // Lower

        // EYE (Inside Head)
        r(cx + 18, by - 31, 6, 6, cEyeBg);
        r(cx + 20, by - 30, 3, 3, cEyePupil);

        // Cheek
        r(cx + 20, by - 23, 6, 2, '#000');

        // FROZEN / STUNNED STARS
        if (this.frozen > 0) {
            // Cyan overlay
            ctx.fillStyle = '#00FFFF';
            ctx.globalAlpha = 0.3;
            ctx.fillRect(ox + (cx - 20) * p, oy + (by - 40) * p, 50 * p, 60 * p);
            ctx.globalAlpha = 1.0;

            // ROTATING STARS
            const time = Date.now() / 150;
            const starRadius = 15;
            const headX = (facingRight ? ox + (cx + 20) * p : ox + (cx - 20) * p);
            const headY = oy + (by - 30) * p;

            ctx.fillStyle = '#FFFF00';
            for (let i = 0; i < 4; i++) {
                const angle = time + (i * Math.PI / 2);
                const sx = headX + Math.cos(angle) * starRadius * p;
                const sy = headY + Math.sin(angle) * 8 * p;

                ctx.beginPath();
                ctx.moveTo(sx, sy - 3 * p);
                ctx.lineTo(sx + 3 * p, sy);
                ctx.lineTo(sx, sy + 3 * p);
                ctx.lineTo(sx - 3 * p, sy);
                ctx.fill();
            }
        }
    }

    activateRapidFire() {
        this.fireRate = 0.05;
        setTimeout(() => this.fireRate = 0.2, 5000);
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

class StopWorkOrder {
    constructor(x, y) {
        this.x = x; this.y = y; this.width = 20; this.height = 20; this.speed = 200; this.active = true;
        this.wobble = Math.random() * Math.PI * 2;
    }
    update(dt) {
        this.y += this.speed * dt;
        this.x += Math.sin(this.wobble) * 2; this.wobble += dt * 5;
        if (this.y > canvas.height) this.active = false;
    }
    draw(ctx) {
        // Roll of Red Tape
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        const radius = this.width / 2;

        // Outer roll (dark red)
        ctx.fillStyle = '#8B0000';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Inner layers (lighter red rings)
        ctx.strokeStyle = '#DC143C';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 3, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 6, 0, Math.PI * 2);
        ctx.stroke();

        // Center hole (empty/dark)
        ctx.fillStyle = '#330000';
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
        ctx.fill();

        // Loose tape strip hanging off
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(centerX + radius - 2, centerY);
        ctx.quadraticCurveTo(centerX + radius + 5, centerY + 5, centerX + radius + 2, centerY + 15);
        ctx.stroke();
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
        ctx.fillStyle = '#000';
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
    }
    update(dt) {
        let filled = 0; let total = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] !== -1) total++;
                if (this.grid[r][c] === 1) filled++;
            }
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
        }
    }
    checkCollision(brick) {
        let cx = brick.x + brick.width / 2;
        let cy = brick.y + brick.height / 2;
        // Account for margin in collision
        let col = Math.floor((cx - this.sideMargin) / this.brickWidth);
        let row = Math.floor((cy - 50) / this.brickHeight);
        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
            if (this.grid[row][col] === -1) return false;
            if (this.grid[row][col] === 0) {
                this.grid[row][col] = 1;
                if (this.isColumnComplete(col)) audio.playPrize();
                return true;
            } else return false;
        }
        return false;
    }
    fillRandom(count) {
        let emptySpots = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) if (this.grid[r][c] === 0) emptySpots.push({ r, c });
        }
        for (let i = 0; i < count && emptySpots.length > 0; i++) {
            let idx = Math.floor(Math.random() * emptySpots.length);
            let spot = emptySpots.splice(idx, 1)[0];
            this.grid[spot.r][spot.c] = 1;
            if (this.isColumnComplete(spot.c)) audio.playPrize();
        }
    }
    isColumnComplete(col) {
        for (let r = 0; r < this.rows; r++) if (this.grid[r][col] === 0) return false;
        return true;
    }
}

class Boss {
    constructor() {
        this.width = 120; this.height = 80;
        this.x = canvas.width / 2 - this.width / 2; this.y = 250;
        this.speed = 100; this.direction = 1;
        this.attackTimer = 0; this.attackRate = 2; this.rageTimer = 0;
    }
    update(dt) {
        this.x += this.speed * this.direction * dt;
        if (this.x <= 0) { this.x = 0; this.direction = 1; }
        else if (this.x + this.width >= canvas.width) { this.x = canvas.width - this.width; this.direction = -1; }
        if (this.rageTimer > 0) { this.rageTimer -= dt; this.attackRate = 0.3; }
        else this.attackRate = Math.max(0.5, 2.5 - (level * 0.5));
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.attack();
            this.attackTimer = this.attackRate + Math.random() * 0.5;
        }
    }

    checkCollision(brick) {
        if (brick.x < this.x + this.width &&
            brick.x + brick.width > this.x &&
            brick.y < this.y + this.height &&
            brick.y + brick.height > this.y) {
            return true;
        }
        return false;
    }

    attack() {
        let order = new StopWorkOrder(this.x + this.width / 2, this.y + this.height);
        order.speed = 200 + (level * 50); stopOrders.push(order);
    }

    draw(ctx) {
        // ULTRA-HIGH FIDELITY Boss (Updated for Lighter Skin & High Detail)
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

        // Center X ~ 30
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
        } else {
            fill(cx - 3, 13, 6, 1, cBlack);
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
    constructor(x, y, text) {
        this.x = x; this.y = y; this.text = text; this.life = 1.0; this.vy = -50;
    }
    update(dt) { this.y += this.vy * dt; this.life -= dt; }
    draw(ctx) {
        ctx.fillStyle = `rgba(255, 215, 0, ${this.life})`;
        ctx.font = 'bold 20px "Press Start 2P"';
        ctx.fillText(this.text, this.x, this.y);
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
        boss.speed = 100 + (level * 80);
        boss.attackRate = Math.max(0.5, 2.5 - (level * 0.5));
        boss.y = 150 + (level * 20);

        boss.width = 120; // Ensure consistent
        boss.height = 80;
        boss.x = canvas.width / 2 - boss.width / 2;

        bricks = []; stopOrders = []; powerUps = []; barriers = []; floatingTexts = []; cactuses = []; particles = [];


        // Calculate safe zone for cacti (below the lowest possible building block)
        // Rows * BrickHeight + TopMargin(50) = Bottom of grid
        let gridBottom = (rows * 20) + 50;
        let safeYStart = gridBottom + 20; // 20px buffer

        let cactusCount = 2 + Math.floor(Math.random() * 3);
        let javelinaCount = 1; // Always 1 Javelina

        // Spawn Javelina
        cactuses.push({
            x: Math.random() * (canvas.width - 50),
            y: safeYStart + Math.random() * (canvas.height - 150 - safeYStart),
            width: 40, height: 30, scale: 1.5, type: 'JAVELINA'
        });

        // Spawn Cacti
        for (let i = 0; i < cactusCount; i++) {
            // Ensure they don't spawn too low (on top of player)
            // Player is roughly at canvas.height - 120
            let maxY = canvas.height - 150;
            let spawnY = safeYStart + Math.random() * (maxY - safeYStart);

            // Safety check if grid is huge
            if (spawnY > maxY) spawnY = maxY;

            cactuses.push({
                x: Math.random() * (canvas.width - 50), y: spawnY,
                width: 30, height: 60, scale: 1.0 + Math.random() * 0.5, type: 'CACTUS'
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
        document.getElementById('game-over-screen').classList.remove('hidden');
        document.getElementById('final-score').innerHTML = `CONGRATULATIONS!<br>You have defeated the mighty LUCHACABRA<br>and have made your city a better city.<br><br>SCORE: ${score}`;
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
        document.getElementById('final-score').innerText = `SCORE: ${score}`;
        audio.playGameOver();
        return;
    }

    launcher.update(dt);
    boss.update(dt);
    blueprint.update(dt);

    powerUpTimer -= dt;
    if (powerUpTimer <= 0) {
        if (Math.random() < 0.3) {
            let type = Math.random() < 0.5 ? 'MONEY' : 'VOLUNTEER';
            powerUps.push(new PowerUp(Math.random() * (canvas.width - 20), 0, type));
        }
        powerUpTimer = 5;
    }

    for (let i = bricks.length - 1; i >= 0; i--) {
        let b = bricks[i]; b.update(dt);
        let hitBarrier = false;
        for (let j = 0; j < cactuses.length; j++) {
            let c = cactuses[j];
            if (b.x < c.x + c.width && b.x + b.width > c.x && b.y < c.y + c.height && b.y + b.height > c.y) {
                bricks.splice(i, 1); hitBarrier = true; audio.playHit(); break;
            }
        }
        if (hitBarrier) continue;
        for (let j = barriers.length - 1; j >= 0; j--) {
            let bar = barriers[j]; if (!bar.active) continue;
            if (b.x < bar.x + bar.width && b.x + b.width > bar.x && b.y < bar.y + bar.height && b.y + b.height > bar.y) {
                bar.takeDamage(); bricks.splice(i, 1); hitBarrier = true; audio.playHit(); break;
            }
        }
        if (hitBarrier) continue;
        if (boss.checkCollision(b)) {
            bricks.splice(i, 1); audio.playBossHit(); createExplosion(b.x, b.y, '#fff');
            boss.rageTimer = 2.0; boss.y += 2; continue;
        }
        if (blueprint.checkCollision(b)) {
            bricks.splice(i, 1); score += 10;
            document.getElementById('score').innerText = `SCORE: ${score}`;
            audio.playHit(); continue;
        }
        if (!b.active) bricks.splice(i, 1);
    }

    for (let i = stopOrders.length - 1; i >= 0; i--) {
        let s = stopOrders[i]; s.update(dt);
        let hitBarrier = false;
        for (let j = barriers.length - 1; j >= 0; j--) {
            let bar = barriers[j]; if (!bar.active) continue;
            if (s.x < bar.x + bar.width && s.x + s.width > bar.x && s.y < bar.y + bar.height && s.y + s.height > bar.y) {
                bar.takeDamage(); stopOrders.splice(i, 1); hitBarrier = true; audio.playHit(); break;
            }
        }
        if (hitBarrier) continue;
        if (s.x < launcher.x + launcher.width && s.x + s.width > launcher.x && s.y < launcher.y + launcher.height && s.y + s.height > launcher.y) {
            launcher.frozen = 1.5; health -= 10;
            const lifeFill = document.getElementById('life-bar-fill');
            if (lifeFill) {
                lifeFill.style.width = `${Math.max(0, health)}%`;
                if (health < 30) lifeFill.style.backgroundColor = '#f00';
                else if (health < 60) lifeFill.style.backgroundColor = '#ff0';
                else lifeFill.style.backgroundColor = '#0f0';
            }
            audio.playDamage(); createExplosion(launcher.x + launcher.width / 2, launcher.y, '#f00');
            stopOrders.splice(i, 1); continue;
        }
        if (!s.active) stopOrders.splice(i, 1);
    }

    for (let i = powerUps.length - 1; i >= 0; i--) {
        let p = powerUps[i]; p.update(dt);
        if (p.x < launcher.x + launcher.width && p.x + p.width > launcher.x && p.y < launcher.y + launcher.height && p.y + p.height > launcher.y) {
            if (p.type === 'MONEY') {
                launcher.activateRapidFire(); score += 150;
                document.getElementById('score').innerText = `SCORE: ${score}`;
                floatingTexts.push(new FloatingText(launcher.x + launcher.width / 2, launcher.y, "+150"));
                health = Math.min(100, health + 10);
                const lifeFill = document.getElementById('life-bar-fill');
                if (lifeFill) {
                    lifeFill.style.width = `${Math.max(0, health)}%`;
                    if (health < 30) lifeFill.style.backgroundColor = '#f00';
                    else if (health < 60) lifeFill.style.backgroundColor = '#ff0';
                    else lifeFill.style.backgroundColor = '#0f0';
                }
            }
            if (p.type === 'VOLUNTEER') blueprint.fillRandom(5);
            powerUps.splice(i, 1); audio.playPowerUp(); continue;
        }
        if (!p.active) powerUps.splice(i, 1);
    }

    for (let i = particles.length - 1; i >= 0; i--) { particles[i].update(dt); if (particles[i].life <= 0) particles.splice(i, 1); }
    for (let i = floatingTexts.length - 1; i >= 0; i--) { floatingTexts[i].update(dt); if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1); }
}

function draw() {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (currentState === STATE.PLAYING || currentState === STATE.MENU) {
        cactuses.forEach(c => {
            const cx = c.x; const cy = c.y; const s = c.scale;
            const p = 2; // standard pixel size

            if (c.type === 'JAVELINA') {
                // Javelina Art (Boar)
                const cFur = '#6B4226'; // Brown
                const cFurD = '#3D2B1F'; // Dark Brown
                const cSnout = '#CD853F'; // Peru
                const cEye = '#000';

                // Body (Round, bulk)
                ctx.fillStyle = cFur;
                ctx.fillRect(cx, cy, 20 * s, 14 * s);

                // Head
                ctx.fillRect(cx - 8 * s, cy + 2 * s, 10 * s, 10 * s);

                // Legs
                ctx.fillStyle = cFurD;
                ctx.fillRect(cx + 2 * s, cy + 14 * s, 3 * s, 6 * s);
                ctx.fillRect(cx + 14 * s, cy + 14 * s, 3 * s, 6 * s);
                ctx.fillRect(cx - 4 * s, cy + 12 * s, 3 * s, 6 * s);

                // Snout
                ctx.fillStyle = cSnout;
                ctx.fillRect(cx - 12 * s, cy + 6 * s, 4 * s, 4 * s);
                ctx.fillStyle = '#000'; // Nose holes
                ctx.fillRect(cx - 12 * s, cy + 7 * s, 1 * s, 2 * s);

                // Ears
                ctx.fillStyle = cFurD;
                ctx.fillRect(cx - 4 * s, cy - 2 * s, 3 * s, 4 * s);

                // Eye
                ctx.fillStyle = '#FFF';
                ctx.fillRect(cx - 6 * s, cy + 4 * s, 3 * s, 3 * s);
                ctx.fillStyle = '#000';
                ctx.fillRect(cx - 7 * s, cy + 5 * s, 2 * s, 2 * s);

                // White collar stripe
                ctx.fillStyle = '#D3D3D3';
                ctx.fillRect(cx + 6 * s, cy, 2 * s, 14 * s);

                // Spots
                ctx.fillStyle = '#D2B48C';
                ctx.fillRect(cx + 10 * s, cy + 4 * s, 2 * s, 2 * s);
                ctx.fillRect(cx + 14 * s, cy + 8 * s, 2 * s, 2 * s);

            } else {
                // Regular Cactus
                ctx.fillStyle = '#2E8B57';
                ctx.fillRect(cx + 10 * s, cy, 10 * s, 60 * s);
                ctx.fillRect(cx, cy + 20 * s, 10 * s, 8 * s); ctx.fillRect(cx, cy + 10 * s, 6 * s, 10 * s);
                ctx.fillRect(cx + 20 * s, cy + 25 * s, 10 * s, 8 * s); ctx.fillRect(cx + 24 * s, cy + 15 * s, 6 * s, 10 * s);
                ctx.fillStyle = '#FF69B4'; if (Math.random() > 0.95) ctx.fillRect(cx + 12 * s, cy - 2 * s, 4 * s, 4 * s);
            }
        });
        blueprint.draw(ctx);
        barriers.forEach(b => { if (b.active) b.draw(ctx); });

        // Safety check for objects
        if (launcher && launcher.draw) launcher.draw(ctx);
        if (boss && boss.draw) boss.draw(ctx);

        bricks.forEach(b => b.draw(ctx)); stopOrders.forEach(s => s.draw(ctx));
        powerUps.forEach(p => p.draw(ctx)); particles.forEach(p => p.draw(ctx));
        floatingTexts.forEach(t => t.draw(ctx));
    } else if (currentState === STATE.GAME_OVER && level >= 3 && health > 0) {
        if (Math.random() > 0.9) createExplosion(Math.random() * canvas.width, Math.random() * canvas.height / 2, `hsl(${Math.random() * 360}, 100%, 50%)`);
        particles.forEach(p => p.draw(ctx));
    }
}

// Instruction Screen Helpers
function instructionUnderstand() {
    console.log("Instruction understood. Switching to Start Screen.");
    document.getElementById('instruction-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
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

window.addEventListener('keydown', (e) => {
    if (currentState === STATE.MENU && e.code === 'Enter') startGame();
});

document.getElementById('instruction-btn').addEventListener('click', instructionUnderstand);
document.getElementById('restart-btn').addEventListener('click', resetGame);

// Start
resize();
initGame(); // Ensure objects exist for Menu background
requestAnimationFrame(gameLoop);
