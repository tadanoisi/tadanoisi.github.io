import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getDatabase, ref, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js";
import { Player } from './player.js';
import { Bomb, setupBombManager } from './bomb.js';
import { ItemManager } from './itemManager.js';

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
export const MAP_SIZE = 25;
export const walls = new Set();
let player;
let players = {};
let blocks = new Set();
export const bombs = {};
export const items = new Map();

export const ITEM_TYPES = {
  BOMB_UP: 'bomb_up',
  FIRE_UP: 'fire_up',
};

const playerId = `player_${Math.floor(Math.random() * 1000)}`;

// ItemManagerを初期化
export const itemManager = new ItemManager();

function updateHUD() {
  if (player) {
    hpDisplay.textContent = `HP: ${player.hp}`;
    firePowerDisplay.textContent = `Fire Power: ${player.firePower}`;
    bombCountDisplay.textContent = `Bombs: ${player.bombCount}/${player.maxBombs}`;
  }
}

// プレイヤーリストを更新する関数
function updatePlayerList(players) {
  const playerListDiv = document.getElementById('player-list');
  playerListDiv.innerHTML = ''; // リストをクリア

  for (const id in players) {
    const player = players[id];

    // プレイヤーリストのアイテムを作成
    const playerItem = document.createElement('div');
    playerItem.classList.add('player-list-item');

    // プレイヤーの色を表示
    const playerColor = document.createElement('div');
    playerColor.classList.add('player-color');
    playerColor.style.backgroundColor = player.isMe ? 'green' : 'red'; // 自分は緑、他人は赤
    playerItem.appendChild(playerColor);

    // プレイヤーの名前を表示
    const playerName = document.createElement('span');
    playerName.textContent = `Player ${id}`; // プレイヤーIDを表示
    playerItem.appendChild(playerName);

    // プレイヤーのHPを表示
    const playerHP = document.createElement('span');
    playerHP.textContent = ` (HP: ${player.hp})`;
    playerItem.appendChild(playerHP);

    playerListDiv.appendChild(playerItem);
  }
}

function generateBlocks() {
  const blocksToSave = new Set();

  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      // 壁の位置にはブロックを生成しない
      if (x === 0 || y === 0 || x === MAP_SIZE - 1 || y === MAP_SIZE - 1) {
        continue;
      }

      // 固定壁の位置にはブロックを生成しない
      if (x % 2 === 0 && y % 2 === 0) {
        continue;
      }

      // プレイヤーの開始位置周辺を空ける
      const isNearStart = (x >= 1 && x <= 3 && y >= 1 && y <= 3);
      if (isNearStart) {
        continue;
      }

      // ステージの角のマスから周囲1マスはブロックを配置しない
      const isNearCorner =
        (x === 1 && y === 1) || // 左上
        (x === 1 && y === MAP_SIZE - 2) || // 左下
        (x === MAP_SIZE - 2 && y === 1) || // 右上
        (x === MAP_SIZE - 2 && y === MAP_SIZE - 2); // 右下
      if (isNearCorner) {
        continue;
      }

      // ランダム生成（30%の確率でブロックを生成）
      if (Math.random() < 0.3) {
        blocksToSave.add(`${x},${y}`);
      }
    }
  }

  // Firebaseにブロックの位置を保存
  set(ref(database, 'blocks'), Array.from(blocksToSave));
}

function loadBlocks(callback) {
  onValue(ref(database, 'blocks'), (snapshot) => {
    const blocksData = snapshot.val();
    if (blocksData) {
      callback(new Set(blocksData));
    }
  });
}

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

  loadBlocks((loadedBlocks) => {
    blocks = loadedBlocks;

    for (let y = 0; y < MAP_SIZE; y++) {
      for (let x = 0; x < MAP_SIZE; x++) {
        const cellIndex = y * MAP_SIZE + x;
        const cell = gameDiv.children[cellIndex];

        if (blocks.has(`${x},${y}`)) {
          cell.classList.add('block');
        }
      }
    }

    initPlayer();
    setupEventListeners();
  });
}

function initPlayer() {
  const startX = 1;
  const startY = 1;

  if (isWallOrBlock(startX, startY)) {
    console.error('Player starting position is blocked!');
    return;
  }

  const cellIndex = startY * MAP_SIZE + startX;
  const cell = gameDiv.children[cellIndex];
  if (!cell) {
    console.error('Cell not found at:', startX, startY);
    return;
  }

  player = new Player(startX, startY, playerId, true, updateHUD);
  player.render();
  set(ref(database, `players/${playerId}`), { x: startX, y: startY, hp: player.hp }); // HPをFirebaseに保存
  updateHUD();
}

