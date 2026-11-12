// Local static-first integration evidence. Node 22 + Chrome, no test runtime dependencies.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,readFile,writeFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
const root=resolve(fileURLToPath(new URL('../',import.meta.url))),temp=await mkdtemp(join(tmpdir(),'object-examples-')),consumer=join(temp,'consumer');
const wait=ms=>new Promise(r=>setTimeout(r,ms)),hash=x=>createHash('sha256').update(x).digest('hex');
const run=(cmd,args,cwd=root)=>execFileSync(cmd,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']});
const report={startedAt:new Date().toISOString(),baseCommit:run('git',['rev-parse','HEAD']).trim(),scope:'Local Chromium software renderer and emulated viewport, not physical-device or full accessibility/composition certification.',tests:[],inputs:{}};
let server,chrome;const sessions=[];
try{
 const raw=run('npm',['pack','--json','--pack-destination',temp]);const pack=JSON.parse(raw.slice(raw.lastIndexOf('\n[')+1))[0];
 report.package={files:pack.files.length,size:pack.size,sha256:hash(await readFile(join(temp,pack.filename)))};
 assert(!pack.files.some(f=>f.path.startsWith('examples/')||f.path.startsWith('site/')));
 await mkdir(consumer);await writeFile(join(consumer,'package.json'),JSON.stringify({type:'module',private:true}));
 run('npm',['install','--offline','--ignore-scripts','--no-audit','--no-fund',join(temp,pack.filename)],consumer);
 await cp(join(root,'examples'),join(consumer,'examples'),{recursive:true});
 await mkdir(join(consumer,'site/src/og'),{recursive:true});for(const file of ['favicon.svg','og/apple-touch-icon.png'])await cp(join(root,'site/src',file),join(consumer,'site/src',file));
 for(const mode of ['NodeNext','Bundler'])run(process.execPath,[join(root,'node_modules/typescript/bin/tsc'),'--noEmit','--strict','--allowJs','--checkJs','--target','ES2022','--module',mode==='NodeNext'?'NodeNext':'ESNext','--moduleResolution',mode,'--ignoreConfig',join(consumer,'examples/lifecycle/app.js')]);
 report.strictInstalledCompilerInvocations=2;
 const html=await readFile(join(consumer,'examples/lifecycle/index.html'),'utf8');await writeFile(join(consumer,'examples/lifecycle/index.html'),html.replace('../../dist/solids.js','../../node_modules/solids/dist/solids.js'));
 server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),failure=url.pathname.startsWith('/failure/'),path=failure?url.pathname.slice('/failure'.length):url.pathname,installed=path.startsWith('/consumer/'),base=installed?consumer:root,rel=installed?path.slice('/consumer'.length):path,file=resolve(base,'.'+rel);
  if(!file.startsWith(base+'/')){res.writeHead(403).end();return}if(failure&&rel==='/dist/solids.js'){res.writeHead(404).end();return}
  if(rel.endsWith('/dist/solids.js'))await wait(200);
  const target=(await stat(file)).isDirectory()?join(file,'index.html'):file;
  res.setHeader('Content-Type',['.js','.mjs'].includes(extname(target))?'text/javascript':extname(target)==='.css'?'text/css':'text/html');res.end(await readFile(target));
 }catch{res.writeHead(404).end()}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 chrome=spawn(process.env.CHROME||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--window-size=1440,1200','--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--remote-debugging-port=0','--user-data-dir='+join(temp,'chrome'),'about:blank'],{stdio:'ignore'});
 let port;for(let i=0;i<100&&!port;i++){try{port=Number((await readFile(join(temp,'chrome/DevToolsActivePort'),'utf8')).split('\n')[0])}catch{await wait(100)}}assert(port,'Chrome unavailable; set CHROME');
 report.browser=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json();delete report.browser.webSocketDebuggerUrl;
 async function page({width=1000,reduced=false,noJS=false,noGL=false}={}){
  const target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json(),ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});let id=0;const pending=new Map(),errors=[];
  ws.onmessage=({data})=>{const m=JSON.parse(data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)};
  const send=(method,params={})=>new Promise((r,j)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);j(Error(method+' timeout'))},15000);pending.set(n,m=>{clearTimeout(timer);m.error?j(Error(JSON.stringify(m.error))):r(m.result)});ws.send(JSON.stringify({id:n,method,params}))});
  const evaluate=async expression=>{const m=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(m.exceptionDetails)throw Error(m.exceptionDetails.exception?.description||m.exceptionDetails.text);return m.result?.value};
  await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:reduced?'reduce':'no-preference'}]});
  if(noJS)await send('Emulation.setScriptExecutionDisabled',{value:true});
  else await send('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{window.__pending=new Set();const req=requestAnimationFrame.bind(window),cancel=cancelAnimationFrame.bind(window);window.requestAnimationFrame=fn=>{let id=req(t=>{__pending.delete(id);fn(t)});__pending.add(id);return id};window.cancelAnimationFrame=id=>{__pending.delete(id);cancel(id)};window.__glCalls=0;const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2'){__glCalls++;if(${noGL})return null;}return get.call(this,type,...args)}})();`});
  const out={send,evaluate,errors,async close(){ws.close();await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`)},async navigate(path){await send('Page.navigate',{url:origin+path});for(let i=0;i<120;i++){if(await evaluate(noJS?"document.readyState==='complete'":"document.getElementById('enhance')?.disabled===false")){await fetch(`http://127.0.0.1:${port}/json/activate/${target.id}`);await send('Page.bringToFront');return}await wait(50)}throw Error('Example not ready '+errors.join('\n'))}};
  sessions.push(out);return out;
 }
 const appExpr="await import(new URL('./app.js',location.href).href)";
 const app=(p,expr)=>p.evaluate(`(async()=>{const app=${appExpr};${expr}})()`);
 const click=(p,id)=>p.evaluate(`document.getElementById('${id}').click()`);
 const until=async(p,expr)=>{for(let i=0;i<100;i++){if(await p.evaluate(expr))return;await wait(50)}throw Error('Timed out: '+expr+' '+JSON.stringify(await p.evaluate("({status:document.getElementById('status')?.textContent,focus:document.activeElement?.id,scene:!!document.querySelector('sd-scene'),glCalls:window.__glCalls,visible:document.visibilityState,focused:document.hasFocus()})"))+' '+p.errors.join(' | '))};
 async function screenshot(p,name){if(process.env.EXAMPLE_SCREENSHOTS){await mkdir(process.env.EXAMPLE_SCREENSHOTS,{recursive:true});const r=await p.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});await writeFile(join(process.env.EXAMPLE_SCREENSHOTS,name+'.png'),Buffer.from(r.data,'base64'))}}
 for(const delivery of ['source','built','installed']){
  const p=await page();const path=delivery==='source'?'/examples/lifecycle/':delivery==='built'?'/site/dist/examples/lifecycle/':'/consumer/examples/lifecycle/';await p.navigate(path);
  assert(await p.evaluate("__glCalls===0&&!document.querySelector('sd-scene')&&!document.getElementById('static').hidden"));
  // Actual native keyboard activation and localized field editing.
  await p.evaluate("document.getElementById('note').focus();window.__note=document.getElementById('note')");await p.send('Input.insertText',{text:'Edited 한글 '});
  await p.evaluate("document.getElementById('enhance').focus()");for(const type of ['keyDown','keyUp'])await p.send('Input.dispatchKeyEvent',{type,key:'Enter',code:'Enter',windowsVirtualKeyCode:13,...(type==='keyDown'?{text:'\r',unmodifiedText:'\r'}:{})});
  await until(p,"!!document.querySelector('sd-scene')?.gl&&document.getElementById('static').hidden");await wait(300);
  const pixels=await p.evaluate("(()=>{const s=document.querySelector('sd-scene');s.frame(s.time,0);const gl=s.gl,a=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,a);return{painted:a.filter((v,i)=>i%4===3&&v>0).length,objects:s.objects.size}})()");assert(pixels.painted>0&&pixels.objects===2);
  await p.evaluate("document.getElementById('color').value='#ffbd91';document.getElementById('color').dispatchEvent(new Event('change'))");assert.equal(await p.evaluate("document.querySelector('sd-orb').getAttribute('color')"),'#ffbd91');
  await p.evaluate("window.__scene=document.querySelector('sd-scene');__scene.setAttribute('paused','')");await wait(100);assert.equal(await p.evaluate('__pending.size'),0);await p.evaluate("__scene.removeAttribute('paused')");await wait(100);assert(await p.evaluate('__pending.size>0'));
  await p.evaluate("document.getElementById('stage').style.height='320px'");await wait(150);assert(await p.evaluate("(()=>{const s=document.querySelector('sd-scene');return s.canvas.height===Math.round(s.getBoundingClientRect().height)&&s.canvas.height>280})()"));
  await screenshot(p,delivery);
  const cycles=[];for(let i=0;i<5;i++){await p.evaluate("window.__last=document.querySelector('sd-scene')");await click(p,'enhance');await wait(120);const c=await p.evaluate("({detached:!__last.isConnected,released:__last.gl.isContextLost(),pending:__pending.size,source:!document.getElementById('static').hidden,note:document.getElementById('note')===__note&&__note.value.includes('Edited 한글')})");assert(c.detached&&c.released&&c.pending===0&&c.source&&c.note);cycles.push(c);await click(p,'enhance');await until(p,"!!document.querySelector('sd-scene')?.gl");}
  await app(p,'app.disposeExample();app.disposeExample();');await wait(100);assert(await p.evaluate("!document.querySelector('sd-scene')&&__pending.size===0&&!document.getElementById('static').hidden"));await click(p,'enhance');assert(await p.evaluate("!document.querySelector('sd-scene')"));
  await app(p,'app.mountExample();app.mountExample();');await click(p,'enhance');await until(p,"!!document.querySelector('sd-scene')?.gl");
  // Live preference and viewport gates, and explicit static intent precedence.
  await p.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await until(p,"!document.querySelector('sd-scene')");await wait(100);assert.equal(await p.evaluate('__pending.size'),0);
  await click(p,'enhance');await p.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});await wait(100);assert(await p.evaluate("!document.querySelector('sd-scene')"));
  await click(p,'enhance');await until(p,"!!document.querySelector('sd-scene')?.gl");await p.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});await until(p,"!document.querySelector('sd-scene')");assert(await p.evaluate("document.documentElement.scrollWidth<=innerWidth+1"));await screenshot(p,delivery+'-compact');
  await app(p,'app.disposeExample();');assert.deepEqual(p.errors,[]);report.tests.push({delivery,status:'passed',keyboardAndNativeInput:true,pixels,pauseAndResize:true,cycles,preferenceAndCompactPolicy:true,explicitStaticRetained:true,idempotentAppCleanup:true});await p.close();
 }
 for(const mode of ['compact','reduced','noJS','noGL','loadFailure','pendingDispose']){
  const p=await page({width:mode==='compact'?390:1000,reduced:mode==='reduced',noJS:mode==='noJS',noGL:mode==='noGL'});await p.navigate(mode==='loadFailure'?'/failure/examples/lifecycle/':'/site/dist/examples/lifecycle/');
  if(mode!=='noJS'){await click(p,'enhance');if(mode==='pendingDispose')await app(p,'app.disposeExample();');await wait(900);}
  const state=await p.evaluate("({scene:!!document.querySelector('sd-scene'),fallback:!document.getElementById('static').hidden,overflow:document.documentElement.scrollWidth>innerWidth+1,note:!!document.getElementById('note'),pending:window.__pending?.size??0,glCalls:window.__glCalls??0,status:document.getElementById('status').textContent})");
  assert(!state.scene&&state.fallback&&!state.overflow&&state.note&&state.pending===0);if(['compact','reduced','noJS'].includes(mode))assert.equal(state.glCalls,0);assert.deepEqual(p.errors,[]);await screenshot(p,mode);report.tests.push({mode,status:'passed',state});await p.close();
 }
 for(const rel of ['README.md','docs/SKILL.md','docs/integration.md','site/src/accessibility.md','scripts/gen-site.mjs','scripts/check-docs.mjs','scripts/check-examples.mjs','package.json','package-lock.json','examples/lifecycle/index.html','examples/lifecycle/style.css','examples/lifecycle/app.js'])report.inputs[rel]=hash(await readFile(join(root,rel)));
 report.finishedAt=new Date().toISOString();report.result='PASS';console.log(JSON.stringify(report,null,2));
}catch(error){report.result='FAIL';report.failure=error.message;throw error;}finally{
 if(process.env.EXAMPLE_REPORT)await writeFile(process.env.EXAMPLE_REPORT,JSON.stringify(report,null,2)+'\n');
 for(const p of sessions)try{await p.close()}catch{}if(chrome&&chrome.exitCode===null)await new Promise(r=>{chrome.once('exit',r);chrome.kill('SIGKILL')});if(server)await new Promise(r=>server.close(r));await rm(temp,{recursive:true,force:true});
}
