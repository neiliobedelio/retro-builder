const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Constants
const GRID_ROWS = 10;
const GRID_COLS = 10;
const BRICK_SIZE = 30; // Will be dynamic based on screen width
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

// Entities
class Launcher {
    constructor() {
        this.width = 80; // Bigger size V2
        this.height = 50;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - 60;
        this.color = '#0f0';
        this.cooldown = 0;
        this.frozen = 0;
        this.fireRate = 0.2;
        this.speed = 400; // Keyboard movement speed
    }

    update(dt) {
        if (this.frozen > 0) {
            this.frozen -= dt;
            this.color = '#00f'; // Blue when frozen
            return;
        }
        this.color = '#0f0';

        // Keyboard Input
        if (input.keys.left) this.x -= this.speed * dt;
        if (input.keys.right) this.x += this.speed * dt;
        if (input.keys.space) fireBrick();

        // Mouse/Touch Input (Override if significant movement)
        // Only verify mouse if it moved? 
        // Simple blend: Input.x is absolute, keyboard is relative.
        // Let's just clamp both.

        // Clamp
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;

        if (this.cooldown > 0) this.cooldown -= dt;
    }

    draw(ctx) {
        // Roadrunner V3 (Cartoon Style Pixel Art)
        const p = 4; // Pixel size
        const ox = this.x;
        const oy = this.y;

        // Neck (Blue) - Curved
        ctx.fillStyle = '#0000CC';
        ctx.fillRect(ox + 13 * p, oy + 0 * p, 2 * p, 4 * p);
        ctx.fillRect(ox + 12 * p, oy + 4 * p, 2 * p, 2 * p);

        // Body (Blue)
        ctx.fillRect(ox + 4 * p, oy + 5 * p, 10 * p, 4 * p);

        // Head (Blue)
        ctx.fillRect(ox + 12 * p, oy - 3 * p, 6 * p, 4 * p);

        // Crest/Feathers (Blue)
        ctx.fillRect(ox + 11 * p, oy - 4 * p, 2 * p, 2 * p);
        ctx.fillRect(ox + 10 * p, oy - 3 * p, 1 * p, 2 * p);

        // Big Cartoon Eye (White Sclera)
        ctx.fillStyle = '#FFF';
        ctx.fillRect(ox + 14 * p, oy - 2 * p, 3 * p, 2 * p);
        // Pupil (Black)
        ctx.fillStyle = '#000';
        if (this.frozen > 0) {
            // X eyes when stunned
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(ox + 15 * p, oy - 2 * p);
            ctx.lineTo(ox + 17 * p, oy);
            ctx.moveTo(ox + 17 * p, oy - 2 * p);
            ctx.lineTo(ox + 15 * p, oy);
            ctx.stroke();
        } else {
            ctx.fillRect(ox + 16 * p, oy - 1.5 * p, 1 * p, 1 * p);
        }

        // Beak (Orange)
        ctx.fillStyle = '#FF9900';
        ctx.beginPath();
        ctx.moveTo(ox + 18 * p, oy - 1 * p);
        ctx.lineTo(ox + 22 * p, oy + 1 * p); // Curved down
        ctx.lineTo(ox + 18 * p, oy + 1 * p);
        ctx.fill();

        // Hard Hat (Yellow) - Taller & Rounder
        ctx.fillStyle = '#FFFF00';
        ctx.fillRect(ox + 13 * p, oy - 6 * p, 4 * p, 1 * p); // Top
        ctx.fillRect(ox + 12 * p, oy - 5 * p, 6 * p, 1 * p); // Middle
        ctx.fillRect(ox + 12 * p, oy - 4 * p, 6 * p, 1 * p); // Base Dome
        ctx.fillRect(ox + 11 * p, oy - 3 * p, 8 * p, 1 * p); // Brim

        // Legs (Orange) - Fast Animation
        ctx.fillStyle = '#FF9900';
        if (Math.floor(Date.now() / 50) % 2 === 0) {
            // Run Frame 1
            ctx.beginPath();
            ctx.arc(ox + 6 * p, oy + 10 * p, 3 * p, 0, Math.PI * 2); // Blur circle
            ctx.fill();
            ctx.beginPath();
            ctx.arc(ox + 10 * p, oy + 9 * p, 2 * p, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Run Frame 2
            ctx.beginPath();
            ctx.arc(ox + 5 * p, oy + 9 * p, 2 * p, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(ox + 9 * p, oy + 10 * p, 3 * p, 0, Math.PI * 2);
            ctx.fill();
        }

        // Tail (Blue Feathers)
        ctx.fillStyle = '#0000CC';
        ctx.beginPath();
        ctx.moveTo(ox + 4 * p, oy + 5 * p);
        ctx.lineTo(ox - 2 * p, oy + 1 * p); // Longer tail
        ctx.lineTo(ox + 2 * p, oy + 7 * p);
        ctx.fill();

        // Dazed Stars Effect (Pixel Art)
        if (this.frozen > 0) {
            ctx.fillStyle = '#FFFF00';
            let t = Date.now() / 150;
            for (let i = 0; i < 4; i++) {
                let angle = t + (i * (Math.PI / 2));
                let sx = ox + 14 * p + Math.cos(angle) * 20;
                let sy = oy - 4 * p + Math.sin(angle) * 12;
                ctx.fillRect(sx, sy, 5, 5); // Big pixel star
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
        this.x = x;
        this.y = y;
        this.width = 10;
        this.height = 10;
        this.speed = 400;
        this.active = true;
    }

    update(dt) {
        this.y -= this.speed * dt;
        if (this.y < 0) this.active = false;
    }

    draw(ctx) {
        // 3D Brick Look
        // Main Face
        ctx.fillStyle = '#ffd700'; // Gold/Yellow
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Shadow (Bottom & Right)
        ctx.fillStyle = '#b8860b'; // Darker Gold
        ctx.fillRect(this.x + 2, this.y + this.height - 2, this.width - 2, 2);
        ctx.fillRect(this.x + this.width - 2, this.y + 2, 2, this.height - 2);

        // Highlight (Top & Left)
        ctx.fillStyle = '#ffffcc'; // Pale Yellow
        ctx.fillRect(this.x, this.y, this.width - 2, 2);
        ctx.fillRect(this.x, this.y, 2, this.height - 2);
    }
}

class StopWorkOrder {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.speed = 200;
        this.active = true;
        this.wobble = Math.random() * Math.PI * 2;
    }

    update(dt) {
        this.y += this.speed * dt;
        this.x += Math.sin(this.wobble) * 2; // Slight wobble
        this.wobble += dt * 5;
        if (this.y > canvas.height) this.active = false;
    }

    draw(ctx) {
        // Heavy Brick Projectile
        ctx.fillStyle = '#8B0000'; // Dark Red
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Rough Texture
        ctx.fillStyle = '#A52A2A'; // Brownish Red
        ctx.fillRect(this.x + 2, this.y + 2, 6, 6);
        ctx.fillRect(this.x + 12, this.y + 12, 6, 6);

        // Warning Symbol
        ctx.fillStyle = '#FFFF00';
        ctx.font = 'bold 16px Arial';
        ctx.fillText('!', this.x + 8, this.y + 16);
    }
}

class Barrier {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 60;
        this.height = 10;
        this.hp = 3;
        this.active = true;
    }

    draw(ctx) {
        // Color based on HP - Construction Yellow/Orange
        if (this.hp === 3) ctx.fillStyle = '#FFD700'; // Gold
        else if (this.hp === 2) ctx.fillStyle = '#DAA520'; // Goldenrod
        else ctx.fillStyle = '#B8860B'; // Dark Goldenrod

        ctx.fillRect(this.x, this.y, this.width, this.height);

        // Stripes
        ctx.fillStyle = '#000';
        for (let i = 0; i < this.width; i += 10) {
            ctx.fillRect(this.x + i, this.y, 2, this.height);
        }
    }

    takeDamage() {
        this.hp--;
        if (this.hp <= 0) this.active = false;
    }
}

class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.speed = 150;
        this.type = type; // 'MONEY' or 'VOLUNTEER'
        this.active = true;
    }

