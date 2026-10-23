/** Cross-browser, idempotent visibility gate for the mascot overlay.
 * HTML hidden alone is not sufficient when more specific stylesheet rules
 * include display:flex. Apply both native and explicit CSS state. */
export function syncWorkspaceMascot(mascot,workspace,{hasDocument=false,importing=false}={}){
  const absent=Boolean(hasDocument||importing);
  if(!mascot)return absent;
  mascot.hidden=absent;
  mascot.setAttribute('aria-hidden',String(absent));
  mascot.style.setProperty('display',absent?'none':'flex','important');
  mascot.style.setProperty('visibility',absent?'hidden':'visible','important');
  if(workspace)workspace.dataset.contentLoaded=String(absent);
  return absent;
}
