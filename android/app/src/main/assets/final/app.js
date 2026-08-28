(()=>{
'use strict';
const $=s=>document.querySelector(s);
const screen=$('#screen'), viewport=$('#viewport'), admin=$('#admin');
const pip=$('#pip'), music=$('#music'), victory=$('#victory'), birthday=$('#birthday'), video=$('#soquetin');
const STORE='cochinoca.bomba.final.v1';
const DEFAULT={stage:'idle',x:0,y:0,scale:1,pauseAt:20,finalSeconds:1800,serialLog:'',timerRunning:false};
let state=Object.assign({},DEFAULT,JSON.parse(localStorage.getItem(STORE)||'{}'));
let adminOpen=false, calibrating=false, pauseArmed=false, symbolSeq=[], morse='', cheat='', lastCheat=0;
const CHEAT='123412341234';
const matrix=[['J','A','H','F','C','B'],['I','J','A','B','C','H'],['F','D','E','A','G','I'],['I','J','A','E','H','J'],['H','D','I','B','C','E']];
let letterIdx=[0,0,0,0,0];
// IDs 0..9 are the ten symbols from the manual. Their images live in final/symbols/.
// A-F are mixed among them; visible order is intentionally fixed so testing is repeatable.
const symbolOrder=['S7','B','S2','S9','E','S0','S5','A','S4','S1','F','S8','C','S6','D','S3'];
const correctSymbols=['S2','S5','S4'];
const fallback=['⌁','Ϟ','★','Ψ','Ω','⌘','ϟ','Ж','¿','¶'];
function save(){localStorage.setItem(STORE,JSON.stringify(state));}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function native(){return window.Android||window.BombBridge||window.Native||null;}
function send(line){try{const n=native();if(!n) return log('WEB '+line); if(typeof n.sendSerial==='function')n.sendSerial(line);else if(typeof n.send==='function')n.send(line);else if(typeof n.writeSerial==='function')n.writeSerial(line);else log('Sin método sendSerial');}catch(e){log('TX ERROR '+e.message);}}
function connect(){try{const n=native();if(!n)return log('Modo web: sin puente USB');if(typeof n.connectUsb==='function')n.connectUsb();else if(typeof n.connect==='function')n.connect();else if(typeof n.connectNano==='function')n.connectNano();}catch(e){log('CONNECT ERROR '+e.message);}}
function log(s){state.serialLog=(state.serialLog+'\n'+s).trim().split('\n').slice(-10).join('\n');save();const el=$('#serialStatus');if(el)el.textContent=state.serialLog||'—';}
window.BombNative={onSerialLine:line=>onSerial(line),onUsbState:s=>log('USB '+s)};
window.onSerialLine=line=>onSerial(line);
window.onUsbState=s=>log('USB '+s);
function onSerial(raw){const line=String(raw||'').trim();if(!line)return;log('RX '+line);const u=line.toUpperCase();if(/^(BTN|BOTON|BUTTON|PULSADO|PRESS)/.test(u)) physicalButton();if(/^(CABLE|CORTE|WIRE)(_|:|\s)?(OK|CUT|CORTADO)?/.test(u)&&state.stage==='cables')go('symbols');if(/^(FINAL|DESATIBAR)/.test(u)&&state.stage==='final')finish();}
function physicalButton(){if(state.stage==='video'&&video.paused&&pauseArmed){pauseArmed=false;setTimer(state.finalSeconds,true);video.play().catch(()=>{});}else if(state.stage==='final'){finish();}}
function applyTransform(){viewport.style.transform=`translate(calc(-50% + ${state.x}px),calc(-50% + ${state.y}px)) scale(${state.scale})`;save();}
function go(stage){state.stage=stage;save();render();}
function stopAll(){pip.pause();pip.currentTime=0;music.pause();video.pause();victory.pause();birthday.pause();}
function startExperience(){stopAll();symbolSeq=[];morse='';letterIdx=[0,0,0,0,0];send('RESET');go('initial');pip.currentTime=0;pip.play().catch(()=>{});closeAdmin();}
function setTimer(sec,start=false){state.finalSeconds=Math.max(0,Math.round(sec));save();send('TIEMPO:'+state.finalSeconds);if(start){send('INICIAR');state.timerRunning=true;}save();updateAdmin();}
function timerCmd(cmd){send(cmd);state.timerRunning=cmd==='INICIAR'?true:cmd==='PAUSA'?false:state.timerRunning;save();updateAdmin();}
function render(){screen.className='panel';video.classList.remove('hidden');video.style.display='none';screen.innerHTML='';
 switch(state.stage){
  case 'idle': screen.innerHTML=`<div class="title">DISPOSITIVO EN ESPERA</div><div class="subtitle">Ingrese al modo administrador para iniciar.</div>`;break;
  case 'initial': screen.innerHTML=`<div class="title">ADVERTENCIA</div><button id="call" class="bigButton danger">LLAME AL ESCUADRÓN ANTIBOMBAS PARA SILENCIAR</button>`;$('#call').onclick=()=>{pip.pause();pip.currentTime=0;go('video');};break;
  case 'video': screen.classList.add('videoScreen');screen.innerHTML='';screen.appendChild(video);video.style.display='block';startVideo();break;
  case 'cables': if(music.paused){music.currentTime=0;music.play().catch(()=>{});} screen.innerHTML=`<div class="title">PALANCAS Y CABLES</div><div class="subtitle">CORTE EL CABLE CORRECTO</div>`;break;
  case 'symbols': renderSymbols();break;
  case 'morse': renderMorse();break;
  case 'lock': renderLock();break;
  case 'final': screen.innerHTML=`<div class="title">DISPOSITIVO ABIERTO</div><div class="subtitle">Localice y pulse <b>DESATIBAR BONBA</b></div><div class="hint">Esperando botón físico…</div>`;break;
  case 'done': screen.innerHTML=`<div class="success">BOMBA DESATIBADA</div><div class="subtitle">🎂 ¡FELIZ CUMPLEAÑOS! 🎂</div>`;break;
 }
 applyTransform();
}
function startVideo(){pauseArmed=true;video.currentTime=0;video.play().catch(()=>{});}
video.addEventListener('timeupdate',()=>{if(state.stage==='video'&&pauseArmed&&video.currentTime>=Number(state.pauseAt||0)){video.pause();pauseArmed=true;}});
video.addEventListener('ended',()=>{if(state.stage==='video')go('cables');});
function renderSymbols(){screen.innerHTML=`<div class="title">BOTONES DE SÍMBOLOS</div><div class="selectedSlots"><div class="slot"></div><div class="slot"></div><div class="slot"></div></div><div class="symbols" id="symbols"></div>`;const box=$('#symbols');symbolOrder.forEach(id=>{const b=document.createElement('button');b.className='key symbolKey';b.dataset.id=id;if(id[0]==='S'){const n=+id.slice(1);b.innerHTML=`<img src="symbols/s${n}.png" alt="símbolo ${n}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span class="symbolFallback" style="display:none">${fallback[n]}</span>`;}else b.textContent=id;b.onclick=()=>pickSymbol(id);box.appendChild(b);});updateSymbolSlots();}
function pickSymbol(id){symbolSeq.push(id);if(symbolSeq.length>3)symbolSeq.shift();updateSymbolSlots();if(symbolSeq.length===3){if(symbolSeq.every((x,i)=>x===correctSymbols[i])){setTimeout(()=>go('morse'),250);}else{setTimeout(()=>{symbolSeq=[];updateSymbolSlots();},500);}}}
function updateSymbolSlots(){document.querySelectorAll('.slot').forEach((el,i)=>{const id=symbolSeq[i];if(!id){el.textContent='';return;}if(id[0]==='S'){const n=+id.slice(1);el.textContent=fallback[n];}else el.textContent=id;});}
function renderMorse(){screen.innerHTML=`<div class="title">MORSE</div><div class="codeDisplay" id="morseDisplay"></div><div class="keypad" id="keys"></div>`;const keys=$('#keys');['1','2','3','4','5','6','7','8','9','⌫','0','OK'].forEach(k=>{const b=document.createElement('button');b.className='key';b.textContent=k;b.onclick=()=>morseKey(k);keys.appendChild(b);});updateMorse();}
function morseKey(k){if(k==='⌫')morse=morse.slice(0,-1);else if(k==='OK'){if(morse==='4461612')go('lock');else morse='';}else if(morse.length<7)morse+=k;updateMorse();}
function updateMorse(){const e=$('#morseDisplay');if(e)e.textContent=morse||'_______';}
function renderLock(){screen.innerHTML=`<div class="title">CANDADO</div><div class="letterPicker" id="pickers"></div><button id="wordOk" class="bigButton">ENVIAR</button><div id="wordMsg" class="subtitle"></div>`;const p=$('#pickers');matrix.forEach((col,c)=>{const d=document.createElement('div');d.className='letterCol';d.innerHTML=`<button class="arrowBtn" data-d="-1">▲</button><div class="letter" id="letter${c}"></div><button class="arrowBtn" data-d="1">▼</button>`;d.querySelectorAll('button').forEach(b=>b.onclick=()=>cycleLetter(c,+b.dataset.d));p.appendChild(d);});$('#wordOk').onclick=checkWord;updateLetters();}
function cycleLetter(c,d){letterIdx[c]=(letterIdx[c]+d+matrix[c].length)%matrix[c].length;updateLetters();}
function updateLetters(){matrix.forEach((col,c)=>{const e=$('#letter'+c);if(e)e.textContent=col[letterIdx[c]];});}
function currentWord(){return matrix.map((col,c)=>col[letterIdx[c]]).join('');}
function checkWord(){const w=currentWord(),m=$('#wordMsg');if(w==='JADEE'){m.textContent='CÓDIGO ACEPTADO — ABRA EL DISPOSITIVO';setTimeout(()=>go('final'),1200);}else{m.textContent='PALABRA NO VÁLIDA';setTimeout(()=>{if(m)m.textContent='';},900);}}
function finish(){state.timerRunning=false;send('PAUSA');music.pause();music.currentTime=0;go('done');victory.currentTime=0;victory.play().catch(()=>{});victory.onended=()=>{birthday.currentTime=0;birthday.play().catch(()=>{});};}
// Secret quadrant code, captured on the real full screen rather than the calibrated viewport.
window.addEventListener('pointerdown',e=>{if(adminOpen)return;const now=Date.now();if(now-lastCheat>2000)cheat='';lastCheat=now;const left=e.clientX<innerWidth/2,top=e.clientY<innerHeight/2;const q=top?(left?'1':'2'):(left?'3':'4');cheat=(cheat+q).slice(-CHEAT.length);if(cheat===CHEAT){cheat='';e.preventDefault();e.stopImmediatePropagation();openAdmin();}},true);
function openAdmin(){adminOpen=true;admin.classList.remove('hidden');buildAdmin();}
function closeAdmin(){adminOpen=false;calibrating=false;viewport.classList.remove('calibrating');admin.classList.add('hidden');}
function buildAdmin(){admin.innerHTML=`<h1>ADMIN — DESTRUCTOMATIC T47</h1>
<h2>Experiencia</h2><div class="adminGrid"><button class="adminBtn ok" data-act="start">INICIAR EXPERIENCIA</button><button class="adminBtn danger" data-act="reset">RESET TOTAL</button><button class="adminBtn" data-go="initial">PIP</button><button class="adminBtn" data-go="video">VIDEO</button><button class="adminBtn" data-go="cables">CABLES</button><button class="adminBtn" data-go="symbols">SÍMBOLOS</button><button class="adminBtn" data-go="morse">MORSE</button><button class="adminBtn" data-go="lock">CANDADO</button><button class="adminBtn" data-go="final">FINAL</button><button class="adminBtn" data-go="done">VICTORIA</button></div>
<h2>Nano / eventos</h2><div class="adminGrid"><button class="adminBtn" data-act="connect">CONECTAR NANO</button><button class="adminBtn" data-act="status">ESTADO</button><button class="adminBtn" data-act="simBtn">SIMULAR BOTÓN</button><button class="adminBtn" data-act="simCable">SIMULAR CORTE</button><button class="adminBtn" data-act="simFinal">SIMULAR FINAL</button></div><div id="serialStatus" class="status"></div>
<h2>Contador</h2><div class="adminRow"><label>Tiempo (segundos)</label><input id="timeSec" type="number" min="0" step="1" value="${state.finalSeconds}"><button class="adminBtn" data-act="setTime">FIJAR</button><button class="adminBtn ok" data-act="timerStart">START</button><button class="adminBtn" data-act="timerPause">PAUSA</button><button class="adminBtn danger" data-act="timerReset">RESET</button></div><div class="adminRow"><button class="adminBtn" data-dt="-60">−1 min</button><button class="adminBtn" data-dt="-10">−10 s</button><button class="adminBtn" data-dt="10">+10 s</button><button class="adminBtn" data-dt="60">+1 min</button></div>
<h2>Pausa del video</h2><div class="adminRow"><label>Segundo de pausa</label><input id="pauseAt" type="number" min="0" step="0.1" value="${Number(state.pauseAt).toFixed(1)}"><button class="adminBtn" data-dp="-1">−1 s</button><button class="adminBtn" data-dp="-.1">−0,1</button><button class="adminBtn" data-dp=".1">+0,1</button><button class="adminBtn" data-dp="1">+1 s</button><button class="adminBtn" data-act="savePause">GUARDAR</button><button class="adminBtn" data-act="useCurrent">USAR TIEMPO ACTUAL</button><button class="adminBtn" data-act="testPause">PROBAR</button></div>
<h2>Calibración de ventana visible</h2><div class="adminRow"><div class="calibPad"><button class="up" data-move="0,-5">↑</button><button class="left" data-move="-5,0">←</button><button class="center" data-act="calibToggle">□</button><button class="right" data-move="5,0">→</button><button class="down" data-move="0,5">↓</button></div><button class="adminBtn" data-scale="-.02">ACHICAR</button><button class="adminBtn" data-scale=".02">AGRANDAR</button><button class="adminBtn" data-act="calibReset">RESET POSICIÓN</button><span id="calibVals" class="status"></span></div>
<div class="adminRow"><button class="adminBtn ok" data-act="close">CERRAR ADMIN</button></div>`;
 admin.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{go(b.dataset.go);updateAdmin();});
 admin.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>{const [x,y]=b.dataset.move.split(',').map(Number);state.x+=x;state.y+=y;applyTransform();updateAdmin();});
 admin.querySelectorAll('[data-scale]').forEach(b=>b.onclick=()=>{state.scale=Math.max(.35,Math.min(2.5,state.scale+Number(b.dataset.scale)));applyTransform();updateAdmin();});
 admin.querySelectorAll('[data-dp]').forEach(b=>b.onclick=()=>{state.pauseAt=Math.max(0,Number(state.pauseAt)+Number(b.dataset.dp));save();updateAdmin();});
 admin.querySelectorAll('[data-dt]').forEach(b=>b.onclick=()=>{setTimer(state.finalSeconds+Number(b.dataset.dt),false);});
 admin.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>adminAction(b.dataset.act));updateAdmin();}
