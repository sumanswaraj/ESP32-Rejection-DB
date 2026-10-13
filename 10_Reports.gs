/** Quantity-based reports, pagination, snapshots and bounded optional cache. */
function qcFwReport_(request){
  qcFwRequireUser_(request.token);const filters=qcFwObject_(request.filters||{}),book=qcFwBook_(),table=book.getSheetByName('ESP32_Log'),timezone=book.getSpreadsheetTimeZone();
  const snapshot=request.snapshot_row===undefined?table.getLastRow():request.snapshot_row;
  qcFwAssert_(Number.isSafeInteger(snapshot)&&snapshot>=1&&snapshot<=table.getLastRow(),'SNAPSHOT_INVALID');
  qcFwAssert_(snapshot-1<=QC_APP.MAX_REPORT_ROWS,'REPORT_LIMIT: archive older records into another workbook before reporting more than 50,000 rows');
  const dateFilter=key=>{const v=qcFwText_(filters[key],key,10,false);if(v){qcFwAssert_(/^\d{4}-\d{2}-\d{2}$/.test(v),'DATE_FILTER_INVALID');const d=new Date(v+'T00:00:00Z');qcFwAssert_(Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v,'DATE_FILTER_INVALID');}return v;};
  const from=dateFilter('from'),to=dateFilter('to');qcFwAssert_(!from||!to||from<=to,'DATE_RANGE_INVALID');
  const logger=qcFwText_(filters.logger,'LOGGER',80,false),machine=qcFwText_(filters.machine,'MACHINE',80,false),part=qcFwText_(filters.part,'PART',80,false),type=filters.type||'ALL';
  const defect=filters.defect?Number(filters.defect):0;qcFwAssert_(['ALL','REAL','SAMPLE'].includes(type)&&(!defect||(Number.isInteger(defect)&&defect>=1&&defect<=16)),'FILTER_INVALID');
  const page=request.page===undefined?0:request.page,size=request.page_size===undefined?10:request.page_size;
  qcFwAssert_(Number.isSafeInteger(page)&&page>=0&&Number.isSafeInteger(size)&&size>=1&&size<=1000,'PAGE_INVALID');
  const cacheKey='qc-report:'+qcFwHash_(qcFwCanonical_({book:book.getId(),schema:QC_APP.VERSION,snapshot,timezone,from,to,logger,machine,part,type,defect}));
  const cached=qcFwReportCacheLoad_(cacheKey,page,size);if(cached)return cached;
  const raw=snapshot>1?table.getRange(2,1,snapshot-1,18).getValues():[],events=[];
  const byDefect=Object.create(null),byMachine=Object.create(null),byPart=Object.create(null),byLogger=Object.create(null),byDay=Object.create(null),byWeek=Object.create(null),byMonth=Object.create(null);let pieces=0;
  raw.forEach(r=>{
    if(!(r[0] instanceof Date)||!Number.isFinite(r[0].getTime()))return;
    const time=r[14] instanceof Date&&Number.isFinite(r[14].getTime())?r[14]:r[0],day=Utilities.formatDate(time,timezone,'yyyy-MM-dd'),dataType=String(r[1]).startsWith('SAMPLE_')?'SAMPLE':'REAL';
    if((from&&day<from)||(to&&day>to)||(logger&&r[1]!==logger)||(machine&&r[8]!==machine)||(part&&r[7]!==part)||(defect&&Number(r[2])!==defect)||(type!=='ALL'&&type!==dataType))return;
    const quantity=r[12]===''||r[12]==null?1:Number(r[12]);qcFwAssert_(Number.isInteger(quantity)&&quantity>=1&&quantity<=9999,'INVALID_LEDGER_QUANTITY: review row data');
    pieces+=quantity;const key=String(r[2])+' · '+r[3];byDefect[key]=(byDefect[key]||0)+quantity;byMachine[String(r[8]||'Not specified')]=(byMachine[String(r[8]||'Not specified')]||0)+quantity;byDay[day]=(byDay[day]||0)+quantity;
    const partKey=String(r[7]||'Not specified'),loggerKey=String(r[1]||'Not specified'),weekDate=new Date(day+'T00:00:00Z');
    weekDate.setUTCDate(weekDate.getUTCDate()-((weekDate.getUTCDay()+6)%7));
    const week=weekDate.toISOString().slice(0,10),month=day.slice(0,7);
    byPart[partKey]=(byPart[partKey]||0)+quantity;byLogger[loggerKey]=(byLogger[loggerKey]||0)+quantity;
    byWeek[week]=(byWeek[week]||0)+quantity;byMonth[month]=(byMonth[month]||0)+quantity;
    events.push({timestamp:time.toISOString(),received:r[0].toISOString(),day,logger:r[1],machine:r[8],part:r[7],defectCode:r[2],defect:r[3],quantity,job:r[9],event:r[10],source:r[16]||'',timeQuality:r[15]||'',type:dataType});
  });
  const rank=o=>Object.keys(o).map(name=>({name,pieces:o[name]})).sort((a,b)=>b.pieces-a.pieces);
  events.reverse();const summary={success:true,timezone,snapshotRow:snapshot,total:events.length,pieces,
    byDefect:rank(byDefect),byMachine:rank(byMachine).slice(0,100),byPart:rank(byPart).slice(0,100),byLogger:rank(byLogger).slice(0,100),
    byDay:Object.keys(byDay).sort().slice(-366).map(name=>({name,pieces:byDay[name]})),
    byWeek:Object.keys(byWeek).sort().slice(-104).map(name=>({name,pieces:byWeek[name]})),
    byMonth:Object.keys(byMonth).sort().slice(-120).map(name=>({name,pieces:byMonth[name]}))};
  qcFwReportCacheSave_(cacheKey,summary,events);
  return Object.assign({},summary,{page,pageSize:size,events:events.slice(page*size,(page+1)*size)});
}

