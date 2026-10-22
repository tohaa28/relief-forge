// Keyboard routing is intentionally separate from UI handlers so collisions
// with input editing and browser shortcuts can be regression-tested.
export const nodeShortcuts=Object.freeze({
  v:{tool:'move'},'+':{tool:'add'},'=':{tool:'add'},h:{tool:'handles'},
  c:{operation:'cusp'},s:{operation:'smooth'},'shift+s':{operation:'symmetric'},
  l:{operation:'line'},q:{operation:'curve'},b:{operation:'break'},
  x:{operation:'close'},r:{operation:'reverse'},delete:{operation:'remove'},
  backspace:{operation:'remove'}
});
export function keyboardAction(event,nodeEditing=false){
  if(event.defaultPrevented||event.altKey||event.isComposing)return null;
  const target=event.target;
  if(target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target?.tagName))return null;
  const key=event.key?.toLowerCase();
  if(!key)return null;
  const command=event.ctrlKey||event.metaKey;
  if(command){
    if(event.shiftKey&&key==='s')return {button:'save'};
    if(!event.shiftKey&&key==='s')return {button:'export-eps'};
    if(!event.shiftKey&&key==='o')return {button:'open'};
    if(key==='z')return {button:event.shiftKey?'redo':'undo'};
    if(!event.shiftKey&&key==='y')return {button:'redo'};
    return null;
  }
  if(!nodeEditing)return key==='v'?{button:'select'}:null;
  const lookup=(event.shiftKey?'shift+':'')+key;
  return nodeShortcuts[lookup]||(!event.shiftKey?nodeShortcuts[key]:null)||null;
}
