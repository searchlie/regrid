/*
 * detect.js - 射影プロファイル法による不規則グリッド検出
 * ブラウザ(window.SheetDetect)とNode(module.exports)の両方で動く純粋関数群。
 */
(function (root) {
  'use strict';

  // ---- マスク生成 -------------------------------------------------------
  // 透明PNGならalpha>alphaThr、不透明なら四隅の最頻色との差で前景を判定する。
  function buildMask(rgba, W, H, opts) {
    const mask = new Uint8Array(W * H);
    let hasAlpha = false;
    for (let i = 3; i < rgba.length; i += 4) {
      if (rgba[i] < 255) { hasAlpha = true; break; }
    }
    if (hasAlpha) {
      for (let i = 0, p = 0; p < W * H; p++, i += 4) {
        mask[p] = rgba[i + 3] > opts.alphaThr ? 1 : 0;
      }
      return { mask, mode: 'alpha', bg: null };
    }
    // 背景色モード: 四隅の最頻色
    const corners = [0, W - 1, (H - 1) * W, H * W - 1].map(p => {
      const i = p * 4; return [rgba[i], rgba[i + 1], rgba[i + 2]];
    });
    let best = corners[0], bestN = 0;
    for (const c of corners) {
      let n = 0;
      for (const d of corners) if (c[0] === d[0] && c[1] === d[1] && c[2] === d[2]) n++;
      if (n > bestN) { best = c; bestN = n; }
    }
    const tol = opts.bgTol;
    for (let i = 0, p = 0; p < W * H; p++, i += 4) {
      const d = Math.abs(rgba[i] - best[0]) + Math.abs(rgba[i + 1] - best[1]) + Math.abs(rgba[i + 2] - best[2]);
      mask[p] = d > tol ? 1 : 0;
    }
    return { mask, mode: 'bg', bg: best };
  }

  function profiles(mask, W, H) {
    const rows = new Int32Array(H), cols = new Int32Array(W);
    for (let y = 0; y < H; y++) {
      const o = y * W;
      for (let x = 0; x < W; x++) {
        if (mask[o + x]) { rows[y]++; cols[x]++; }
      }
    }
    return { rows, cols };
  }

  // ---- 1軸分の検出 -------------------------------------------------------
  // profile: 長さNの配列。閾値(最大値の ratio 倍)を超える連続区間をバンドとする。
  function findBands(profile, ratio, minBand) {
    let max = 0;
    for (const v of profile) if (v > max) max = v;
    const thr = max * ratio;
    const bands = [];
    let s = -1;
    for (let i = 0; i < profile.length; i++) {
      const on = profile[i] > thr;
      if (on && s < 0) s = i;
      if (!on && s >= 0) { bands.push([s, i - 1]); s = -1; }
    }
    if (s >= 0) bands.push([s, profile.length - 1]);
    // 小さなゴミ(ノイズ)を除去
    return bands.filter(b => b[1] - b[0] + 1 >= minBand);
  }

  function median(arr) {
    if (!arr.length) return 0;
    const a = arr.slice().sort((x, y) => x - y);
    return a[a.length >> 1];
  }

  // バンド列 -> 境界線(ピクセル座標。cut位置)の配列。長さ=バンド数+1。
  // 巨大バンド(中央値の1.6倍超)は、プロファイルの谷で分割する。
  function bandsToLines(bands, profile, N, splitOversized) {
    if (!bands.length) return [0, N];
    const sizes = bands.map(b => b[1] - b[0] + 1);
    const m = median(sizes);
    const lines = [0];
    for (let i = 0; i < bands.length; i++) {
      const [s, e] = bands[i];
      const size = e - s + 1;
      if (splitOversized && m > 0 && size > m * 1.6) {
        const k = Math.round(size / m);
        const win = Math.max(2, Math.round(m * 0.25));
        for (let j = 1; j < k; j++) {
          const expect = Math.round(s + (size * j) / k);
          let bestPos = expect, bestV = Infinity;
          for (let p = Math.max(s + 1, expect - win); p <= Math.min(e, expect + win); p++) {
            if (profile[p] < bestV) { bestV = profile[p]; bestPos = p; }
          }
          lines.push(bestPos);
        }
      }
      if (i < bands.length - 1) {
        lines.push(Math.round((e + 1 + bands[i + 1][0]) / 2));
      }
    }
    lines.push(N);
    return lines;
  }

  const DEFAULTS = {
    alphaThr: 0,        // alpha > alphaThr を前景とみなす
    bgTol: 24,          // 背景色モードの許容差(RGB差分の和)
    ratio: 0.02,        // 隙間判定: プロファイルが最大値のこの割合以下なら隙間
    minBand: 3,         // これより細いバンドはノイズとして無視
    splitOversized: true
  };

  function detect(rgba, W, H, userOpts) {
    const opts = Object.assign({}, DEFAULTS, userOpts || {});
    const { mask, mode, bg } = buildMask(rgba, W, H, opts);
    const { rows, cols } = profiles(mask, W, H);
    const rowBands = findBands(rows, opts.ratio, opts.minBand);
    const colBands = findBands(cols, opts.ratio, opts.minBand);
    const rowLines = bandsToLines(rowBands, rows, H, opts.splitOversized);
    const colLines = bandsToLines(colBands, cols, W, opts.splitOversized);
    return { rowLines, colLines, rowBands, colBands, mask, mode, bg, opts };
  }

  // ---- セル情報 ---------------------------------------------------------
  // 境界線で区切られた各セルについて、前景のタイトなバウンディングボックスを求める。
  function computeCells(mask, W, H, rowLines, colLines) {
    const cells = [];
    for (let r = 0; r < rowLines.length - 1; r++) {
      for (let c = 0; c < colLines.length - 1; c++) {
        const x0 = colLines[c], x1 = colLines[c + 1];
        const y0 = rowLines[r], y1 = rowLines[r + 1];
        let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
        for (let y = y0; y < y1; y++) {
          const o = y * W;
          for (let x = x0; x < x1; x++) {
            if (mask[o + x]) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        const empty = maxX < 0;
        // cut: 内容が境界線に接していて、線の向こう側の隣接ピクセルにも前景がある
        //      (=スプライトが線で切断されている可能性が高い)
        let cut = false;
        if (!empty) {
          const ty0 = minY, ty1 = maxY, tx0 = minX, tx1 = maxX;
          const any = (xa, xb, ya, yb) => {
            for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) if (mask[y * W + x]) return true;
            return false;
          };
          if (minX === x0 && x0 > 0 && any(x0 - 1, x0 - 1, ty0, ty1)) cut = true;
          if (maxX === x1 - 1 && x1 < W && any(x1, x1, ty0, ty1)) cut = true;
          if (minY === y0 && y0 > 0 && any(tx0, tx1, y0 - 1, y0 - 1)) cut = true;
          if (maxY === y1 - 1 && y1 < H && any(tx0, tx1, y1, y1)) cut = true;
        }
        cells.push({
          row: r, col: c, x: x0, y: y0, w: x1 - x0, h: y1 - y0, empty, cut,
          trim: empty ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
        });
      }
    }
    return cells;
  }

  const api = { DEFAULTS, buildMask, profiles, findBands, bandsToLines, detect, computeCells };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SheetDetect = api;
})(typeof window !== 'undefined' ? window : globalThis);