    update(dt) {
        this.y += this.speed * dt;
        if (this.y > canvas.height) this.active = false;
    }

    draw(ctx) {
        ctx.font = 'bold 30px "Press Start 2P", monospace'; // Use retro font if available, else monospace
        if (this.type === 'MONEY') {
            ctx.fillStyle = '#ffd700';
            ctx.fillText('$', this.x, this.y + 25);
        } else {
            ctx.fillStyle = '#0ff';
            ctx.fillText('+', this.x, this.y + 25);
        }
    }
}

class Blueprint {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.grid = [];
        this.brickWidth = canvas.width / cols;
        this.brickHeight = 20;

        // Initialize grid with variable heights
        for (let r = 0; r < rows; r++) {
            this.grid[r] = [];
            for (let c = 0; c < cols; c++) {
                // Variable Max Height Logic
                // Randomize "start row" for each column
                // Some columns start at row 0 (full height), others start lower.
                // We'll calculate this per column once. 
                this.grid[r][c] = 0;
            }
        }

        // Apply Sky mask (Variable Heights)
        for (let c = 0; c < cols; c++) {
            // Random start row (0 to rows-2). ensuring at least 2 blocks high
            let startRow = Math.floor(Math.random() * (rows - 2));
            for (let r = 0; r < startRow; r++) {
                this.grid[r][c] = -1; // -1 = Sky/Inactive
            }
        }
    }

    update(dt) {
        // Check win condition
        let filled = 0;
        let total = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] !== -1) total++;
                if (this.grid[r][c] === 1) filled++;
            }
        }
        if (total > 0 && filled === total) {
            nextLevel();
        }
    }

    draw(ctx) {
        for (let c = 0; c < this.cols; c++) {
            // Dynamic Roof Height Calculation
            // Find the highest filled block (lowest index r with val 1)
            // Or the "max height" of the building if empty.
            // Wait, request: "triangular roofs move up as the user accumulates hits"
            // This implies the roof sits on top of the COMPLETED blocks.
            // Let's find the top-most filled block.
            let topBlockY = (this.rows) * this.brickHeight + 50; // Default at bottom

            // Find highest FFILLED block
            let found = false;
            for (let r = 0; r < this.rows; r++) {
                if (this.grid[r][c] === 1) {
                    topBlockY = r * this.brickHeight + 50;
                    found = true;
                    break;
                }
            }
            // If nothing filled, roof sits at the bottom of the "buildable" area?
            // Or maybe it sits at the "startRow" (variable height top)?

            // Let's create the effect that the building grows.
            // So roof sits on `topBlockY`.
            // But we also need to respect the "Sky".

            // Actually, let's place roof on top of highest 1.
            // If no 1s, it's at the bottom (ground).
            // BUT we have variable heights. The "Sky" shouldn't be drawn.

            let bx = c * this.brickWidth;
            let by = 50; // Top of screenish

            // Draw Sky/Empty as invisible?
            // Draw filled blocks.

            // Roof logic
            let roofY = topBlockY;

            // If column is completely empty of bricks (but has valid spots), 
            // maybe roof starts at bottom?
            // Let's keep simpler logic: Roof is above the highest visible building part.
            // If `grid[r][c] == -1`, it's sky.
            // If `grid[r][c] == 0`, it's a girder/empty frame? User requested "targets".

            // Let's draw the roof at `topBlockY`.

            // Roof (Triangle/Trapezoid)
            ctx.beginPath();
            ctx.moveTo(bx + 2, roofY);
            ctx.lineTo(bx + (this.brickWidth - 8) / 2 + 2, roofY - 15);
            ctx.lineTo(bx + this.brickWidth - 6, roofY);
            ctx.closePath();
            ctx.fillStyle = '#3a3a3a';
            ctx.fill();

            // Antenna (On roof)
            ctx.fillStyle = '#555';
            ctx.fillRect(bx + this.brickWidth / 2 - 2, roofY - 25, 2, 25);
            ctx.fillStyle = '#f00';
            if (Math.floor(Date.now() / 500) % 2 === 0) {
                ctx.fillRect(bx + this.brickWidth / 2 - 3, roofY - 27, 4, 4);
            }

            for (let r = 0; r < this.rows; r++) {
                if (this.grid[r][c] === -1) continue; // Skip sky

                let brickY = r * this.brickHeight + 50;
                let bHeight = this.brickHeight;

                // 3D Side Effect
                ctx.fillStyle = '#1a1a1a';
                ctx.fillRect(bx + this.brickWidth - 6, brickY + 4, 6, bHeight - 4);

                // Body background (Construction Frame)
                if (this.grid[r][c] === 0) {
                    ctx.strokeStyle = '#2a2a2a';
                    ctx.strokeRect(bx + 2, brickY, this.brickWidth - 8, bHeight);
                }

                // Windows
                if (this.grid[r][c] === 1) {
                    // Body
                    ctx.fillStyle = '#2a2a2a';
                    ctx.fillRect(bx + 2, brickY, this.brickWidth - 8, bHeight);

                    // Segmented Windows (2x2 Grid)
                    let paneCols = 2;
                    let paneRows = 2;
                    let margin = 4;

                    let wWidth = (this.brickWidth - 8 - (margin * (paneCols + 1))) / paneCols;
                    let wHeight = (bHeight - (margin * (paneRows + 1))) / paneRows;

                    for (let pr = 0; pr < paneRows; pr++) {
                        for (let pc = 0; pc < paneCols; pc++) {
                            // Gradient Window Color
                            let hue = 120 - (r / this.rows) * 60;
                            hue += (c * 13) % 10;

                            // Slight individual flicker
                            if (Math.random() > 0.98) ctx.fillStyle = '#fff';
                            else ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;

                            ctx.shadowBlur = 5;
                            ctx.shadowColor = '#ff0';

                            let wx = bx + 2 + margin + (pc * (wWidth + margin));
                            let wy = brickY + margin + (pr * (wHeight + margin));

                            ctx.fillRect(wx, wy, wWidth, wHeight);
                        }
                    }
                    ctx.shadowBlur = 0;
                }
            }
        }
    }

    checkCollision(brick) {
        // Simple grid collision
        // Convert brick x/y to grid col/row
        // This is a bit tricky because brick is moving. 
        // For now, check center point of brick
        let cx = brick.x + brick.width / 2;
        let cy = brick.y + brick.height / 2;

        let col = Math.floor(cx / this.brickWidth);
        let row = Math.floor((cy - 50) / this.brickHeight);

        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
            if (this.grid[row][col] === -1) return false; // Pass through sky
            if (this.grid[row][col] === 0) {
                this.grid[row][col] = 1;
                return true; // Hit and filled
            } else {
                return false; // Already filled, pass through
            }
        }
        return false;
    }

    fillRandom(count) {
        let emptySpots = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[r][c] === 0) emptySpots.push({ r, c });
            }
        }

        for (let i = 0; i < count && emptySpots.length > 0; i++) {
            let idx = Math.floor(Math.random() * emptySpots.length);
            let spot = emptySpots.splice(idx, 1)[0];
            this.grid[spot.r][spot.c] = 1;
        }
    }
}

