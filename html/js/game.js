import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getDatabase, ref, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js";
import { Player } from './player.js';
import { Bomb } from './bomb.js';

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyCdwZ1i8yOhT2WFL540DECEhcllnAKEyrg",
  authDomain: "otamesi-f7e85.firebaseapp.com",
  databaseURL: "https://otamesi-f7e85-default-rtdb.firebaseio.com",
  projectId: "otamesi-f7e85",
  storageBucket: "otamesi-f7e85.appspot.com",
  messagingSenderId: "406129611065",
  appId: "1:406129611065:web:abb9f366f33ed4f90f58e8"
};

// Firebaseを初期化
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// ゲーム要素
const gameDiv = document.getElementById('game');
const hpDisplay = document.getElementById('hp');
const mapSize = 15;
let player;
let players = {};
let walls = new Set();
let bombs = {};

// プレイヤーのIDを生成
const playerId = `player_${Math.floor(Math.random() * 1000)}`;

// ゲーム開始時にFirebaseのデータをクリーンアップ
function cleanupFirebaseData() {
  remove(ref(database, 'players'));
  remove(ref(database, 'bombs'));
}

// マップを初期化
function initMap() {
  for (let y = 0; y < mapSize; y++) {
    for (let x = 0; x < mapSize; x++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');

      if (x % 2 === 0 && y % 2 === 0) {
        cell.classList.add('wall');
        walls.add(`${x},${y}`);
      } else if (Math.random() < 0.3 && !(x === 0 && y === 0)) {
        cell.classList.add('block');
        walls.add(`${x},${y}`);
      }

      gameDiv.appendChild(cell);
    }
  }
}

// 指定された位置が壁かどうかを確認
function isWall(x, y) {
  return walls.has(`${x},${y}`);
}

// 指定された位置が他のプレイヤーと重なっているか確認
function isOccupied(x, y) {
  for (const id in players) {
    if (players[id].x === x && players[id].y === y) {
      return true;
    }
  }
  return false;
}

// HP表示を更新する関数
function updateHPDisplay(hp) {
  hpDisplay.textContent = `HP: ${hp}`;
}

// プレイヤーを初期化
function initPlayer() {
  let startX, startY;
  do {
    startX = Math.floor(Math.random() * 15);
    startY = Math.floor(Math.random() * 15);
  } while (isOccupied(startX, startY) || isWall(startX, startY));

  player = new Player(startX, startY, playerId, true, updateHPDisplay);
  player.render();
  set(ref(database, `players/${playerId}`), { x: player.x, y: player.y, hp: player.hp });

  // キーボード入力
  document.addEventListener('keydown', (event) => {
    let newX = player.x;
    let newY = player.y;

    switch (event.key) {
      case 'ArrowUp': newY--; break;
      case 'ArrowDown': newY++; break;
      case 'ArrowLeft': newX--; break;
      case 'ArrowRight': newX++; break;
      case ' ':
        if (player.bombCount < player.maxBombs && !player.isBombCooldown) {
          const bombId = `bomb_${Date.now()}`;
          const bomb = new Bomb(player.x, player.y, bombId, player.firePower, walls, checkPlayerDamage);
          set(ref(database, `bombs/${bombId}`), { x: player.x, y: player.y, timer: 3, firePower: player.firePower });
          player.bombCount++;
          player.startBombCooldown();
        }
        break;
    }

    if (newX >= 0 && newX < mapSize && newY >= 0 && newY < mapSize && !isWall(newX, newY) && !isOccupied(newX, newY)) {
      player.updatePosition(newX, newY);
      set(ref(database, `players/${playerId}`), { x: newX, y: newY, hp: player.hp });
    }
  });
}

// 爆発がプレイヤーにダメージを与える処理
function checkPlayerDamage(x, y) {
  for (const id in players) {
    if (players[id].x === x && players[id].y === y) {
      players[id].updateHP(players[id].hp - 1);
      console.log(`プレイヤー ${id} のHPが ${players[id].hp + 1} → ${players[id].hp} に減りました。`);

      if (players[id].hp <= 0) {
        if (players[id].isMe) {
          alert('Game Over!');
          window.location.reload();
        } else {
          console.log(`プレイヤー ${id} が倒されました。`);
        }
      }
    }
  }
}

// 他のプレイヤーの位置を監視
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
    if (id !== playerId) {
      const { x, y, hp } = playersData[id];
      if (!players[id]) {
        players[id] = new Player(x, y, id, false, updateHPDisplay);
      }
      players[id].updatePosition(x, y);
      players[id].updateHP(hp);
    }
  }
});

// 爆弾の情報を監視
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
    const { x, y, timer, firePower } = bombsData[id];
    if (!bombs[id]) {
      bombs[id] = new Bomb(x, y, id, firePower, walls, checkPlayerDamage);
    }
  }
});

// タブが閉じられる際にプレイヤーデータを削除
window.onbeforeunload = () => {
  remove(ref(database, `players/${playerId}`));
};

// ゲームを開始
cleanupFirebaseData();
initMap();
initPlayer();