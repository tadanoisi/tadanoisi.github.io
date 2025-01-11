import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getDatabase, ref, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js";
import { Player } from './player.js';
import { Bomb } from './bomb.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCdwZ1i8yOhT2WFL540DECEhcllnAKEyrg",
  authDomain: "otamesi-f7e85.firebaseapp.com",
  databaseURL: "https://otamesi-f7e85-default-rtdb.firebaseio.com",
  projectId: "otamesi-f7e85",
  storageBucket: "otamesi-f7e85.appspot.com",
  messagingSenderId: "406129611065",
  appId: "1:406129611065:web:abb9f366f33ed4f90f58e8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);

// Game elements
const gameDiv = document.getElementById('game');
const hpDisplay = document.getElementById('hp');
export const MAP_SIZE = 21; // マップサイズをグローバル変数として定義
export const walls = new Set(); // walls をエクスポート
let player;
let players = {};
let blocks = new Set(); // Destroyable blocks
export const bombs = {}; // bombs をエクスポート

// アイテムの種類を定義
export const ITEM_TYPES = {
  BOMB_UP: 'bomb_up', // 爆弾の最大設置数を増やす
  FIRE_UP: 'fire_up', // 爆発範囲を強化する
};

// アイテムを管理するセット
export const items = new Map(); // { "x,y": { type: ITEM_TYPES.BOMB_UP } }

// Player ID generation
const playerId = `player_${Math.floor(Math.random() * 1000)}`;

// Map initialization
function initMap() {
  gameDiv.innerHTML = ''; // Clear existing map
  gameDiv.style.gridTemplateColumns = `repeat(${MAP_SIZE}, 20px)`;
  gameDiv.style.gridTemplateRows = `repeat(${MAP_SIZE}, 20px)`;

  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');

      // 外周に壁を設置
      if (x === 0 || y === 0 || x === MAP_SIZE - 1 || y === MAP_SIZE - 1) {
        cell.classList.add('wall');
        walls.add(`${x},${y}`);
      } else if (x % 2 === 0 && y % 2 === 0) {
        cell.classList.add('wall');
        walls.add(`${x},${y}`);
      } else if (Math.random() < 0.3 && !(x === 1 && y === 1)) { // スタート地点付近にブロックを生成しない
        cell.classList.add('block');
        blocks.add(`${x},${y}`);
      }

      gameDiv.appendChild(cell);
    }
  }
}

// Check if a position is a wall or block
function isWallOrBlock(x, y) {
  return walls.has(`${x},${y}`) || blocks.has(`${x},${y}`);
}

// Check if a position is occupied by another player
function isOccupied(x, y) {
  for (const id in players) {
    if (players[id].x === x && players[id].y === y) {
      return true;
    }
  }
  return false;
}

// Update HP display
function updateHPDisplay(hp) {
  if (hpDisplay) {
    hpDisplay.textContent = `HP: ${hp}`;
  } else {
    console.error('hpDisplay element not found!');
  }
}

// Initialize player
function initPlayer() {
  let startX, startY;
  let maxAttempts = 100; // 最大試行回数を設定
  let attempts = 0;

  do {
    startX = Math.floor(Math.random() * MAP_SIZE);
    startY = Math.floor(Math.random() * MAP_SIZE);
    attempts++;
    if (attempts >= maxAttempts) {
      console.error('Failed to find a valid starting position for the player.');
      return;
    }
  } while (
    isOccupied(startX, startY) || // 他のプレイヤーと重ならないか
    isWallOrBlock(startX, startY) || // 壁やブロックと重ならないか
    blocks.has(`${startX},${startY}`) // 壊せるブロックと重ならないか
  );

  player = new Player(startX, startY, playerId, true, updateHPDisplay);
  player.render();
  set(ref(database, `players/${playerId}`), { x: player.x, y: player.y })
    .then(() => {
      console.log('Player initialized successfully:', playerId);
    })
    .catch((error) => {
      console.error('Failed to initialize player:', error);
    });
}

// Check player damage from explosion
function checkPlayerDamage(x, y) {
  if (player.x === x && player.y === y && !player.isDamaged) {
    player.isDamaged = true;
    player.updateHP(player.hp - 1);

    if (player.hp <= 0) {
      alert('Game Over!');
      window.location.reload();
    }

    setTimeout(() => {
      player.isDamaged = false;
    }, 1000);
  }
}

// Monitor other players' positions
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
    const { x, y } = playersData[id];
    if (!players[id]) {
      players[id] = new Player(x, y, id, id === playerId, updateHPDisplay);
    }
    players[id].updatePosition(x, y);
  }
});

// Monitor bombs data
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

    // 爆弾の位置がマップの範囲内かチェック
    if (x >= 0 && x < MAP_SIZE && y >= 0 && y < MAP_SIZE) {
      if (!bombs[id]) {
        bombs[id] = new Bomb(x, y, id, firePower, blocks, checkPlayerDamage, player, placedBy);
      }
    } else {
      console.error('Invalid bomb position:', x, y);

      // 不正なデータをFirebaseから削除
      remove(ref(database, `bombs/${id}`))
        .then(() => {
          console.log('Invalid bomb removed from Firebase:', id);
        })
        .catch((error) => {
          console.error('Failed to remove invalid bomb:', error);
        });
    }
  }
});

