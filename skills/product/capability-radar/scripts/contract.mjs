export function validateRadarData(raw) {
  const statuses=['已具备','确定能做到','可能做到'];
  const str=v=>typeof v==='string'&&v.trim().length>0;
  const len=v=>Array.from(v).length;
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('JSON 顶层必须是对象。');
  const data=JSON.parse(JSON.stringify(raw));
  if(data.schemaVersion!==undefined&&data.schemaVersion!==1)throw Error('仅支持 schemaVersion=1。');
  data.schemaVersion=1;
  if(!Array.isArray(data.capabilities)||data.capabilities.length<1||data.capabilities.length>24)throw Error('capabilities 必须包含 1–24 项能力；更多条目应拆为多张雷达。');
  for(const key of ['title','subtitle','note','source','centerLabel'])if(data[key]!==undefined&&(typeof data[key]!=='string'||len(data[key])>240))throw Error(`${key} 必须是字符串，最多 240 个字符。`);
  if(data.date!==undefined&&(typeof data.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(data.date)||Number.isNaN(Date.parse(data.date+'T00:00:00Z'))||new Date(data.date+'T00:00:00Z').toISOString().slice(0,10)!==data.date))throw Error('date 必须是有效的 YYYY-MM-DD 日期。');
  const ids=new Set();
  data.capabilities.forEach((c,i)=>{
    if(!c||typeof c!=='object'||Array.isArray(c))throw Error(`第 ${i+1} 项能力必须是对象。`);
    if(!['string','number'].includes(typeof c.id)||!String(c.id).trim()||(typeof c.id==='number'&&!Number.isFinite(c.id)))throw Error(`第 ${i+1} 项缺少有效 id。`);
    const id=String(c.id).trim();if(ids.has(id))throw Error(`能力 id 重复：${id}`);ids.add(id);
    if(!str(c.group)||len(c.group.trim())>16)throw Error(`能力 ${id} 的 group 必须为 1–16 个字符。`);
    if(!str(c.name)||len(c.name)>120)throw Error(`能力 ${id} 缺少有效 name。`);
    c.group=c.group.trim();
    if(!statuses.includes(c.status))throw Error(`能力 ${id} 的 status 无效。只允许：${statuses.join(' / ')}。`);
    if(c.shortLabel!==undefined&&!str(c.shortLabel))throw Error(`能力 ${id} 的 shortLabel 不能为空。`);
    c.shortLabel=(c.shortLabel||c.name).trim();
    if(len(c.shortLabel)>20)throw Error(`能力 ${id} 的图上说明超过 20 个字符，请设置更短的 shortLabel。`);
    if(c.summary!==undefined&&(typeof c.summary!=='string'||len(c.summary)>32))throw Error(`能力 ${id} 的 summary 最多 32 个字符。`);
    for(const k of ['proof','limits','input','output','evidence','scenarios'])if(c[k]!==undefined&&typeof c[k]!=='string')throw Error(`能力 ${id} 的 ${k} 必须为字符串。`);
    if(c.sourceRefs!==undefined&&(!Array.isArray(c.sourceRefs)||c.sourceRefs.length===0||c.sourceRefs.some(r=>!r||!str(r.source)||!str(r.locator))))throw Error(`能力 ${id} 的 sourceRefs 必须含 source 与 locator。`);
    if(c.sourceRefs?.some(r=>r.quote!==undefined&&(!str(r.quote)||len(r.quote)>4000)))throw Error(`能力 ${id} 的来源 quote 必须为 1–4000 个字符。`);
  });
  if(data.domains!==undefined&&(!Array.isArray(data.domains)||data.domains.some(v=>!str(v)||len(v.trim())>16)))throw Error('domains 必须是能力域名称数组，每项最多 16 个字符。');
  data.domains=(data.domains||[...new Set(data.capabilities.map(c=>c.group))]).map(v=>v.trim());
  if(data.domains.length<1||data.domains.length>8||new Set(data.domains).size!==data.domains.length)throw Error('能力域须为 1–8 个，且名称不能重复。');
  if(data.capabilities.some(c=>!data.domains.includes(c.group)))throw Error('有能力的 group 不在 domains 中。');
  data.title=data.title||'技术能力雷达';data.centerLabel=data.centerLabel||'能力范围';
  if(len(data.title)>44)throw Error('title 最多 44 个字符。');
  if(len(data.centerLabel)>10)throw Error('centerLabel 最多 10 个字符。');
  if(data.sources!==undefined){
    if(!Array.isArray(data.sources)||data.sources.some(s=>!s||!str(s.id)||!str(s.name)||!/^[a-f0-9]{64}$/.test(s.sha256)))throw Error('sources 每项必须含 id、name 和 sha256。');
    const sourceIds=new Set(data.sources.map(s=>s.id));if(sourceIds.size!==data.sources.length)throw Error('sources.id 重复。');
    for(const c of data.capabilities)if(!c.sourceRefs?.length||c.sourceRefs.some(r=>!sourceIds.has(r.source)))throw Error(`能力 ${c.id} 缺少有效来源引用。`);
  }
  return data;
}
