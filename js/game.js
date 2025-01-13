import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getDatabase, ref, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js";
import { Player } from './player.js';
import { Bomb, setupBombManager } from './bomb.js';

const firebaseConfig = {
  apiKey: "AIzaSyCdwZ1i8yOhT2WFL540DECEhcllnAKEyrg",
  authDomain: "otamesi-f7e85.firebaseapp.com",
  databaseURL: "https://otamesi-f7e85-default-rtdb.firebaseio.com",
  projectId: "otamesi-f7e85",
  storageBucket: "otamesi-f7e85.appspot.com",
  messagingSenderId: "406129611065",
  appId: "1:406129611065:web:abb9f366f33ed4f90f58e8"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);

const gameDiv = document.getElementById('game');
const hpDisplay = document.getElementById('hp');
const firePowerDisplay = document.getElementById('fire-power');
const bombCountDisplay = document.getElementById('bomb-count');
const respawnButton = document.getElementById('respawn-button');
export const MAP_SIZE = 25; // マップのサイズ
export const walls = new Set(); // 壁の位置を管理するセット
export let players = {}; // 他のプレイヤーを管理するオブジェクト
export const bombs = {}; // 爆弾を管理するオブジェクト

const playerId = `player_${Math.floor(Math.random() * 1000)}`; // プレイヤーIDをランダムに生成
let player; // プレイヤーオブジェクトを保持する変数

// ステータス変更用のUI要素を取得
const hpInput = document.getElementById('hp-input');
const bombCountInput = document.getElementById('bomb-count-input');
const firePowerInput = document.getElementById('fire-power-input');
const applyStatusButton = document.getElementById('apply-status');

/**
 * ランダムな位置を取得する関数
 * @returns {Object} - ランダムな位置 { x, y }
 */
export function getRandomPosition() {
  let x, y;
  do {
    x = Math.floor(Math.random() * (MAP_SIZE - 2)) + 1;
    y = Math.floor(Math.random() * (MAP_SIZE - 2)) + 1;
  } while (isWallOrBlock(x, y)); // プレイヤー同士の当たり判定をなくすため、isOccupiedを削除
  return { x, y };
}

/**
 * HUDを更新する関数
 */
function updateHUD() {
  if (player) {
    hpDisplay.textContent = `HP: ${player.hp}`;
    firePowerDisplay.textContent = `Fire Power: ${player.firePower}`;
    bombCountDisplay.textContent = `Bombs: ${player.bombCount}/${player.maxBombs}`;
    if (player.isStunned) {
      hpDisplay.textContent += ' (STUNNED)';
    }
  }
}

/**
 * プレイヤーリストを更新する関数
 * @param {Object} players - プレイヤー情報
 */
function updatePlayerList(players) {
  const playerListDiv = document.getElementById('player-list');
  playerListDiv.innerHTML = '';

  for (const id in players) {
    const player = players[id];

    const playerItem = document.createElement('div');
    playerItem.classList.add('player-list-item');

    const playerColor = document.createElement('div');
    playerColor.classList.add('player-color');
    playerColor.style.backgroundColor = player.isMe ? 'green' : 'red';
    playerItem.appendChild(playerColor);

    const playerName = document.createElement('span');
    playerName.textContent = `Player ${id}`;
    playerItem.appendChild(playerName);

    const playerHP = document.createElement('span');
    playerHP.textContent = ` (HP: ${player.hp})`;
    playerItem.appendChild(playerHP);

    playerListDiv.appendChild(playerItem);
  }
}

/**
 * マップを初期化する関数
 */
function initMap() {
  gameDiv.innerHTML = '';
  gameDiv.style.gridTemplateColumns = `repeat(${MAP_SIZE}, 20px)`;
  gameDiv.style.gridTemplateRows = `repeat(${MAP_SIZE}, 20px)`;

  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');

      if (x === 0 || y === 0 || x === MAP_SIZE - 1 || y === MAP_SIZE - 1) {
        cell.classList.add('wall');
        walls.add(`${x},${y}`);
      } else if (x % 2 === 0 && y % 2 === 0) {
        cell.classList.add('wall');
        walls.add(`${x},${y}`);
      }

      gameDiv.appendChild(cell);
    }
  }

  initPlayer();
  setupEventListeners();
}

