import { remove, ref } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js";
import { database, MAP_SIZE, bombs } from './game.js'; // bombs をインポート

// エフェクトのプーリング用配列
const explosionPool = [];

// エフェクト要素を取得する関数
function getExplosionElement() {
  if (explosionPool.length > 0) {
    return explosionPool.pop(); // プールから要素を取り出す
  }
  const explosionElement = document.createElement('div');
  explosionElement.classList.add('explosion');
  return explosionElement;
}

// エフェクト要素をプールに戻す関数
function releaseExplosionElement(explosionElement) {
  explosionElement.classList.remove('explosion');
  explosionPool.push(explosionElement);
}

export class Bomb {
  constructor(x, y, id, firePower, blocks, checkPlayerDamage, player, placedBy) {
    this.x = x;
    this.y = y;
    this.id = id;
    this.firePower = firePower;
    this.timer = 3;
    this.element = null;
    this.blocks = blocks;
    this.checkPlayerDamage = checkPlayerDamage;
    this.player = player;
    this.placedBy = placedBy; // 爆弾を置いたプレイヤーのID
    this.explosionElements = [];
    this.render();
  }

  render() {
    const gameDiv = document.getElementById('game');
    if (!gameDiv) {
      console.error('Game div not found!');
      return;
    }

    // マップの範囲外の場合は処理を中断
    if (this.x < 0 || this.x >= MAP_SIZE || this.y < 0 || this.y >= MAP_SIZE) {
      console.error('Bomb position is out of bounds:', this.x, this.y);
      return;
    }

    const cellIndex = this.y * MAP_SIZE + this.x; // マップサイズを動的に参照
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
          // 爆弾が削除された後に、bombs オブジェクトからも削除
          delete bombs[this.id];
        })
        .catch((error) => {
          console.error('Failed to remove bomb:', error);
        });
      this.player.bombCount--;
    }, this.timer * 1000);
  }

  explode() {
    const gameDiv = document.getElementById('game');
    if (!gameDiv) {
      console.error('Game div not found!');
      return;
    }

    const directions = [
      { x: 0, y: 0 }, // 中心
      { x: 1, y: 0 }, { x: -1, y: 0 }, // 左右
      { x: 0, y: 1 }, { x: 0, y: -1 } // 上下
    ];

    directions.forEach((dir) => {
      for (let i = 0; i <= this.firePower; i++) { // i を 0 から開始して中心も含める
        const explosionX = this.x + dir.x * i;
        const explosionY = this.y + dir.y * i;

        // マップの範囲外の場合は処理を中断
        if (explosionX < 0 || explosionX >= MAP_SIZE || explosionY < 0 || explosionY >= MAP_SIZE) break;

        // 爆発エフェクトを表示
        this.showExplosionEffect(explosionX, explosionY);

        // ブロックがある場合は破壊し、その先には進まない
        if (this.blocks.has(`${explosionX},${explosionY}`)) {
          this.destroyBlock(explosionX, explosionY);
          break; // この方向の爆発を終了
        }

        // プレイヤーのダメージチェック
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

    // マップの範囲外の場合は処理を中断
    if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) {
      console.error('Explosion position is out of bounds:', x, y);
      return;
    }

    const cellIndex = y * MAP_SIZE + x; // マップサイズを動的に参照
    const cell = gameDiv.children[cellIndex];

    if (!cell) {
      console.error('Cell not found at:', x, y);
      return;
    }

    const explosionElement = getExplosionElement();
    cell.appendChild(explosionElement);

    console.log(`Explosion effect added at (${x}, ${y})`); // デバッグ用ログ

    // アニメーション終了後に要素を削除
    const onAnimationEnd = () => {
      console.log(`Explosion effect ended at (${x}, ${y})`); // デバッグ用ログ
      explosionElement.removeEventListener('animationend', onAnimationEnd); // イベントリスナーを削除
      if (explosionElement.parentNode) {
        explosionElement.remove();
      }
      releaseExplosionElement(explosionElement); // エフェクト要素をプールに戻す
    };

    explosionElement.addEventListener('animationend', onAnimationEnd, { once: true }); // 一度だけ実行

    // エフェクトが確実に表示されるように少し遅らせる
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

    // マップの範囲外の場合は処理を中断
    if (x < 0 || x >= MAP_SIZE || y < 0 || y >= MAP_SIZE) {
      console.error('Block position is out of bounds:', x, y);
      return;
    }

    const cellIndex = y * MAP_SIZE + x; // マップサイズを動的に参照
    const cell = gameDiv.children[cellIndex];

    if (!cell) {
      console.error('Cell not found at:', x, y);
      return;
    }

    cell.classList.remove('block');
    this.blocks.delete(`${x},${y}`);
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