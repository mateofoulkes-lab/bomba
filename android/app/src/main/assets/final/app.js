(()=>{
'use strict';
const $=s=>document.querySelector(s);
const screen=$('#screen'), viewport=$('#viewport'), admin=$('#admin');
const pip=$('#pip'), music=$('#music'), victory=$('#victory'), birthday=$('#birthday'), errorAudio=$('#errorAudio'), boom=$('#boom'), video=$('#soquetin');
const STORE='cochinoca.bomba.final.v2';
const DEFAULT={stage:'idle',x:0,y:0,scale:1,pauseAt:20,timerSeconds:5445,startSeconds:5445,serialLog:'',timerRunning:false,timerEnd:0};
let state=Object.assign({},DEFAULT,JSON.parse(localStorage.getItem(STORE)||'{}'));
let adminOpen=false, calibrating=false, pauseArmed=false, symbolSeq=[], morse='', cheat='', lastCheat=0, rapidTimer=null, zeroHandling=false;
const CHEAT='123412341234';
const matrix=[['J','A','H','F','C','B'],['I','J','A','B','C','H'],['F','D','E','A','G','I'],['I','J','A','E','H','J'],['H','D','I','B','C','E']];
let letterIdx=[0,0,0,0,0];
const symbolOrder=['S7','S2','S9','S0','S5','S4','S1','S8','S6','S3'];
const correctSymbols=['S2','S5','S4'];
const mediaSlots=['soquetin','pip','musica','victoria','cumple','error','boom'];
const mediaEls={soquetin:video,pip:pip,musica:music,victoria:victory,cumple:birthday,error:errorAudio,boom:boom};
function save(){localStorage.setItem(STORE,JSON.stringify(state));}
function native(){return window.Android||null;}
function log(s){state.serialLog=(state.serialLog+'\n'+s).trim().split('\n').slice(-12).join('\n');save();const el=$('#serialStatus');if(el)el.textContent=state.serialLog||'—';}
function send(line){try{const n=native();if(!n)return log('WEB '+line);if(typeof n.sendSerial==='function')n.sendSerial(line);else if(typeof n.send==='function')n.send(line);}catch(e){log('TX ERROR '+e.message);}}
function connect(){try{const n=native();if(!n)return log('Sin puente Android');if(typeof n.connectUsb==='function')n.connectUsb();else if(typeof n.connect==='function')n.connect();}catch(e){log('CONNECT ERROR '+e.message);}}
window.BombNative={
 onSerialLine:line=>onSerial(line),
 onUsbState:s=>log('USB '+s),
 onMediaSelected:(slot,url)=>{applyMedia(slot,url);buildAdmin();}
};
function loadMedia(){const n=native();if(!n)return;mediaSlots.forEach(slot=>{try{const url=n.mediaUrl(slot);if(url)applyMedia(slot,url);}catch(_){}});}
function applyMedia(slot,url){const el=mediaEls[slot];if(el&&url){el.src=url;el.load();}}
function pickMedia(slot){const n=native();if(n&&typeof n.pickMedia==='function')n.pickMedia(slot);}
function mediaStatus(slot){const el=mediaEls[slot];return el&&el.src&&!el.src.includes('/android_asset/')?'CONFIGURADO':'SIN CONFIGURAR';}
function onSerial(raw){const line=String(raw||'').trim();if(!line)return;log('RX '+line);const u=line.toUpperCase();
 if(/^(ERROR|FALLO|FAIL)/.test(u)){penaltyError();return;}
 if(/^(CABLE_BAD|CABLE_MAL|CORTE_MAL|WIRE_BAD)/.test(u)&&state.stage==='cables'){penaltyError();return;}
 if(/^(CABLE_OK|CORTE_OK|WIRE_OK|CABLE_CORTADO)/.test(u)&&state.stage==='cables'){go('symbols');return;}
 if(/^(FINAL|DESATIBAR)/.test(u)&&state.stage==='final'){finish();return;}
 if(/^(BUTTON_DOWN|BOTON_PULSADO|PRESS_DOWN)/.test(u))return;
 if(/(BUTTON_UP|BOTON_SUELTO|RELEASE|SUELTO)/.test(u)){physicalButton('release');return;}
 if(/^(BTN|BOTON|BUTTON|PULSADO|PRESS)$/.test(u)){physicalButton('release');}
}
function physicalButton(kind){if(state.stage==='video'&&video.paused&&pauseArmed&&kind==='release'){pauseArmed=false;video.play().catch(()=>{});rapidDrainTo(1810,2000);}else if(state.stage==='final'){finish();}}
function applyTransform(){viewport.style.transform=`translate(calc(-50% + ${state.x}px),calc(-50% + ${state.y}px)) scale(${state.scale})`;save();}
function go(stage){state.stage=stage;save();render();}
function stopAll(){[pip,music,victory,birthday,errorAudio,boom].forEach(a=>{try{a.pause();a.currentTime=0;}catch(_){}});try{video.pause();}catch(_){};if(rapidTimer){clearInterval(rapidTimer);rapidTimer=null;}}
function timerRemaining(){if(!state.timerRunning)return Math.max(0,Math.round(state.timerSeconds));return Math.max(0,Math.ceil((state.timerEnd-Date.now())/1000));}
function setTimer(sec,start=false){sec=Math.max(0,Math.round(sec));state.timerSeconds=sec;state.timerRunning=!!start;state.timerEnd=start?Date.now()+sec*1000:0;save();send('TIEMPO:'+sec);if(start)send('INICIAR');updateAdmin();}
function timerPause(){state.timerSeconds=timerRemaining();state.timerRunning=false;state.timerEnd=0;save();send('PAUSA');updateAdmin();}
function startExperience(){stopAll();symbolSeq=[];morse='';letterIdx=[0,0,0,0,0];zeroHandling=false;go('initial');setTimer(state.startSeconds,true);pip.currentTime=0;pip.play().catch(()=>{});closeAdmin();}
function rapidDrainTo(target,duration){if(rapidTimer)clearInterval(rapidTimer);const from=Math.max(target,timerRemaining());timerPause();const started=Date.now();rapidTimer=setInterval(()=>{const t=Math.min(1,(Date.now()-started)/duration);const eased=t*t*(3-2*t);const cur=Math.round(from+(target-from)*eased);state.timerSeconds=cur;send('TIEMPO:'+cur);if(t>=1){clearInterval(rapidTimer);rapidTimer=null;setTimer(target,true);}},80);}
function subtractMinute(){const next=Math.max(0,timerRemaining()-60);setTimer(next,state.timerRunning);if(next===0)handleZero();}
function penaltyError(){try{errorAudio.currentTime=0;errorAudio.play().catch(()=>{});}catch(_){}subtractMinute();}
function handleZero(){
 if(zeroHandling||state.stage==='idle'||state.stage==='done')return;
 zeroHandling=true;state.timerRunning=false;state.timerSeconds=0;state.timerEnd=0;save();send('PAUSA');
 let granted=false;
 const grantFive=()=>{if(granted||!zeroHandling)return;granted=true;boom.onended=null;boom.onerror=null;setTimer(300,true);zeroHandling=false;};
 try{
   boom.pause();boom.currentTime=0;boom.onended=grantFive;boom.onerror=grantFive;
   const p=boom.play();if(p&&typeof p.catch==='function')p.catch(grantFive);
 }catch(_){grantFive();}
}
setInterval(()=>{if(state.timerRunning){const r=timerRemaining();if(r<=0)handleZero();const live=$('#timerLive');if(live)live.textContent=formatTime(r);}},250);
function formatTime(s){s=Math.max(0,Math.round(s));return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}
function render(){screen.className='panel';video.style.display='none';screen.innerHTML='';
 switch(state.stage){
  case'idle':screen.innerHTML='<div class="title">DISPOSITIVO EN ESPERA</div><div class="subtitle">Ingrese al modo administrador para iniciar.</div>';break;
  case'initial':screen.innerHTML='<div class="title">ADVERTENCIA</div><div class="subtitle">CONTACTE A LA DIVISIÓN DE EXPLOSIVOS DE COCHINOCA</div><button id="call" class="callButton"><span class="callIcon">☎</span><span class="callText"><b>LLAMAR</b><small>División Explosivos de Cochinoca</small></span></button>';$('#call').onclick=()=>{pip.pause();pip.currentTime=0;go('video');};break;
  case'video':screen.classList.add('videoScreen');screen.appendChild(video);video.style.display='block';startVideo();break;
  case'cables':if(music.paused){music.currentTime=0;music.play().catch(()=>{});}screen.innerHTML='<div class="title">PALANCAS Y CABLES</div><div class="subtitle">CORTE EL CABLE CORRECTO</div>';break;
  case'symbols':renderSymbols();break;
  case'morse':renderMorse();break;
  case'lock':renderLock();break;
  case'final':screen.innerHTML='<div class="title">DISPOSITIVO ABIERTO</div><div class="subtitle">Mueva la palanca <b>DESATIBAR BONBA</b></div><div class="hint">Esperando palanca física…</div>';break;
  case'done':screen.innerHTML='<div class="success">BOMBA DESATIBADA</div><div class="subtitle">¡FELIZ CUMPLEAÑOS!</div>';break;
 }
 applyTransform();
}
function startVideo(){pauseArmed=true;video.currentTime=0;video.play().catch(()=>{});}
video.addEventListener('timeupdate',()=>{if(state.stage==='video'&&pauseArmed&&video.currentTime>=Number(state.pauseAt||0)){video.pause();}});
video.addEventListener('play',()=>{if(state.stage==='video'&&pauseArmed&&video.currentTime>=Number(state.pauseAt||0)){setTimeout(()=>{if(pauseArmed)video.pause();},0);}});
video.addEventListener('ended',()=>{if(state.stage==='video')go('cables');});
function renderSymbols(){screen.innerHTML='<div class="title">BOTONES DE SÍMBOLOS</div><div class="selectedSlots"><div class="slot"></div><div class="slot"></div><div class="slot"></div></div><div class="symbols" id="symbols"></div>';const box=$('#symbols');symbolOrder.forEach(id=>{const b=document.createElement('button');b.className='symbolKey';b.dataset.id=id;const n=+id.slice(1);b.innerHTML=`<span class="keySlot"></span><img src="symbols/${n}.png" alt="símbolo ${n}">`;b.onclick=()=>pickSymbol(id);box.appendChild(b);});updateSymbolSlots();}
function pickSymbol(id){symbolSeq.push(id);updateSymbolSlots();if(symbolSeq.length===3){if(symbolSeq.every((x,i)=>x===correctSymbols[i]))setTimeout(()=>go('morse'),250);else setTimeout(()=>{penaltyError();symbolSeq=[];updateSymbolSlots();},250);}}
function updateSymbolSlots(){document.querySelectorAll('.slot').forEach((el,i)=>{const id=symbolSeq[i];el.innerHTML='';if(!id)return;const n=+id.slice(1);el.innerHTML=`<img src="symbols/${n}.png" alt="">`;});}
function renderMorse(){screen.innerHTML='<div class="title">MORSE</div><div class="codeDisplay" id="morseDisplay"></div><div class="keypad" id="keys"></div>';const keys=$('#keys');['1','2','3','4','5','6','7','8','9','⌫','0','OK'].forEach(k=>{const b=document.createElement('button');b.className='key';b.textContent=k;b.onclick=()=>morseKey(k);keys.appendChild(b);});updateMorse();}
function morseKey(k){if(k==='⌫')morse=morse.slice(0,-1);else if(k==='OK'){if(morse==='4461612')go('lock');else{penaltyError();morse='';}}else if(morse.length<7)morse+=k;updateMorse();}
function updateMorse(){const e=$('#morseDisplay');if(e)e.textContent=morse||'_______';}
function renderLock(){screen.innerHTML='<div class="title">CANDADO</div><div class="letterPicker" id="pickers"></div><div class="hint">TOQUE CADA LETRA PARA CAMBIARLA</div><button id="wordOk" class="bigButton">ENVIAR</button><div id="wordMsg" class="subtitle"></div>';const p=$('#pickers');matrix.forEach((col,c)=>{const d=document.createElement('button');d.className='letterKey';d.innerHTML=`<span class="keySlot"></span><span class="letter" id="letter${c}"></span>`;d.onclick=()=>cycleLetter(c,1);p.appendChild(d);});$('#wordOk').onclick=checkWord;updateLetters();}
function cycleLetter(c,d){letterIdx[c]=(letterIdx[c]+d+matrix[c].length)%matrix[c].length;updateLetters();}
function updateLetters(){matrix.forEach((col,c)=>{const e=$('#letter'+c);if(e)e.textContent=col[letterIdx[c]];});}
function currentWord(){return matrix.map((col,c)=>col[letterIdx[c]]).join('');}
function checkWord(){const m=$('#wordMsg');if(currentWord()==='JADEE'){m.textContent='CÓDIGO ACEPTADO — ABRA EL DISPOSITIVO';setTimeout(()=>go('final'),900);}else{penaltyError();m.textContent='PALABRA NO VÁLIDA';setTimeout(()=>{if(m)m.textContent='';},900);}}
function finish(){timerPause();music.pause();music.currentTime=0;go('done');victory.currentTime=0;victory.play().catch(()=>{});victory.onended=()=>{birthday.currentTime=0;birthday.play().catch(()=>{});};}
window.addEventListener('pointerdown',e=>{if(adminOpen)return;const now=Date.now();if(now-lastCheat>2000)cheat='';lastCheat=now;const q=e.clientY<innerHeight/2?(e.clientX<innerWidth/2?'1':'2'):(e.clientX<innerWidth/2?'3':'4');cheat=(cheat+q).slice(-CHEAT.length);if(cheat===CHEAT){cheat='';e.preventDefault();e.stopImmediatePropagation();openAdmin();}},true);
function openAdmin(){if(state.stage==='video'&&pauseArmed&&video.currentTime>=Number(state.pauseAt||0))video.pause();adminOpen=true;admin.classList.remove('hidden');buildAdmin();}
function closeAdmin(){adminOpen=false;calibrating=false;viewport.classList.remove('calibrating');admin.classList.add('hidden');if(state.stage==='video'&&pauseArmed&&video.currentTime>=Number(state.pauseAt||0))video.pause();}
function buildAdmin(){if(!adminOpen)return;admin.innerHTML=`<h1>ADMIN — DESTRUCTOMATIC T47</h1>
<h2>Experiencia</h2><div class="adminGrid"><button class="adminBtn ok" data-act="start">INICIAR EXPERIENCIA</button><button class="adminBtn danger" data-act="reset">RESET TOTAL</button><button class="adminBtn" data-go="initial">PIP</button><button class="adminBtn" data-go="video">VIDEO</button><button class="adminBtn" data-go="cables">CABLES</button><button class="adminBtn" data-go="symbols">SÍMBOLOS</button><button class="adminBtn" data-go="morse">MORSE</button><button class="adminBtn" data-go="lock">CANDADO</button><button class="adminBtn" data-go="final">FINAL</button></div>
<h2>Nano / eventos</h2><div class="adminGrid"><button class="adminBtn" data-act="connect">CONECTAR NANO</button><button class="adminBtn" data-act="status">ESTADO</button><button class="adminBtn" data-act="simBtn">SIMULAR BOTÓN</button><button class="adminBtn" data-act="simCable">SIMULAR CORTE OK</button><button class="adminBtn" data-act="simError">SIMULAR ERROR</button><button class="adminBtn" data-act="simFinal">SIMULAR FINAL</button></div><div id="serialStatus" class="status">${state.serialLog||'—'}</div>
<h2>Contador</h2><div class="adminRow"><b id="timerLive">${formatTime(timerRemaining())}</b><label>Segundos</label><input id="timeSec" type="number" min="0" step="1" value="${timerRemaining()}"><button class="adminBtn" data-act="setTime">FIJAR</button><button class="adminBtn ok" data-act="timerStart">START</button><button class="adminBtn" data-act="timerPause">PAUSA</button></div><div class="adminRow"><button class="adminBtn" data-dt="-60">−1 min</button><button class="adminBtn" data-dt="60">+1 min</button></div>
<h2>Pausa del video</h2><div class="adminRow"><input id="pauseAt" type="number" min="0" step="0.1" value="${Number(state.pauseAt).toFixed(1)}"><button class="adminBtn" data-dp="-1">−1 s</button><button class="adminBtn" data-dp="-.1">−0,1</button><button class="adminBtn" data-dp=".1">+0,1</button><button class="adminBtn" data-dp="1">+1 s</button><button class="adminBtn" data-act="savePause">GUARDAR</button><button class="adminBtn" data-act="useCurrent">USAR TIEMPO ACTUAL</button></div>
<h2>Archivos del celular</h2><div class="mediaGrid">${mediaSlots.map(s=>`<div class="mediaRow"><b>${s}</b><span>${mediaStatus(s)}</span><button class="adminBtn" data-media="${s}">ELEGIR</button><button class="adminBtn" data-testmedia="${s}">PROBAR</button></div>`).join('')}</div>
<h2>Calibración</h2><div class="adminRow"><div class="calibPad"><button class="up" data-move="0,-5">↑</button><button class="left" data-move="-5,0">←</button><button class="center" data-act="calibToggle">□</button><button class="right" data-move="5,0">→</button><button class="down" data-move="0,5">↓</button></div><button class="adminBtn" data-scale="-.02">ACHICAR</button><button class="adminBtn" data-scale=".02">AGRANDAR</button><button class="adminBtn" data-act="calibReset">RESET POSICIÓN</button><span id="calibVals" class="status"></span></div><div class="adminRow"><button class="adminBtn ok" data-act="close">CERRAR ADMIN</button></div>`;
 admin.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>go(b.dataset.go));
 admin.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>{const [x,y]=b.dataset.move.split(',').map(Number);state.x+=x;state.y+=y;applyTransform();updateAdmin();});
 admin.querySelectorAll('[data-scale]').forEach(b=>b.onclick=()=>{state.scale=Math.max(.35,Math.min(2.5,state.scale+Number(b.dataset.scale)));applyTransform();updateAdmin();});
 admin.querySelectorAll('[data-dp]').forEach(b=>b.onclick=()=>{state.pauseAt=Math.max(0,Number(state.pauseAt)+Number(b.dataset.dp));save();updateAdmin();});
 admin.querySelectorAll('[data-dt]').forEach(b=>b.onclick=()=>{const running=state.timerRunning;setTimer(timerRemaining()+Number(b.dataset.dt),running);});
 admin.querySelectorAll('[data-media]').forEach(b=>b.onclick=()=>pickMedia(b.dataset.media));
 admin.querySelectorAll('[data-testmedia]').forEach(b=>b.onclick=()=>{const el=mediaEls[b.dataset.testmedia];if(el){el.currentTime=0;el.play().catch(()=>{});}});
 admin.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>adminAction(b.dataset.act));updateAdmin();}
