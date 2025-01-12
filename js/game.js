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
const respawnButton = document.getElementById('respawn-button'); // 復活ボタン
export const MAP_SIZE = 25;
export const walls = new Set();
let player;
let players = {};
export const bombs = {};

const playerId = `player_${Math.floor(Math.random() * 1000)}`;

function updateHUD() {
  if (player) {
    hpDisplay.textContent = `HP: ${player.hp}`;
    firePowerDisplay.textContent = `Fire Power: ${player.firePower}`;
    bombCountDisplay.textContent = `Bombs: ${player.bombCount}/${player.maxBombs}`;
  }
}

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

function getRandomPosition() {
  let x, y;
  do {
    x = Math.floor(Math.random() * (MAP_SIZE - 2)) + 1; // 1からMAP_SIZE-2の範囲でランダム
    y = Math.floor(Math.random() * (MAP_SIZE - 2)) + 1; // 1からMAP_SIZE-2の範囲でランダム
  } while (isWallOrBlock(x, y) || isOccupied(x, y)); // 壁や他のプレイヤーと重ならないようにする
  return { x, y };
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

  initPlayer();
  setupEventListeners();
}

function initPlayer() {
  const { x, y } = getRandomPosition(); // ランダムな位置を取得

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
  set(ref(database, `players/${playerId}`), { x, y, hp: player.hp });
  updateHUD();
}

function isWallOrBlock(x, y) {
  return walls.has(`${x},${y}`);
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

function checkPlayerDamage(x, y) {
  if (player.x === x && player.y === y && !player.isDamaged) {
    player.isDamaged = true;
    player.updateHP(player.hp - 1);

    if (player.hp <= 0) {
      removePlayer(playerId); // HPが0になったプレイヤーを削除
      respawnButton.style.display = 'block'; // 復活ボタンを表示
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

function removePlayer(playerId) {
  remove(ref(database, `players/${playerId}`))
    .then(() => {
      console.log('Player removed successfully:', playerId);
    })
    .catch((error) => {
      console.error('Failed to remove player:', error);
    });
}

function respawnPlayer() {
  // 古いプレイヤーを削除
  if (player) {
    player.remove(); // ローカルのプレイヤー表示を削除
  }

  // 古いプレイヤーデータをFirebaseから削除
  remove(ref(database, `players/${playerId}`))
    .then(() => {
      console.log('Old player data removed successfully:', playerId);

      // 新しいプレイヤーを生成
      const { x, y } = getRandomPosition(); // ランダムな位置を取得
      player = new Player(x, y, playerId, true, updateHUD);
      player.render();
      set(ref(database, `players/${playerId}`), { x, y, hp: player.hp });
      respawnButton.style.display = 'none'; // 復活ボタンを非表示
      updateHUD();
    })
    .catch((error) => {
      console.error('Failed to remove old player data:', error);
    });
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
    players[id].updateHP(hp);

    if (hp <= 0) {
      removePlayer(id); // HPが0のプレイヤーを削除
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
      set(ref(database, `players/${playerId}`), { x: newX, y: newY, hp: player.hp });
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

  // 復活ボタンのクリックイベント
  respawnButton.addEventListener('click', () => {
    respawnPlayer();
  });
}

setupBombManager(checkPlayerDamage, player);

initMap();