// Pure, DOM-free policy for interactive editing of high-complexity SVG paths.
// Count actual native commands: a single giant compound curve must not bypass
// viewport culling simply because document.paths.length is small.
export function heavyManualScene(paths,{maxPaths=25,maxCommands=600}={}){
  if(!Array.isArray(paths))return false;
  let vectorCount=0,commands=0;
  for(const p of paths){
    if(!p||p.kind==='image')continue;
    vectorCount++;
    if(vectorCount>maxPaths)return true;
    commands+=Array.isArray(p.commands)&&p.commands.length?p.commands.length:
      Array.isArray(p.points)?p.points.length:0;
    if(commands>maxCommands)return true;
  }
  return false;
}
// Matches SVG's default preserveAspectRatio='xMidYMid meet'. No SVG
// getScreenCTM / layout flush in the pointermove hot path.
export function screenToDocumentPoint(clientX,clientY,rect,view){
  if(!rect||!view||![clientX,clientY,rect.left,rect.top,rect.width,rect.height,
    view.x,view.y,view.width,view.height].every(Number.isFinite)||
    rect.width<=0||rect.height<=0||view.width<=0||view.height<=0)return null;
  const scale=Math.min(rect.width/view.width,rect.height/view.height);
  const padX=(rect.width-view.width*scale)/2,
    padY=(rect.height-view.height*scale)/2;
  return [view.x+(clientX-rect.left-padX)/scale,
    view.y+(clientY-rect.top-padY)/scale];
}
