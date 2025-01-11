import { remove, ref } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js";
import { database } from './game.js';

export class Bomb {
  constructor(x, y, id, firePower, blocks, checkPlayerDamage, player) {
    this.x = x;
    this.y = y;
    this.id = id;
    this.firePower = firePower;
    this.timer = 3;
    this.element = null;
    this.blocks = blocks;
    this.checkPlayerDamage = checkPlayerDamage;
    this.player = player;
    this.explosionElements = [];
    this.render();
  }

  render() {
    const gameDiv = document.getElementById('game');
    const cellIndex = this.y * 20 + this.x; // マップサイズが20x20なので20に変更
    const cell = gameDiv.children[cellIndex];

    this.element = document.createElement('div');
    this.element.classList.add('bomb');
    cell.appendChild(this.element);

    setTimeout(() => {
      this.explode();
      remove(ref(database, `bombs/${this.id}`));
      this.player.bombCount--;
    }, this.timer * 1000);
  }

  explode() {
    const gameDiv = document.getElementById('game');
    const directions = [
      { x: 0, y: 0 }, // 中心
      { x: 1, y: 0 }, { x: -1, y: 0 }, // 左右
      { x: 0, y: 1 }, { x: 0, y: -1 } // 上下
    ];

    directions.forEach((dir) => {
      for (let i = 1; i <= this.firePower; i++) {
        const explosionX = this.x + dir.x * i;
        const explosionY = this.y + dir.y * i;

        if (explosionX < 0 || explosionX >= 20 || explosionY < 0 || explosionY >= 20) break; // マップサイズが20x20なので20に変更
        if (this.blocks.has(`${explosionX},${explosionY}`)) {
          this.destroyBlock(explosionX, explosionY);
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
    const cellIndex = y * 20 + x; // マップサイズが20x20なので20に変更
    const cell = gameDiv.children[cellIndex];

    const explosionElement = document.createElement('div');
    explosionElement.classList.add('explosion');
    cell.appendChild(explosionElement);
    this.explosionElements.push(explosionElement);

    setTimeout(() => {
      if (explosionElement.parentNode) {
        explosionElement.remove();
      }
    }, 500);
  }

  destroyBlock(x, y) {
    const gameDiv = document.getElementById('game');
    const cellIndex = y * 20 + x; // マップサイズが20x20なので20に変更
    const cell = gameDiv.children[cellIndex];

    cell.classList.remove('block');
    this.blocks.delete(`${x},${y}`);
  }

  remove() {
    if (this.element && this.element.parentNode) {
      this.element.remove();
    }
    this.explosionElements.forEach((element) => {
      if (element && element.parentNode) {
        element.remove();
      }
    });
  }
}