/**
 * プレイヤーを初期化する関数
 */
function initPlayer() {
  const { x, y } = getRandomPosition();

  if (isWallOrBlock(x, y)) {
    console.error('Player starting position is blocked!');
    return;
  }

  const cellIndex = y * MAP_SIZE + x;
  const cell = gameDiv.children[cellIndex];
  if (!cell) {
    console.error('Cell not found at:', x, y);
    return;
  }

  player = new Player(x, y, playerId, true, updateHUD);
  player.render();
  set(ref(database, `players/${playerId}`), { x, y, hp: player.hp, isStunned: false })
    .then(() => {
      console.log('Player initialized successfully');
    })
    .catch((error) => {
      console.error('Failed to initialize player:', error);
    });
  updateHUD();
}

/**
 * 指定された位置が壁またはブロックかどうかを確認する関数
 * @param {number} x - X座標
 * @param {number} y - Y座標
 * @returns {boolean} - 壁またはブロックの場合 true
 */
function isWallOrBlock(x, y) {
  return walls.has(`${x},${y}`);
}

/**
 * 指定された位置が他のプレイヤーに占有されているかどうかを確認する関数
 * @param {number} x - X座標
 * @param {number} y - Y座標
 * @returns {boolean} - 占有されている場合 true
 */
function isOccupied(x, y) {
  // プレイヤー同士の当たり判定をなくすため、常にfalseを返す
  return false;
}

/**
 * 指定された位置に爆弾があるかどうかを確認する関数
 * @param {number} x - X座標
 * @param {number} y - Y座標
 * @returns {boolean} - 爆弾がある場合 true
 */
function isBombAt(x, y) {
  for (const id in bombs) {
    if (bombs[id].x === x && bombs[id].y === y) {
      return true;
    }
  }
  return false;
}

/**
 * プレイヤーがダメージを受けたかどうかを確認する関数
 * @param {number} x - X座標
 * @param {number} y - Y座標
 */
function checkPlayerDamage(x, y) {
  if (player && player.x === x && player.y === y && !player.isDamaged && !player.isDead) {
    player.isDamaged = true;
    player.takeDamage();

    if (player.hp <= 0) {
      removePlayer(playerId);
      respawnButton.style.display = 'block';
      alert('You died! Press the respawn button to come back.');
    } else {
      set(ref(database, `players/${playerId}`), { x: player.x, y: player.y, hp: player.hp });
    }

    setTimeout(() => {
      player.isDamaged = false;
    }, 1000);

    updatePlayerList(players);
  }
}

/**
 * プレイヤーを削除する関数
 * @param {string} playerId - プレイヤーID
 */
function removePlayer(playerId) {
  remove(ref(database, `players/${playerId}`))
    .then(() => {
      console.log('Player removed successfully:', playerId);
    })
    .catch((error) => {
      console.error('Failed to remove player:', error);
    });
}

/**
 * プレイヤーをリスポーンさせる関数
 */
function respawnPlayer() {
  if (player) {
    player.respawn();
    set(ref(database, `players/${playerId}`), { x: player.x, y: player.y, hp: player.hp, isStunned: false });
    respawnButton.style.display = 'none';
  }
}

// ステータスを適用するイベントリスナー
applyStatusButton.addEventListener('click', () => {
  const newHP = parseInt(hpInput.value, 10);
  const newBombCount = parseInt(bombCountInput.value, 10);
  const newFirePower = parseInt(firePowerInput.value, 10);

  if (player) {
    player.hp = newHP;
    player.maxBombs = newBombCount;
    player.firePower = newFirePower;
    updateHUD();
    set(ref(database, `players/${playerId}`), { x: player.x, y: player.y, hp: player.hp });
  }
});

