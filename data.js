const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const LS = {
  get(k, fallback=null){ try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); },
  remove(k){ localStorage.removeItem(k); }
};
const dayOrder = ['monday','tuesday','wednesday','thursday','friday'];
let currentDay = suggestedDay();
let sessionStart = Date.now();

function suggestedDay(){
  const d = new Date().getDay();
  return {1:'monday',2:'tuesday',3:'wednesday',4:'thursday',5:'friday'}[d] || 'monday';
}
function todayKey(){ return new Date().toISOString().slice(0,10); }
function entryKey(dayId, exId, setNo, field){ return `jp3.entry.${todayKey()}.${dayId}.${exId}.${setNo}.${field}`; }
function notesKey(dayId){ return `jp3.notes.${todayKey()}.${dayId}`; }
function doneKey(dayId, exId){ return `jp3.done.${todayKey()}.${dayId}.${exId}`; }
function history(){ return LS.get('jp3.history', []); }
function saveHistory(list){ LS.set('jp3.history', list.slice(-500)); }
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function mailto(to, subject, body){ window.location.href = `mailto:${encodeURIComponent(to||'')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; }

function render(){
  const root = $('#root');
  root.innerHTML = `<main class="app">
    ${hero()}
    ${tabs()}
    <div class="layout">
      <div>${workoutPanel()}${exerciseList()}</div>
      <aside class="side">${sidePanel()}</aside>
    </div>
  </main>
  ${bottomNav()}
  ${modal()}
  <div class="print-only" id="printArea"></div>`;
  wire(); updateMetrics();
}
function hero(){
  const h = history();
  const week = workoutsThisWeek(h).length;
  const total = h.length;
  const last = h[0]?.date || 'Not yet';
  return `<section class="hero">
    <div class="hero-top"><div><div class="version">Jo's Program v${PROGRAM_VERSION} • Personal Training App</div><h1>Strong for Life</h1><p>Set-by-set training log, workout history, email summaries, weekly reports, and coaching notes built specifically for Jo.</p></div><img class="portrait" src="icon-180.png" alt="Jo"></div>
    <div class="dash">
      <div class="metric"><b id="mComplete">0%</b><span>today complete</span></div>
      <div class="metric"><b>${week}/4</b><span>this week</span></div>
      <div class="metric"><b>${total}</b><span>saved workouts</span></div>
      <div class="metric"><b>${last}</b><span>last workout</span></div>
    </div>
  </section>`;
}
function tabs(){ return `<nav class="day-tabs">${dayOrder.map(d=>`<button class="tab ${d===currentDay?'active':''}" data-day="${d}">${WORKOUTS[d].label}</button>`).join('')}</nav>`; }
function workoutPanel(){
  const d = WORKOUTS[currentDay];
  return `<section class="panel">
    <div class="workout-head"><div><h2>${d.label}: ${d.title}</h2><p>${d.subtitle}</p></div><div class="primary-actions"><button class="btn" id="emailTop">📧 Email Workout</button><button class="btn secondary" id="printTop">📄 PDF / Print</button></div></div>
    <div class="section-title"><h3>Warm-Up</h3><span class="hint">Practical and easy</span></div><ul class="mini-list">${d.warmup.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
  </section>`;
}
function exerciseList(){
  const d = WORKOUTS[currentDay];
  return `<section class="panel"><div class="section-title"><h3>Main Workout</h3><span class="hint">Every set auto-saves</span></div>${d.exercises.map((ex,i)=>exerciseCard(ex,i+1)).join('')}</section>`;
}
function exerciseCard(ex, n){
  const checked = LS.get(doneKey(currentDay, ex.id), false) ? 'checked' : '';
  const prev = previousExercise(currentDay, ex.id);
  return `<article class="workout-card exercise" data-ex="${ex.id}">
    <div class="exercise-art">${art(ex.type)}</div>
    <div class="exercise-main">
      <div class="ex-top"><div class="ex-title"><input class="check ex-done" type="checkbox" ${checked} aria-label="complete ${esc(ex.name)}"><div><h3 class="ex-name">${n}. ${esc(ex.name)}</h3><div class="sub">${esc(ex.sub)}</div></div></div><div class="badges"><div class="badge">${ex.sets}<small>sets</small></div><div class="badge">${esc(ex.reps)}<small>reps</small></div></div></div>
      <ul class="cue-list">${ex.cues.slice(0,3).map(c=>`<li>${esc(c)}</li>`).join('')}</ul>
      ${setTable(ex)}
      <div class="previous"><b>Previous workout:</b> ${prev ? prevSummary(prev, ex) : 'no saved workout yet'}</div>
      <details class="details"><summary>Exercise Details</summary><div class="detail-body">
        <div class="detail-box"><h4>📷 Exercise Image</h4>${art(ex.type)}<p class="sub">Visual example only. Use the safest machine/setup available.</p></div>
        <div class="detail-box"><h4>🎥 Demonstration Video</h4><div class="video-slot">Optional demo video slot<br><small>Use gym trainer guidance or add a trusted video later.</small></div></div>
        <div class="detail-box"><h4>📝 Coaching Cues</h4><ul>${ex.cues.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></div>
        <div class="detail-box"><h4>⚠️ Common Mistakes</h4><ul>${ex.mistakes.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></div>
        <div class="detail-box"><h4>🔄 Alternatives</h4><ul>${ex.alternatives.map(c=>`<li>${esc(c)}</li>`).join('')}</ul></div>
        <div class="detail-box"><h4>📈 Matt's Tip</h4><p>${esc(ex.tip)}</p></div>
      </div></details>
    </div>
  </article>`;
}
function setTable(ex){
  let rows = '';
  for(let i=1;i<=ex.sets;i++){
    const w = LS.get(entryKey(currentDay, ex.id, i, 'weight'), '');
    const r = LS.get(entryKey(currentDay, ex.id, i, 'reps'), '');
    const dn = LS.get(entryKey(currentDay, ex.id, i, 'done'), false) ? 'checked' : '';
    rows += `<div class="set-row"><label>Set ${i}</label><input inputmode="decimal" placeholder="lbs" data-field="weight" data-set="${i}" value="${esc(w)}"><input inputmode="numeric" placeholder="reps" data-field="reps" data-set="${i}" value="${esc(r)}"><div class="done-cell"><input class="small-check" type="checkbox" data-field="done" data-set="${i}" ${dn}></div></div>`;
  }
  return `<div class="set-table"><div class="set-head"><div>Set</div><div>Weight</div><div>Reps</div><div>Done</div></div>${rows}</div>`;
}
function sidePanel(){
  const d = WORKOUTS[currentDay];
  return `<div class="side-card complete-card"><h3>Finish Today's Workout</h3><div class="completion"><div class="progressbar"><div class="progressfill" id="progressfill"></div></div><div id="progressText" class="sub">0 exercises complete</div><button class="btn success big" id="finishBtn">✅ Finish Workout</button><button class="btn big" id="emailSide">📧 Email Today's Workout</button><button class="btn secondary big" id="printSide">📄 Save as PDF / Print</button></div></div>
  <div class="side-card"><h3>Daily Notes</h3><textarea class="notes" id="dayNotes" placeholder="How did today feel? Knee comfort, energy, wins, anything to remember...">${esc(LS.get(notesKey(currentDay),''))}</textarea></div>
  <div class="side-card"><h3>Cool-Down</h3><ul class="mini-list">${d.cooldown.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
  <div class="side-card"><h3>Weekly Report</h3><button class="btn big" id="weeklyEmail">📧 Email Weekly Report</button><div class="history-list" id="weekList">${weekList()}</div></div>
  <div class="side-card"><h3>History</h3><div class="history-list">${recentHistory()}</div></div>`;
}
function weekList(){
  const wk = workoutsThisWeek(history());
  if(!wk.length) return '<div class="sub">No workouts saved this week yet.</div>';
  return wk.map(h=>`<div class="history-item"><b>${esc(h.dayLabel)}</b><br>${esc(h.date)} • ${h.completed}/${h.total} exercises</div>`).join('');
}
function recentHistory(){
  const h = history().slice(0,5);
  if(!h.length) return '<div class="sub">No saved workouts yet.</div>';
  return h.map(x=>`<div class="history-item"><b>${esc(x.dayLabel)}</b><br>${esc(x.date)} • ${x.completed}/${x.total} • ${x.volume.toLocaleString()} lbs</div>`).join('');
}
function bottomNav(){ return `<nav class="bottom-nav"><div class="bottom-nav-inner">${dayOrder.filter(d=>d!=='wednesday').map(d=>`<button class="navbtn ${d===currentDay?'active':''}" data-day="${d}">${WORKOUTS[d].label}</button>`).join('')}</div></nav>`; }
function modal(){ return `<div class="modal" id="completeModal"><div class="modal-card"><div class="modal-head"><h2>🎉 Great Job, Jo!</h2><button class="close" id="closeModal">×</button></div><div id="modalBody"></div></div></div>`; }
function art(type){
  const base=`<svg viewBox="0 0 120 120" role="img" aria-hidden="true"><rect x="10" y="94" width="100" height="6" rx="3" fill="#d8d2de"/>`;
  const map={
    press:`${base}<circle cx="60" cy="38" r="10" fill="#4b257d"/><path d="M60 48v34M38 82h44M42 55h-20M78 55h20" stroke="#25304a" stroke-width="6" stroke-linecap="round"/><path d="M28 55v35M92 55v35" stroke="#b9adc9" stroke-width="6" stroke-linecap="round"/><path d="M40 55l18 10M80 55L62 65" stroke="#8c5bc2" stroke-width="6" stroke-linecap="round"/></svg>`,
    row:`${base}<circle cx="44" cy="38" r="9" fill="#4b257d"/><path d="M42 48l-10 34h36l-8-24" stroke="#25304a" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M66 58h28" stroke="#8c5bc2" stroke-width="7" stroke-linecap="round"/><path d="M72 48l20 10" stroke="#25304a" stroke-width="5" stroke-linecap="round"/></svg>`,
    legpress:`${base}<circle cx="34" cy="72" r="8" fill="#536077"/><path d="M38 70l24-24 24 16" stroke="#25304a" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M64 46l28-20M84 64l26-22" stroke="#8c5bc2" stroke-width="7" stroke-linecap="round"/></svg>`,
    hinge:`${base}<circle cx="55" cy="34" r="9" fill="#4b257d"/><path d="M54 44l16 27M69 71l-22 22M69 71h22" stroke="#25304a" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M42 60h58" stroke="#8c5bc2" stroke-width="5" stroke-linecap="round"/></svg>`,
    glute:`${base}<circle cx="48" cy="54" r="9" fill="#4b257d"/><path d="M30 76h56M50 62l24 14M30 76l20-14" stroke="#25304a" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M20 76h78" stroke="#b9adc9" stroke-width="5" stroke-linecap="round"/></svg>`,
    curl_leg:`${base}<circle cx="44" cy="40" r="9" fill="#4b257d"/><path d="M44 50v32h30M75 82l20 10" stroke="#25304a" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M24 82h66" stroke="#b9adc9" stroke-width="6" stroke-linecap="round"/></svg>`,
    extension:`${base}<circle cx="44" cy="38" r="9" fill="#4b257d"/><path d="M44 48v32h36M80 80h26" stroke="#25304a" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M26 80h58" stroke="#b9adc9" stroke-width="6" stroke-linecap="round"/></svg>`,
    calf:`${base}<circle cx="58" cy="36" r="9" fill="#4b257d"/><path d="M58 46v36M58 82l-18 16M58 82l24 16" stroke="#25304a" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M38 98h48" stroke="#8c5bc2" stroke-width="6" stroke-linecap="round"/></svg>`,
    pulldown:`${base}<circle cx="60" cy="52" r="9" fill="#4b257d"/><path d="M30 28h60M60 62v28M42 62l-12-22M78 62l12-22" stroke="#25304a" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M30 28v12M90 28v12" stroke="#8c5bc2" stroke-width="5"/></svg>`,
    curl:`${base}<circle cx="60" cy="40" r="9" fill="#4b257d"/><path d="M60 50v32M45 64l-14 18M75 64l14 18" stroke="#25304a" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M28 83h18M74 83h18" stroke="#8c5bc2" stroke-width="6" stroke-linecap="round"/></svg>`,
    triceps:`${base}<circle cx="60" cy="38" r="9" fill="#4b257d"/><path d="M60 48v34M46 58l-18 20M74 58l18 20" stroke="#25304a" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M30 78l-8 12M90 78l8 12" stroke="#8c5bc2" stroke-width="6" stroke-linecap="round"/></svg>`,
    shoulder:`${base}<circle cx="60" cy="46" r="9" fill="#4b257d"/><path d="M60 56v30M44 66l-22 14M76 66l22 14" stroke="#25304a" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M22 80l-8-8M98 80l8-8" stroke="#8c5bc2" stroke-width="5" stroke-linecap="round"/></svg>`,
    carry:`${base}<circle cx="60" cy="34" r="9" fill="#4b257d"/><path d="M60 44v40M48 58l-16 24M72 58l16 24M48 84l-12 14M72 84l18 14" stroke="#25304a" stroke-width="6" fill="none" stroke-linecap="round"/><rect x="20" y="80" width="18" height="18" rx="3" fill="#8c5bc2"/><rect x="82" y="80" width="18" height="18" rx="3" fill="#8c5bc2"/></svg>`,
    walk:`${base}<circle cx="60" cy="36" r="9" fill="#4b257d"/><path d="M60 46v26M60 72l-18 24M60 72l24 24M60 54l-18 8M60 54l18 8" stroke="#25304a" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`,
    rower:`${base}<circle cx="52" cy="50" r="9" fill="#4b257d"/><path d="M52 60l22 20H34M74 80l22-18M32 88h68" stroke="#25304a" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`
  };
  return map[type] || map.press;
}
function wire(){
  $$('[data-day]').forEach(b=>b.addEventListener('click',()=>{ currentDay=b.dataset.day; sessionStart=Date.now(); render(); window.scrollTo({top:0,behavior:'smooth'}); }));
  $$('.exercise').forEach(card=>{
    const exId = card.dataset.ex;
    $('.ex-done',card).addEventListener('change',e=>{ LS.set(doneKey(currentDay,exId),e.target.checked); updateMetrics(); });
    $$('[data-field]',card).forEach(inp=>inp.addEventListener('input',e=>{ const set=e.target.dataset.set, field=e.target.dataset.field; const val = field==='done' ? e.target.checked : e.target.value; LS.set(entryKey(currentDay,exId,set,field), val); updateMetrics(); }));
  });
  $('#dayNotes')?.addEventListener('input',e=>LS.set(notesKey(currentDay),e.target.value));
  $('#finishBtn').addEventListener('click',finishWorkout);
  ['emailTop','emailSide'].forEach(id=>$('#'+id).addEventListener('click',()=>emailWorkout(false)));
  ['printTop','printSide'].forEach(id=>$('#'+id).addEventListener('click',printWorkout));
  $('#weeklyEmail').addEventListener('click',emailWeeklyReport);
  $('#closeModal').addEventListener('click',()=>$('#completeModal').classList.remove('show'));
}
function updateMetrics(){
  const d=WORKOUTS[currentDay]; let total=d.exercises.length, done=0;
  d.exercises.forEach(ex=>{ if(LS.get(doneKey(currentDay,ex.id), false)) done++; });
  const pct = total ? Math.round(done/total*100) : 0;
  $('#mComplete').textContent = pct+'%'; $('#progressfill').style.width=pct+'%'; $('#progressText').textContent = `${done} of ${total} exercises complete`;
}
function snapshot(){
  const d=WORKOUTS[currentDay]; const exercises=d.exercises.map(ex=>{ const sets=[]; for(let i=1;i<=ex.sets;i++){ sets.push({set:i, weight:LS.get(entryKey(currentDay,ex.id,i,'weight'),''), reps:LS.get(entryKey(currentDay,ex.id,i,'reps'),''), done:LS.get(entryKey(currentDay,ex.id,i,'done'),false)}); } return {id:ex.id,name:ex.name,sets}; });
  const completed = d.exercises.filter(ex=>LS.get(doneKey(currentDay,ex.id),false)).length;
  return {id:crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), date:todayKey(), savedAt:new Date().toLocaleString(), dayId:currentDay, dayLabel:`${d.label}: ${d.title}`, completed, total:d.exercises.length, durationMin:Math.max(1,Math.round((Date.now()-sessionStart)/60000)), volume:calcVolume(exercises), notes:LS.get(notesKey(currentDay),''), exercises};
}
function calcVolume(exercises){ let v=0; exercises.forEach(ex=>ex.sets.forEach(s=>{ const w=parseFloat(String(s.weight).replace(/[^0-9.]/g,'')); const r=parseFloat(String(s.reps).replace(/[^0-9.]/g,'')); if(!isNaN(w)&&!isNaN(r)) v+=w*r; })); return Math.round(v); }
function finishWorkout(){
  const snap=snapshot(); const h=history(); h.unshift(snap); saveHistory(h);
  $('#modalBody').innerHTML = `<p><b>${esc(snap.dayLabel)}</b> complete.</p><div class="dash"><div class="metric"><b>${snap.completed}/${snap.total}</b><span>exercises</span></div><div class="metric"><b>${snap.durationMin}</b><span>minutes</span></div><div class="metric"><b>${snap.volume.toLocaleString()}</b><span>lbs volume</span></div><div class="metric"><b>${snap.date}</b><span>date</span></div></div><button class="btn big" id="modalEmail">📧 Email Today's Workout</button><button class="btn secondary big" id="modalPrint">📄 Save as PDF / Print</button>`;
  $('#completeModal').classList.add('show');
  $('#modalEmail').addEventListener('click',()=>emailWorkout(true, snap)); $('#modalPrint').addEventListener('click',()=>printWorkout(snap)); render(); $('#completeModal').classList.add('show');
}
function previousExercise(dayId, exId){
  for(const h of history()){ if(h.dayId===dayId){ const ex=h.exercises.find(e=>e.id===exId); if(ex) return {date:h.date, ex}; } } return null;
}
function prevSummary(prev){ return `${prev.date}: ` + prev.ex.sets.filter(s=>s.weight||s.reps).map(s=>`Set ${s.set} ${s.weight||'-'} × ${s.reps||'-'}`).join(', '); }
function workoutText(snap=snapshot()){
  let lines=[`Jo's Program`, snap.dayLabel, `Date: ${snap.date}`, `Duration: ${snap.durationMin} minutes`, `Completed: ${snap.completed}/${snap.total} exercises`, `Total Volume: ${snap.volume.toLocaleString()} lbs`, ''];
  snap.exercises.forEach(ex=>{ lines.push(ex.name); ex.sets.forEach(s=>lines.push(`  Set ${s.set}: ${s.weight||'-'} lbs x ${s.reps||'-'} reps ${s.done?'(done)':''}`)); lines.push(''); });
  if(snap.notes){ lines.push('Daily Notes:', snap.notes, ''); }
  lines.push('Sent from Jo\'s Program v3.0'); return lines.join('\n');
}
function emailWorkout(saveFirst=false, snap=null){ if(saveFirst&&!snap){ snap=snapshot(); const h=history(); h.unshift(snap); saveHistory(h); } snap = snap || snapshot(); mailto('', `Jo's Program - ${snap.dayLabel} - ${snap.date}`, workoutText(snap)); }
function printWorkout(snap=null){ snap=snap||snapshot(); $('#printArea').innerHTML = `<h1>Jo's Program</h1><h2>${esc(snap.dayLabel)} - ${esc(snap.date)}</h2><p><b>Duration:</b> ${snap.durationMin} minutes &nbsp; <b>Completed:</b> ${snap.completed}/${snap.total} &nbsp; <b>Volume:</b> ${snap.volume.toLocaleString()} lbs</p>${snap.exercises.map(ex=>`<h3>${esc(ex.name)}</h3><table class="print-table"><tr><th>Set</th><th>Weight</th><th>Reps</th><th>Done</th></tr>${ex.sets.map(s=>`<tr><td>${s.set}</td><td>${esc(s.weight||'')}</td><td>${esc(s.reps||'')}</td><td>${s.done?'Yes':''}</td></tr>`).join('')}</table>`).join('')}<h3>Notes</h3><p>${esc(snap.notes||'')}</p>`; window.print(); }
function workoutsThisWeek(h){ const now=new Date(); const start=new Date(now); start.setDate(now.getDate()-now.getDay()); start.setHours(0,0,0,0); return h.filter(x=>new Date(x.date+'T12:00:00')>=start); }
function emailWeeklyReport(){
  const wk=workoutsThisWeek(history());
  let body=['Jo\'s Program Weekly Report','',`Week ending: ${todayKey()}`,'',`Workouts completed: ${wk.length}`,''];
  wk.forEach(w=>body.push(`${w.dayLabel} - ${w.date}`,`Completed: ${w.completed}/${w.total}`,`Volume: ${w.volume.toLocaleString()} lbs`, w.notes?`Notes: ${w.notes}`:'',''));
  if(!wk.length) body.push('No workouts saved this week yet.');
  mailto('', `Jo's Program Weekly Report - ${todayKey()}`, body.join('\n'));
}
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js').catch(()=>{})); }
render();
