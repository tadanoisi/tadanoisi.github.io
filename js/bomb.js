import { remove, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js";
import { database, MAP_SIZE, bombs, walls, players } from './game.js';

const explosionPool = [];

function getExplosionElement() {
  if (explosionPool.length > 0) {
    return explosionPool.pop();
  }
  const explosionElement = document.createElement('div');
  explosionElement.classList.add('explosion');
  return explosionElement;
}

function releaseExplosionElement(explosionElement) {
  explosionElement.classList.remove('explosion');
  explosionPool.push(explosionElement);
}

export class Bomb {
  constructor(x, y, id, firePower, checkPlayerDamage, player, placedBy, playerId) {
    this.x = x !== undefined ? x : 0;
    this.y = y !== undefined ? y : 0;
    this.id = id;
    this.firePower = firePower;
    this.timer = 3;
    this.element = null;
    this.checkPlayerDamage = checkPlayerDamage;
    this.player = player;
    this.placedBy = placedBy;
    this.playerId = playerId;
    this.explosionElements = [];
    this.explosionTimer = null;
    this.blinkInterval = null;
    this.type = 'normal';
    this.render();
  }

  moveTo(newX, newY) {
    console.log(`Moving bomb ${this.id} to (${newX}, ${newY})`);

    if (
      newX < 0 ||
      newX >= MAP_SIZE ||
      newY < 0 ||
      newY >= MAP_SIZE ||
      walls.has(`${newX},${newY}`) ||
      Object.values(bombs).some((b) => b.x === newX && b.y === newY && b.id !== this.id)
    ) {
      console.log(`Bomb ${this.id} cannot move to (${newX}, ${newY})`);
      return;
    }

    const hitPlayer = Object.values(players).find(
      (p) => p.x === newX && p.y === newY
    );

    if (hitPlayer) {
      console.log(`[BOMB] Player ${hitPlayer.id} hit by bomb!`);
      hitPlayer.stun();

      const directions = {
        up: { x: 0, y: -1 },
        down: { x: 0, y: 1 },
        left: { x: -1, y: 0 },
        right: { x: 1, y: 0 },
      };

      const move = directions[this.player.direction];
      if (move) {
        const nextX = newX + move.x;
        const nextY = newY + move.y;

        if (
          nextX >= 0 &&
          nextX < MAP_SIZE &&
          nextY >= 0 &&
          nextY < MAP_SIZE &&
          !walls.has(`${nextX},${nextY}`) &&
          !Object.values(bombs).some((b) => b.x === nextX && b.y === nextY)
        ) {
          newX = nextX;
          newY = nextY;
        }
      }
    }

    this.x = newX;
    this.y = newY;
    this.render();

    set(ref(database, `bombs/${this.id}`), {
      x: this.x,
      y: this.y,
      timer: this.timer,
      firePower: this.firePower,
      placedBy: this.placedBy,
      type: this.type,
    }).catch((error) => {
      console.error('Failed to update bomb position:', error);
    });
  }

  render() {
    const gameDiv = document.getElementById('game');
    if (!gameDiv) {
      console.error('Game div not found!');
      return;
    }

    const cellIndex = this.y * MAP_SIZE + this.x;
    const cell = gameDiv.children[cellIndex];

    if (!cell) {
      console.error('Cell not found at:', this.x, this.y);
      return;
    }

    if (this.element) {
      this.element.remove();
    }

    this.element = document.createElement('div');
    this.element.classList.add('bomb');
    cell.appendChild(this.element);

    if (!this.explosionTimer && this.timer > 0) {
      this.explosionTimer = setTimeout(() => {
        console.log(`[BOMB] Bomb ${this.id} exploded!`);
        this.explode();
        remove(ref(database, `bombs/${this.id}`))
          .then(() => {
            console.log('Bomb removed successfully:', this.id);
            delete bombs[this.id];
            if (this.placedBy === this.playerId) {
              this.player.bombExploded();
            }
          })
          .catch((error) => {
            console.error('Failed to remove bomb:', error);
          });
      }, this.timer * 1000);

      this.startBlinkAnimation();
    }
  }

  startBlinkAnimation() {
    let blinkCount = 0;
    const blinkDuration = 500;

    this.blinkInterval = setInterval(() => {
      if (this.element) {
        this.element.style.opacity = this.element.style.opacity === '0.5' ? '1' : '0.5';
        blinkCount++;

        if (blinkCount >= 6) {
          clearInterval(this.blinkInterval);
          this.blinkInterval = null;
        }
      }
    }, blinkDuration);
  }

  explode() {
    console.log(`[BOMB] Bomb ${this.id} exploded at (${this.x}, ${this.y})`);

    if (this.x === undefined || this.y === undefined) {
      console.error(`Invalid bomb position: ${this.x}, ${this.y}`);
      return;
    }

    const gameDiv = document.getElementById('game');
    if (!gameDiv) {
      console.error('Game div not found!');
      return;
    }

    const directions = [
      { x: 0, y: 0 },
      { x: 1, y: 0 }, { x: -1, y: 0 },
      { x: 0, y: 1 }, { x: 0, y: -1 }
    ];

    directions.forEach((dir) => {
      for (let i = 0; i <= this.firePower; i++) {
        const explosionX = this.x + dir.x * i;
        const explosionY = this.y + dir.y * i;

        if (explosionX < 0 || explosionX >= MAP_SIZE || explosionY < 0 || explosionY >= MAP_SIZE) break;

        if (walls.has(`${explosionX},${explosionY}`)) {
          break;
        }

        this.showExplosionEffect(explosionX, explosionY);
        this.checkPlayerDamage(explosionX, explosionY);
      }
    });

    if (this.element && this.element.parentNode) {
      this.element.remove();
    }
  }

  showExplosionEffect(x, y) {
    const gameDiv = document.getElementById('game');
    if (!gameDiv) {
      console.error('Game div not found!');
      return;
    }

    const cellIndex = y * MAP_SIZE + x;
    const cell = gameDiv.children[cellIndex];

    if (!cell) {
      console.error('Cell not found at:', x, y);
      return;
    }

    const explosionElement = getExplosionElement();
    cell.appendChild(explosionElement);

    const onAnimationEnd = () => {
      explosionElement.removeEventListener('animationend', onAnimationEnd);
      if (explosionElement.parentNode) {
        explosionElement.remove();
      }
      releaseExplosionElement(explosionElement);
    };

    explosionElement.addEventListener('animationend', onAnimationEnd, { once: true });

    setTimeout(() => {
      explosionElement.classList.add('explosion');
    }, 10);
  }

  remove() {
    if (this.element && this.element.parentNode) {
      this.element.remove();
      console.log('Bomb removed from DOM:', this.id);
    }
    this.explosionElements.forEach((element) => {
      if (element && element.parentNode) {
        element.remove();
      }
    });

    if (this.explosionTimer) {
      clearTimeout(this.explosionTimer);
      this.explosionTimer = null;
    }

    if (this.blinkInterval) {
      clearInterval(this.blinkInterval);
      this.blinkInterval = null;
    }
  }
}

export class SplitBomb extends Bomb {
  constructor(x, y, id, firePower, checkPlayerDamage, player, placedBy, playerId) {
    super(x, y, id, firePower, checkPlayerDamage, player, placedBy, playerId);
    this.timer = 3;
    this.type = 'split';
  }

  explode() {
    super.explode();
    this.split();
  }

  split() {
    const directions = [
      { x: 1, y: 0 }, { x: -1, y: 0 },
      { x: 0, y: 1 }, { x: 0, y: -1 }
    ];

    directions.forEach(dir => {
      const newX = this.x + dir.x * 2;
      const newY = this.y + dir.y * 2;

      if (
        newX >= 0 && newX < MAP_SIZE &&
        newY >= 0 && newY < MAP_SIZE &&
        !walls.has(`${newX},${newY}`)
      ) {
        const bombId = `bomb_${Math.floor(Math.random() * 1000)}`;
        set(ref(database, `bombs/${bombId}`), {
          x: newX,
          y: newY,
          timer: 1,
          firePower: 1,
          placedBy: this.placedBy,
          type: 'normal'
        });
      }
    });
  }

  render() {
    super.render();
    this.element.style.backgroundColor = 'pink';
  }
}

export class InvisibleBomb extends Bomb {
  constructor(x, y, id, firePower, checkPlayerDamage, player, placedBy, playerId) {
    super(x, y, id, firePower, checkPlayerDamage, player, placedBy, playerId);
    this.timer = 3;
    this.opacity = 0;
    this.fadeInterval = null;
    this.type = 'invisible';

    this.x = x !== undefined ? x : 0;
    this.y = y !== undefined ? y : 0;

    set(ref(database, `bombs/${this.id}`), {
      x: this.x,
      y: this.y,
      timer: this.timer,
      firePower: this.firePower,
      placedBy: this.placedBy,
      type: this.type,
      opacity: this.opacity,
    }).catch((error) => {
      console.error('Failed to initialize invisible bomb:', error);
    });
  }

  render() {
    const gameDiv = document.getElementById('game');
    if (!gameDiv) {
      console.error('Game div not found!');
      return;
    }

    const cellIndex = this.y * MAP_SIZE + this.x;
    const cell = gameDiv.children[cellIndex];

    if (!cell) {
      console.error('Cell not found at:', this.x, this.y);
      return;
    }

    if (this.element) {
      this.element.remove();
    }

    this.element = document.createElement('div');
    this.element.classList.add('bomb');
    this.element.style.opacity = this.opacity;
    cell.appendChild(this.element);

    if (!this.explosionTimer) {
      this.explosionTimer = setTimeout(() => {
        console.log(`[BOMB] Invisible Bomb ${this.id} exploded!`);
        this.explode();
        remove(ref(database, `bombs/${this.id}`))
          .then(() => {
            console.log('Invisible Bomb removed successfully:', this.id);
            delete bombs[this.id];
            if (this.placedBy === this.playerId) {
              this.player.bombExploded();
            }
          })
          .catch((error) => {
            console.error('Failed to remove invisible bomb:', error);
          });
      }, this.timer * 1000);

      this.startFadeInAnimation();
    }
  }

  startFadeInAnimation() {
    const fadeDuration = this.timer * 1000;
    const fadeSteps = 100;
    const fadeInterval = fadeDuration / fadeSteps;

    this.fadeInterval = setInterval(() => {
      if (this.element) {
        this.opacity += 1 / fadeSteps;
        this.element.style.opacity = this.opacity;

        set(ref(database, `bombs/${this.id}/opacity`), this.opacity)
          .catch((error) => {
            console.error('Failed to update bomb opacity:', error);
          });

        if (this.opacity >= 1) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
        }
      }
    }, fadeInterval);
  }

  explode() {
    console.log(`[BOMB] Invisible Bomb ${this.id} exploded at (${this.x}, ${this.y})`);

    if (this.x === undefined || this.y === undefined) {
      console.error(`Invalid bomb position: ${this.x}, ${this.y}`);
      return;
    }

    const gameDiv = document.getElementById('game');
    if (!gameDiv) {
      console.error('Game div not found!');
      return;
    }

    const directions = [
      { x: 0, y: 0 },
      { x: 1, y: 0 }, { x: -1, y: 0 },
      { x: 0, y: 1 }, { x: 0, y: -1 }
    ];

    directions.forEach((dir) => {
      for (let i = 0; i <= this.firePower; i++) {
        const explosionX = this.x + dir.x * i;
        const explosionY = this.y + dir.y * i;

        if (explosionX < 0 || explosionX >= MAP_SIZE || explosionY < 0 || explosionY >= MAP_SIZE) break;

        if (walls.has(`${explosionX},${explosionY}`)) {
          break;
        }

        this.showExplosionEffect(explosionX, explosionY);
        this.checkPlayerDamage(explosionX, explosionY);
      }
    });

    if (this.element && this.element.parentNode) {
      this.element.remove();
    }
  }

  remove() {
    if (this.element && this.element.parentNode) {
      this.element.remove();
      console.log('Invisible Bomb removed from DOM:', this.id);
    }
    this.explosionElements.forEach((element) => {
      if (element && element.parentNode) {
        element.remove();
      }
    });

    if (this.explosionTimer) {
      clearTimeout(this.explosionTimer);
      this.explosionTimer = null;
    }

    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
  }
}