function adminAction(a){switch(a){case'start':startExperience();break;case'reset':stopAll();state=Object.assign({},DEFAULT,{x:state.x,y:state.y,scale:state.scale,pauseAt:state.pauseAt,finalSeconds:state.finalSeconds});save();send('RESET');go('idle');updateAdmin();break;case'connect':connect();break;case'status':send('ESTADO');break;case'simBtn':physicalButton();break;case'simCable':if(state.stage==='cables')go('symbols');break;case'simFinal':if(state.stage==='final')finish();break;case'setTime':setTimer(Number($('#timeSec').value||0),false);break;case'timerStart':timerCmd('INICIAR');break;case'timerPause':timerCmd('PAUSA');break;case'timerReset':timerCmd('RESET');break;case'savePause':state.pauseAt=Math.max(0,Number($('#pauseAt').value||0));save();updateAdmin();break;case'useCurrent':state.pauseAt=video.currentTime||0;save();updateAdmin();break;case'testPause':closeAdmin();go('video');break;case'calibToggle':calibrating=!calibrating;viewport.classList.toggle('calibrating',calibrating);break;case'calibReset':state.x=0;state.y=0;state.scale=1;applyTransform();updateAdmin();break;case'close':closeAdmin();break;}}
function updateAdmin(){if(!adminOpen)return;const t=$('#timeSec'),p=$('#pauseAt'),s=$('#serialStatus'),c=$('#calibVals');if(t&&document.activeElement!==t)t.value=state.finalSeconds;if(p&&document.activeElement!==p)p.value=Number(state.pauseAt).toFixed(1);if(s)s.textContent=state.serialLog||'Sin mensajes';if(c)c.textContent=`X ${state.x}px  Y ${state.y}px  ESCALA ${state.scale.toFixed(2)}`;}
// Keep normal game state after process recreation, but never auto-play audio/video until admin starts or user interacts.
applyTransform();render();
})();