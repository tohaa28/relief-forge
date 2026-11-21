import {circlePath} from './vector-points.js?v=0.2.0-alpha.89';

// Capture only screen-size decorations after a full render. Camera frames
// never inspect native commands, rebuild geometry, or relaunch diagnostics.
export function cacheViewDecorations(geometry,markers,clearance,unit,healthy=null,clearanceMinimum=0){
  const circles=[...geometry.querySelectorAll('circle.node'),
    ...markers.querySelectorAll('circle'),...clearance.querySelectorAll('circle')]
    .map(element=>({element,scale:element.hasAttribute('data-distance-mm')?7:Number(element.getAttribute('r'))/unit,
      minimum:element.hasAttribute('data-distance-mm')?
        clearanceMinimum:0}));
  const labels=[...markers.querySelectorAll('text.issue-number')].map(element=>{
    const anchor=element.parentNode.querySelector('circle');
    return {element,x:Number(anchor.getAttribute('cx')),y:Number(anchor.getAttribute('cy'))};
  });
  let previous=unit;
  return next=>{
    if(!Number.isFinite(next)||next<=0||next===previous)return;
    for(const {element,scale,minimum} of circles)
      element.setAttribute('r',Math.max(minimum,next*scale));
    for(const {element,x,y} of labels){
      element.setAttribute('x',x+10*next);element.setAttribute('y',y-9*next);
      element.setAttribute('font-size',12*next);
    }
    if(healthy)healthy.element.setAttribute('d',circlePath(healthy.points,Math.max(.00001,next*3.1)));
    previous=next;
  };
}