export class RemoteBomb extends Bomb {
  constructor(x, y, id, firePower, checkPlayerDamage, player, placedBy, playerId) {
    super(x, y, id, firePower, checkPlayerDamage, player, placedBy, playerId);
    this.isRemote = true;
    this.warningCount = 0;
    this.warningInterval = null;
    this.isTriggered = false;
    this.type = 'remote';
  }

  render() {
    const gameDiv = document.getElementById('game');
    if (!gameDiv) {
      console.error('Game div not found!');
      return;
    }

    const cellIndex = this.y * MAP_SIZE + this.x;
    const cell = gameDiv.children[cellIndex];

    if (!cell) {
      console.error('Cell not found at:', this.x, this.y);
      return;
    }

    if (this.element) {
      this.element.remove();
    }

    this.element = document.createElement('div');
    this.element.classList.add('bomb');
    this.element.style.backgroundColor = 'blue';
    cell.appendChild(this.element);

    if (this.explosionTimer) {
      clearTimeout(this.explosionTimer);
      this.explosionTimer = null;
    }
  }

  showWarning() {
    if (this.element) {
      this.element.style.backgroundColor = this.warningCount % 2 === 0 ? 'red' : 'black';
      this.warningCount++;

      if (this.warningCount >= 2) {
        clearInterval(this.warningInterval);
        this.warningInterval = null;
        this.explode();
      }
    }
  }

