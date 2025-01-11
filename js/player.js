import { MAP_SIZE } from './game.js'; // マップサイズをインポート

export class Player {
  constructor(x, y, id, isMe, updateHPDisplay) {
    this.x = x;
    this.y = y;
    this.id = id;
    this.isMe = isMe;
    this.updateHPDisplay = updateHPDisplay;
    this.element = null;
    this.bombCount = 0;
    this.maxBombs = 1; // 同時に置ける爆弾の最大数
    this.firePower = 1;
    this.isBombCooldown = false; // クールダウン中かどうか
    this.hp = 3; // HPをローカルで管理
    this.isDamaged = false;
    this.render();
  }

  render() {
    const gameDiv = document.getElementById('game');
    const cellIndex = this.y * MAP_SIZE + this.x; // マップサイズを動的に参照
    const cell = gameDiv.children[cellIndex];
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
    if (this.isMe && this.updateHPDisplay) {
      this.updateHPDisplay(this.hp);
    }
  }

  remove() {
    if (this.element && this.element.parentNode) {
      this.element.remove();
    }
  }

  // 爆弾設置クールダウンを開始するメソッド
  startBombCooldown() {
    this.isBombCooldown = true;
    setTimeout(() => {
      this.isBombCooldown = false;
      console.log('Bomb cooldown ended');
    }, 2000); // クールダウン時間を2秒に設定
  }

  // 爆弾を設置できるかどうかをチェックするメソッド
  canPlaceBomb() {
    const canPlace = !this.isBombCooldown && this.bombCount < this.maxBombs;
    console.log(`Can place bomb? ${canPlace} (bombCount: ${this.bombCount}, maxBombs: ${this.maxBombs})`); // デバッグログ
    return canPlace;
  }
}