function isWallOrBlock(x, y) {
  return walls.has(`${x},${y}`) || blocks.has(`${x},${y}`);
}

function isOccupied(x, y) {
  for (const id in players) {
    if (players[id].x === x && players[id].y === y) {
      return true;
    }
  }
  return false;
}

function isBombAt(x, y) {
  for (const id in bombs) {
    if (bombs[id].x === x && bombs[id].y === y) {
      return true;
    }
  }
  return false;
}

function checkItemPickup(x, y) {
  const itemType = itemManager.pickupItem(x, y, playerId); // ローカルでアイテムを取得
  if (itemType) {
    if (itemType === ITEM_TYPES.BOMB_UP) {
      player.maxBombs++;
    } else if (itemType === ITEM_TYPES.FIRE_UP) {
      player.firePower++;
    }
    updateHUD();
  }
}

function checkPlayerDamage(x, y) {
  if (player.x === x && player.y === y && !player.isDamaged) {
    player.isDamaged = true;
    player.updateHP(player.hp - 1);

    if (player.hp <= 0) {
      alert('Game Over!');
      window.location.reload();
    }

    // HPをFirebaseに保存
    set(ref(database, `players/${playerId}`), { x: player.x, y: player.y, hp: player.hp });

    setTimeout(() => {
      player.isDamaged = false;
    }, 1000);

    // プレイヤーリストを更新
    updatePlayerList(players);
  }
}

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
    const { x, y, hp } = playersData[id];
    if (!players[id]) {
      players[id] = new Player(x, y, id, id === playerId, updateHUD);
    }
    players[id].updatePosition(x, y);
    players[id].updateHP(hp); // HPを更新
  }

  // プレイヤーリストを更新
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
        bombs[id] = new Bomb(x, y, id, firePower, blocks, checkPlayerDamage, player, placedBy, playerId);
      }
    } else {
      console.error('Invalid bomb position:', x, y);
      remove(ref(database, `bombs/${id}`));
    }
  }
});

// アイテムの変更を監視
onValue(ref(database, 'items'), (snapshot) => {
  const itemsData = snapshot.val();
  if (!itemsData) {
    // アイテムがすべて削除された場合
    items.clear();
    const itemElements = document.querySelectorAll('.item');
    itemElements.forEach((itemElement) => itemElement.remove());
    return;
  }

  const currentItemKeys = new Set(Object.keys(itemsData));

  // 削除されたアイテムを処理
  for (const key of items.keys()) {
    if (!currentItemKeys.has(key)) {
      items.delete(key);
      const [x, y] = key.split(',').map(Number);
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

  // 新しいアイテムを追加
  for (const key in itemsData) {
    const { type } = itemsData[key];
    if (!items.has(key)) {
      items.set(key, { type });

      const [x, y] = key.split(',').map(Number);
      const cellIndex = y * MAP_SIZE + x;
      const cell = gameDiv.children[cellIndex];
      if (cell) {
        const itemElement = document.createElement('div');
        itemElement.classList.add('item', type);
        cell.appendChild(itemElement);
      }
    }
  }
});

window.onbeforeunload = () => {
  remove(ref(database, `players/${playerId}`));
};

onValue(ref(database, 'blocks'), (snapshot) => {
  if (!snapshot.exists()) {
    generateBlocks();
  }
});

function setupEventListeners() {
  document.addEventListener('keydown', (e) => {
    if (player.isMe) {
      let newX = player.x;
      let newY = player.y;
      switch (e.key) {
        case 'ArrowUp': newY--; break;
        case 'ArrowDown': newY++; break;
        case 'ArrowLeft': newX--; break;
        case 'ArrowRight': newX++; break;
      }

      if (newX < 0 || newX >= MAP_SIZE || newY < 0 || newY >= MAP_SIZE) return;
      if (isWallOrBlock(newX, newY)) return;
      if (isOccupied(newX, newY)) return;
      if (isBombAt(newX, newY)) return;

      player.updatePosition(newX, newY);
      set(ref(database, `players/${playerId}`), { x: newX, y: newY, hp: player.hp }); // HPをFirebaseに保存
      checkItemPickup(newX, newY);
    }
  });

  let isPlacingBomb = false;
  document.addEventListener('keydown', async (e) => {
    if (e.key === ' ' && player.isMe && player.canPlaceBomb() && !isPlacingBomb) {
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
}

// BombManagerの設定を追加
setupBombManager(blocks, checkPlayerDamage, player);

// ゲームを初期化
initMap();