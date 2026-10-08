// Partition the native TOC without altering SQL or omitting any archive entry.
export function schemaFirstRestoreLists(toc){
 if(typeof toc!=='string'||Buffer.byteLength(toc)>8_000_000)throw Error('RESTORE_TOC_UNKNOWN');
 const schemas=[],remaining=[],ids=new Set();
 for(const line of toc.split('\n')){
  if(!line.trim()||line.startsWith(';')){schemas.push(line);remaining.push(line);continue;}
  const entry=line.match(/^([1-9][0-9]*);\s+[0-9]+\s+[0-9]+\s+(.+)$/);
  if(!entry||ids.has(entry[1]))throw Error('RESTORE_TOC_UNKNOWN');
  ids.add(entry[1]);(/^(?:SCHEMA)\s/.test(entry[2])?schemas:remaining).push(line);
 }
 if(!ids.size)throw Error('RESTORE_TOC_UNKNOWN');
 return Object.freeze({schemas:schemas.join('\n'),remaining:remaining.join('\n'),entries:ids.size,
  schemaEntries:schemas.filter(line=>/^[1-9][0-9]*;/.test(line)).length});
}
