/** Small job-history pages. Browsing never transfers the complete job ledger. */
function qcFwHistorySize_(value){
  const size=value===undefined?10:value;
  qcFwAssert_(size===5||size===10,'PAGE_SIZE_INVALID: choose 5 or 10 rows');return size;
}

function qcFwJobHistory_(request){
  qcFwRequireUser_(request.token);
  return qcFwJobHistoryPage_(request);
}

function qcFwJobHistoryPage_(request){
  const sheet=qcFwTable_('Job_Assignments'),last=sheet.getLastRow();
  const snapshot=request.snapshot_row===undefined?last:request.snapshot_row;
  const page=request.page===undefined?0:request.page,size=qcFwHistorySize_(request.page_size);
  qcFwAssert_(Number.isSafeInteger(snapshot)&&snapshot>=1&&snapshot<=last,'SNAPSHOT_INVALID');
  qcFwAssert_(Number.isSafeInteger(page)&&page>=0&&Number.isSafeInteger(page*size),'PAGE_INVALID');
  // Job_Assignments is an append-only system ledger. Keep its upper row fixed
  // while browsing so newly appended jobs cannot repeat/skip rows between pages.
  // A job's current end/status may still change while an operator is browsing.
  const total=snapshot-1,end=snapshot-page*size,start=Math.max(2,end-size+1);
  const headers=qcFwHeaders_(sheet),rows=end<2?[]:sheet.getRange(start,1,end-start+1,headers.length).getValues();
  const jobs=rows.reverse().map(r=>Object.fromEntries(headers.filter(Boolean).map(h=>[h,r[headers.indexOf(h)]])))
    .filter(j=>j.Job_ID).map(qcFwPublicJob_);
  return {success:true,jobs,total,page,pageSize:size,snapshotRow:snapshot};
}
