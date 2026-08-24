const SCREENS=['waiting','video','error','switches','symbols','morse','opened','final'];
const KEY='bonba-state-v1';
const defaults={screen:'waiting',switches:[false,false,false,false,false,false,false,false],wires:[false,false,false],redButton:false,finalButton:false,symbols:[],timer:'03:00:00'};
let state={...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
function save(){localStorage.setItem(KEY,JSON.stringify(state)); render();}
function render(){
  $$('.screen').forEach(x=>x.classList.toggle('active',x.dataset.screen===state.screen));
  const dbg=$('#debug'); if(dbg) dbg.textContent=JSON.stringify(state,null,2);
  $('#symbolProgress').textContent=`${state.symbols.length} / 3`;
  $$('.symbol-btn').forEach((b,i)=>b.classList.toggle('used',state.symbols.includes(i)));
}
function go(name){if(SCREENS.includes(name)){state.screen=name;save();}}
function next(){go(SCREENS[Math.min(SCREENS.indexOf(state.screen)+1,SCREENS.length-1)])}
function prev(){go(SCREENS[Math.max(SCREENS.indexOf(state.screen)-1,0)])}
function reset(){state=structuredClone(defaults);save();}
const symbolChars=['Ϟ','⌁','ƛ','Ϙ','Ѭ','ϗ','Ψ','Ж','Ω','Ϭ','Ͽ','Ӭ','҂','Ͼ','Ѧ','ϟ'];
const grid=$('#symbolGrid');
symbolChars.forEach((ch,i)=>{const b=document.createElement('button');b.className='symbol-btn';b.textContent=ch;b.onclick=()=>{if(state.symbols.length<3&&!state.symbols.includes(i)){state.symbols.push(i);save(); if(state.symbols.length===3)setTimeout(()=>go('morse'),600)}};grid.appendChild(b)});
$('#callBombSquad').onclick=()=>go('video');
let taps=0,tapTimer; $('#operatorHotspot').onclick=()=>{taps++;clearTimeout(tapTimer);tapTimer=setTimeout(()=>taps=0,1200);if(taps>=5){$('#operator').classList.toggle('open');taps=0}};
const ops=[['◀ Puzzle',prev],['Puzzle ▶',next],['Reiniciar',reset],['Esperar',()=>go('waiting')],['Video',()=>go('video')],['Fallo',()=>go('error')],['Palancas',()=>go('switches')],['Símbolos',()=>go('symbols')],['Morse',()=>go('morse')],['Caja abierta',()=>go('opened')],['Final',()=>go('final')],['Cerrar panel',()=>$('#operator').classList.remove('open')]];
ops.forEach(([t,f])=>{const b=document.createElement('button');b.textContent=t;b.onclick=f;$('#operatorButtons').appendChild(b)});
window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue){state={...defaults,...JSON.parse(e.newValue)}; applyPhysical();render();}});
function applyPhysical(){
  if(state.screen==='video'&&state.redButton){$('#subtitle').textContent='— Bien. Mantené apretado ese botón. No lo sueltes todavía...';}
  if(state.screen==='video'&&!state.redButton&&state.videoStarted){go('error');setTimeout(()=>go('switches'),1800)}
  if(state.screen==='switches'&&state.wires.some(Boolean)&&state.switches.filter(Boolean).length>=3){setTimeout(()=>go('symbols'),450)}
  if(state.screen==='opened'&&state.finalButton){setTimeout(()=>go('final'),250)}
}
// Simulator marks this once the physical red button has been pressed at least once.
setInterval(()=>{const latest={...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')};if(JSON.stringify(latest)!==JSON.stringify(state)){state=latest;applyPhysical();render();}},300);
render();