import { ITEMS } from '../art/art';
import { LEGS } from '../world/legs';
import { fetchBoard, fetchRun, savedName, saveName, submitRun, type Board, type Entry, type RunCard, type RunLog } from '../systems/leaderboard';

/**
 * The leaderboard, opened from the score card: a printed panel over the game. At the top, your run waiting
 * for a name to send it under. Below, three boards: FASTEST and TOP SCORE for whole runs, and BY LEG for any
 * one leg, by time or by score. Tap a name to see that run's card: every leg's time and score, how the
 * score was made, and what fell off or broke where.
 *
 * It is HTML rather than drawn in the canvas so the name field works with any keyboard, a phone's
 * included; its keys are kept from the game, so typing never presses its buttons.
 */

const CSS = `
#board { position: fixed; inset: 0; z-index: 8; display: grid; place-items: center; background: rgba(10,7,18,.74); font-family: "Space Mono", monospace; color: #F3E3CC; padding: max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left)); }
#board .sheet { width: min(640px, 100%); max-height: 100%; overflow: auto; background: #0A0712; box-shadow: inset 0 0 0 3px #F3E3CC, 10px 10px 0 #E3263A; padding: clamp(12px, 3vmin, 24px); box-sizing: border-box; }
#board h2 { margin: 0; font: 400 clamp(28px, 6vmin, 44px)/1 Anton, Impact, sans-serif; letter-spacing: .03em; text-shadow: 4px 4px 0 #E3263A; }
#board h3 { margin: 0; font: 400 clamp(26px, 5vmin, 38px)/1 Anton, Impact, sans-serif; letter-spacing: .03em; }
#board .kicker { margin: 6px 0 12px; font-size: 12px; font-weight: 700; letter-spacing: .18em; color: #FFB23F; }
#board .sign { margin: 4px 0 2px; padding: 12px; background: #1A1024; box-shadow: inset 0 0 0 2px #FF6A30; }
#board .sign label { display: block; margin: 0 0 8px; font: 400 clamp(18px, 3.4vmin, 24px)/1.1 Anton, Impact, sans-serif; letter-spacing: .05em; color: #FFB23F; }
#board .sign small { display: block; margin-top: 6px; font-size: 11px; letter-spacing: .1em; opacity: .7; }
#board form { display: flex; gap: 8px; }
#board input { flex: 1; min-width: 0; font: 400 20px/1 Anton, Impact, sans-serif; letter-spacing: .08em; text-transform: uppercase; padding: 8px 12px; background: #F3E3CC; color: #0A0712; border: 0; border-radius: 0; outline: 3px solid transparent; }
#board input:focus { outline-color: #FF6A30; }
#board button { font: 400 18px/1 Anton, Impact, sans-serif; letter-spacing: .06em; padding: 8px 14px; border: 0; border-radius: 0; cursor: pointer; background: #FF6A30; color: #0A0712; box-shadow: 3px 3px 0 #E3263A; }
#board button:disabled { opacity: .5; cursor: default; }
#board button.ghost { background: transparent; color: #F3E3CC; box-shadow: inset 0 0 0 2px rgba(243,227,204,.6); }
#board button.on { background: #F3E3CC; color: #0A0712; box-shadow: 3px 3px 0 #E3263A; }
#board .note { min-height: 18px; margin: 8px 0 4px; font-size: 12px; letter-spacing: .1em; color: #FF6A30; }
#board .tabs, #board .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 6px; }
#board .chips button { font-size: 15px; padding: 6px 10px; }
#board .rule { height: 3px; background: #FF6A30; margin: 12px 0 4px; }
#board .rows { margin: 0 0 12px; }
#board .row { display: grid; grid-template-columns: 2.2em 1fr auto auto; gap: 12px; align-items: baseline; padding: 8px 6px; border-bottom: 1px dashed rgba(243,227,204,.25); cursor: pointer; }
#board .row:hover { background: rgba(255,106,48,.12); }
#board .row .n { color: #FFB23F; font-weight: 700; font-size: 13px; }
#board .row b { font: 400 19px/1 Anton, Impact, sans-serif; letter-spacing: .05em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#board .row .main { font: 400 21px/1 Anton, Impact, sans-serif; color: #FF6A30; text-align: right; }
#board .row .side { font-size: 12px; opacity: .7; text-align: right; min-width: 5em; }
#board .row.you { background: #E3263A; }
#board .row.you .main, #board .row.you .n { color: #F3E3CC; }
#board .empty { padding: 14px 6px; opacity: .7; font-size: 13px; letter-spacing: .1em; }
#board .foot { display: flex; justify-content: space-between; gap: 8px; }
#board .stats { display: flex; flex-wrap: wrap; gap: 6px 18px; margin: 8px 0 12px; font-size: 12px; letter-spacing: .12em; }
#board .stats b { font: 400 22px/1 Anton, Impact, sans-serif; letter-spacing: .04em; color: #FF6A30; margin-right: 6px; }
#board .pets span { margin-right: 10px; }
#board .pets .gone { text-decoration: line-through; opacity: .5; }
#board .leg { padding: 9px 6px; border-bottom: 1px dashed rgba(243,227,204,.25); }
#board .leg .top { display: grid; grid-template-columns: 1.6em 1fr auto auto; gap: 12px; align-items: baseline; }
#board .leg .top .n { color: #FFB23F; font-weight: 700; font-size: 13px; }
#board .leg .top b { font: 400 18px/1 Anton, Impact, sans-serif; letter-spacing: .05em; }
#board .leg .top .t { font-size: 13px; }
#board .leg .top .s { font: 400 20px/1 Anton, Impact, sans-serif; color: #FF6A30; min-width: 3.2em; text-align: right; }
#board .leg .how { margin: 4px 0 0 2.4em; font-size: 11px; letter-spacing: .08em; opacity: .8; line-height: 1.6; }
#board .leg .how .bad { color: #FF6A30; }
`;

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'TH' : (['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH')}`;
const clock = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const thing = (key: string) => (ITEMS.find((i) => i.key === key)?.name ?? key).toUpperCase();
const PETS: [string, string][] = [['cat', 'BISCUIT'], ['bird', 'SUNNY'], ['fish', 'GOLDIE']];

/** A small element: tag, class, text. */
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/**
 * Opens the leaderboard; `onClose` runs when it is closed. From the score card it comes with the run just
 * finished, to sign and send; from the title menu, with none, to look only.
 */
export function openBoard(run: (RunLog & { score: number; time: number }) | null, onClose: () => void) {
  if (!document.getElementById('board-css')) {
    const style = document.createElement('style');
    style.id = 'board-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  const root = el('div');
  root.id = 'board';
  const sheet = el('div', 'sheet');
  sheet.setAttribute('role', 'dialog');
  sheet.setAttribute('aria-label', 'Leaderboard');
  root.appendChild(sheet);
  document.body.appendChild(root);

  // Keys typed here are the panel's alone: they never reach the game underneath.
  for (const ev of ['keydown', 'keyup', 'keypress'] as const) root.addEventListener(ev, (e) => e.stopPropagation());
  root.addEventListener('pointerdown', (e) => e.stopPropagation());

  let board: Board = { kind: 'time' };
  let legBy: 'time' | 'score' = 'time';
  let legN = 1;
  /** Your run once sent: its id, so it is marked wherever it shows. */
  let mine: number | null = null;
  let name = savedName();
  let note = '';

  const close = () => {
    root.remove();
    document.removeEventListener('keydown', onKey, true);
    onClose();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    if (sheet.dataset.view === 'card') showBoards();
    else close();
  };
  document.addEventListener('keydown', onKey, true);

  /** The boards: your run to send, the tabs, and the rows. */
  function showBoards() {
    sheet.dataset.view = 'boards';
    sheet.replaceChildren();
    sheet.append(el('h2', '', 'THE LEADERBOARD'), el('div', 'kicker', run ? `YOUR RUN · ${run.score} PTS · ${clock(run.time)}` : 'THE BEST MOVES ON THE ROAD'));

    if (run && mine === null) {
      // Signing the run: a name, then SEND. It is the first thing on the panel, boxed in ember.
      const sign = el('div', 'sign');
      const label = el('label', '', 'PUT YOUR NAME ON THIS RUN');
      label.htmlFor = 'board-name';
      const form = el('form');
      const input = el('input');
      Object.assign(input, { id: 'board-name', maxLength: 12, placeholder: 'YOUR NAME', value: name, autocomplete: 'nickname' });
      const send = el('button', '', 'SEND RUN');
      send.type = 'submit';
      form.append(input, send);
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        name = input.value.trim().toUpperCase();
        if (!name) {
          setNote('TYPE A NAME FIRST.');
          input.focus();
          return;
        }
        send.disabled = true;
        setNote('SENDING...');
        submitRun({ name, ...run! })
          .then(({ id, rank }) => {
            mine = id;
            saveName(name);
            note = `${ordinal(rank.time)} FASTEST · ${ordinal(rank.score)} TOP SCORE`;
            showBoards();
          })
          .catch((err: Error) => {
            send.disabled = false;
            setNote(err.message.toUpperCase());
          });
      });
      sign.append(label, form, el('small', '', 'UP TO 12 LETTERS. IT GOES ON BOTH BOARDS AND EVERY LEG.'));
      sheet.appendChild(sign);
      if (!input.value) setTimeout(() => input.focus(), 0);
    }
    const noteEl = el('div', 'note', note);
    sheet.appendChild(noteEl);
    function setNote(t: string) {
      note = t;
      noteEl.textContent = t;
    }

    // The tabs: whole runs by time, by score, or one leg.
    const tabs = el('div', 'tabs');
    for (const [label, b] of [
      ['FASTEST', { kind: 'time' }],
      ['TOP SCORE', { kind: 'score' }],
      ['BY LEG', { kind: 'leg', leg: legN, by: legBy }],
    ] as [string, Board][]) {
      const t = el('button', board.kind === b.kind ? 'on' : 'ghost', label);
      t.type = 'button';
      t.addEventListener('click', () => {
        board = b;
        note = mine === null ? '' : note;
        showBoards();
      });
      tabs.appendChild(t);
    }
    sheet.appendChild(tabs);
    if (board.kind === 'leg') {
      const chips = el('div', 'chips');
      LEGS.forEach((l, i) => {
        const c = el('button', legN === i + 1 ? 'on' : 'ghost', `${i + 1} · ${l.title.toUpperCase()}`);
        c.type = 'button';
        c.addEventListener('click', () => {
          legN = i + 1;
          board = { kind: 'leg', leg: legN, by: legBy };
          showBoards();
        });
        chips.appendChild(c);
      });
      sheet.appendChild(chips);
      const by = el('div', 'chips');
      for (const k of ['time', 'score'] as const) {
        const c = el('button', legBy === k ? 'on' : 'ghost', k === 'time' ? 'FASTEST LEG' : 'BEST LEG SCORE');
        c.type = 'button';
        c.addEventListener('click', () => {
          legBy = k;
          board = { kind: 'leg', leg: legN, by: legBy };
          showBoards();
        });
        by.appendChild(c);
      }
      sheet.appendChild(by);
    }
    sheet.appendChild(el('div', 'rule'));
    const rows = el('div', 'rows');
    rows.appendChild(el('div', 'empty', 'LOADING...'));
    sheet.appendChild(rows);
    const foot = el('div', 'foot');
    const closeBtn = el('button', 'ghost', 'CLOSE');
    closeBtn.type = 'button';
    closeBtn.addEventListener('click', close);
    foot.append(el('span'), closeBtn);
    sheet.appendChild(foot);

    const shown = board;
    const byTime = shown.kind === 'time' || (shown.kind === 'leg' && shown.by === 'time');
    fetchBoard(shown)
      .then((top) => {
        if (shown !== board || !rows.isConnected) return;
        rows.replaceChildren();
        if (!top.length) rows.appendChild(el('div', 'empty', 'NO RUNS YET. BE THE FIRST.'));
        top.forEach((e: Entry, i) => {
          const row = el('div', `row${e.id === mine ? ' you' : ''}`);
          // Fastest boards lead with the time, score boards with the score; the other sits beside it.
          row.append(el('span', 'n', String(i + 1).padStart(2, '0')), el('b', '', e.name), el('span', 'main', byTime ? clock(e.time) : String(e.score)), el('span', 'side', byTime ? `${e.score} PTS` : clock(e.time)));
          row.title = 'See this run';
          row.addEventListener('click', () => showCard(e.id));
          rows.appendChild(row);
        });
      })
      .catch((err: Error) => {
        rows.replaceChildren(el('div', 'empty', err.message.toUpperCase()));
      });
  }

  /** One run's card: its totals, its pets, and every leg. */
  function showCard(id: number) {
    sheet.dataset.view = 'card';
    sheet.replaceChildren(el('div', 'empty', 'LOADING THE RUN...'));
    fetchRun(id)
      .then((r: RunCard) => {
        if (sheet.dataset.view !== 'card') return;
        sheet.replaceChildren();
        const when = new Date(r.created * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
        sheet.append(el('h3', '', r.name), el('div', 'kicker', `${'★'.repeat(r.stars)}${'☆'.repeat(3 - r.stars)} · ${when}`));
        const stats = el('div', 'stats');
        for (const [v, label] of [
          [String(r.score), 'PTS'],
          [clock(r.time), 'TOTAL'],
          [String(r.delivered.length), 'THINGS HOME'],
        ]) {
          const s = el('span');
          s.append(el('b', '', v), document.createTextNode(label));
          stats.appendChild(s);
        }
        sheet.appendChild(stats);
        const pets = el('div', 'stats pets');
        for (const [key, pet] of PETS) pets.appendChild(el('span', r.delivered.includes(key) ? '' : 'gone', pet));
        sheet.appendChild(pets);
        sheet.appendChild(el('div', 'rule'));
        r.logs.forEach((l, i) => {
          const row = el('div', 'leg');
          const top = el('div', 'top');
          top.append(el('span', 'n', String(i + 1).padStart(2, '0')), el('b', '', LEGS[i].title.toUpperCase()), el('span', 't', clock(l.time)), el('span', 's', String(l.score)));
          const how = el('div', 'how');
          const parts = [`CARGO ${l.cargo}`, `PARKING +${l.parking}`, l.clean ? `CLEAN LEG +${l.clean}` : '', l.penalty ? `BREAKAGE −${l.penalty}` : ''].filter(Boolean);
          how.appendChild(document.createTextNode(parts.join(' · ')));
          const bad = [...l.lost.map((k) => `LOST ${thing(k)}`), ...l.broken.map((k) => `BROKE ${thing(k)}`)];
          if (bad.length) {
            how.appendChild(el('br'));
            how.appendChild(el('span', 'bad', bad.join(' · ')));
          }
          row.append(top, how);
          sheet.appendChild(row);
        });
        const foot = el('div', 'foot');
        const back = el('button', 'ghost', '← BACK');
        back.type = 'button';
        back.addEventListener('click', showBoards);
        const closeBtn = el('button', 'ghost', 'CLOSE');
        closeBtn.type = 'button';
        closeBtn.addEventListener('click', close);
        foot.append(back, closeBtn);
        sheet.appendChild(el('div', 'rule'));
        sheet.appendChild(foot);
      })
      .catch((err: Error) => {
        sheet.replaceChildren(el('div', 'empty', err.message.toUpperCase()));
        const back = el('button', 'ghost', '← BACK');
        back.addEventListener('click', showBoards);
        sheet.appendChild(back);
      });
  }

  showBoards();
}
