import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {flags,readJSON,writeNew,stop} from './io.mjs';
import {validateRadarData} from './contract.mjs';
const require=createRequire(import.meta.url);
let browser;
try{
 const a=flags(process.argv.slice(2),['html','json','playwright','out']);
 if(!a.html||!a.json||!a.out)throw Error('用法：node verify-browser.mjs --html <html> --json <json> --out <receipt> [--playwright <已有模块>]');
 const data=validateRadarData(readJSON(a.json));
 const preview=path.resolve(path.dirname(a.out),path.basename(a.out,path.extname(a.out))+'-预览.png');
 if(fs.existsSync(a.out)||fs.existsSync(preview))throw Error('浏览器验证输出已存在，拒绝覆盖。');
 let pw;
 try{pw=a.playwright?await import(pathToFileURL(require.resolve(a.playwright)).href):await import('playwright');}catch{throw Error('NOT_RUN：无法找到 Playwright。通过 --playwright 指向已有模块，或使用宿主浏览器检查；不要自动安装。');}
 const chromium=pw.chromium||pw.default?.chromium;
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.resolve(a.html)).href);
 await page.waitForFunction(()=>document.querySelector('.capability')||!document.getElementById('notice').hidden,{},{timeout:20000});
 const count=await page.locator('.capability').count();
 if(count!==data.capabilities.length)throw Error('FAIL：页面能力数量不一致。'+await page.locator('#notice').textContent());
 for(const c of data.capabilities){
  const node=page.locator('.capability').filter({has:page.locator(`[data-short-label=${JSON.stringify(String(c.id))}]`)});
  if(await node.count()!==1||await node.getAttribute('data-status')!==c.status||await node.locator('[data-short-label]').textContent()!==c.shortLabel)throw Error(`FAIL：能力 ${c.id} 的标签或状态与数据不一致。`);
 }
 const geometry=await page.locator('#chart svg').evaluate(svg=>{
  const base=svg.getScreenCTM().inverse(),view=svg.viewBox.baseVal;
  const labels=[...svg.querySelectorAll('text')].filter(e=>e.textContent.trim()).map(e=>{const b=e.getBBox(),m=base.multiply(e.getScreenCTM()),p=new DOMPoint(b.x,b.y).matrixTransform(m),q=new DOMPoint(b.x+b.width,b.y+b.height).matrixTransform(m);return {text:e.textContent,x:p.x,y:p.y,w:q.x-p.x,h:q.y-p.y};});
  return {clipped:labels.filter(b=>b.x<-.5||b.y<-.5||b.x+b.w>view.width+.5||b.y+b.h>view.height+.5),overlaps:labels.flatMap((a,i)=>labels.slice(i+1).filter(b=>Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>3&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>3).map(b=>[a.text,b.text]))};
 });
 await page.locator('.capability').first().click();
 if(!await page.locator('#detail').evaluate(d=>d.open))throw Error('FAIL：能力证据未展开。');
 await page.locator('#close-detail').click();
 await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(0,0);
 fs.mkdirSync(path.dirname(preview),{recursive:true});await page.locator('#chart svg').screenshot({path:preview});
 const status=geometry.clipped.length||geometry.overlaps.length||errors.length?'FAIL':'PASS';
 const receipt={status,scope:'实际页面标签、状态、证据展开与文字几何；不代表技术事实复验或老板理解验收',capabilities:count,geometry,browserErrors:errors,preview};
 writeNew(a.out,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt,null,2));if(status!=='PASS')process.exitCode=1;
}catch(error){stop(error);}finally{if(browser)await browser.close();}