  triggerExplosion() {
    if (this.isRemote && !this.isTriggered) {
      this.isTriggered = true;
      this.warningInterval = setInterval(() => this.showWarning(), 500);

      set(ref(database, `bombs/${this.id}/isTriggered`), true)
        .catch((error) => {
          console.error('Failed to update bomb trigger status:', error);
        });
    }
  }

  explode() {
    const gameDiv = document.getElementById('game');
    if (!gameDiv) {
      console.error('Game div not found!');
      return;
    }

    const directions = [
      { x: 0, y: 0 },
      { x: 1, y: 0 }, { x: -1, y: 0 },
      { x: 0, y: 1 }, { x: 0, y: -1 }
    ];

    directions.forEach((dir) => {
      for (let i = 0; i <= this.firePower; i++) {
        const explosionX = this.x + dir.x * i;
        const explosionY = this.y + dir.y * i;

        if (explosionX < 0 || explosionX >= MAP_SIZE || explosionY < 0 || explosionY >= MAP_SIZE) break;

        if (walls.has(`${explosionX},${explosionY}`)) {
          break;
        }

        this.showExplosionEffect(explosionX, explosionY);
        this.checkPlayerDamage(explosionX, explosionY);
      }
    });

    if (this.element && this.element.parentNode) {
      this.element.remove();
    }

    remove(ref(database, `bombs/${this.id}`))
      .then(() => {
        console.log('Remote Bomb removed successfully:', this.id);
        delete bombs[this.id];
        if (this.placedBy === this.playerId) {
          this.player.bombExploded();
        }
      })
      .catch((error) => {
        console.error('Failed to remove remote bomb:', error);
      });
  }
}

