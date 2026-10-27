import {geometryCommands} from './eps-export.js?v=0.2.0-alpha.50';

// WebGPU performs only conservative AABB BROADPHASE. All fill topology,
// intersections, Clipper, Bézier refit, acceptance and EPS remain CPU f64.
// Each bounding rectangle includes the full native control hull, not a
// potentially under-sampled chord, so the GPU cannot authorize a false join.
export function nativeControlBounds(path){
  if(path?.kind==='image')return null;
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  try{
    for(const c of geometryCommands(path)){
      for(let k=1;k<c.length;k+=2){
        const x=c[k],y=c[k+1];
        if(!Number.isFinite(x)||!Number.isFinite(y))return null;
        x0=Math.min(x0,x);y0=Math.min(y0,y);
        x1=Math.max(x1,x);y1=Math.max(y1,y);
      }
    }
  }catch{return null;}
  return Number.isFinite(x0+y0+x1+y1)?[x0,y0,x1,y1]:null;
}
export const broadphaseShader=`
struct Boxes { values: array<vec4f> };
struct Flags { values: array<u32> };
struct Parameters { count: u32, padding: f32, unused0: u32, unused1: u32 };
@group(0) @binding(0) var<storage,read> boxes: Boxes;
@group(0) @binding(1) var<storage,read_write> flags: Flags;
@group(0) @binding(2) var<uniform> config: Parameters;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let index=id.x;
  let n=config.count;
  if(index>=n*n) { return; }
  let a=index/n;
  let b=index%n;
  if(b<=a) { flags.values[index]=0u; return; }
  let x=boxes.values[a];
  let y=boxes.values[b];
  let p=config.padding;
  // Inclusive padded rectangles: false positives are allowed; false
  // negatives are not. Union is always validated again using CPU f64.
  flags.values[index]=select(0u,1u,
    x.x<=y.z+p && y.x<=x.z+p &&
    x.y<=y.w+p && y.y<=x.w+p);
}`;

// Driver bugs can leave requestAdapter, shader compilation, or mapAsync
// unresolved forever (notably on machines with mixed/older GPU drivers).
// Never allow a graphics driver to block importing a CNC document.
export function gpuBroadphase(document,options={}){
  const timeoutMs=Number.isFinite(options.timeoutMs)
    ?Math.max(1,Math.min(30000,options.timeoutMs)):4500;
  let timer;
  const fallback=new Promise(resolve=>{
    timer=setTimeout(()=>resolve({mode:'cpu',pairs:null,
      reason:'webgpu-timeout-'+timeoutMs+'ms'}),timeoutMs);
  });
  return Promise.race([gpuBroadphaseImpl(document,options),fallback])
    .finally(()=>clearTimeout(timer));
}
async function gpuBroadphaseImpl(document,{tolerance=.01,navigatorObject=globalThis.navigator,
    maxPaths=512,minPaths=16}={}){
  const paths=document?.paths;
  const fallback=(reason)=>({mode:'cpu',pairs:null,reason});
  if(!Array.isArray(paths)||paths.length<minPaths)return fallback('small-document');
  if(paths.length>maxPaths)return fallback('path-count-limit');
  const bounds=paths.map(nativeControlBounds);
  if(bounds.some(b=>!b))return fallback('unsupported-native-geometry');
  const magnitude=Math.max(1,...bounds.flat().map(Math.abs));
  if(magnitude>1e6)return fallback('coordinate-range');
  if(!navigatorObject?.gpu?.requestAdapter)return fallback('webgpu-unavailable');
  // f32 rounding can move both bounds toward the inside. Add many ULPs
  // plus the diagnostic tolerance; this broadphase can only overselect.
  const padding=Math.max(.0001,4*Math.abs(tolerance),magnitude*0.00001);
  const n=paths.length,flagsBytes=n*n*4;
  let device,boxBuffer,flagBuffer,readBuffer,paramBuffer;
  try{
    const adapter=await navigatorObject.gpu.requestAdapter({powerPreference:'high-performance'});
    if(!adapter)return fallback('no-adapter');
    device=await adapter.requestDevice();
    if(device.limits.maxStorageBufferBindingSize<flagsBytes)return fallback('storage-limit');
    const usage=globalThis.GPUBufferUsage,mode=globalThis.GPUMapMode;
    if(!usage||!mode)return fallback('webgpu-runtime-missing');
    const coords=new Float32Array(n*4);
    bounds.forEach((b,i)=>coords.set(b,i*4));
    boxBuffer=device.createBuffer({size:coords.byteLength,usage:usage.STORAGE|usage.COPY_DST});
    flagBuffer=device.createBuffer({size:flagsBytes,usage:usage.STORAGE|usage.COPY_SRC});
    readBuffer=device.createBuffer({size:flagsBytes,usage:usage.COPY_DST|usage.MAP_READ});
    paramBuffer=device.createBuffer({size:16,usage:usage.UNIFORM|usage.COPY_DST});
    const params=new ArrayBuffer(16),view=new DataView(params);
    view.setUint32(0,n,true);view.setFloat32(4,padding,true);
    device.queue.writeBuffer(boxBuffer,0,coords);
    device.queue.writeBuffer(paramBuffer,0,params);
    const module=device.createShaderModule({code:broadphaseShader});
    const pipeline=await device.createComputePipelineAsync({
      layout:'auto',compute:{module,entryPoint:'main'}});
    const bindings=device.createBindGroup({layout:pipeline.getBindGroupLayout(0),entries:[
      {binding:0,resource:{buffer:boxBuffer}},
      {binding:1,resource:{buffer:flagBuffer}},
      {binding:2,resource:{buffer:paramBuffer}}
    ]});
    const encoder=device.createCommandEncoder(),pass=encoder.beginComputePass();
    pass.setPipeline(pipeline);pass.setBindGroup(0,bindings);
    pass.dispatchWorkgroups(Math.ceil(n*n/64));pass.end();
    encoder.copyBufferToBuffer(flagBuffer,0,readBuffer,0,flagsBytes);
    device.queue.submit([encoder.finish()]);
    await readBuffer.mapAsync(mode.READ);
    const result=new Uint32Array(readBuffer.getMappedRange().slice(0));
    const pairs=[];
    for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)
      if(result[i*n+j]!==0)pairs.push([i,j]);
    readBuffer.unmap();
    return {mode:'webgpu',pairs,reason:null,count:n,padding,candidates:pairs.length};
  }catch(error){
    return fallback('gpu-error:'+String(error?.message||error).slice(0,100));
  }finally{
    for(const b of [boxBuffer,flagBuffer,readBuffer,paramBuffer]){
      try{b?.destroy();}catch{}
    }
    // Device lifetime ends with this dispatch; never retain document data.
    try{device?.destroy();}catch{}
  }
}
