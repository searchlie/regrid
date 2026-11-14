/* i18n.js - English (default) / Japanese UI strings */
(function (root) {
  'use strict';
  const DICT = {
    en: {
      title: 'Regrid - turn an irregular sprite sheet into an evenly spaced one',
      subtitle: 'Rows and columns are aligned but the spacing is irregular? Regrid detects the grid and rebuilds the sheet with evenly sized cells. Your image is processed in the browser and never uploaded.',
      pickBtn: 'Choose image',
      dropHint: 'or drag & drop / paste (Ctrl+V)',
      modeMove: 'Move lines',
      modeAddRow: 'Add row line',
      modeAddCol: 'Add column line',
      modeDel: 'Delete line',
      zoom: 'Zoom',
      detectSummary: 'Detection settings',
      sensitivity: 'Gap sensitivity',
      minBand: 'Noise filter (min width, px)',
      split: 'Auto-split rows/columns that touch',
      alphaThr: 'Alpha threshold',
      redetect: 'Re-detect (discards manual edits)',
      outSummary: 'Output: evenly spaced sprite sheet',
      outHint: 'Rebuilds the sheet so every frame sits in a cell of the same size. Ready to use in Godot (Hframes / Vframes) or any engine that slices by a fixed grid.',
      anchor: 'Frame anchor',
      anchorBC: 'Bottom center (characters)',
      anchorC: 'Center',
      anchorTL: 'Top left',
      pad: 'Cell padding (px)',
      prefix: 'File name prefix',
      saveSheet: 'Save aligned sheet (PNG)',
      saveJson: 'Save coordinates (JSON)',
      optSummary: 'Option: save each frame as a separate file',
      optMode: 'Split mode',
      optUniform: 'Uniform-size PNGs (uses the anchor and padding above)',
      optTrim: 'Trimmed PNGs',
      optRaw: 'Raw regions between the grid lines',
      skipEmpty: 'Skip empty cells',
      saveZip: 'Save frames as ZIP',
      tip: 'Tip: drag lines with "Move lines" and fix only the ones that are off. Cells outlined in red may be cut by a line.',
      langBtn: '日本語',
      loadError: 'Could not load the image.',
      noCells: 'There are no cells to export.',
      editedNotice: 'You have manual edits. Press "Re-detect" to apply the new settings.',
      modeAlpha: 'transparency',
      modeBg: 'background color',
      status: '{cols} cols × {rows} rows / {empty} empty cells / image {w}×{h}px / detected by {mode}',
      statusEdited: ' / manually edited',
      statusCut: ' / ⚠ {n} cell(s) touching a line (red outline)',
      sheetInfo: 'Output sheet {sw}×{sh}px / cell {cw}×{ch}px / {cols} cols × {rows} rows  →  Godot: Hframes {cols}, Vframes {rows}'
    },
    ja: {
      title: 'Regrid - スプライトシートを等間隔に整える',
      subtitle: '行・列は揃っているが間隔が不規則なスプライトシートを、等間隔のシートに整えます。画像はブラウザ内でのみ処理され、送信されません。',
      pickBtn: '画像を選ぶ',
      dropHint: 'またはここにドラッグ＆ドロップ / 貼り付け(Ctrl+V)',
      modeMove: '線を動かす',
      modeAddRow: '横線を追加',
      modeAddCol: '縦線を追加',
      modeDel: '線を削除',
      zoom: 'ズーム',
      detectSummary: '検出設定',
      sensitivity: '隙間の感度',
      minBand: 'ノイズ除去(最小幅px)',
      split: '癒着した行・列を自動で分割',
      alphaThr: 'アルファのしきい値',
      redetect: '再検出(手動編集は破棄)',
      outSummary: '出力: 間隔を揃えたスプライトシート',
      outHint: '全フレームを同じサイズのセルに並べ直した、等間隔のシートPNGを書き出します。Godot の AnimatedSprite2D / Sprite2D(Hframes・Vframes)にそのまま使えます。',
      anchor: 'フレームの基準位置',
      anchorBC: '下・中央(キャラクター向け)',
      anchorC: '中央',
      anchorTL: '左上',
      pad: 'セル内の余白 px',
      prefix: 'ファイル名の接頭辞',
      saveSheet: '整列したシートPNGを保存',
      saveJson: '座標JSONを保存',
      optSummary: 'オプション: 1フレームずつ個別ファイルに分割して保存',
      optMode: '分割の方式',
      optUniform: '均等サイズの個別PNG(上の基準位置・余白を適用)',
      optTrim: 'トリミングした個別PNG',
      optRaw: '線で区切った領域をそのまま個別PNG',
      skipEmpty: '空セルは出力しない',
      saveZip: '個別PNGをZIPで保存',
      tip: '操作のコツ: 線は「線を動かす」でドラッグ。ズレた箇所だけ手で直せば完了です。赤枠のセルは線で切れている可能性があります。',
      langBtn: 'English',
      loadError: '画像を読み込めませんでした。',
      noCells: '出力できるセルがありません。',
      editedNotice: '手動編集があるため、設定を反映するには「再検出」を押してください。',
      modeAlpha: '透明度',
      modeBg: '背景色',
      status: '{cols}列 × {rows}行 / 空セル {empty} / 画像 {w}×{h}px / 判定: {mode}',
      statusEdited: ' / 手動編集あり',
      statusCut: ' / ⚠ 線に接しているセル {n}(赤枠)',
      sheetInfo: '出力シート {sw}×{sh}px / 1セル {cw}×{ch}px / {cols}列×{rows}行  →  Godot: Hframes {cols}, Vframes {rows}'
    }
  };

  let lang = 'en';
  const listeners = [];

  function t(key, params) {
    let s = (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key;
    if (params) for (const k of Object.keys(params)) s = s.split('{' + k + '}').join(String(params[k]));
    return s;
  }

  function apply() {
    document.documentElement.lang = lang;
    document.title = t('title');
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  }

  function setLang(l) {
    if (!DICT[l]) l = 'en';
    lang = l;
    try { localStorage.setItem('regrid.lang', l); } catch (e) { /* 保存できなくても動作に影響なし */ }
    apply();
    listeners.forEach(fn => fn(lang));
  }

  function init() {
    let saved = null;
    try { saved = localStorage.getItem('regrid.lang'); } catch (e) { /* ignore */ }
    lang = DICT[saved] ? saved : 'en'; // 既定は英語
    apply();
  }

  const api = { DICT, t, setLang, init, getLang: () => lang, onChange: fn => listeners.push(fn) };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.I18n = api;
})(typeof window !== 'undefined' ? window : globalThis);