export function setupBombManager(checkPlayerDamage, player, playerId) {
  onValue(ref(database, 'bombs'), (snapshot) => {
    const bombsData = snapshot.val();
    if (!bombsData) return;

    const currentBombIds = new Set(Object.keys(bombsData));

    for (const id in bombs) {
      if (!currentBombIds.has(id)) {
        bombs[id].remove();
        delete bombs[id];
      }
    }

    for (const id in bombsData) {
      const { x, y, timer, firePower, placedBy, type, isTriggered, opacity } = bombsData[id];

      if (x === undefined || y === undefined) {
        console.error(`Invalid bomb position: ${x}, ${y}`);
        console.log('Bomb data:', bombsData[id]);
        remove(ref(database, `bombs/${id}`));
        continue;
      }

      if (x >= 0 && x < MAP_SIZE && y >= 0 && y < MAP_SIZE) {
        if (!bombs[id]) {
          if (type === 'split') {
            bombs[id] = new SplitBomb(x, y, id, firePower, checkPlayerDamage, player, placedBy, playerId);
          } else if (type === 'invisible') {
            bombs[id] = new InvisibleBomb(x, y, id, firePower, checkPlayerDamage, player, placedBy, playerId);
          } else if (type === 'remote') {
            bombs[id] = new RemoteBomb(x, y, id, firePower, checkPlayerDamage, player, placedBy, playerId);
          } else {
            bombs[id] = new Bomb(x, y, id, firePower, checkPlayerDamage, player, placedBy, playerId);
          }
        }

        bombs[id].x = x;
        bombs[id].y = y;
        bombs[id].render();

        if (type === 'invisible' && bombs[id].element) {
          bombs[id].element.style.opacity = opacity || 0;
        }

        if (type === 'remote' && isTriggered && !bombs[id].isTriggered) {
          bombs[id].triggerExplosion();
        }
      } else {
        console.error('Invalid bomb position:', x, y);
        remove(ref(database, `bombs/${id}`));
      }
    }
  });
}