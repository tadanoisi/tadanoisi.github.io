import { MAP_SIZE, bombs, walls, database } from './game.js';
import { ref, set } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js";

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
    this.canPunch = true; // パンチ可能かどうかを示すフラグ
    this.direction = 'right'; // 初期方向を右に設定
    this.punchDistance = 4; // パンチで爆弾を飛ばせるマス数（4マスに変更）
    this.render();
  }

  // パンチを実行するメソッド
  punch() {
    if (!this.canPunch) return; // クールダウン中はパンチできない

    const directions = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };

    // 現在の向きに基づいてパンチの方向を決定
    const move = directions[this.direction];
    if (!move) return;

    // 爆弾が存在するか確認
    const bomb = Object.values(bombs).find(
      (b) => b.x === this.x + move.x && b.y === this.y + move.y
    );

    if (bomb) {
      // 爆弾を指定されたマス数先に飛ばす
      let newX = this.x + move.x * this.punchDistance;
      let newY = this.y + move.y * this.punchDistance;

      // 移動先が壁や他の爆弾でないか確認
      if (
        newX < 0 ||
        newX >= MAP_SIZE ||
        newY < 0 ||
        newY >= MAP_SIZE ||
        walls.has(`${newX},${newY}`) ||
        Object.values(bombs).some((b) => b.x === newX && b.y === newY)
      ) {
        return; // 移動できない場合は停止
      }

      // 爆弾の位置を更新
      bomb.moveTo(newX, newY);
      this.canPunch = false; // クールダウンを開始
      setTimeout(() => {
        this.canPunch = true; // 1秒後にクールダウン終了
      }, 1000);

      // パンチのエフェクトを表示
      this.showPunchEffect();
    }
  }

  // パンチのエフェクトを表示するメソッド
  showPunchEffect() {
    const gameDiv = document.getElementById('game');
    if (!gameDiv) return;

    const cellIndex = this.y * MAP_SIZE + this.x;
    const cell = gameDiv.children[cellIndex];
    if (!cell) return;

    const punchEffect = document.createElement('div');
    punchEffect.classList.add('punch-effect');
    cell.appendChild(punchEffect);

    setTimeout(() => {
      punchEffect.remove();
    }, 300); // 0.3秒後にエフェクトを削除
  }

  // プレイヤーの向きを更新するメソッド
  updateDirection(direction) {
    this.direction = direction;
  }

  // パンチで爆弾を飛ばせるマス数を設定するメソッド
  setPunchDistance(distance) {
    this.punchDistance = distance;
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