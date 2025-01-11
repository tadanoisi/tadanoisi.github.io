import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getDatabase, ref, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js";
import { Player } from './player.js';
import { Bomb } from './bomb.js';

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

function updateHUD() {
  if (player) {
    hpDisplay.textContent = `HP: ${player.hp}`;
    firePowerDisplay.textContent = `Fire Power: ${player.firePower}`;
    bombCountDisplay.textContent = `Bombs: ${player.bombCount}/${player.maxBombs}`;
  }
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
      } else if (Math.random() < 0.3 && !(x === 1 && y === 1)) {
        cell.classList.add('block');
        blocks.add(`${x},${y}`);
      }

      gameDiv.appendChild(cell);
    }
  }
}

function initPlayer() {
  let startX, startY;
  let maxAttempts = 100;
  let attempts = 0;

  do {
    startX = Math.floor(Math.random() * MAP_SIZE);
    startY = Math.floor(Math.random() * MAP_SIZE);
    attempts++;
    if (attempts >= maxAttempts) {
      console.error('Failed to find a valid starting position for the player.');
      return;
    }
  } while (isOccupied(startX, startY) || isWallOrBlock(startX, startY) || blocks.has(`${startX},${startY}`));

  player = new Player(startX, startY, playerId, true, updateHUD);
  player.render();
  set(ref(database, `players/${playerId}`), { x: player.x, y: player.y });
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

function checkItemPickup(x, y) {
  const itemKey = `${x},${y}`;
  if (items.has(itemKey)) {
    const item = items.get(itemKey);
    items.delete(itemKey);

    if (item.type === ITEM_TYPES.BOMB_UP) {
      player.maxBombs++;
    } else if (item.type === ITEM_TYPES.FIRE_UP) {
      player.firePower++;
    }

    updateHUD();
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
      players[id] = new Player(x, y, id, id === playerId, updateHUD);
    }
    players[id].updatePosition(x, y);
  }
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

window.onbeforeunload = () => {
  remove(ref(database, `players/${playerId}`));
};

initMap();
initPlayer();

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

    player.updatePosition(newX, newY);
    set(ref(database, `players/${playerId}`), { x: newX, y: newY });
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