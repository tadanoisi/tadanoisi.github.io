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
    this.x = x;
    this.y = y;
    this.id = id;
    this.firePower = firePower;
    this.timer = 3; // 爆発までのタイマー
    this.element = null;
    this.checkPlayerDamage = checkPlayerDamage;
    this.player = player;
    this.placedBy = placedBy;
    this.playerId = playerId;
    this.explosionElements = [];
    this.explosionTimer = null; // 爆発タイマーを保持するプロパティ
    this.blinkInterval = null; // 点滅アニメーション用のインターバル
    this.render();
  }

  // 爆弾を指定された位置に移動させるメソッド
  moveTo(newX, newY) {
    if (
      newX < 0 ||
      newX >= MAP_SIZE ||
      newY < 0 ||
      newY >= MAP_SIZE ||
      walls.has(`${newX},${newY}`) ||
      Object.values(bombs).some((b) => b.x === newX && b.y === newY && b.id !== this.id)
    ) {
      return; // 移動できない場合は停止
    }

    // 他のプレイヤーに当たったか確認
    const hitPlayer = Object.values(players).find(
      (p) => p.x === newX && p.y === newY
    );

    if (hitPlayer && hitPlayer.stun) {
      // プレイヤーを行動不能にする
      hitPlayer.stun();

      // 爆弾を進行方向の隣のマスに移動させる
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

        // 移動先が壁や他の爆弾でないか確認
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

    // 爆弾の位置を更新
    this.x = newX;
    this.y = newY;
    this.render();

    // Firebaseに爆弾の新しい位置を反映
    set(ref(database, `bombs/${this.id}`), {
      x: this.x,
      y: this.y,
      timer: this.timer,
      firePower: this.firePower,
      placedBy: this.placedBy,
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

    // 爆発タイマーが既に設定されていない場合のみタイマーを設定
    if (!this.explosionTimer) {
      this.explosionTimer = setTimeout(() => {
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

      // 爆発前に点滅アニメーションを開始
      this.startBlinkAnimation();
    }
  }

  // 爆発前に点滅アニメーションを開始するメソッド
  startBlinkAnimation() {
    let blinkCount = 0;
    const blinkDuration = 500; // 点滅の間隔（ミリ秒）

    this.blinkInterval = setInterval(() => {
      if (this.element) {
        this.element.style.opacity = this.element.style.opacity === '0.5' ? '1' : '0.5';
        blinkCount++;

        // 点滅を3回繰り返したらアニメーションを停止
        if (blinkCount >= 6) {
          clearInterval(this.blinkInterval);
          this.blinkInterval = null;
        }
      }
    }, blinkDuration);
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

    // 爆発タイマーをクリア
    if (this.explosionTimer) {
      clearTimeout(this.explosionTimer);
      this.explosionTimer = null;
    }

    // 点滅アニメーションをクリア
    if (this.blinkInterval) {
      clearInterval(this.blinkInterval);
      this.blinkInterval = null;
    }
  }
}

export function setupBombManager(checkPlayerDamage, player) {
  onValue(ref(database, 'bombs'), (snapshot) => {
    const bombsData = snapshot.val();
    if (!bombsData) return;

    const currentBombIds = new Set(Object.keys(bombsData));

    // 削除された爆弾を処理
    for (const id in bombs) {
      if (!currentBombIds.has(id)) {
        bombs[id].remove();
        delete bombs[id];
      }
    }

    // 新しい爆弾または更新された爆弾を処理
    for (const id in bombsData) {
      const { x, y, timer, firePower, placedBy } = bombsData[id];
      if (!bombs[id]) {
        bombs[id] = new Bomb(x, y, id, firePower, checkPlayerDamage, player, placedBy);
      } else {
        // 爆弾の位置が更新された場合、ローカルの爆弾オブジェクトを更新
        bombs[id].x = x;
        bombs[id].y = y;
        bombs[id].render();
      }
    }
  });
}