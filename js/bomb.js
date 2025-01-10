export class Bomb {
  constructor(x, y, id, firePower, walls, checkPlayerDamage) {
    this.x = x;
    this.y = y;
    this.id = id;
    this.firePower = firePower;
    this.timer = 3;
    this.element = null;
    this.walls = walls;
    this.checkPlayerDamage = checkPlayerDamage;
    this.explosionElements = [];
    this.render();
  }

  render() {
    const gameDiv = document.getElementById('game');
    const cellIndex = this.y * 15 + this.x;
    const cell = gameDiv.children[cellIndex];

    this.element = document.createElement('div');
    this.element.classList.add('bomb');
    cell.appendChild(this.element);

    setTimeout(() => {
      this.explode();
    }, this.timer * 1000);
  }

  explode() {
    const gameDiv = document.getElementById('game');
    const directions = [
      { x: 0, y: 0 }, // 中心
      { x: 1, y: 0 }, { x: -1, y: 0 }, // 左右
      { x: 0, y: 1 }, { x: 0, y: -1 }  // 上下
    ];

    directions.forEach((dir) => {
      for (let i = 0; i <= this.firePower; i++) {
        const explosionX = this.x + dir.x * i;
        const explosionY = this.y + dir.y * i;

        if (explosionX >= 0 && explosionX < 15 && explosionY >= 0 && explosionY < 15) {
          const cellIndex = explosionY * 15 + explosionX;
          const cell = gameDiv.children[cellIndex];

          if (cell.classList.contains('wall')) {
            break;
          }
          if (cell.classList.contains('block')) {
            cell.classList.remove('block');
            this.walls.delete(`${explosionX},${explosionY}`);
            break;
          }

          const explosionElement = document.createElement('div');
          explosionElement.classList.add('explosion');
          cell.appendChild(explosionElement);
          this.explosionElements.push(explosionElement);

          if (typeof this.checkPlayerDamage === 'function') {
            this.checkPlayerDamage(explosionX, explosionY);
          }

          setTimeout(() => {
            if (explosionElement.parentNode) {
              explosionElement.remove();
            }
          }, 500);
        }
      }
    });

    if (this.element && this.element.parentNode) {
      this.element.remove();
    }
  }

  remove() {
    if (this.element && this.element.parentNode) {
      this.element.remove();
    }
    this.explosionElements.forEach((element) => {
      if (element && element.parentNode) {
        element.remove();
      }
    });
  }
}