class Boss {
    constructor() {
        this.width = 60;
        this.height = 40;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = 250; // Middle area
        this.speed = 100;
        this.direction = 1;
        this.attackTimer = 0;
        this.attackRate = 2; // Seconds between attacks
        this.rageTimer = 0; // Rage mode timer
    }

    update(dt) {
        this.x += this.speed * this.direction * dt;

        // Fix: Push out of bounds to prevent sticking
        if (this.x <= 0) {
            this.x = 0;
            this.direction = 1;
        } else if (this.x + this.width >= canvas.width) {
            this.x = canvas.width - this.width;
            this.direction = -1;
        }

        // Rage Logic
        if (this.rageTimer > 0) {
            this.rageTimer -= dt;
            this.attackRate = 0.3; // Rapid fire in rage
        } else {
            this.attackRate = Math.max(0.5, 2.5 - (level * 0.5)); // Normal rate
        }

        // Attack logic
        this.attackTimer -= dt;
        if (this.attackTimer <= 0) {
            this.attack();
            // Randomize next attack slightly
            this.attackTimer = this.attackRate + Math.random() * 0.5;
        }
    }

    attack() {
        let order = new StopWorkOrder(this.x + this.width / 2, this.y + this.height);
        // Scale projectile speed with level too
        order.speed = 200 + (level * 50);
        stopOrders.push(order);
    }

