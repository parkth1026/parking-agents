#!/usr/bin/env node
// Acceptance runner. Node built-ins + an already installed playwright-cli; no application dependencies.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, copyFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, delimiter } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseArgs } from './lib/util.mjs';
import { buildPayload } from './lib/report-data.mjs';
const args=parseArgs(process.argv.slice(2),{checks:{required:true},workspace:{},output:{}});
if(!['layout','tokens','detail','mobile'].includes(args.checks))throw Error('--checks layout|tokens|detail|mobile');
const skill=dirname(dirname(fileURLToPath(import.meta.url)));
const temp=mkdtempSync(join(tmpdir(),'trending-browser-'));
const output=resolve(args.output||join(temp,'evidence'));mkdirSync(output,{recursive:true});
let workspace=args.workspace?resolve(args.workspace):temp;
if(!args.workspace){
 const weeks=join(temp,'data','weeks'),repos=join(temp,'data','repos');
 mkdirSync(weeks,{recursive:true});mkdirSync(repos,{recursive:true});
 for(const f of ['2026-W36.json','2026-W36.analysis.md'])copyFileSync(join(skill,'fixtures','golden',f),join(weeks,f));
 copyFileSync(join(skill,'fixtures','golden','tt-a1i__archify.history.json'),join(repos,'tt-a1i__archify.json'));
 copyFileSync(join(skill,'fixtures','old-week','2026-W28.json'),join(weeks,'2026-W28.json'));
 copyFileSync(join(skill,'fixtures','old-week','legacy.analysis.md'),join(weeks,'2026-W28.analysis.md'));
 mkdirSync(join(temp,'report'),{recursive:true});
 writeFileSync(join(temp,'report','data.js'),'window.TRENDING_DATA = '+JSON.stringify(buildPayload(weeks))+';\n');
 copyFileSync(join(skill,'assets','viewer.html'),join(temp,'report','index.html'));
}
function cliPath(){
 for(const p of (process.env.PATH||'').split(delimiter)){
   const candidate=join(p,'node_modules','@playwright','cli','playwright-cli.js');
   if(existsSync(candidate))return candidate;
   const bin=join(p,'playwright-cli');
   if(existsSync(bin)){const real=realpathSync(bin);if(/\.[cm]?js$/.test(real))return real;}
 }
 throw Error('需要已安装的 playwright-cli；验证工具缺失，未执行验收');
}
const cli=cliPath(),session='gtw-'+process.pid;
function run(argv){
 const r=spawnSync(process.execPath,[cli,'-s='+session,...argv],{cwd:temp,encoding:'utf8',windowsHide:true,timeout:55000,maxBuffer:4*1024*1024});
 if(r.status!==0||/### Error/.test(r.stdout||''))throw Error((r.stdout||'')+(r.stderr||'')+(r.error?.message||''));
 return r.stdout;
}
async function checkPage(page,opts){
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.context().setOffline(true);
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(opts.url);
 await page.locator('.row').first().waitFor();
 const checks=[];
 const assert=(name,ok)=>{checks.push({name,pass:!!ok});};
 const evaluate=fn=>page.evaluate(fn);
 if(opts.checks==='layout'){
  const result=await evaluate(()=>{
   const rows=[...document.querySelectorAll('.row')],main=document.querySelector('.main').getBoundingClientRect();
   const w=window.TRENDING_DATA.weeks.find(w=>w.week===document.querySelector('#weekSel').value);
   const counts={new:0,recurring:0,returning:0};w.repos.forEach(r=>counts[r.entry_status]++);
   const hot=[...w.repos].sort((a,b)=>b.stars_week/b.stars_total-a.stars_week/a.stars_total).slice(0,3).map(r=>r.full_name);
   return {count:rows.length,visible:rows.every(r=>r.getBoundingClientRect().height>0),sameColumn:rows.every(r=>r.getBoundingClientRect().x===rows[0].getBoundingClientRect().x),width:main.width,center:Math.abs(main.x-(innerWidth-main.width)/2)<1,overflow:document.documentElement.scrollWidth>innerWidth,counts,head:document.querySelector('.listhead').textContent,hot,hotText:document.querySelector('#hot').textContent,surges:document.querySelectorAll('.surge').length,bars:document.querySelectorAll('.surgebar').length,expectedSurges:w.repos.filter(r=>r.stars_week/r.stars_total>=.2).length,accel:document.querySelector('.accel')?.textContent,thumbs:[...document.querySelectorAll('.rthumb .box')].map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})),hasTable:!!document.querySelector('.listwrap > table')};
  });
  assert('20 rows fully visible in one column',result.count===20&&result.visible&&result.sameColumn&&!result.hasTable);
  assert('1152px centered, no horizontal overflow',result.width===1152&&result.center&&!result.overflow);
  assert('counts include zero recurring',result.head.includes('新晋 '+result.counts.new)&&result.head.includes('回锅 '+result.counts.returning)&&result.head.includes('常驻 '+result.counts.recurring));
  assert('TLDR first line contains velocity top three',result.hot.every(n=>result.hotText.includes(n)));
  assert('surge badges and bars match data',result.surges===result.expectedSurges&&result.bars===result.expectedSurges);
  assert('all desktop thumbnails 288 by 162',result.thumbs.every(x=>x.w===288&&x.h===162));
  assert('offline initials for every row',await page.locator('.fb:visible').count()===20);
  assert('offline local file loaded',page.url().startsWith('file:'));
  // Mutate only the in-memory browser fixture, verifying stale display and closed SURGE boundary.
  await page.evaluate(()=>{const w=DATA.weeks.find(w=>w.week===$('weekSel').value);w.staleAt='2026-09-03T00:00:00Z';w.staleReason='fixture reclassification';w.repos[0].stars_total=100;w.repos[0].stars_week=20;renderWeek();});
  assert('stale yellow banner and exact 20% boundary',await page.locator('#stale').isVisible()&&await page.locator('.row').first().locator('.surge').count()===1);
  await page.reload();
  await page.locator('.row').first().waitFor();
  // Exercise actual image load/error handlers without hitting the network.
  await page.context().setOffline(false);
  await page.route('https://**/*',route=>route.fulfill({status:200,contentType:'image/svg+xml',body:route.request().url().includes('opengraph.githubassets.com')?'<svg xmlns="http://www.w3.org/2000/svg" width="288" height="162"><rect width="288" height="162" fill="indigo"/></svg>':'invalid-image'}));
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('.rthumb img')?.hidden===false);
  assert('README decode failure falls back to Social Preview',await page.locator('.rthumb img').first().getAttribute('src').then(s=>s.includes('opengraph.githubassets.com')));
  await page.unroute('https://**/*');
  await page.route('https://**/*',route=>route.fulfill({status:200,contentType:'image/png',body:'invalid-image'}));
  await page.reload();
  await page.waitForFunction(()=>[...document.querySelectorAll('.rthumb img')].every(img=>img.complete&&img.hidden));
  assert('both image sources fail: all initials remain',await page.locator('.fb:visible').count()===20);
  await page.context().setOffline(true);
  await page.reload();await page.locator('.row').first().waitFor();
 }
 if(opts.checks==='tokens'){
  const violations=await evaluate(()=>{
   const specs={'.row':{paddingTop:'24px',paddingRight:'16px',paddingBottom:'24px',paddingLeft:'16px',borderBottomColor:'rgb(218, 220, 231)'},'.nm':{fontSize:'16px',fontWeight:'500',color:'rgba(23, 23, 23, 0.8)'},'.rdesc':{fontSize:'14px',color:'rgb(92, 94, 112)'},'.nums .pair':{fontSize:'14px',fontWeight:'500'},'.glabel':{fontSize:'12px',color:'rgba(92, 94, 112, 0.7)'},'.bdg.status':{fontSize:'10px',fontWeight:'600',textTransform:'uppercase',letterSpacing:'0.25px',color:'rgb(102, 112, 204)'},'.tpill':{fontSize:'12px',borderRadius:'6px'},'h1':{fontSize:'24px',fontWeight:'600'},'.surgebar':{height:'2px',backgroundColor:'rgb(102, 112, 204)'}};
   const errors=[];
   for(const [selector,props] of Object.entries(specs)){
    const nodes=[...document.querySelectorAll(selector)];if(!nodes.length)errors.push(selector+' missing');
    for(const el of nodes){const css=getComputedStyle(el);for(const [key,value]of Object.entries(props))if(css[key]!==value)errors.push(selector+' '+key+': '+css[key]+' != '+value);}
   }
   for(const selector of ['.main','.topbar-in','footer'])if(getComputedStyle(document.querySelector(selector)).maxWidth!=='1152px')errors.push(selector+' max-width');
   const medals=[...document.querySelectorAll('.medal')].map(e=>getComputedStyle(e).backgroundColor);
   if(JSON.stringify(medals)!==JSON.stringify(['rgb(249, 156, 0)','rgb(156, 163, 175)','rgb(180, 83, 9)']))errors.push('medals');
   return errors;
  });
  assert('all locked computed-style tokens on every matching element',violations.length===0);
  if(violations.length)checks.push({name:violations.join('\n'),pass:false});
 }
 if(opts.checks==='detail'){
  const row=page.locator('.row').first(),card=page.locator('.detail').first();
  assert('details initially closed',!await card.isVisible());
  await row.click({position:{x:10,y:10}});
  assert('click opens inline card',await card.isVisible()&&await row.getAttribute('aria-expanded')==='true');
  assert('four fields and controlled niche pills',await card.locator('.lead').innerText().then(t=>t.includes('定位')&&!t.includes('尚无'))&&await card.locator('.analysis').innerText().then(t=>t.includes('为什么爆')&&t.includes('可信度')&&t.includes('生态位'))&&await card.locator('.npill').count()>0);
  assert('no images inside analysis card',await page.locator('.detail img').count()===0);
  assert('metadata and README collapsed',await card.locator('details[open]').count()===0);
  await row.click({position:{x:10,y:10}});
  assert('second click closes',!await card.isVisible());
  await row.focus();await page.keyboard.press('Enter');assert('keyboard opens',await card.isVisible());
  await page.screenshot({path:opts.screenshot,fullPage:false});
  const old=await page.locator('#weekSel option').last().getAttribute('value');
  await page.selectOption('#weekSel',old);
  await page.locator('.row').first().click({position:{x:10,y:10}});
  assert('old week renders 20 rows and placeholder',await page.locator('.row').count()===20&&await page.locator('.detail').first().innerText().then(t=>t.includes('四字段注释')));
  assert('old week no false stale',!await page.locator('#stale').isVisible());
  // Legacy data.js has none of the new aliases; exercise that direction separately.
  await page.evaluate(()=>{for(const w of DATA.weeks){for(const r of w.repos)for(const k of ['note','presence','accel','coreImg','readme','created','pushed','issues','license','source_status'])delete r[k];delete w.staleAt;}renderWeek();});
  assert('legacy data.js still renders',await page.locator('.row').count()===20);
 }
 if(opts.checks==='mobile'){
  for(const width of [640,390,320]){
   await page.setViewportSize({width,height:844});
   await page.locator('.row').first().click({position:{x:8,y:8}});
   await page.locator('.detail').first().locator('summary').first().click();
   const result=await evaluate(()=>{
    const row=document.querySelector('.row'),thumb=row.querySelector('.rthumb').getBoundingClientRect(),main=row.querySelector('.rmain').getBoundingClientRect(),box=row.querySelector('.box').getBoundingClientRect();
    return {overflow:document.documentElement.scrollWidth>innerWidth,desc:getComputedStyle(row.querySelector('.rdesc')).display,fork:getComputedStyle(row.querySelector('.fk')).display,below:thumb.y>=main.bottom,full:Math.abs(thumb.width-main.width)<1,ratio:Math.abs(box.width/box.height-16/9)<.02,columns:getComputedStyle(document.querySelector('.kv')).gridTemplateColumns.split(' ').length};
   });
   assert(width+'px no overflow, hidden description/fork, full-width bottom image, two-column metadata',!result.overflow&&result.desc==='none'&&result.fork==='none'&&result.below&&result.full&&result.ratio&&result.columns===2);
   if(width===390){await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:opts.screenshot,fullPage:false});}
   await page.reload();await page.locator('.row').first().waitFor();
  }
 }
 if(opts.checks==='layout'||opts.checks==='tokens')await page.screenshot({path:opts.screenshot,fullPage:false});
 assert('zero console errors and uncaught exceptions',errors.length===0);
 return {checks,errors,pass:checks.every(c=>c.pass),url:page.url()};
}
const opts={checks:args.checks,url:pathToFileURL(join(workspace,'report','index.html')).href,screenshot:join(output,args.checks+'.png')};
const codeFile=join(temp,'check.js');writeFileSync(codeFile,'async page => ('+checkPage.toString()+')(page,'+JSON.stringify(opts)+')');
try{
 run(['open','--browser=chrome']);
 const stdout=run(['run-code','--filename='+codeFile]);
 const match=/### Result\s*\n([\s\S]*?)(?:\n### |$)/.exec(stdout);
 if(!match)throw Error('浏览器未返回可解析的验收结果: '+stdout);
 const result=JSON.parse(match[1]);
 writeFileSync(join(output,args.checks+'.json'),JSON.stringify(result,null,2));
 for(const c of result.checks)console.log((c.pass?'PASS ':'FAIL ')+c.name);
 console.log('Evidence: '+output);
 process.exitCode=result.pass?0:1;
}catch(e){console.error(e.message);process.exitCode=1;}
finally{try{run(['close']);}catch(e){console.error('Browser cleanup: '+e.message);}if(args.output)rmSync(temp,{recursive:true,force:true});}
