/* Wort-Anzeigen in den Spielen: das Feld bleibt gleich gross – bei langem Text wird die Schrift kleiner
 * (statt dass das Feld wächst und das Spielfeld verdeckt). Gemeinsam für Vokaboom und Teilmal.
 * Die Elemente stehen in FIT_SEL; sie werden einzeilig dargestellt und so lange verkleinert, bis sie passen.
 * Ein MutationObserver passt neue oder geänderte Wörter automatisch an.
 */
'use strict';

const FIT_SEL = [
  '.fi-ask strong', '.br-q strong', '.ws-de', '.bwc-word', '.g-de.big', '.g-word-de', '.rn-q', '.pt-msgbox strong',
  '.det-de', '.rain-levelup', '.blitz-card', '.task-q', '.game-q', '.q-big',
].join(', ');

function fitOne(el) {
  if (!el.isConnected || !el.clientWidth) return;
  el.style.fontSize = '';
  const base = parseFloat(getComputedStyle(el).fontSize) || 16;
  let fs = base;
  for (let i = 0; i < 24 && el.scrollWidth > el.clientWidth + 1 && fs > base * 0.42; i++) { fs *= 0.92; el.style.fontSize = `${fs.toFixed(1)}px`; }
}
let fitPending = false;
function fitAll() {
  fitPending = false;
  document.querySelectorAll(FIT_SEL).forEach(fitOne);
}
function fitSoon() {
  if (fitPending) return;
  fitPending = true;
  requestAnimationFrame(fitAll);
}
(function fitInit() {
  if (typeof MutationObserver !== 'function') return;
  const start = () => {
    new MutationObserver((list) => {
      for (const m of list) {
        const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        if (!t) continue;
        if (t.closest?.(FIT_SEL) || t.querySelector?.(FIT_SEL) || [...(m.addedNodes || [])].some((n) => n.nodeType === 1 && (n.matches?.(FIT_SEL) || n.querySelector?.(FIT_SEL)))) { fitSoon(); return; }
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', fitSoon);
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
