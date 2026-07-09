const STORE_PREFIX = 'jos.v3.';
let PROGRAM = null;
let currentView = 'home';
let currentDay = 'mon';

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const app = document.getElementById('app');

function todayKey(){ return new Date().toISOString().slice(0,10); }
function niceDate(d=new Date()){ return d.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'}); }
function storageKey(...parts){ return STORE_PREFIX + parts.join('.'); }
function getJSON(key, fallback){ try{return JSON.parse(localStorage.getItem(key)) ?? fallback}catch{return fallback} }
function setJSON(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
function toast(msg){ let t=$('.toast'); if(!t){t=document.createElement('div');t.className='toast';document.body.appendChild(t)} t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800); }

async function loadProgram(){
  const res = await fetch('data/data.json', {cache:'no-store'}).catch(()=>fetch('data.json',{cache:'no-store'}));
  PROGRAM = await res.json();
  renderShell();
  renderHome();
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('service-worker.js').catch(()=>{}); }
}

function renderShell(){
  app.innerHTML = `<div class="app">
    <header class="topbar">
      <div class="brand"><img src="assets/jo/jo-portrait.png" alt="Jo"><div><h1>${PROGRAM.appTitle}</h1><p>${PROGRAM.subtitle}</p></div></div>
      <div class="top-actions">
        <button class="tab" data-view="home">Home</button>
        ${PROGRAM.days.map(d=>`<button class="tab" data-day="${d.id}">${d.label}</button>`).join('')}
        <button class="tab" data-view="history">History</button>
        <button class="tab" data-view="weekly">Weekly Report</button>
        <button class="tab" data-view="settings">Settings</button>
      </div>
    </header>
    <main id="main"></main>
  </div>
  <nav class="bottom-nav"><div class="bottom-inner">
    <button class="navbtn" data-view="home">Home</button>
    <button class="navbtn" data-day="mon">Mon</button>
    <button class="navbtn" data-day="tue">Tue</button>
    <button class="navbtn" data-day="thu">Thu</button>
    <button class="navbtn" data-day="fri">Fri</button>
  </div></nav>`;
  document.body.addEventListener('click', handleClick);
}

function handleClick(e){
  const dayBtn = e.target.closest('[data-day]');
  if(dayBtn){ currentDay = dayBtn.dataset.day; renderWorkout(currentDay); return; }
  const viewBtn = e.target.closest('[data-view]');
  if(viewBtn){ const v=viewBtn.dataset.view; if(v==='home') renderHome(); if(v==='history') renderHistory(); if(v==='weekly') renderWeekly(); if(v==='settings') renderSettings(); return; }
  const detail = e.target.closest('[data-detail]');
  if(detail){ const card = detail.closest('.exercise'); $('.details', card)?.classList.toggle('open'); return; }
  const email = e.target.closest('[data-email]'); if(email){ emailWorkout(email.dataset.email); return; }
  const finish = e.target.closest('[data-finish]'); if(finish){ finishWorkout(finish.dataset.finish); return; }
  const print = e.target.closest('[data-print]'); if(print){ window.print(); return; }
  const clear = e.target.closest('[data-clear-day]'); if(clear){ clearDay(clear.dataset.clearDay); return; }
  const saveSettings = e.target.closest('[data-save-settings]'); if(saveSettings){ saveSettingsForm(); return; }
  const exportBtn = e.target.closest('[data-export]'); if(exportBtn){ exportData(); return; }
  const importBtn = e.target.closest('[data-import]'); if(importBtn){ $('#importFile')?.click(); return; }
}

function setActive(){
  $$('.tab,.navbtn').forEach(b=>b.classList.remove('active'));
  if(currentView==='home') $$('[data-view="home"]').forEach(b=>b.classList.add('active'));
  if(currentView==='history') $$('[data-view="history"]').forEach(b=>b.classList.add('active'));
  if(currentView==='weekly') $$('[data-view="weekly"]').forEach(b=>b.classList.add('active'));
  $$(`[data-day="${currentDay}"]`).forEach(b=>{ if(currentView==='workout') b.classList.add('active'); });
}

function getDay(id){ return PROGRAM.days.find(d=>d.id===id); }
function getWorkoutDraft(dayId, date=todayKey()){ return getJSON(storageKey('draft', date, dayId), null); }
function saveWorkoutDraft(dayId, data, date=todayKey()){ setJSON(storageKey('draft', date, dayId), data); }
function getExerciseDraft(dayId, exId){ const draft=getWorkoutDraft(dayId)||{}; return draft[exId] || {}; }
function history(){ return getJSON(storageKey('history'), []); }
function saveHistory(items){ setJSON(storageKey('history'), items); }