    draw(ctx) {
        // Pixel Art Luchador Boss (Blocky Style)
        const p = 5; // Pixel size
        const ox = this.x;

        // Rage Effect (Stomp + Color Flash)
        let stompY = 0;
        let rageFlash = false;
        if (this.rageTimer > 0) {
            stompY = Math.sin(Date.now() / 50) * 5; // Rapid stomp
            if (Math.floor(Date.now() / 100) % 2 === 0) rageFlash = true;
        }
        const oy = this.y + stompY;

        // Rage Aura (Tight Outline)
        if (this.rageTimer > 0) {
            ctx.fillStyle = '#FF0000';
            // Head Outline
            ctx.fillRect(ox + 3 * p - 2, oy - 2, 6 * p + 4, 3 * p + 4);
            // Body Outline
            ctx.fillRect(ox + 2 * p - 2, oy + 3 * p - 2, 8 * p + 4, 5 * p + 4);
            // Arms Outline
            let armY = (Date.now() % 50 < 25) ? 1 * p : 4 * p;
            ctx.fillRect(ox - 2, oy + armY - 2, 2 * p + 4, 2 * p + 4); // Left
            ctx.fillRect(ox + 10 * p - 2, oy + armY - 2, 2 * p + 4, 2 * p + 4); // Right
        }

        // Colors (Normal vs Rage Flash)
        const cCape = rageFlash ? '#800000' : '#D00';
        const cBody = rageFlash ? '#FF0000' : '#FFCCAA';
        const cTrunks = rageFlash ? '#B22222' : '#008080';
        const cBoots = rageFlash ? '#FF4500' : '#FFD700';
        const cMask = rageFlash ? '#FF0000' : '#008080';
        const cMaskDetail = rageFlash ? '#FFFF00' : '#FFD700';
        const cArm = rageFlash ? '#FF0000' : '#FFCCAA';

        // Cape - Behind
        ctx.fillStyle = cCape;
        for (let i = 0; i < 12; i++) {
            for (let j = 2; j < 8; j++) {
                if (Math.random() > 0.2) ctx.fillRect(ox + i * p, oy + j * p, p, p);
            }
        }

        // Body
        ctx.fillStyle = cBody;
        ctx.fillRect(ox + 2 * p, oy + 3 * p, 8 * p, 5 * p);

        // Trunks
        ctx.fillStyle = cTrunks;
        ctx.fillRect(ox + 2 * p, oy + 6 * p, 8 * p, 2 * p);

        // Boots
        ctx.fillStyle = cBoots;
        ctx.fillRect(ox + 2 * p, oy + 8 * p, 2 * p, 2 * p); // Left
        ctx.fillRect(ox + 8 * p, oy + 8 * p, 2 * p, 2 * p); // Right

        // Head (Mask)
        ctx.fillStyle = cMask;
        ctx.fillRect(ox + 3 * p, oy, 6 * p, 3 * p);

        // Mask Details
        ctx.fillStyle = cMaskDetail;
        ctx.fillRect(ox + 4 * p, oy + 1 * p, 1 * p, 1 * p); // Eye
        ctx.fillRect(ox + 7 * p, oy + 1 * p, 1 * p, 1 * p); // Eye

        // Arms
        ctx.fillStyle = cArm;
        let armY = (Math.floor(Date.now() / 200) % 2 === 0) ? 3 * p : 2 * p;
        if (this.rageTimer > 0) armY = (Math.floor(Date.now() / 50) % 2 === 0) ? 1 * p : 4 * p; // Flail arms

        ctx.fillRect(ox, oy + armY, 2 * p, 2 * p); // Left Arm
        ctx.fillRect(ox + 10 * p, oy + armY, 2 * p, 2 * p); // Right Arm
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
}
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

