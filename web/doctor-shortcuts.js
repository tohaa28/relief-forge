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
  if(event.defaultPrevented||event.isComposing)return null;
  const target=event.target;
  if(target?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(target?.tagName))return null;
  const key=event.key?.toLowerCase();
  if(!key)return null;
  if(event.altKey){
    const digit=/^Digit([1-8])$/.exec(event.code||'');
    return event.shiftKey&&digit?{repair:Number(digit[1])}:null;
  }
  const command=event.ctrlKey||event.metaKey;
  if(command){
    if(event.shiftKey&&key==='s')return {button:'save'};
    if(!event.shiftKey&&key==='s')return {button:'export-eps'};
    if(!event.shiftKey&&key==='o')return {button:'open'};
    if(!event.shiftKey&&key==='n')return {button:'new'};
    if(event.shiftKey&&key==='e')return {button:'export'};
    if(key==='z')return {button:event.shiftKey?'redo':'undo'};
    if(!event.shiftKey&&key==='y')return {button:'redo'};
    return null;
  }
  if(!nodeEditing){
    return ({v:'select',e:'curve-edit',p:'line',t:'rect',i:'circle',f:'fit',g:'toggle-info'})[key]?
      {button:({v:'select',e:'curve-edit',p:'line',t:'rect',i:'circle',f:'fit',g:'toggle-info'})[key]}:null;
  }
  const lookup=(event.shiftKey&&key!=='+'?'shift+':'')+key;
  return nodeShortcuts[lookup]||(!event.shiftKey?nodeShortcuts[key]:null)||null;
}