// Remove player data when tab is closed
window.onbeforeunload = () => {
  remove(ref(database, `players/${playerId}`))
    .then(() => {
      console.log('Player removed successfully:', playerId);
    })
    .catch((error) => {
      console.error('Failed to remove player:', error);
    });
};

// Start the game
initMap();
initPlayer();

// Player movement
document.addEventListener('keydown', (e) => {
  if (player.isMe) {
    let newX = player.x;
    let newY = player.y;
    switch (e.key) {
      case 'ArrowUp':
        newY--;
        break;
      case 'ArrowDown':
        newY++;
        break;
      case 'ArrowLeft':
        newX--;
        break;
      case 'ArrowRight':
        newX++;
        break;
    }

    // マップの範囲内かチェック
    if (newX < 0 || newX >= MAP_SIZE || newY < 0 || newY >= MAP_SIZE) {
      console.log('Cannot move: Out of bounds');
      return;
    }

    // 壁やブロックがあるかチェック
    if (isWallOrBlock(newX, newY)) {
      console.log('Cannot move: Wall or block');
      return;
    }

    // 他のプレイヤーがいるかチェック
    if (isOccupied(newX, newY)) {
      console.log('Cannot move: Occupied by another player');
      return;
    }

    // 爆弾の上を通れるかチェック
    const bombAtNewPosition = Object.values(bombs).find(bomb => bomb.x === newX && bomb.y === newY);
    if (bombAtNewPosition) {
      console.log('Cannot move: Bomb in the way');
      return;
    }

    // 移動処理を実行
    player.updatePosition(newX, newY);
    set(ref(database, `players/${playerId}`), { x: newX, y: newY })
      .then(() => {
        console.log('Player position updated successfully:', newX, newY);
      })
      .catch((error) => {
        console.error('Failed to update player position:', error);
      });

    // アイテムを取得するチェック
    checkItemPickup(newX, newY);
  }
});

// Bomb placement
let isPlacingBomb = false; // 爆弾設置中かどうかを示すフラグ

document.addEventListener('keydown', async (e) => {
  if (e.key === ' ' && player.isMe && player.canPlaceBomb() && !isPlacingBomb) {
    isPlacingBomb = true; // 爆弾設置中にフラグを設定

    const bombId = `bomb_${Math.floor(Math.random() * 1000)}`;

    // 爆弾の位置がマップの範囲内かチェック
    if (player.x >= 0 && player.x < MAP_SIZE && player.y >= 0 && player.y < MAP_SIZE) {
      try {
        // Firebaseに爆弾データを書き込む
        await set(ref(database, `bombs/${bombId}`), {
          x: player.x,
          y: player.y,
          timer: 3,
          firePower: player.firePower,
          placedBy: playerId // 爆弾を置いたプレイヤーのIDを記録
        });

        console.log('Bomb placed successfully:', bombId);
        player.bombCount++;
        console.log(`Bomb count: ${player.bombCount}`); // デバッグログ
      } catch (error) {
        console.error('Failed to place bomb:', error);
      } finally {
        isPlacingBomb = false; // 爆弾設置が完了したらフラグを解除
      }
    } else {
      console.error('Bomb position is out of bounds:', player.x, player.y);
      isPlacingBomb = false; // エラーが発生した場合もフラグを解除
    }
  }
});

// ブロックを壊す関数
function destroyBlock(x, y) {
  const cellIndex = y * MAP_SIZE + x;
  const cell = gameDiv.children[cellIndex];
  if (!cell) return;

  cell.classList.remove('block');
  blocks.delete(`${x},${y}`);

  // 100%の確率でアイテムを生成
  const itemType = Math.random() < 0.5 ? ITEM_TYPES.BOMB_UP : ITEM_TYPES.FIRE_UP;
  items.set(`${x},${y}`, { type: itemType });

  // アイテムを表示
  const itemElement = document.createElement('div');
  itemElement.classList.add('item', itemType);
  cell.appendChild(itemElement);
}

// プレイヤーがアイテムを取得する処理
function checkItemPickup(x, y) {
  const itemKey = `${x},${y}`;
  if (items.has(itemKey)) {
    const item = items.get(itemKey);
    items.delete(itemKey);

    // アイテムの効果を適用
    if (item.type === ITEM_TYPES.BOMB_UP) {
      player.maxBombs++;
      console.log('Bomb UP! Max bombs:', player.maxBombs); // デバッグログ
    } else if (item.type === ITEM_TYPES.FIRE_UP) {
      player.firePower++;
      console.log('Fire UP! Fire power:', player.firePower); // デバッグログ
    }

    // アイテムを削除
    const cellIndex = y * MAP_SIZE + x;
    const cell = gameDiv.children[cellIndex];
    if (cell) {
      const itemElement = cell.querySelector('.item');
      if (itemElement) {
        itemElement.remove();
      }
    }
  }
}