    playShoot() {
        this.playTone(440, 'square', 0.1);
    }

    playHit() {
        this.playTone(100, 'sawtooth', 0.1);
    }

    playBossHit() {
        this.playTone(80, 'square', 0.1);
    }

    playPowerUp() {
        this.playTone(600, 'sine', 0.1);
        setTimeout(() => this.playTone(800, 'sine', 0.1), 100);
    }

    playFreeze() {
        this.playTone(150, 'sawtooth', 0.5);
    }

    playDamage() {
        this.playTone(100, 'sawtooth', 0.3);
    }

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
}

const audio = new SoundManager();

class FloatingText {
    constructor(x, y, text) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.life = 1.0; // Seconds
        this.dy = -50; // Float up speed
    }
    update(dt) {
        this.y += this.dy * dt;
        this.life -= dt;
    }
    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = '#FFFF00';
        ctx.font = 'bold 20px Arial';
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1.0;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 200;
        this.vy = (Math.random() - 0.5) * 200;
        this.life = 0.5; // Seconds
        this.color = color;
        this.size = Math.random() * 4 + 2;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 10; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function initGame() {
    resize();
    launcher = new Launcher();

    // Level Config
    let rows = 5, cols = 5;
    if (level === 2) { rows = 8; cols = 8; }
    if (level === 3) { rows = 12; cols = 10; }

    blueprint = new Blueprint(rows, cols);
    boss = new Boss();
    // Boss difficulty
    boss.speed = 100 + (level * 80);
    boss.attackRate = Math.max(0.5, 2.5 - (level * 0.5));
    boss.y = 150 + (level * 20); // Start lower each level

    // Boss Size Scaling
    boss.width = 60 + (level * 20);
    boss.height = 40 + (level * 15);
    boss.x = canvas.width / 2 - boss.width / 2; // Recenter

    bricks = [];
    stopOrders = [];
    powerUps = [];
    barriers = [];
    floatingTexts = [];

    // Create Barriers
    let barrierCount = 3;
    let spacing = canvas.width / (barrierCount + 1);
    for (let i = 1; i <= barrierCount; i++) {
        barriers.push(new Barrier(i * spacing - 30, 350));
    }

    if (level === 1) health = 100;

    // Reset Life Bar UI
    const lifeFill = document.getElementById('life-bar-fill');
    if (lifeFill) {
        lifeFill.style.width = `${health}%`;
        lifeFill.style.backgroundColor = '#0f0';
    }

    document.getElementById('level').innerText = `LEVEL: ${level}`;
}

