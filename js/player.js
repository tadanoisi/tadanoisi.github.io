import { MAP_SIZE } from './game.js';

export class Player {
  constructor(x, y, id, isMe, updateHUD) {
    this.x = x;
    this.y = y;
    this.id = id;
    this.isMe = isMe;
    this.updateHUD = updateHUD;
    this.element = null;
    this.bombCount = 0;
    this.maxBombs = 1;
    this.firePower = 1;
    this.isBombCooldown = false;
    this.hp = 3;
    this.isDamaged = false;
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

    if (this.element) {
      this.element.remove();
    }

    this.element = document.createElement('div');
    this.element.classList.add('player');
    if (this.isMe) {
      this.element.classList.add('my-player');
    }
    cell.appendChild(this.element);
  }

  updatePosition(x, y) {
    this.x = x;
    this.y = y;
    this.render();
  }

  updateHP(hp) {
    this.hp = hp;
    if (this.isMe && this.updateHUD) {
      this.updateHUD();
    }
  }

  remove() {
    if (this.element && this.element.parentNode) {
      this.element.remove();
    }
  }

  placeBomb() {
    if (this.canPlaceBomb()) {
      this.bombCount++;
      this.updateHUD();
    }
  }

  bombExploded() {
    if (this.bombCount > 0) {
      this.bombCount--;
      this.updateHUD();
    }
  }

  canPlaceBomb() {
    return !this.isBombCooldown && this.bombCount < this.maxBombs;
  }
}