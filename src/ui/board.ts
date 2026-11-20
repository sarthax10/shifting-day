import { savedName, saveName, submitRun, topScores, type Entry } from '../systems/leaderboard';

/**
 * The leaderboard, opened from the score card: a printed panel over the game with a name to type, the
 * run's score to send, and the top ten. It is HTML rather than drawn in the canvas so the name field works
 * with any keyboard, a phone's included; its keys are kept from the game, so typing never presses its
 * buttons.
 */

const CSS = `
#board { position: fixed; inset: 0; z-index: 8; display: grid; place-items: center; background: rgba(10,7,18,.72); font-family: "Space Mono", monospace; color: #F3E3CC; padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left)); }
#board .sheet { width: min(560px, 100%); max-height: 100%; overflow: auto; background: #0A0712; box-shadow: inset 0 0 0 3px #F3E3CC, 10px 10px 0 #E3263A; padding: clamp(14px, 3vmin, 26px); box-sizing: border-box; }
#board h2 { margin: 0; font: 400 clamp(30px, 6vmin, 46px)/1 Anton, Impact, sans-serif; letter-spacing: .03em; text-shadow: 4px 4px 0 #E3263A; }
#board .mine { margin: 6px 0 14px; font-size: 13px; font-weight: 700; letter-spacing: .18em; color: #FFB23F; }
#board form { display: flex; gap: 8px; margin-bottom: 8px; }
#board input { flex: 1; min-width: 0; font: 400 22px/1 Anton, Impact, sans-serif; letter-spacing: .08em; text-transform: uppercase; padding: 8px 12px; background: #F3E3CC; color: #0A0712; border: 0; border-radius: 0; outline: 3px solid transparent; }
#board input:focus { outline-color: #FF6A30; }
#board button { font: 400 20px/1 Anton, Impact, sans-serif; letter-spacing: .06em; padding: 8px 16px; border: 0; border-radius: 0; cursor: pointer; background: #FF6A30; color: #0A0712; box-shadow: 3px 3px 0 #E3263A; }
#board button:disabled { opacity: .5; cursor: default; }
#board button.ghost { background: transparent; color: #F3E3CC; box-shadow: inset 0 0 0 2px #F3E3CC; }
#board .note { min-height: 18px; font-size: 12px; letter-spacing: .1em; color: #FF6A30; margin-bottom: 8px; }
#board ol { list-style: none; margin: 0 0 14px; padding: 0; counter-reset: rank; }
#board li { display: grid; grid-template-columns: 2.4em 1fr auto 4.6em; gap: 10px; align-items: baseline; padding: 7px 6px; border-bottom: 1px dashed rgba(243,227,204,.25); counter-increment: rank; }
#board li::before { content: counter(rank, decimal-leading-zero); color: #FFB23F; font-weight: 700; font-size: 13px; }
#board li b { font: 400 20px/1 Anton, Impact, sans-serif; letter-spacing: .05em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#board li span { font: 400 22px/1 Anton, Impact, sans-serif; color: #FF6A30; text-align: right; }
#board li i { font-style: normal; font-size: 12px; opacity: .7; text-align: right; }
#board li.you { background: #E3263A; }
#board li.you span, #board li.you::before { color: #F3E3CC; }
#board .empty { padding: 14px 6px; opacity: .7; font-size: 13px; letter-spacing: .1em; }
#board .foot { display: flex; justify-content: flex-end; }
`;

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'TH' : (['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH')}`;
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Opens the leaderboard for a finished run; `onClose` runs when it is closed. */
export function openBoard(run: { legs: number[]; score: number; time: number }, onClose: () => void) {
  if (!document.getElementById('board-css')) {
    const style = document.createElement('style');
    style.id = 'board-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  const root = document.createElement('div');
  root.id = 'board';
  root.innerHTML = `
    <div class="sheet" role="dialog" aria-label="Leaderboard">
      <h2>THE LEADERBOARD</h2>
      <div class="mine">YOUR RUN · ${run.score} PTS · ${clock(run.time)}</div>
      <form><input name="name" maxlength="12" autocomplete="nickname" placeholder="YOUR NAME" aria-label="Your name"><button type="submit">SEND</button></form>
      <div class="note"></div>
      <ol></ol>
      <div class="foot"><button type="button" class="ghost close">CLOSE</button></div>
    </div>`;
  document.body.appendChild(root);
  const form = root.querySelector('form')!;
  const input = root.querySelector('input')!;
  const send = root.querySelector<HTMLButtonElement>('form button')!;
  const note = root.querySelector<HTMLElement>('.note')!;
  const list = root.querySelector('ol')!;
  input.value = savedName();

  // Keys typed here are the panel's alone: they never reach the game underneath.
  for (const ev of ['keydown', 'keyup', 'keypress'] as const) root.addEventListener(ev, (e) => e.stopPropagation());
  root.addEventListener('pointerdown', (e) => e.stopPropagation());

  const show = (top: Entry[], you?: { name: string; score: number; time: number }) => {
    list.replaceChildren();
    if (!top.length) {
      const li = document.createElement('div');
      li.className = 'empty';
      li.textContent = 'NO RUNS YET. BE THE FIRST.';
      list.appendChild(li);
      return;
    }
    let marked = false;
    for (const e of top) {
      const li = document.createElement('li');
      const name = document.createElement('b');
      name.textContent = e.name;
      const score = document.createElement('span');
      score.textContent = String(e.score);
      const time = document.createElement('i');
      time.textContent = clock(e.time);
      li.append(name, score, time);
      if (you && !marked && e.name === you.name && e.score === you.score && Math.abs(e.time - you.time) < 0.2) {
        li.className = 'you';
        marked = true;
      }
      list.appendChild(li);
    }
  };

  const close = () => {
    root.remove();
    document.removeEventListener('keydown', onKey, true);
    onClose();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };
  document.addEventListener('keydown', onKey, true);
  root.querySelector('.close')!.addEventListener('click', close);

  note.textContent = 'LOADING THE BOARD...';
  topScores()
    .then((top) => {
      show(top);
      note.textContent = '';
    })
    .catch((e: Error) => (note.textContent = e.message.toUpperCase()));

  let sent = false;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (sent) return;
    const name = input.value.trim().toUpperCase();
    if (!name) {
      note.textContent = 'TYPE A NAME FIRST.';
      input.focus();
      return;
    }
    send.disabled = true;
    note.textContent = 'SENDING...';
    submitRun({ name, legs: run.legs, score: run.score, time: run.time })
      .then(({ rank, top }) => {
        sent = true;
        saveName(name);
        input.disabled = true;
        show(top, { name, score: run.score, time: Math.round(run.time * 10) / 10 });
        note.textContent = rank <= top.length ? `YOU ARE NUMBER ${rank}.` : `YOU CAME ${ordinal(rank)}. SO CLOSE. NOT REALLY.`;
      })
      .catch((err: Error) => {
        send.disabled = false;
        note.textContent = err.message.toUpperCase();
      });
  });
  if (!input.value) input.focus();
}