function nextLevel() {
    if (level < 3) {
        level++;
        audio.playWin();

        // Transition Screen
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
        // Win Game
        currentState = STATE.GAME_OVER;
        document.getElementById('game-over-screen').classList.remove('hidden');
        document.getElementById('final-score').innerText = `YOU WON! SCORE: ${score}`;
        audio.playWin();
    }
}

function resize() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
    if (blueprint) blueprint.brickWidth = canvas.width / blueprint.cols;
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
    document.getElementById('start-screen').classList.add('hidden');
    currentState = STATE.PLAYING;
    score = 0;
    health = 100;
    level = 1;
    initGame();
}

function resetGame() {
    document.getElementById('game-over-screen').classList.add('hidden');
    currentState = STATE.MENU;
    document.getElementById('start-screen').classList.remove('hidden');
}

// Game Loop
function gameLoop(timestamp) {
    const deltaTime = (timestamp - lastTime) / 1000; // Seconds
    lastTime = timestamp;

    update(deltaTime);
    draw();

    requestAnimationFrame(gameLoop);
}

function update(dt) {
    if (currentState !== STATE.PLAYING) return;

    // Health Check
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

    // Power Up Spawning
    powerUpTimer -= dt;
    if (powerUpTimer <= 0) {
        if (Math.random() < 0.3) { // 30% chance every 5s
            let type = Math.random() < 0.5 ? 'MONEY' : 'VOLUNTEER';
            powerUps.push(new PowerUp(Math.random() * (canvas.width - 20), 0, type));
        }
        powerUpTimer = 5;
    }

    // Update Bricks
    for (let i = bricks.length - 1; i >= 0; i--) {
        let b = bricks[i];
        b.update(dt);

        // Barrier Collision
        let hitBarrier = false;
        for (let j = barriers.length - 1; j >= 0; j--) {
            let bar = barriers[j];
            if (!bar.active) continue;
            if (b.x < bar.x + bar.width && b.x + b.width > bar.x &&
                b.y < bar.y + bar.height && b.y + b.height > bar.y) {
                bar.takeDamage();
                bricks.splice(i, 1);
                hitBarrier = true;
                audio.playHit();
                break;
            }
        }
        if (hitBarrier) continue;

        // Collisions
        if (boss.checkCollision(b)) {
            bricks.splice(i, 1);
            audio.playBossHit();
            createExplosion(b.x, b.y, '#fff');

            // Enrage Mechanic: Trigger Rage Mode
            boss.rageTimer = 2.0; // Enrage for 2 seconds
            boss.y += 2; // Get closer on hit!

            continue;
        }

        if (blueprint.checkCollision(b)) {
            bricks.splice(i, 1);
            score += 10;
            document.getElementById('score').innerText = `SCORE: ${score}`;
            audio.playHit();
            continue;
        }

        if (!b.active) {
            bricks.splice(i, 1);
        }
    }

    // Update Stop Orders
    for (let i = stopOrders.length - 1; i >= 0; i--) {
        let s = stopOrders[i];
        s.update(dt);

        // Barrier Collision
        let hitBarrier = false;
        for (let j = barriers.length - 1; j >= 0; j--) {
            let bar = barriers[j];
            if (!bar.active) continue;
            if (s.x < bar.x + bar.width && s.x + s.width > bar.x &&
                s.y < bar.y + bar.height && s.y + s.height > bar.y) {
                bar.takeDamage();
                stopOrders.splice(i, 1);
                hitBarrier = true;
                audio.playHit();
                break;
            }
        }
        if (hitBarrier) continue;

        // Check collision with launcher
        if (s.x < launcher.x + launcher.width &&
            s.x + s.width > launcher.x &&
            s.y < launcher.y + launcher.height &&
            s.y + s.height > launcher.y) {

            launcher.frozen = 1.5; // Reduced stun duration (was 3s)
            health -= 10;

            // Update Life Bar
            const lifeFill = document.getElementById('life-bar-fill');
            if (lifeFill) {
                lifeFill.style.width = `${Math.max(0, health)}%`;
                if (health < 30) lifeFill.style.backgroundColor = '#f00';
                else if (health < 60) lifeFill.style.backgroundColor = '#ff0';
                else lifeFill.style.backgroundColor = '#0f0';
            }

            audio.playDamage();
            createExplosion(launcher.x + launcher.width / 2, launcher.y, '#f00');
            stopOrders.splice(i, 1);
            continue;
        }

        if (!s.active) {
            stopOrders.splice(i, 1);
        }
    }

    // Update PowerUps
    for (let i = powerUps.length - 1; i >= 0; i--) {
        let p = powerUps[i];
        p.update(dt);

        // Check collision with launcher
        if (p.x < launcher.x + launcher.width &&
            p.x + p.width > launcher.x &&
            p.y < launcher.y + launcher.height &&
            p.y + p.height > launcher.y) {

            if (p.type === 'MONEY') {
                launcher.activateRapidFire();
                // Score & Floating Text
                score += 150;
                document.getElementById('score').innerText = `SCORE: ${score}`;
                floatingTexts.push(new FloatingText(launcher.x + launcher.width / 2, launcher.y, "+150"));

                // Life Gain
                health = Math.min(100, health + 10);
                // Update Life Bar
                const lifeFill = document.getElementById('life-bar-fill');
                if (lifeFill) {
                    lifeFill.style.width = `${Math.max(0, health)}%`;
                    if (health < 30) lifeFill.style.backgroundColor = '#f00';
                    else if (health < 60) lifeFill.style.backgroundColor = '#ff0';
                    else lifeFill.style.backgroundColor = '#0f0';
                }
            }
            if (p.type === 'VOLUNTEER') blueprint.fillRandom(5);

            powerUps.splice(i, 1);
            audio.playPowerUp();
            continue;
        }

        if (!p.active) {
            powerUps.splice(i, 1);
        }
    }

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(dt);
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    // Update Floating Texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        floatingTexts[i].update(dt);
        if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
    }
}