function qcFwUtf8Size_(s){let n=0;for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c<128)n++;else if(c<2048)n+=2;else if(c>=0xd800&&c<=0xdbff&&i+1<s.length&&s.charCodeAt(i+1)>=0xdc00&&s.charCodeAt(i+1)<=0xdfff){n+=4;i++;}else n+=3;}return n;}

function qcFwReportCacheLoad_(key,page,size){
  try{
    const cache=CacheService.getScriptCache(),metaText=cache.get(key);if(!metaText)return null;
    const summary=JSON.parse(metaText),start=page*size,end=Math.min(start+size,summary.total),keys=[];
    if(start>=summary.total)return Object.assign({},summary,{page,pageSize:size,events:[]});
    for(let i=Math.floor(start/100);i<=Math.floor((end-1)/100);i++)keys.push(key+':'+i);
    const chunks=cache.getAll(keys);if(keys.some(k=>!chunks[k]))return null;
    const rows=keys.flatMap(k=>JSON.parse(chunks[k]));
    return Object.assign({},summary,{page,pageSize:size,events:rows.slice(start%100,start%100+end-start)});
  }catch(err){return null;} // Cache eviction/failure falls back to the source ledger.
}

function qcFwReportCacheSave_(key,summary,events){
  try{
    const cache=CacheService.getScriptCache(),meta=JSON.stringify(summary);if(qcFwUtf8Size_(meta)>95000)return;
    let batch={};
    for(let i=0;i<events.length;i+=100){const text=JSON.stringify(events.slice(i,i+100));if(qcFwUtf8Size_(text)>95000)return;
      batch[key+':'+(i/100)]=text;if(Object.keys(batch).length===50){cache.putAll(batch,QC_APP.REPORT_CACHE_SECONDS);batch={};}}
    if(Object.keys(batch).length)cache.putAll(batch,QC_APP.REPORT_CACHE_SECONDS);cache.put(key,meta,QC_APP.REPORT_CACHE_SECONDS);
  }catch(err){} // Reporting correctness never depends on the cache.
}