onValue(ref(database, 'players'), (snapshot) => {
  const playersData = snapshot.val();
  if (!playersData) return;

  const currentPlayerIds = new Set(Object.keys(playersData));

  for (const id in players) {
    if (!currentPlayerIds.has(id)) {
      players[id].remove();
      delete players[id];
    }
  }

  for (const id in playersData) {
    const { x, y, hp, isStunned } = playersData[id];
    if (!players[id]) {
      players[id] = new Player(x, y, id, id === playerId, updateHUD);
    }
    players[id].updatePosition(x, y);
    players[id].updateHP(hp);

    if (isStunned) {
      players[id].stun();
    } else {
      players[id].isStunned = false; // スタン状態でないことを反映
    }

    if (hp <= 0) {
      removePlayer(id);
    }
  }

  updatePlayerList(players);
});

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
    const { x, y, timer, firePower, placedBy } = bombsData[id];
    if (x >= 0 && x < MAP_SIZE && y >= 0 && y < MAP_SIZE) {
      if (!bombs[id]) {
        bombs[id] = new Bomb(x, y, id, firePower, checkPlayerDamage, player, placedBy, playerId);
      }
    } else {
      console.error('Invalid bomb position:', x, y);
      remove(ref(database, `bombs/${id}`));
    }
  }
});

window.onbeforeunload = () => {
  remove(ref(database, `players/${playerId}`));
};

/**
 * イベントリスナーを設定する関数
 */
function setupEventListeners() {
  document.addEventListener('keydown', (e) => {
    if (player && player.isMe && !player.isDead) {
      if (player.isStunned) {
        console.log(`[STUN] Player ${player.id} is stunned and cannot move!`); // スタン状態中は移動できないログ
        return; // スタン状態中はすべてのキー入力を無視
      }

      let newX = player.x;
      let newY = player.y;
      switch (e.key) {
        case 'ArrowUp': newY--; player.updateDirection('up'); break;
        case 'ArrowDown': newY++; player.updateDirection('down'); break;
        case 'ArrowLeft': newX--; player.updateDirection('left'); break;
        case 'ArrowRight': newX++; player.updateDirection('right'); break;
        case 'v': 
          if (!player.isStunned) { // スタン状態中はパンチできない
            player.punch(); 
          }
          break;
      }

      if (newX < 0 || newX >= MAP_SIZE || newY < 0 || newY >= MAP_SIZE) return;
      if (isWallOrBlock(newX, newY)) return;
      if (isBombAt(newX, newY)) return;

      player.updatePosition(newX, newY);
      set(ref(database, `players/${playerId}`), { x: newX, y: newY, hp: player.hp, isStunned: player.isStunned });
    }
  });

  let isPlacingBomb = false;
  document.addEventListener('keydown', async (e) => {
    if (e.key === ' ' && player && player.isMe && player.canPlaceBomb() && !isPlacingBomb && !player.isDead && !player.isStunned) { // スタン状態中は爆弾を置けない
      isPlacingBomb = true;
      const bombId = `bomb_${Math.floor(Math.random() * 1000)}`;

      if (player.x >= 0 && player.x < MAP_SIZE && player.y >= 0 && player.y < MAP_SIZE) {
        try {
          await set(ref(database, `bombs/${bombId}`), {
            x: player.x,
            y: player.y,
            timer: 3,
            firePower: player.firePower,
            placedBy: playerId
          });
          player.placeBomb();
        } catch (error) {
          console.error('Failed to place bomb:', error);
        } finally {
          isPlacingBomb = false;
        }
      } else {
        console.error('Bomb position is out of bounds:', player.x, player.y);
        isPlacingBomb = false;
      }
    }
  });

  respawnButton.addEventListener('click', () => {
    respawnPlayer();
  });
}

setupBombManager(checkPlayerDamage, player);

// 操作方法パネルを閉じる処理
document.getElementById('close-controls').addEventListener('click', () => {
  document.getElementById('controls-panel').style.display = 'none';
});

initMap();