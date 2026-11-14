// 実行: node tests/detect.test.js   (依存パッケージなし)
const assert = require('node:assert');
const D = require('../src/detect.js');

// 合成シート: 列/行の間隔が不規則、かつ1か所だけ行同士が接している
function makeSheet(colX, rowY, size, touchRow) {
  const W = colX[colX.length - 1] + size + 4, H = rowY[rowY.length - 1] + size + 4;
  const rgba = new Uint8Array(W * H * 4);
  rowY.forEach((y, r) => colX.forEach((x, c) => {
    // 少し形を変えた塊を描く
    for (let yy = 0; yy < size; yy++) for (let xx = 0; xx < size; xx++) {
      if (((xx - size / 2) ** 2 + (yy - size / 2) ** 2) < (size / 2) ** 2) {
        const i = ((y + yy) * W + (x + xx)) * 4;
        rgba[i] = 200; rgba[i + 3] = 255;
      }
    }
  }));
  if (touchRow != null) { // 行 touchRow と touchRow+1 を1列分だけ橋渡しする
    const yMid = rowY[touchRow] + size;
    for (let y = yMid - 2; y <= yMid + 2; y++) {
      const i = (y * W + colX[1] + Math.floor(size / 2)) * 4;
      rgba[i] = 200; rgba[i + 3] = 255;
    }
  }
  return { rgba, W, H };
}

const colX = [2, 35, 66, 101, 133];
const rowY = [1, 30, 66, 97, 130];
const { rgba, W, H } = makeSheet(colX, rowY, 24, 1);

const r = D.detect(rgba, W, H);
assert.strictEqual(r.colLines.length - 1, colX.length, '列数');
assert.strictEqual(r.rowLines.length - 1, rowY.length, '行数(接している行も分割できる)');

// 各セルの内容が、描いたスプライトと一致する
const cells = D.computeCells(r.mask, W, H, r.rowLines, r.colLines);
assert.ok(cells.every(c => !c.empty), '空セルなし');
cells.forEach(c => {
  assert.ok(c.trim.w >= 22 && c.trim.w <= 25, 'セル幅が妥当: ' + c.trim.w);
});

// 背景色モード(不透明PNG)でも検出できる
const opaque = new Uint8Array(rgba);
for (let i = 0; i < W * H; i++) if (opaque[i * 4 + 3] === 0) { opaque[i * 4] = 30; opaque[i * 4 + 1] = 90; opaque[i * 4 + 2] = 30; opaque[i * 4 + 3] = 255; }
const r2 = D.detect(opaque, W, H);
assert.strictEqual(r2.mode, 'bg');
assert.strictEqual(r2.colLines.length - 1, colX.length);
assert.strictEqual(r2.rowLines.length - 1, rowY.length);

console.log('OK: 全テスト合格');
