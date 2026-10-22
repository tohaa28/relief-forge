// Viewport-only navigation for Vector Doctor diagnostics.
// Never mutate the document geometry or the stored issue position.
export function issueViewBox(view, point, sheet, toleranceMm) {
  if (!view || !sheet || !Array.isArray(point) || point.length !== 2) return null;
  const numbers=[view.x,view.y,view.width,view.height,point[0],point[1],sheet.width,sheet.height,toleranceMm];
  if (numbers.some(n=>typeof n!=='number'||!Number.isFinite(n))) return null;
  if (view.width<=0||view.height<=0||sheet.width<=0||sheet.height<=0||toleranceMm<=0) return null;
  // Make the initial jump useful for big sheets, but do not zoom out a detailed view.
  // The issue point is centered even at a sheet edge (surrounding blank space is allowed).
  const targetWidth=Math.max(2,20*toleranceMm,0.1*Math.min(sheet.width,sheet.height));
  const width=Math.min(view.width,targetWidth);
  const height=width*view.height/view.width;
  if (!Number.isFinite(height)||height<=0) return null;
  return {x:point[0]-width/2,y:point[1]-height/2,width,height};
}