function draw() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (currentState === STATE.PLAYING) {
        blueprint.draw(ctx);
        barriers.forEach(b => {
            if (b.active) b.draw(ctx);
        });
        launcher.draw(ctx);
        boss.draw(ctx);
        bricks.forEach(b => b.draw(ctx));
        stopOrders.forEach(s => s.draw(ctx));
        powerUps.forEach(p => p.draw(ctx));
        particles.forEach(p => p.draw(ctx));
        floatingTexts.forEach(t => t.draw(ctx));
    }
}

// Instruction Screen Helpers
function instructionUnderstand() {
    document.getElementById('instruction-screen').classList.add('hidden');
    document.getElementById('start-screen').classList.remove('hidden');
    // Initialize game background entities so it's not empty behind the menu
    resize();
    initGame();
    currentState = STATE.MENU;
}

// Event Listeners
// Mobile: Tap to start
document.getElementById('start-screen').addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent ghost click
    startGame();
}, { passive: false });

// Desktop/Keyboard: Enter to start
window.addEventListener('keydown', (e) => {
    // Check if we are in the MENU state (Start Screen is visible)
    if (currentState === STATE.MENU && e.code === 'Enter') {
        startGame();
    }
});

document.getElementById('restart-btn').addEventListener('click', resetGame);
document.getElementById('instruction-btn').addEventListener('click', instructionUnderstand);

// Start
resize();
// Game loop starts immediately to draw background, but state is MENU (waiting for instruction click)
requestAnimationFrame(gameLoop);
