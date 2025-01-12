import { remove, ref, set } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js";
import { database, MAP_SIZE, bombs, walls, ITEM_TYPES, items } from './game.js';

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
  constructor(x, y, id, firePower, blocks, checkPlayerDamage, player, placedBy, playerId) {
    this.x = x;
    this.y = y;
    this.id = id;
    this.firePower = firePower;
    this.timer = 3;
    this.element = null;
    this.blocks = blocks;
    this.checkPlayerDamage = checkPlayerDamage;
    this.player = player;
    this.placedBy = placedBy;
    this.playerId = playerId;
    this.explosionElements = [];
    this.render();
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

    this.element = document.createElement('div');
    this.element.classList.add('bomb');
    cell.appendChild(this.element);

    setTimeout(() => {
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

        if (this.blocks.has(`${explosionX},${explosionY}`)) {
          this.destroyBlock(explosionX, explosionY);
          break;
        }

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

  destroyBlock(x, y) {
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

    cell.classList.remove('block');
    this.blocks.delete(`${x},${y}`);

    // アイテムをランダムで生成
    const itemType = Math.random() < 0.5 ? ITEM_TYPES.BOMB_UP : ITEM_TYPES.FIRE_UP;
    const itemKey = `${x},${y}`;

    // Firebaseにアイテムを保存
    set(ref(database, `items/${itemKey}`), { type: itemType })
      .then(() => {
        console.log('Item added successfully:', itemKey);
      })
      .catch((error) => {
        console.error('Failed to add item:', error);
      });
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
  }
}