function renderHome(){
  currentView='home'; setActive();
  const main=$('#main'); const completedThisWeek = history().filter(h=>isThisWeek(new Date(h.completedAt))).length;
  main.innerHTML=`<section class="hero">
    <div class="panel"><h2 class="hero-title">Good work starts with showing up.</h2><p class="small">Open today's workout, track every set, and email the summary when finished.</p>
      <div class="stats"><div class="stat"><b>${completedThisWeek}</b><span class="small">workouts this week</span></div><div class="stat"><b>${history().length}</b><span class="small">saved sessions</span></div><div class="stat"><b>V3</b><span class="small">complete app</span></div></div>
    </div>
    <div class="panel"><h3 class="section-title" style="margin-top:0">Quick Start</h3><button class="btn primary" data-day="${suggestedDay()}">Start Today's Workout</button><p class="small">Today: ${niceDate()}</p><p class="small">All entries save automatically on this device.</p></div>
  </section>
  <section><h3 class="section-title">Workout Days</h3><div class="day-grid">${PROGRAM.days.map(d=>`<div class="day-card" data-day="${d.id}"><h3>${d.label}</h3><p>${d.title}</p><span class="chip">${d.theme}</span></div>`).join('')}</div></section>`;
}

function suggestedDay(){ const n=new Date().getDay(); return n===2?'tue':n===4?'thu':n===5?'fri':'mon'; }
function isThisWeek(date){ const now=new Date(); const start=new Date(now); start.setDate(now.getDate()-now.getDay()); start.setHours(0,0,0,0); return date>=start; }

function renderWorkout(dayId){
  currentView='workout'; currentDay=dayId; setActive(); const day=getDay(dayId); const main=$('#main');
  main.innerHTML=`<section class="workout-head"><div><h2>${day.label}: ${day.title}</h2><p class="small">${day.theme}</p></div><div class="email-bar"><button class="btn gold" data-email="${day.id}">📧 Email Today's Workout</button><button class="btn green" data-finish="${day.id}">✅ Finish Workout</button><button class="btn" data-print>Print / Save PDF</button></div></section>
  <section class="panel"><h3 class="section-title" style="margin-top:0">Warm-Up</h3><div class="chips">${day.warmup.map(w=>`<span class="chip">${w}</span>`).join('')}</div></section>
  <h3 class="section-title">Main Workout</h3>
  ${day.exercises.map((ex,i)=>exerciseCard(day,ex,i)).join('')}
  <section class="panel"><h3 class="section-title" style="margin-top:0">Daily Notes</h3><textarea class="notes" data-notes="${day.id}" placeholder="How did the workout feel? Knee status? Energy level? Anything Matt should know?">${escapeHtml((getWorkoutDraft(day.id)||{})._notes||'')}</textarea><div class="email-bar" style="margin-top:12px"><button class="btn green" data-finish="${day.id}">✅ Finish Workout</button><button class="btn gold" data-email="${day.id}">📧 Email Today's Workout</button><button class="btn" data-print>Print / Save PDF</button><button class="btn red" data-clear-day="${day.id}">Clear Today</button></div></section>
  <section class="panel"><h3 class="section-title" style="margin-top:0">Cool-Down</h3><div class="chips">${day.cooldown.map(c=>`<span class="chip">${c}</span>`).join('')}</div></section>`;
  wireInputs(day.id);
}

function exerciseCard(day, ex, idx){
  const previous = lastExerciseHistory(ex.id);
  const sets = Array.from({length: ex.sets}, (_,i)=>i+1);
  const d = getExerciseDraft(day.id, ex.id);
  return `<article class="exercise" data-exercise="${ex.id}">
    <div class="exercise-img"><img src="${ex.image}" alt="${escapeHtml(ex.name)}"></div>
    <div class="exercise-body"><div class="exercise-top"><div><h3>${idx+1}. ${ex.name}</h3><p class="small">${ex.cues[0]||''}</p></div><div class="badges"><div class="badge">${ex.sets}<span>sets</span></div><div class="badge">${ex.repRange}<span>reps</span></div></div></div>
    <div class="prev"><b>Last time:</b> ${previous ? previousSummary(previous, ex.id) : 'no saved workout yet'}</div>
    <table class="set-table"><thead><tr><th>Set</th><th>Weight</th><th>Reps</th><th>Done</th></tr></thead><tbody>
      ${sets.map(s=>`<tr><td>Set ${s}</td><td><input inputmode="decimal" type="number" min="0" step="any" data-field="weight" data-day="${day.id}" data-ex="${ex.id}" data-set="${s}" value="${d?.sets?.[s-1]?.weight||''}" placeholder="lbs"></td><td><input inputmode="numeric" type="text" data-field="reps" data-day="${day.id}" data-ex="${ex.id}" data-set="${s}" value="${d?.sets?.[s-1]?.reps||''}" placeholder="reps"></td><td><input class="check" type="checkbox" data-field="done" data-day="${day.id}" data-ex="${ex.id}" data-set="${s}" ${d?.sets?.[s-1]?.done?'checked':''}></td></tr>`).join('')}
    </tbody></table>
    <div class="exercise-actions"><button class="btn" data-detail>Exercise Details</button><a class="btn" href="${ex.video}" target="_blank" rel="noopener">▶ Demo Video</a></div>
    <div class="details"><div class="details-grid"><div class="detail-box"><h4>Coaching Cues</h4><ul>${ex.cues.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div><div class="detail-box"><h4>Common Mistakes</h4><ul>${ex.mistakes.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div><div class="detail-box"><h4>Alternatives</h4><ul>${ex.alternatives.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div></div><div class="detail-box" style="margin-top:12px"><h4>Matt's Tip</h4><p class="small">${escapeHtml(ex.tip)}</p></div></div>
    </div></article>`;
}

