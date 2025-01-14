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
    // 位置が undefined の場合のデフォルト値を設定
    this.x = x !== undefined ? x : 0;
    this.y = y !== undefined ? y : 0;
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
    this.type = 'normal'; // デフォルトの爆弾タイプ
    this.render();
  }

  // 爆弾を指定された位置に移動させるメソッド
  moveTo(newX, newY) {
    console.log(`Moving bomb ${this.id} to (${newX}, ${newY})`); // デバッグ用ログ

    if (
      newX < 0 ||
      newX >= MAP_SIZE ||
      newY < 0 ||
      newY >= MAP_SIZE ||
      walls.has(`${newX},${newY}`) ||
      Object.values(bombs).some((b) => b.x === newX && b.y === newY && b.id !== this.id)
    ) {
      console.log(`Bomb ${this.id} cannot move to (${newX}, ${newY})`); // デバッグ用ログ
      return; // 移動できない場合は停止
    }

    // 他のプレイヤーに当たったか確認
    const hitPlayer = Object.values(players).find(
      (p) => p.x === newX && p.y === newY
    );

    if (hitPlayer) {
      console.log(`[BOMB] Player ${hitPlayer.id} hit by bomb!`); // プレイヤーが爆弾に当たったログ
      hitPlayer.stun(); // プレイヤーをスタン状態にする

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
      type: this.type, // 爆弾のタイプを追加
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
    if (!this.explosionTimer && this.timer > 0) {
      this.explosionTimer = setTimeout(() => {
        console.log(`[BOMB] Bomb ${this.id} exploded!`); // 爆発ログ
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
    console.log(`[BOMB] Bomb ${this.id} exploded at (${this.x}, ${this.y})`); // デバッグ用ログ

    // 位置が undefined の場合のエラーハンドリング
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

export class SplitBomb extends Bomb {
  constructor(x, y, id, firePower, checkPlayerDamage, player, placedBy, playerId) {
    super(x, y, id, firePower, checkPlayerDamage, player, placedBy, playerId);
    this.timer = 3; // 通常のタイマー
    this.type = 'split'; // 爆弾のタイプを設定
  }

  explode() {
    super.explode();
    this.split();
  }

  split() {
    const directions = [
      { x: 1, y: 0 }, { x: -1, y: 0 }, // 右と左
      { x: 0, y: 1 }, { x: 0, y: -1 }  // 下と上
    ];

    directions.forEach(dir => {
      const newX = this.x + dir.x * 2; // 2マス先の位置を計算
      const newY = this.y + dir.y * 2;

      // マップの範囲内かつ壁でない場合のみ爆弾を設置
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
          type: 'normal' // ノーマルの爆弾を生成
        });
      }
    });
  }

  render() {
    super.render();
    this.element.style.backgroundColor = 'pink'; // 色で区別
  }
}

export class InvisibleBomb extends Bomb {
  constructor(x, y, id, firePower, checkPlayerDamage, player, placedBy, playerId) {
    super(x, y, id, firePower, checkPlayerDamage, player, placedBy, playerId);
    this.timer = 3; // 通常のタイマー
    this.opacity = 0; // 初期透明度を完全に透明に設定
    this.fadeInterval = null; // 透明度変化用のインターバル
    this.type = 'invisible'; // 爆弾のタイプを設定

    // 位置が undefined の場合のデフォルト値を設定
    this.x = x !== undefined ? x : 0;
    this.y = y !== undefined ? y : 0;

    // Firebaseに爆弾の初期データを保存
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
    this.element.style.opacity = this.opacity; // 初期透明度を設定
    cell.appendChild(this.element);

    // 爆発タイマーが既に設定されていない場合のみタイマーを設定
    if (!this.explosionTimer) {
      this.explosionTimer = setTimeout(() => {
        console.log(`[BOMB] Invisible Bomb ${this.id} exploded!`); // 爆発ログ
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

      // 透明度を徐々に変化させるアニメーションを開始
      this.startFadeInAnimation();
    }
  }

  // 透明度を徐々に変化させるアニメーションを開始するメソッド
  startFadeInAnimation() {
    const fadeDuration = this.timer * 1000; // 爆発までの時間
    const fadeSteps = 100; // 透明度を変化させるステップ数
    const fadeInterval = fadeDuration / fadeSteps; // 各ステップの間隔

    this.fadeInterval = setInterval(() => {
      if (this.element) {
        this.opacity += 1 / fadeSteps; // 透明度を徐々に増加
        this.element.style.opacity = this.opacity;

        // Firebaseに透明度を保存
        set(ref(database, `bombs/${this.id}/opacity`), this.opacity)
          .catch((error) => {
            console.error('Failed to update bomb opacity:', error);
          });

        // 透明度が1になったらアニメーションを停止
        if (this.opacity >= 1) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
        }
      }
    }, fadeInterval);
  }

  explode() {
    console.log(`[BOMB] Invisible Bomb ${this.id} exploded at (${this.x}, ${this.y})`); // デバッグ用ログ

    // 位置が undefined の場合のエラーハンドリング
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

    // 爆発タイマーをクリア
    if (this.explosionTimer) {
      clearTimeout(this.explosionTimer);
      this.explosionTimer = null;
    }

    // 透明度変化アニメーションをクリア
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }
  }
}

export class RemoteBomb extends Bomb {
  constructor(x, y, id, firePower, checkPlayerDamage, player, placedBy, playerId) {
    super(x, y, id, firePower, checkPlayerDamage, player, placedBy, playerId);
    this.isRemote = true; // リモコンバクダンであることを示すフラグ
    this.warningCount = 0; // 警告回数を管理
    this.warningInterval = null; // 警告用のインターバル
    this.isTriggered = false; // 爆発がトリガーされたかどうかを示すフラグ
    this.type = 'remote'; // 爆弾のタイプを設定
  }

  // 爆発タイマーを無効化する
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
    this.element.style.backgroundColor = 'blue'; // リモコンバクダンの色を青に設定
    cell.appendChild(this.element);

    // 爆発タイマーを無効化
    if (this.explosionTimer) {
      clearTimeout(this.explosionTimer);
      this.explosionTimer = null;
    }
  }

  // 警告を表示するメソッド
  showWarning() {
    if (this.element) {
      this.element.style.backgroundColor = this.warningCount % 2 === 0 ? 'red' : 'black';
      this.warningCount++;

      if (this.warningCount >= 2) {
        clearInterval(this.warningInterval);
        this.warningInterval = null;
        this.explode(); // 2回の警告後に爆発
      }
    }
  }

  // 爆発をトリガーするメソッド
  triggerExplosion() {
    if (this.isRemote && !this.isTriggered) {
      this.isTriggered = true; // トリガー済みにする
      this.warningInterval = setInterval(() => this.showWarning(), 500); // 0.5秒間隔で警告

      // Firebaseに爆発をトリガーしたことを反映
      set(ref(database, `bombs/${this.id}/isTriggered`), true)
        .catch((error) => {
          console.error('Failed to update bomb trigger status:', error);
        });
    }
  }

  // 爆発処理
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

    // Firebaseから爆弾を削除
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

    // 削除された爆弾を処理
    for (const id in bombs) {
      if (!currentBombIds.has(id)) {
        bombs[id].remove();
        delete bombs[id];
      }
    }

    // 新しい爆弾または更新された爆弾を処理
    for (const id in bombsData) {
      const { x, y, timer, firePower, placedBy, type, isTriggered, opacity } = bombsData[id];

      // 位置が undefined の場合のエラーハンドリング
      if (x === undefined || y === undefined) {
        console.error(`Invalid bomb position: ${x}, ${y}`);
        console.log('Bomb data:', bombsData[id]); // 爆弾のデータをログに出力
        remove(ref(database, `bombs/${id}`)); // 無効な爆弾を削除
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

        // 爆弾の位置を更新
        bombs[id].x = x;
        bombs[id].y = y;
        bombs[id].render();

        // 透明度を更新
        if (type === 'invisible' && bombs[id].element) {
          bombs[id].element.style.opacity = opacity || 0;
        }

        // リモコンバクダンの爆発を同期
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