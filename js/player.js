export class Player {
  constructor(x, y, id, isMe, updateHPDisplay) {
    this.x = x;
    this.y = y;
    this.id = id;
    this.isMe = isMe;
    this.updateHPDisplay = updateHPDisplay;
    this.element = null;
    this.bombCount = 0;
    this.maxBombs = 1;
    this.firePower = 1;
    this.isBombCooldown = false;
    this.hp = 3; // HPをローカルで管理
    this.isDamaged = false;
    this.render();
  }

  render() {
    const gameDiv = document.getElementById('game');
    const cellIndex = this.y * 20 + this.x; // マップサイズが20x20なので20に変更
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

  startBombCooldown() {
    this.isBombCooldown = true;
    setTimeout(() => {
      this.isBombCooldown = false;
      console.log('Bomb cooldown ended'); // ログを追加
    }, 2000);
  }
}