function updateAdmin(){if(!adminOpen)return;const c=$('#calibVals');if(c)c.textContent=`X ${state.x} · Y ${state.y} · escala ${state.scale.toFixed(2)}`;const t=$('#timerLive');if(t)t.textContent=formatTime(timerRemaining());}
function adminAction(a){switch(a){case'start':startExperience();break;case'reset':stopAll();state=Object.assign({},DEFAULT,{x:state.x,y:state.y,scale:state.scale,pauseAt:state.pauseAt});save();send('RESET');render();buildAdmin();break;case'connect':connect();break;case'status':send('ESTADO');break;case'simBtn':physicalButton('release');break;case'simCable':if(state.stage==='cables')go('symbols');break;case'simError':penaltyError();break;case'simFinal':finish();break;case'setTime':setTimer(Number($('#timeSec').value||0),false);break;case'timerStart':setTimer(timerRemaining(),true);break;case'timerPause':timerPause();break;case'savePause':state.pauseAt=Math.max(0,Number($('#pauseAt').value||0));save();break;case'useCurrent':state.pauseAt=video.currentTime||0;save();buildAdmin();break;case'calibToggle':calibrating=!calibrating;viewport.classList.toggle('calibrating',calibrating);break;case'calibReset':state.x=0;state.y=0;state.scale=1;applyTransform();updateAdmin();break;case'close':closeAdmin();break;}}
loadMedia();applyTransform();render();
})();