function wireInputs(dayId){
  $$('input[data-field]').forEach(input=>input.addEventListener('input',()=>updateDraftFromInputs(dayId)));
  $$('input[type="checkbox"][data-field]').forEach(input=>input.addEventListener('change',()=>updateDraftFromInputs(dayId)));
  $$('textarea[data-notes]').forEach(t=>t.addEventListener('input',()=>updateDraftFromInputs(dayId)));
}
function updateDraftFromInputs(dayId){
  const draft = {};
  getDay(dayId).exercises.forEach(ex=>{ draft[ex.id]={sets:[]}; for(let i=1;i<=ex.sets;i++){ draft[ex.id].sets.push({weight:$(`[data-day="${dayId}"][data-ex="${ex.id}"][data-set="${i}"][data-field="weight"]`)?.value||'', reps:$(`[data-day="${dayId}"][data-ex="${ex.id}"][data-set="${i}"][data-field="reps"]`)?.value||'', done:$(`[data-day="${dayId}"][data-ex="${ex.id}"][data-set="${i}"][data-field="done"]`)?.checked||false}); } });
  draft._notes = $(`textarea[data-notes="${dayId}"]`)?.value || '';
  saveWorkoutDraft(dayId,draft); 
}
function lastExerciseHistory(exId){ const items=history().slice().reverse(); return items.find(w=>w.exercises?.some(e=>e.id===exId)); }
function previousSummary(item, exId){ const ex=item.exercises.find(e=>e.id===exId); const sets=ex.sets.filter(s=>s.weight||s.reps); if(!sets.length) return `${new Date(item.completedAt).toLocaleDateString()} - no set data`; return `${new Date(item.completedAt).toLocaleDateString()} - `+sets.map((s,i)=>`S${i+1}: ${s.weight||'?'} x ${s.reps||'?'}`).join(', '); }
function workoutVolume(dayId){ const draft=getWorkoutDraft(dayId)||{}; let vol=0; Object.values(draft).forEach(ex=>{ if(!ex?.sets) return; ex.sets.forEach(s=>{ const w=parseFloat(s.weight); const r=parseFloat(s.reps); if(!isNaN(w)&&!isNaN(r)) vol+=w*r; }); }); return Math.round(vol); }
function completion(dayId){ const day=getDay(dayId); const draft=getWorkoutDraft(dayId)||{}; let done=0,total=0; day.exercises.forEach(ex=>{ for(let i=0;i<ex.sets;i++){ total++; if(draft?.[ex.id]?.sets?.[i]?.done) done++; }}); return {done,total}; }
function buildWorkoutRecord(dayId){ updateDraftFromInputs(dayId); const day=getDay(dayId); const draft=getWorkoutDraft(dayId)||{}; return {id:crypto.randomUUID?crypto.randomUUID():String(Date.now()), dayId, dayLabel:day.label, title:day.title, completedAt:new Date().toISOString(), volume:workoutVolume(dayId), completion:completion(dayId), notes:draft._notes||'', exercises:day.exercises.map(ex=>({id:ex.id,name:ex.name,sets:(draft[ex.id]?.sets||[])}))}; }
function finishWorkout(dayId){ const rec=buildWorkoutRecord(dayId); const items=history(); items.push(rec); saveHistory(items); toast('Workout saved'); renderWorkout(dayId); setTimeout(()=>alert(`Great job, Jo!\n\n${rec.dayLabel}: ${rec.title} saved.\nCompleted sets: ${rec.completion.done}/${rec.completion.total}\nEstimated volume: ${rec.volume.toLocaleString()} lb\n\nUse the Email button to send today's workout.`),80); }
function emailWorkout(dayId){ const rec=buildWorkoutRecord(dayId); const settings=getJSON(storageKey('settings'),{}); const to=settings.emailTo||''; const cc=settings.emailCc||''; const subject=`Jo's Program - ${rec.dayLabel} ${rec.title} - ${new Date(rec.completedAt).toLocaleDateString()}`; const body=workoutText(rec); let url=`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; if(cc) url += `&cc=${encodeURIComponent(cc)}`; window.location.href=url; }
function workoutText(rec){ return `Jo's Program\n${rec.dayLabel}: ${rec.title}\n${niceDate(new Date(rec.completedAt))}\n\nCompleted Sets: ${rec.completion.done}/${rec.completion.total}\nEstimated Volume: ${rec.volume.toLocaleString()} lb\n\n` + rec.exercises.map(ex=>`${ex.name}\n${ex.sets.map((s,i)=>`  Set ${i+1}: ${s.weight||'-'} lb x ${s.reps||'-'} reps ${s.done?'[done]':''}`).join('\n')}`).join('\n\n') + `\n\nNotes:\n${rec.notes||'-'}\n`; }
function clearDay(dayId){ if(confirm('Clear today\'s entries for this workout?')){ localStorage.removeItem(storageKey('draft',todayKey(),dayId)); renderWorkout(dayId); } }

function renderHistory(){ currentView='history'; setActive(); const items=history().slice().reverse(); $('#main').innerHTML=`<section class="panel"><h2 class="hero-title">Workout History</h2><p class="small">Saved sessions from this device.</p>${items.length?items.map(i=>`<div class="history-item"><b>${i.dayLabel}: ${i.title}</b><p class="small">${niceDate(new Date(i.completedAt))} • ${i.completion.done}/${i.completion.total} sets • ${i.volume.toLocaleString()} lb</p><pre style="white-space:pre-wrap;font-size:12px">${escapeHtml(workoutText(i))}</pre></div>`).join(''):'<p>No saved workouts yet.</p>'}</section>`; }
function renderWeekly(){ currentView='weekly'; setActive(); const items=history().filter(h=>isThisWeek(new Date(h.completedAt))); const vol=items.reduce((a,b)=>a+(b.volume||0),0); $('#main').innerHTML=`<section class="panel"><h2 class="hero-title">Weekly Report</h2><p class="small">This week's saved workout summary.</p><div class="stats"><div class="stat"><b>${items.length}</b><span class="small">workouts</span></div><div class="stat"><b>${vol.toLocaleString()}</b><span class="small">estimated lb</span></div><div class="stat"><b>${Math.round((items.length/4)*100)}%</b><span class="small">weekly target</span></div></div><div class="email-bar" style="margin-top:14px"><button class="btn" data-print>Print / Save PDF</button></div>${items.map(i=>`<div class="history-item"><b>${i.dayLabel}: ${i.title}</b><p class="small">${niceDate(new Date(i.completedAt))} • ${i.volume.toLocaleString()} lb</p></div>`).join('')}</section>`; }
function renderSettings(){ currentView='settings'; setActive(); const s=getJSON(storageKey('settings'),{}); $('#main').innerHTML=`<section class="panel"><h2 class="hero-title">Settings</h2><p class="small">Optional email defaults and data backup.</p><label class="small"><b>Email To</b></label><input class="notes" style="min-height:0" id="emailTo" value="${escapeHtml(s.emailTo||'')}" placeholder="jo@example.com"><label class="small"><b>Email CC</b></label><input class="notes" style="min-height:0" id="emailCc" value="${escapeHtml(s.emailCc||'')}" placeholder="matt@example.com"><div class="email-bar" style="margin-top:12px"><button class="btn primary" data-save-settings>Save Settings</button><button class="btn" data-export>Export Backup</button><button class="btn" data-import>Import Backup</button><input type="file" id="importFile" accept="application/json" style="display:none"></div></section>`; $('#importFile').addEventListener('change', importData); }
function saveSettingsForm(){ setJSON(storageKey('settings'),{emailTo:$('#emailTo').value,emailCc:$('#emailCc').value}); toast('Settings saved'); }
function exportData(){ const data={settings:getJSON(storageKey('settings'),{}),history:history()}; const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`jos-program-backup-${todayKey()}.json`; a.click(); URL.revokeObjectURL(a.href); }
function importData(e){ const file=e.target.files[0]; if(!file) return; const r=new FileReader(); r.onload=()=>{ try{ const data=JSON.parse(r.result); if(data.settings) setJSON(storageKey('settings'),data.settings); if(data.history) saveHistory(data.history); toast('Backup imported'); renderSettings(); }catch{ alert('Could not import that file.'); }}; r.readAsText(file); }
function escapeHtml(str){ return String(str??'').replace(/[&<>'"]/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }

loadProgram().catch(err=>{ app.innerHTML=`<div class="loading-card"><b>Could not load Jo's Program.</b><p>${escapeHtml(err.message)}</p></div>`; });
