// Microcopy for the trail map: a funny friend writing in Hinglish, always
// about the actual data. Pure functions only.

export const EMPTY_LINE = "No expenses yet. Nobody's been generous. Suspicious.";

export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Small deterministic hash so the same stop always gets the same line. */
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Greedy word wrap into at most `maxLines` lines of `maxChars`; the last line
 * gets an ellipsis if text is cut.
 */
export function wrapText(text, maxChars, maxLines = 2) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = line ? `${line} ${w}` : w;
    if (next.length <= maxChars) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = w.length > maxChars ? `${w.slice(0, maxChars - 1)}…` : w;
    if (lines.length === maxLines) {
      line = '';
      const last = lines[maxLines - 1];
      lines[maxLines - 1] = last.length >= maxChars ? `${last.slice(0, maxChars - 1)}…` : `${last}…`;
      return lines;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

const FILLERS = [
  (p, n) => `${n} log ab ${p} ke karzdaar 📒`,
  (p) => `${p} swiped first, asked later`,
  (p) => `${p}'s wallet just let out a sigh`,
  () => 'Yaadein free thi. Yeh nahi. 🧾',
  (p) => `${p} said "main de deta hoon" 🫡`,
];

/**
 * One line under each stop.
 * @param {object} o
 * @param {string} o.id           stop/expense id (for deterministic variety)
 * @param {string} o.payer        payer's name
 * @param {string} o.description
 * @param {number} o.owesCount    how many people owe the payer for this one
 * @param {number} o.payerRunning payer's net balance after this stop (minor units)
 * @param {boolean} o.isBank      payer is the trip's biggest payer
 * @param {boolean} o.isBiggest   this is the trip's biggest expense
 * @param {string|null} o.aiCaption
 * @param {(v:number)=>string} o.money
 */
export function stopQuip({ id, payer, description, owesCount, payerRunning, isBank, isBiggest, aiCaption, money }) {
  if (owesCount === 0) return `${payer} ne apne liye liya. Respect.`;
  if (isBank && isBiggest) return `${payer} is running Bank of ${cap(payer)} 🏦`;
  if (payerRunning < 0) return `${payer} paid for ${description.toLowerCase()} and still owes ${money(-payerRunning)} 💀`;
  if (aiCaption) return aiCaption;
  return FILLERS[hashSeed(id) % FILLERS.length](payer, owesCount);
}

/** Line shown when the map is filtered to one person. */
export function personLine(name, paid, net, money) {
  if (net < 0 && paid > 0) return `${name} paid ${money(paid)} and still owes ${money(-net)} 💀`;
  if (net < 0) return `${name} hasn't paid a rupee and owes ${money(-net)}. Bold.`;
  if (net > 0) return `${name} gets back ${money(net)}. Bank of ${cap(name)} is open 🏦`;
  return `${name} is exactly even. Suspiciously responsible.`;
}

/**
 * Trip badges.
 *  - Bank of X: biggest payer
 *  - Ghost: paid for nothing at all
 *  - Last-minute UPI: whoever settles last (latest marked payment, else the
 *    last payment still pending)
 * @param {{id:string,name:string,paid:number}[]} balances
 * @param {{from:string,to:string,amount:number}[]} settlements
 * @param {Record<string,string>} settled   settleKey -> ISO time marked done
 */
export function tripBadges(balances, settlements, settled = {}) {
  const badges = [];
  const nameOf = (id) => balances.find((b) => b.id === id)?.name ?? 'someone';
  const top = balances.reduce((m, b) => (b.paid > (m?.paid ?? 0) ? b : m), null);
  if (top) badges.push({ id: 'bank', label: `Bank of ${cap(top.name)}`, icon: '🏦', personId: top.id });
  for (const b of balances) if (b.paid === 0) badges.push({ id: `ghost-${b.id}`, label: `Ghost: ${b.name}`, icon: '👻', personId: b.id });

  if (settlements.length) {
    const pending = settlements.filter((s) => !settled[settleKey(s)]);
    let lateId;
    if (pending.length) lateId = pending[pending.length - 1].from;
    else {
      const last = [...settlements].sort((a, b) => settled[settleKey(a)].localeCompare(settled[settleKey(b)])).pop();
      lateId = last.from;
    }
    badges.push({ id: 'late', label: `Last-minute UPI: ${nameOf(lateId)}`, icon: '⏰', personId: lateId });
  }
  return badges;
}

/** Stable key for "this settle-up payment was made". */
export const settleKey = (s) => `${s.from}|${s.to}|${s.amount}`;
