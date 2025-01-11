import { ref, set, remove, onValue } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js";
import { database } from './game.js';
import { Bomb } from './bomb.js';

export class BombManager {
  constructor(blocks, checkPlayerDamage, player) {
    this.blocks = blocks;
    this.checkPlayerDamage = checkPlayerDamage;
    this.player = player;
    this.bombs = {};
    this.setupFirebaseListeners();
  }

  setupFirebaseListeners() {
    // Firebaseの爆弾データを監視
    onValue(ref(database, 'bombs'), (snapshot) => {
      const bombsData = snapshot.val();
      if (!bombsData) return;

      const currentBombIds = new Set(Object.keys(bombsData));

      // 削除された爆弾を処理
      for (const id in this.bombs) {
        if (!currentBombIds.has(id)) {
          this.bombs[id].remove();
          delete this.bombs[id];
        }
      }

      // 新しい爆弾を追加
      for (const id in bombsData) {
        const { x, y, timer, firePower, placedBy, canPass } = bombsData[id];
        if (!this.bombs[id]) {
          this.bombs[id] = new Bomb(x, y, id, firePower, this.blocks, this.checkPlayerDamage, this.player, placedBy, canPass);
        }
      }
    });
  }

  placeBomb(x, y, firePower) {
    const bombId = `bomb_${Math.floor(Math.random() * 1000)}`;
    set(ref(database, `bombs/${bombId}`), { x, y, timer: 3, firePower })
      .catch((error) => {
        console.error('Failed to place bomb:', error);
      });
  }
}