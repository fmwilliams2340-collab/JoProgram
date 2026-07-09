const STORE_KEY = 'josProgram.v3.logs';
const STATE_KEY = 'josProgram.v3.current';
let program = null;
let activeDay = 'mon';
let currentSession = {};
let workoutStart = Date.now();

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const app = $('#app');

function loadLogs(){ try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { return []; } }
function saveLogs(logs){ localStorage.setItem(STORE_KEY, JSON.stringify(logs)); }
function loadCurrent(){ try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); } catch { return {}; } }
function saveCurrent(){ localStorage.setItem(STATE_KEY, JSON.stringify(currentSession)); }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function fmtDate(d){ return new Date(d).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}); }
function escapeHtml(s){ return String(s ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function dayById(id){ return program.days.find(d=>d.id===id) || program.days[0]; }
function exerciseKey(dayId, exId){ return `${todayISO()}.${dayId}.${exId}`; }
function getExerciseState(dayId, ex){
  const key = exerciseKey(dayId, ex.id);
  if(!currentSession[key]) currentSession[key] = { sets: Array.from({length: ex.sets}, (_,i)=>({set:i+1,weight:'',reps:'',done:false})), notes:'' };
  while(currentSession[key].sets.length < ex.sets) currentSession[key].sets.push({set:currentSession[key].sets.length+1,weight:'',reps:'',done:false});
  return currentSession[key];
}
function volumeForSets(sets){ return sets.reduce((sum,s)=> sum + ((parseFloat(s.weight)||0)*(parseFloat(s.reps)||0)),0); }
function lastWorkoutFor(exId){
  const logs = loadLogs().filter(l => l.exercises?.some(e=>e.id===exId));
  if(!logs.length) return null;
  const last = logs[logs.length-1];
  return {date:last.date, exercise:last.exercises.find(e=>e.id===exId)};
}
function allExercises(day){ return day.exercises.map(ex=>({ex,state:getExerciseState(day.id,ex)})); }
function completion(day){
  const total = day.exercises.reduce((n,ex)=>n+ex.sets,0);
  const done = allExercises(day).reduce((n,x)=>n+x.state.sets.filter(s=>s.done).length,0);
  return {done,total,pct: total ? Math.round(done/total*100):0};
}
function weekStats(){
  const logs = loadLogs();
  const since = Date.now() - 7*24*60*60*1000;
  const recent = logs.filter(l=> new Date(l.date).getTime() >= since);
  return { workouts: recent.length, volume: recent.reduce((s,l)=>s+(l.totalVolume||0),0), sets: recent.reduce((s,l)=>s+(l.setsDone||0),0)};
}
async function init(){
  program = await fetch('data/workouts.json', {cache:'no-store'}).then(r=>r.json());
  currentSession = loadCurrent();
  const dow = new Date().getDay();
  activeDay = dow===2?'tue':dow===4?'thu':dow===5?'fri':'mon';
  render();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(()=>{});
}
function render(){
  const day = dayById(activeDay);
  const ws = weekStats();
  const c = completion(day);
  app.innerHTML = `
    <div class="topbar"><div class="nav">${program.days.map(d=>`<button data-day="${d.id}" class="${d.id===activeDay?'active':''}">${d.label}</button>`).join('')}<button data-view="history">History</button><button data-view="weekly">Weekly Report</button></div></div>
    <header class="hero"><div><p>${program.tagline}</p><h1>${program.programName}</h1><p>Version 3.0 Full • set-by-set tracking • autosave • email and PDF-friendly summaries.</p></div><div class="portrait"><img src="assets/jo/jo-portrait.png" alt="Jo portrait"></div></header>
    <section class="stats"><div class="stat"><b>${c.pct}%</b><span>today complete</span></div><div class="stat"><b>${ws.workouts}</b><span>7-day workouts</span></div><div class="stat"><b>${ws.sets}</b><span>sets logged</span></div><div class="stat"><b>${Math.round(ws.volume).toLocaleString()}</b><span>weekly volume</span></div></section>
    ${renderDay(day)}
    <div class="footer-actions"><div class="inner"><button class="primary" data-action="email">📧 Email Workout</button><button class="secondary" data-action="finish">✅ Finish</button><button class="ghost" data-action="print">📄 PDF/Print</button></div></div>
    <div id="complete" class="complete-screen hidden"></div>`;
  wire();
}
function renderDay(day){
  const c = completion(day);
  return `<main class="day-card">
    <div class="day-head"><div><h2>${day.label}: ${day.title}</h2><p>${day.theme}</p><div class="progressbar"><span style="width:${c.pct}%"></span></div></div><div class="day-actions"><button class="primary" data-action="email">📧 Email Today's Workout</button><button class="secondary" data-action="finish">Finish Workout</button><button class="ghost" data-action="clear-day">Clear Today</button></div></div>
    <div class="section-title"><h3>Warm-Up</h3><span class="badge">easy blood flow</span></div><ul class="checklist">${day.warmup.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>
    <div class="section-title"><h3>Main Workout</h3><span class="badge">each set saves automatically</span></div>
    ${day.exercises.map((ex,i)=>renderExercise(day,ex,i)).join('')}
    <div class="section-title"><h3>Daily Notes</h3><span class="badge">wellness</span></div>
    ${renderDailyNotes(day)}
    <div class="section-title"><h3>Cool-Down</h3><span class="badge">recover</span></div><ul class="checklist">${day.cooldown.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul>
  </main>`;
}
function renderExercise(day, ex, idx){
  const state = getExerciseState(day.id, ex);
  const last = lastWorkoutFor(ex.id);
  const volume = volumeForSets(state.sets);
  return `<article class="exercise" data-ex="${ex.id}">
    <div class="ex-art"><img src="${ex.image}" alt="${escapeHtml(ex.name)}"></div>
    <div class="ex-main"><div class="ex-title"><div><h3>${idx+1}. ${escapeHtml(ex.name)}</h3><div class="badge-row"><span class="badge">${ex.sets} sets</span><span class="badge">${escapeHtml(ex.repRange)} reps</span><span class="badge">Volume: ${Math.round(volume).toLocaleString()} lb</span></div></div><input class="big-check" type="checkbox" data-complete-ex="${ex.id}" ${state.sets.every(s=>s.done)?'checked':''} title="mark exercise complete"></div>
      <table class="set-table"><thead><tr><th>Set</th><th>Weight</th><th>Reps</th><th>Done</th></tr></thead><tbody>
      ${state.sets.map((s,i)=>`<tr><td>${i+1}</td><td><input inputmode="decimal" type="number" placeholder="lbs" data-set-field="weight" data-ex="${ex.id}" data-set="${i}" value="${escapeHtml(s.weight)}"></td><td><input inputmode="numeric" type="number" placeholder="reps" data-set-field="reps" data-ex="${ex.id}" data-set="${i}" value="${escapeHtml(s.reps)}"></td><td><input type="checkbox" data-set-field="done" data-ex="${ex.id}" data-set="${i}" ${s.done?'checked':''}></td></tr>`).join('')}
      </tbody></table>
      <div class="previous">${last ? `Last time (${fmtDate(last.date)}): ${last.exercise.sets.map(s=>`Set ${s.set}: ${s.weight||0} × ${s.reps||0}`).join(' | ')}` : 'Last time: no saved workout yet'}</div>
      <textarea rows="2" placeholder="Exercise notes" data-ex-note="${ex.id}">${escapeHtml(state.notes||'')}</textarea>
      <details class="details"><summary>Exercise Details</summary><div class="details-body">
        <div class="info-block"><h4>Coaching Cues</h4><ul>${(ex.tips||[]).map(t=>`<li>${escapeHtml(t)}</li>`).join('')}</ul></div>
        <div class="info-block"><h4>Common Mistakes</h4><ul>${(ex.mistakes||[]).map(t=>`<li>${escapeHtml(t)}</li>`).join('')}</ul></div>
        <div class="info-block"><h4>Alternatives</h4><ul>${(ex.alternatives||[]).map(t=>`<li>${escapeHtml(t)}</li>`).join('')}</ul></div>
        <div class="info-block"><h4>Matt's Tip</h4><p>${escapeHtml(ex.matt||'Move with control and stay pain free.')}</p><p class="video-slot">▶ Demo video slot: add YouTube link in V3.1</p></div>
      </div></details>
    </div>
  </article>`;
}
function renderDailyNotes(day){
  const key = `${todayISO()}.${day.id}.daily`; const d = currentSession[key] || {notes:'',knee:'',energy:''}; currentSession[key]=d;
  return `<div class="panel notes-grid"><textarea rows="4" data-daily="notes" placeholder="Daily notes, how the workout felt, machine issues, substitutions...">${escapeHtml(d.notes)}</textarea><input data-daily="knee" type="number" min="0" max="10" placeholder="Knee 0-10" value="${escapeHtml(d.knee)}"><input data-daily="energy" type="number" min="0" max="10" placeholder="Energy 0-10" value="${escapeHtml(d.energy)}"></div>`;
}
function wire(){
  $$('[data-day]').forEach(b=>b.onclick=()=>{activeDay=b.dataset.day;render();});
  $$('[data-view="history"]').forEach(b=>b.onclick=()=>renderHistory());
  $$('[data-view="weekly"]').forEach(b=>b.onclick=()=>renderWeekly());
  $$('[data-action="email"]').forEach(b=>b.onclick=()=>emailWorkout(dayById(activeDay)));
  $$('[data-action="finish"]').forEach(b=>b.onclick=()=>finishWorkout(dayById(activeDay)));
  $$('[data-action="print"]').forEach(b=>b.onclick=()=>window.print());
  $$('[data-action="clear-day"]').forEach(b=>b.onclick=()=>{ if(confirm('Clear today\'s entries for this day?')){ clearDay(dayById(activeDay)); render(); }});
  $$('[data-set-field]').forEach(input=>input.oninput=input.onchange=()=>updateSet(input));
  $$('[data-ex-note]').forEach(t=>t.oninput=()=>{ const ex=dayById(activeDay).exercises.find(e=>e.id===t.dataset.exNote); getExerciseState(activeDay, ex).notes=t.value; saveCurrent(); });
  $$('[data-daily]').forEach(x=>x.oninput=()=>{ const key=`${todayISO()}.${activeDay}.daily`; currentSession[key][x.dataset.daily]=x.value; saveCurrent(); });
  $$('[data-complete-ex]').forEach(c=>c.onchange=()=>{ const ex=dayById(activeDay).exercises.find(e=>e.id===c.dataset.completeEx); const st=getExerciseState(activeDay,ex); st.sets.forEach(s=>s.done=c.checked); saveCurrent(); render(); });
}
function updateSet(input){
  const ex = dayById(activeDay).exercises.find(e=>e.id===input.dataset.ex);
  const st = getExerciseState(activeDay, ex);
  const s = st.sets[parseInt(input.dataset.set,10)];
  if(input.dataset.setField==='done') s.done=input.checked; else s[input.dataset.setField]=input.value;
  saveCurrent();
  // lightweight update by saving; full re-render only on checkbox to refresh stats
  if(input.dataset.setField==='done') render();
}
function dailyData(day){ return currentSession[`${todayISO()}.${day.id}.daily`] || {}; }
function buildWorkoutLog(day){
  const entries = day.exercises.map(ex=>({ id:ex.id, name:ex.name, sets:getExerciseState(day.id,ex).sets.map((s,i)=>({set:i+1,weight:s.weight,reps:s.reps,done:!!s.done})), notes:getExerciseState(day.id,ex).notes||'' }));
  const totalVolume = entries.reduce((sum,e)=>sum+volumeForSets(e.sets),0);
  const setsDone = entries.reduce((sum,e)=>sum+e.sets.filter(s=>s.done).length,0);
  return {date:new Date().toISOString(), dayId:day.id, dayLabel:`${day.label}: ${day.title}`, durationMinutes:Math.max(1,Math.round((Date.now()-workoutStart)/60000)), totalVolume, setsDone, exercises:entries, daily:dailyData(day)};
}
function summaryText(log){
  const lines=[]; lines.push(`Jo's Program`); lines.push(`${log.dayLabel}`); lines.push(`Date: ${fmtDate(log.date)}`); lines.push(`Duration: ${log.durationMinutes} minutes`); lines.push(`Sets completed: ${log.setsDone}`); lines.push(`Total volume: ${Math.round(log.totalVolume).toLocaleString()} lb`); lines.push('');
  log.exercises.forEach(e=>{ lines.push(e.name); e.sets.forEach(s=>lines.push(`  Set ${s.set}: ${s.weight||'-'} lb x ${s.reps||'-'} reps ${s.done?'✓':''}`)); if(e.notes) lines.push(`  Notes: ${e.notes}`); lines.push(''); });
  lines.push('Daily Notes'); lines.push(`Knee: ${log.daily?.knee || '-'} / 10`); lines.push(`Energy: ${log.daily?.energy || '-'} / 10`); lines.push(log.daily?.notes || '-'); return lines.join('\n');
}
function finishWorkout(day){
  const log = buildWorkoutLog(day); const logs=loadLogs(); logs.push(log); saveLogs(logs); saveCurrent();
  $('#complete').innerHTML=`<div class="complete-card"><h2>Great Job, Jo!</h2><p>${escapeHtml(log.dayLabel)} complete.</p><div class="stats"><div class="stat"><b>${log.durationMinutes}</b><span>minutes</span></div><div class="stat"><b>${log.setsDone}</b><span>sets</span></div><div class="stat"><b>${Math.round(log.totalVolume).toLocaleString()}</b><span>volume</span></div><div class="stat"><b>✓</b><span>saved</span></div></div><button class="primary" id="emailDone">📧 Email Today's Workout</button> <button class="secondary" id="printDone">📄 Save/Print PDF</button> <button class="ghost" id="closeDone">Done</button><div class="report">${escapeHtml(summaryText(log))}</div></div>`;
  $('#complete').classList.remove('hidden'); $('#emailDone').onclick=()=>emailText(summaryText(log), log.dayLabel); $('#printDone').onclick=()=>window.print(); $('#closeDone').onclick=()=>{$('#complete').classList.add('hidden'); render();};
}
function emailWorkout(day){ const log=buildWorkoutLog(day); emailText(summaryText(log), log.dayLabel); }
function emailText(body, subject){ window.location.href=`mailto:?subject=${encodeURIComponent(`Jo's Program - ${subject}`)}&body=${encodeURIComponent(body)}`; }
function clearDay(day){ Object.keys(currentSession).filter(k=>k.startsWith(`${todayISO()}.${day.id}.`)).forEach(k=>delete currentSession[k]); saveCurrent(); }
function renderHistory(){
  const logs=loadLogs().slice().reverse();
  app.innerHTML=`<div class="topbar"><div class="nav"><button onclick="location.reload()">← Back</button></div></div><header class="hero"><div><p>Workout History</p><h1>Jo's Logs</h1><p>Saved on this device.</p></div><div class="portrait"><img src="assets/jo/jo-portrait.png"></div></header><section class="panel">${logs.length?logs.map(l=>`<details class="details"><summary>${fmtDate(l.date)} • ${escapeHtml(l.dayLabel)} • ${Math.round(l.totalVolume).toLocaleString()} lb</summary><div class="report">${escapeHtml(summaryText(l))}</div></details>`).join(''):'No saved workouts yet.'}</section>`;
}
function renderWeekly(){
  const logs=loadLogs(); const since=Date.now()-7*24*60*60*1000; const recent=logs.filter(l=>new Date(l.date).getTime()>=since);
  const text = [`Jo's Program Weekly Report`, `Generated: ${fmtDate(new Date())}`, '', `Workouts completed: ${recent.length}`, `Total sets: ${recent.reduce((s,l)=>s+l.setsDone,0)}`, `Total volume: ${Math.round(recent.reduce((s,l)=>s+l.totalVolume,0)).toLocaleString()} lb`, '', ...recent.map(l=>`${fmtDate(l.date)} - ${l.dayLabel} - ${l.setsDone} sets - ${Math.round(l.totalVolume).toLocaleString()} lb`) ].join('\n');
  app.innerHTML=`<div class="topbar"><div class="nav"><button onclick="location.reload()">← Back</button><button id="emailWeek">📧 Email Weekly Report</button><button onclick="window.print()">📄 PDF/Print</button></div></div><header class="hero"><div><p>Progress</p><h1>Weekly Report</h1><p>Simple summary for coaching review.</p></div><div class="portrait"><img src="assets/jo/jo-portrait.png"></div></header><section class="panel"><div class="report">${escapeHtml(text)}</div></section>`; $('#emailWeek').onclick=()=>emailText(text,'Weekly Report');
}
init();
