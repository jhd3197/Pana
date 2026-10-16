// Let the browser present the new status before doing the next construction
// step. Also works when requestAnimationFrame is throttled in a hidden tab.
export function paintNext() {
  return new Promise(resolve => {
    const fallback = setTimeout(resolve, 100);
    requestAnimationFrame(() => setTimeout(() => { clearTimeout(fallback); resolve(); }, 0));
  });
}
