/* app.js - UI: 読込 / 自動検出 / グリッド線の編集 / 書き出し */
(function () {
  'use strict';
  const D = window.SheetDetect, Z = window.MiniZip;
  const $ = id => document.getElementById(id);

  const S = {
    W: 0, H: 0, rgba: null, srcCanvas: null, name: 'sprite',
    rowLines: [], colLines: [], mask: null, mode: 'alpha',
    zoom: 3, edit: 'move', edited: false, drag: null, hover: null
  };

  const cv = $('cv'), ctx = cv.getContext('2d');

  // ---------------------------------------------------------------- 読込
  function loadFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    S.name = (file.name || 'sprite').replace(/\.[^.]+$/, '') || 'sprite';
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      S.W = c.width; S.H = c.height;
      S.srcCanvas = c;
      S.rgba = g.getImageData(0, 0, S.W, S.H).data;
      URL.revokeObjectURL(url);
      $('prefix').value = S.name;
      $('work').hidden = false;
      const fit = Math.floor(($('work').clientWidth || 900) / S.W);
      setZoom(Math.max(1, Math.min(12, fit)));
      redetect();
    };
    img.onerror = () => { $('status').textContent = '画像を読み込めませんでした。'; };
    img.src = url;
  }

  function currentOpts() {
    return {
      ratio: +$('ratio').value / 100,
      minBand: +$('minb').value,
      splitOversized: $('split').checked,
      alphaThr: +$('alpha').value
    };
  }

  function redetect() {
    if (!S.rgba) return;
    const r = D.detect(S.rgba, S.W, S.H, currentOpts());
    S.rowLines = r.rowLines; S.colLines = r.colLines;
    S.mask = r.mask; S.mode = r.mode; S.edited = false;
    render();
  }

  // ------------------------------------------------------------- 描画
  function setZoom(z) {
    S.zoom = z; $('zoom').value = z; $('zoomv').textContent = z + 'x';
    if (S.rgba) render();
  }

  function render() {
    const z = S.zoom;
    cv.width = S.W * z; cv.height = S.H * z;
    // 市松模様(透過の確認用)
    const t = 8;
    for (let y = 0; y < cv.height; y += t) {
      for (let x = 0; x < cv.width; x += t) {
        ctx.fillStyle = ((x / t + y / t) & 1) ? '#2b2f36' : '#22252b';
        ctx.fillRect(x, y, t, t);
      }
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(S.srcCanvas, 0, 0, cv.width, cv.height);

    const cells = D.computeCells(S.mask, S.W, S.H, S.rowLines, S.colLines);
    // 空セルを暗くする
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    for (const c of cells) if (c.empty) ctx.fillRect(c.x * z, c.y * z, c.w * z, c.h * z);
    // トリミング枠(緑)。スプライトが境界線で切れている可能性があるセルは赤
    let touching = 0;
    ctx.lineWidth = 1;
    for (const c of cells) if (!c.empty) {
      const t = c.trim;
      if (c.cut) touching++;
      ctx.strokeStyle = c.cut ? 'rgba(255,70,70,0.95)' : 'rgba(80,220,120,0.55)';
      ctx.strokeRect(t.x * z + 0.5, t.y * z + 0.5, t.w * z - 1, t.h * z - 1);
    }
    // 境界線
    drawLines(S.rowLines, true, '#00e5ff');
    drawLines(S.colLines, false, '#ff4fd8');

    updateSheetInfo(cells);
    const empties = cells.filter(c => c.empty).length;
    $('status').textContent =
      `${S.colLines.length - 1}列 × ${S.rowLines.length - 1}行 / 空セル ${empties} / ` +
      `画像 ${S.W}×${S.H}px / 判定: ${S.mode === 'alpha' ? '透明度' : '背景色'}` +
      (touching ? ` / ⚠ 線に接しているセル ${touching}(赤枠)` : '') +
      (S.edited ? ' / 手動編集あり' : '');
  }

  // 出力シートのサイズとGodotでの設定値を表示する
  function updateSheetInfo(cells) {
    const pad = Math.max(0, +$('pad').value || 0);
    const u = uniformSize(cells, pad);
    const cols = S.colLines.length - 1, rows = S.rowLines.length - 1;
    $('sheetinfo').textContent =
      `出力シート ${cols * u.w}×${rows * u.h}px / 1セル ${u.w}×${u.h}px / ${cols}列×${rows}行` +
      `  →  Godot: Hframes ${cols}, Vframes ${rows}`;
  }

  function drawLines(lines, horizontal, color) {
    const z = S.zoom;
    lines.forEach((v, i) => {
      const hot = S.drag && S.drag.h === horizontal && S.drag.i === i ||
                  S.hover && S.hover.h === horizontal && S.hover.i === i;
      ctx.strokeStyle = color; ctx.lineWidth = hot ? 3 : 1.5;
      ctx.globalAlpha = hot ? 1 : 0.85;
      ctx.beginPath();
      if (horizontal) { ctx.moveTo(0, v * z); ctx.lineTo(cv.width, v * z); }
      else { ctx.moveTo(v * z, 0); ctx.lineTo(v * z, cv.height); }
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  // -------------------------------------------------------- 線の編集
  function pos(e) {
    const r = cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) };
  }

  // 最も近い線(画面上6px以内)を探す
  function pick(p) {
    const z = S.zoom, tol = 7;
    let best = null, bd = tol;
    S.rowLines.forEach((v, i) => { const d = Math.abs(v * z - p.y); if (d < bd) { bd = d; best = { h: true, i }; } });
    S.colLines.forEach((v, i) => { const d = Math.abs(v * z - p.x); if (d < bd) { bd = d; best = { h: false, i }; } });
    return best;
  }

  function insertLine(arr, v, max) {
    v = Math.max(1, Math.min(max - 1, v));
    if (arr.includes(v)) return;
    arr.push(v); arr.sort((a, b) => a - b);
  }

  cv.addEventListener('pointerdown', e => {
    if (!S.rgba) return;
    const p = pos(e);
    if (S.edit === 'move') {
      const hit = pick(p);
      if (hit) { S.drag = hit; cv.setPointerCapture(e.pointerId); render(); }
    } else if (S.edit === 'addrow') {
      insertLine(S.rowLines, Math.round(p.y / S.zoom), S.H); S.edited = true; render();
    } else if (S.edit === 'addcol') {
      insertLine(S.colLines, Math.round(p.x / S.zoom), S.W); S.edited = true; render();
    } else if (S.edit === 'del') {
      const hit = pick(p);
      if (hit) {
        const arr = hit.h ? S.rowLines : S.colLines;
        if (hit.i > 0 && hit.i < arr.length - 1) { arr.splice(hit.i, 1); S.edited = true; render(); }
      }
    }
  });

  cv.addEventListener('pointermove', e => {
    if (!S.rgba) return;
    const p = pos(e);
    if (S.drag) {
      const arr = S.drag.h ? S.rowLines : S.colLines;
      const lim = S.drag.h ? S.H : S.W;
      const raw = Math.round((S.drag.h ? p.y : p.x) / S.zoom);
      const lo = S.drag.i > 0 ? arr[S.drag.i - 1] + 1 : 0;
      const hi = S.drag.i < arr.length - 1 ? arr[S.drag.i + 1] - 1 : lim;
      arr[S.drag.i] = Math.max(lo, Math.min(hi, raw));
      S.edited = true; render();
    } else if (S.edit === 'move' || S.edit === 'del') {
      const h = pick(p);
      const changed = (h && h.h) !== (S.hover && S.hover.h) || (h && h.i) !== (S.hover && S.hover.i) || !!h !== !!S.hover;
      S.hover = h;
      cv.style.cursor = h ? (h.h ? 'row-resize' : 'col-resize') : 'crosshair';
      if (changed) render();
    }
  });
  const endDrag = () => { if (S.drag) { S.drag = null; render(); } };
  cv.addEventListener('pointerup', endDrag);
  cv.addEventListener('pointercancel', endDrag);

  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
    S.edit = b.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('active', x === b));
  }));

  // ------------------------------------------------------ 書き出し
  // 背景色モードの画像は、背景を透過にして出力する
  function exportSource() {
    if (S.mode !== 'bg') return S.srcCanvas;
    const c = document.createElement('canvas');
    c.width = S.W; c.height = S.H;
    const g = c.getContext('2d');
    const id = g.createImageData(S.W, S.H);
    id.data.set(S.rgba);
    for (let p = 0; p < S.W * S.H; p++) if (!S.mask[p]) id.data[p * 4 + 3] = 0;
    g.putImageData(id, 0, 0);
    return c;
  }

  function outOpts() {
    return {
      mode: $('outmode').value, anchor: $('anchor').value,
      pad: Math.max(0, +$('pad').value || 0), skip: $('skipempty').checked,
      prefix: ($('prefix').value || 'sprite').replace(/[\\/:*?"<>|]/g, '_')
    };
  }

  function uniformSize(cells, pad) {
    let w = 1, h = 1;
    for (const c of cells) if (!c.empty) { w = Math.max(w, c.trim.w); h = Math.max(h, c.trim.h); }
    return { w: w + pad * 2, h: h + pad * 2 };
  }

  // トリミング済み領域 r を、uw×uh の枠の中に基準位置で配置するときの左上座標
  function place(r, uw, uh, anchor, pad) {
    if (anchor === 'tl') return { x: pad, y: pad };
    if (anchor === 'c') return { x: Math.floor((uw - r.w) / 2), y: Math.floor((uh - r.h) / 2) };
    return { x: Math.floor((uw - r.w) / 2), y: uh - pad - r.h }; // bc
  }

  function blobOf(canvas) {
    return new Promise(res => canvas.toBlob(b => res(b), 'image/png'));
  }
  async function bytesOf(canvas) {
    return new Uint8Array(await (await blobOf(canvas)).arrayBuffer());
  }

  function drawCell(src, cell, o, uni) {
    const c = document.createElement('canvas'); const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    if (o.mode === 'raw') {
      c.width = cell.w; c.height = cell.h;
      g.drawImage(src, cell.x, cell.y, cell.w, cell.h, 0, 0, cell.w, cell.h);
    } else if (o.mode === 'trim') {
      const t = cell.trim || { x: cell.x, y: cell.y, w: 1, h: 1 };
      c.width = t.w; c.height = t.h;
      if (!cell.empty) g.drawImage(src, t.x, t.y, t.w, t.h, 0, 0, t.w, t.h);
    } else {
      c.width = uni.w; c.height = uni.h;
      if (!cell.empty) {
        const t = cell.trim, p = place(t, uni.w, uni.h, o.anchor, o.pad);
        g.drawImage(src, t.x, t.y, t.w, t.h, p.x, p.y, t.w, t.h);
      }
    }
    return c;
  }

  const p2 = n => String(n).padStart(2, '0');

  function download(blobOrBytes, filename, type) {
    const blob = blobOrBytes instanceof Blob ? blobOrBytes : new Blob([blobOrBytes], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  async function exportZip() {
    const o = outOpts(), src = exportSource();
    const cells = D.computeCells(S.mask, S.W, S.H, S.rowLines, S.colLines);
    const uni = uniformSize(cells, o.pad);
    const targets = cells.filter(cell => !(cell.empty && o.skip));
    // PNG変換は並列に実行する(1枚ずつ待つと枚数に比例して遅くなる)
    const files = await Promise.all(targets.map(async cell => ({
      name: `${o.prefix}_r${p2(cell.row)}_c${p2(cell.col)}.png`,
      data: await bytesOf(drawCell(src, cell, o, uni))
    })));
    if (!files.length) { $('status').textContent = '出力できるセルがありません。'; return; }
    download(Z.makeZip(files), `${o.prefix}_frames.zip`, 'application/zip');
  }

  async function exportSheet() {
    const o = outOpts(), src = exportSource();
    const cells = D.computeCells(S.mask, S.W, S.H, S.rowLines, S.colLines);
    const uni = uniformSize(cells, o.pad);
    const cols = S.colLines.length - 1, rows = S.rowLines.length - 1;
    const c = document.createElement('canvas');
    c.width = cols * uni.w; c.height = rows * uni.h;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    for (const cell of cells) {
      if (cell.empty) continue;
      const t = cell.trim, p = place(t, uni.w, uni.h, o.anchor, o.pad);
      g.drawImage(src, t.x, t.y, t.w, t.h, cell.col * uni.w + p.x, cell.row * uni.h + p.y, t.w, t.h);
    }
    download(await blobOf(c), `${o.prefix}_uniform_${uni.w}x${uni.h}.png`);
  }

  function exportJson() {
    const o = outOpts();
    const cells = D.computeCells(S.mask, S.W, S.H, S.rowLines, S.colLines);
    const uni = uniformSize(cells, o.pad);
    const data = {
      image: { width: S.W, height: S.H },
      rowLines: S.rowLines, colLines: S.colLines,
      uniformCell: { width: uni.w, height: uni.h, anchor: o.anchor, padding: o.pad },
      cells: cells.map(c => ({ row: c.row, col: c.col, x: c.x, y: c.y, w: c.w, h: c.h, empty: c.empty, trim: c.trim }))
    };
    download(new TextEncoder().encode(JSON.stringify(data, null, 2)), `${o.prefix}_grid.json`, 'application/json');
  }

  // ------------------------------------------------------- イベント配線
  $('file').addEventListener('change', e => loadFile(e.target.files[0]));
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach(t => document.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => document.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  document.addEventListener('drop', e => loadFile(e.dataTransfer.files[0]));
  document.addEventListener('paste', e => {
    const f = [...(e.clipboardData ? e.clipboardData.files : [])].find(x => x.type.startsWith('image/'));
    if (f) loadFile(f);
  });

  $('zoom').addEventListener('input', e => setZoom(+e.target.value));
  const syncLabels = () => {
    $('ratiov').textContent = (+$('ratio').value).toFixed(1) + '%';
    $('minbv').textContent = $('minb').value;
    $('alphav').textContent = $('alpha').value;
  };
  ['ratio', 'minb', 'alpha', 'split'].forEach(id => $(id).addEventListener('input', () => {
    syncLabels();
    if (!S.edited) redetect();
    else $('status').textContent = '手動編集があるため、設定を反映するには「再検出」を押してください。';
  }));
  $('redetect').addEventListener('click', () => { syncLabels(); redetect(); });
  $('pad').addEventListener('input', () => { if (S.rgba) render(); });
  $('dlzip').addEventListener('click', exportZip);
  $('dlsheet').addEventListener('click', exportSheet);
  $('dljson').addEventListener('click', exportJson);
  syncLabels();

  // テスト/デバッグ用に最小限のフックを公開
  window.__app = { S, loadFile, redetect, exportZip };
})();
