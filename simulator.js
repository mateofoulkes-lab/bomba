const KEY='bonba-state-v1';
const defaults={screen:'waiting',switches:[false,false,false,false,false,false,false,false],wires:[false,false,false],redButton:false,finalButton:false,symbols:[],timer:'03:00:00'};
let state={...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')};
const $=s=>document.querySelector(s);
function save(){localStorage.setItem(KEY,JSON.stringify(state));render();}
function render(){
  [...document.querySelectorAll('#switches .toggle')].forEach((b,i)=>{b.classList.toggle('on',state.switches[i]);b.textContent=`P${i+1}: ${state.switches[i]?'ARRIBA':'ABAJO'}`});
  [...document.querySelectorAll('#wires .wire')].forEach((b,i)=>{b.classList.toggle('cut',state.wires[i]);b.textContent=`CABLE ${i+1}: ${state.wires[i]?'CORTADO':'ENTERO'}`});
  $('#redButton').textContent=`BOTÓN ROJO: ${state.redButton?'APRETADO':'SUELTO'}`;
  $('#finalButton').textContent=`DESATIBAR BONBA: ${state.finalButton?'APRETADO':'SUELTO'}`;
  $('#stateView').textContent=JSON.stringify(state,null,2);
}
for(let i=0;i<8;i++){const b=document.createElement('button');b.className='toggle';b.onclick=()=>{state.switches[i]=!state.switches[i];save()};$('#switches').appendChild(b)}
for(let i=0;i<3;i++){const b=document.createElement('button');b.className='wire';b.onclick=()=>{state.wires[i]=!state.wires[i];save()};$('#wires').appendChild(b)}
$('#redButton').onpointerdown=()=>{state.redButton=true;state.videoStarted=true;save()};
['pointerup','pointerleave','pointercancel'].forEach(ev=>$('#redButton').addEventListener(ev,()=>{state.redButton=false;save()}));
$('#finalButton').onclick=()=>{state.finalButton=true;save()};
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{state.screen=b.dataset.go;save()});
$('#reset').onclick=()=>{state=structuredClone(defaults);save()};
window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue){state={...defaults,...JSON.parse(e.newValue)};render()}});
render();