import { ref, set, remove, onValue } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js";
import { database, MAP_SIZE, ITEM_TYPES } from './game.js';

export class ItemManager {
  constructor() {
    this.items = new Map();
    this.setupFirebaseListeners();
  }

  setupFirebaseListeners() {
    onValue(ref(database, 'items'), (snapshot) => {
      const itemsData = snapshot.val();
      if (!itemsData) {
        this.items.clear();
        this.removeAllItemsFromDOM();
        return;
      }

      const currentItemKeys = new Set(Object.keys(itemsData));

      // 削除されたアイテムを処理
      for (const key of this.items.keys()) {
        if (!currentItemKeys.has(key)) {
          this.items.delete(key);
          this.removeItemFromDOM(key);
        }
      }

      // 新しいアイテムを追加
      for (const key in itemsData) {
        const { type } = itemsData[key];
        if (!this.items.has(key)) {
          this.items.set(key, { type });
          this.renderItem(key, type);
        }
      }
    });
  }

  // ローカルでアイテムを生成し、即座に表示
  generateItem(x, y) {
    const itemType = Math.random() < 0.5 ? ITEM_TYPES.BOMB_UP : ITEM_TYPES.FIRE_UP;
    const itemKey = `${x},${y}`;

    // ローカルにアイテムを追加
    this.items.set(itemKey, { type: itemType });
    this.renderItem(itemKey, itemType);

    // Firebaseに非同期で保存
    set(ref(database, `items/${itemKey}`), { type: itemType })
      .then(() => {
        console.log('Item added successfully:', itemKey);
      })
      .catch((error) => {
        console.error('Failed to add item:', error);
      });
  }

  // アイテムを取得
  pickupItem(x, y, playerId) {
    const itemKey = `${x},${y}`;
    if (this.items.has(itemKey)) {
      const item = this.items.get(itemKey);

      // ローカルからアイテムを削除
      this.items.delete(itemKey);
      this.removeItemFromDOM(itemKey);

      // Firebaseから非同期で削除
      remove(ref(database, `items/${itemKey}`))
        .then(() => {
          console.log('Item picked up and removed:', itemKey);
        })
        .catch((error) => {
          console.error('Failed to remove item:', error);
        });

      return item.type;
    }
    return null;
  }

  // DOMからアイテムを削除
  removeItemFromDOM(itemKey) {
    const [x, y] = itemKey.split(',').map(Number);
    const cellIndex = y * MAP_SIZE + x;
    const cell = document.getElementById('game').children[cellIndex];
    if (cell) {
      const itemElement = cell.querySelector('.item');
      if (itemElement) {
        itemElement.remove();
      }
    }
  }

  // すべてのアイテムをDOMから削除
  removeAllItemsFromDOM() {
    const itemElements = document.querySelectorAll('.item');
    itemElements.forEach((itemElement) => itemElement.remove());
  }

  // アイテムをDOMに表示
  renderItem(itemKey, type) {
    const [x, y] = itemKey.split(',').map(Number);
    const cellIndex = y * MAP_SIZE + x;
    const cell = document.getElementById('game').children[cellIndex];
    if (cell) {
      const itemElement = document.createElement('div');
      itemElement.classList.add('item', type);
      cell.appendChild(itemElement);
    }
  }
}