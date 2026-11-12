const $=s=>document.querySelector(s), deck=$('#deck'), action=$('#action'), hint=$('#hint'), camera=$('#camera'), video=$('video'), monitor=$('#monitor'), signal=$('#signal');
const backs='<svg viewBox="0 0 100 158" aria-hidden="true"><g fill="none" stroke="#bb9467"><rect x="2" y="2" width="96" height="154" rx="5"/><rect x="7" y="7" width="86" height="144" rx="3"/><path d="M50 14 89 79 50 144 11 79Z M50 26 78 79 50 132 22 79Z"/><circle cx="50" cy="79" r="24"/><path d="M59 64a18 18 0 1 0 0 30 17 17 0 0 1 0-30Z" fill="#e7c78f"/><path d="M65 71v10m-5-5h10 M50 36v12m-6-6h12 M50 110v12m-6-6h12"/></g><g fill="#c9ab82"><circle cx="19" cy="19" r="2"/><circle cx="81" cy="19" r="2"/><circle cx="19" cy="139" r="2"/><circle cx="81" cy="139" r="2"/></g></svg>';
const spreads={
 one:[['启示','此刻最值得留意的线索','问问自己，这个主题今天在哪里出现。']],
 advice:[['现状','问题中正在发生的事','先观察这个主题是否已经出现在眼前。'],['阻碍','容易忽略的摩擦或盲点','看看它在哪里让你难以前进。'],['建议','可以尝试的下一步','把这个主题变成一次小尝试。']],
 time:[['过去','仍在影响你的经历','回顾什么经历让这个主题延续到现在。'],['现在','此刻最需要面对的事','找出这个主题此刻最明显的表现。'],['未来','接下来可以探索的方向','把它看成一种可以选择的方向。']]
};
const themes=[
 [/感情|关系|伴侣|恋|复合|分手|喜欢|婚|对象|暧昧|沟通|朋友|家人/,'关系','把注意力放在自己的感受、边界和能说清的需求上。'],
 [/工作|职场|职业|转岗|跳槽|辞职|上司|同事|事业|面试|项目|升职/,'工作','对照你在工作中能验证的信息，以及手边可以争取的资源。'],
 [/学习|考试|学业|考研|升学|读书|课程/,'学习','把困扰拆成一个具体的知识缺口、练习目标或时间安排。'],
 [/金钱|收入|花费|存钱|财务|预算|投资/,'资源','看看哪些时间、精力或开支是你现在可以调整的。'],
 [/选择|决定|纠结|要不要|如何选|去留/,'选择','比较每个选项的代价，以及哪个决定比较容易撤回。']
];
const form=$('#setup'), table=$('#table'), result=$('#result'), browse=$('#browse');
let pool=[], drawn=[], selected=0, pending=null, complete=false, active=false, positions=spreads.advice, question='', theme=null, reversals=true;
let lockedUntil=0, pinchAt=0, releaseAt=0;
let stream, model, starting=false, loop=0, last=-1, pinched=true, smooth=null, edge=0, nextEdge=0, gestureBase=null;
const clamp=(n,min,max)=>Math.max(min,Math.min(n,max));
const meaning=c=>c.reversed?c.rev:c.up;
const motion=matchMedia('(prefers-reduced-motion: reduce)');
function shuffle(){ lockedUntil=pinchAt=releaseAt=0;
 pool=cards.map(c=>({...c,reversed:reversals&&Math.random()<.5}));
 for(let i=pool.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]]}
 drawn=[]; selected=0; pending=null; complete=false; active=true; pinched=true; smooth=null; gestureBase=null; edge=0;
 form.hidden=true; table.hidden=false; render(); $('#progress').focus();
 if(!motion.matches) deck.animate([{opacity:.25,transform:'scale(.87)'},{opacity:1,transform:'scale(1)'}],420);
}
form.addEventListener('submit',e=>{
 e.preventDefault(); question=$('#question').value.trim(); positions=spreads[$('#layout').value]; reversals=$('#reverse').checked;
 theme=themes.find(([pattern])=>pattern.test(question)); shuffle();
});
document.querySelectorAll('[data-question]').forEach(b=>b.onclick=()=>{$('#question').value=b.dataset.question;$('#question').focus()});
$('#again').onclick=()=>{active=false; form.hidden=false; table.hidden=true; $('#question').focus()};
$('#reset').onclick=shuffle;
function face(c){
 const names=['major','Wands','Cups','Swords','Pents'];
 const file=names[c.tone]+String(c.index).padStart(2,'0')+'.jpg';
 return '<div class="art"><div class="portrait"><img draggable="false" src="art/'+file+'" alt="'+c.name+'插画" class="'+(c.reversed?'inverted':'')+'"></div><b>'+c.name+'</b><small>'+c.family+' · '+(c.reversed?'逆位':'正位')+'</small></div>';
}

function select(index){
 if(!active||pending||complete||performance.now()<lockedUntil)return;
 const next=((index%pool.length)+pool.length)%pool.length; if(next===selected)return;
 selected=next; paintDeck();
}
const fanSize=()=>innerWidth>=900?23:innerWidth>=640?17:13;
function paintDeck(){
 const count=fanSize(), half=(count-1)/2, visible=new Map();
 for(let d=-half;d<=half;d++)visible.set((selected+d+pool.length)%pool.length,d);
 const existing=[...deck.querySelectorAll('button')], reserved=new Set();
 for(const b of existing){
   const index=Number(b.dataset.index);
   if(!visible.has(index)||reserved.has(index))b.remove();
   else reserved.add(index);
 }
 for(const [index,d] of visible){
   let b=existing.find(card=>card.parentNode===deck&&Number(card.dataset.index)===index);
   if(!b){
     b=makeButton('塔罗牌',()=>{
       if(performance.now()<blockTapUntil)return;
       if(index===selected)advance();else select(index);
     });
     trackCard(b); b.dataset.index=index; deck.append(b);
   }
   const distance=Math.abs(d), ratio=distance/half;
   const offset=distance?Math.sign(d)*(.58+(distance-1)*(count===13?.225:count===17?.244:.232)):0;
   b.classList.toggle('active',d===0); b.setAttribute('aria-pressed',String(d===0)); b.setAttribute('aria-label','第 '+(index+1)+' 张未抽出的牌');
   b.tabIndex=d===0?0:-1;
   b.style.setProperty('--x','calc('+offset+' * var(--fan-unit))');
   b.style.setProperty('--y',(4+ratio*29)*(distance?1:0)+'px');
   b.style.setProperty('--r',d/half*15+'deg');b.style.setProperty('--tilt',-d/half*16+'deg');
   b.style.setProperty('--z',count-distance);
   b.style.setProperty('--s',distance?(.76-ratio*.22):1);
 }
 browse.value=selected+1; $('#counter').textContent='第 '+(selected+1)+' / '+pool.length+' 张';
}
let touchStart=null, blockTapUntil=0;
deck.addEventListener('touchstart',e=>{const p=e.changedTouches[0];touchStart={x:p.clientX,y:p.clientY}},{passive:true});
deck.addEventListener('touchcancel',()=>{touchStart=null},{passive:true});
deck.addEventListener('touchend',e=>{
 if(!touchStart)return;
 const p=e.changedTouches[0], dx=p.clientX-touchStart.x,dy=p.clientY-touchStart.y;
 touchStart=null;
 if(Math.abs(dx)<24||Math.abs(dx)<Math.abs(dy))return;
 blockTapUntil=performance.now()+350; select(selected-Math.sign(dx)*Math.max(1,Math.round(Math.abs(dx)/35)));
},{passive:true});
window.addEventListener('resize',()=>{if(active&&!pending&&!complete)paintDeck()});

function makeButton(label,fn){const b=document.createElement('button');b.type='button';b.className='card';b.setAttribute('aria-label',label);b.onclick=fn;return b}
function render(){
 const n=drawn.length;
 $('#progress').textContent=complete?'牌阵已完成':(n+1)+' / '+positions.length+' · '+positions[n][0]+(pending?' · 等待翻牌':'');
 deck.replaceChildren(); $('#navigation').hidden=!!pending||complete; $('#actions').hidden=complete;
 action.textContent=pending?'翻开这张牌':'抽取这张牌';browse.max=pool.length;
 if(pending||complete){
   const b=makeButton(complete?'最后揭晓：'+drawn.at(-1).name:'翻开所选塔罗牌',advance);
   b.classList.add('active'); if(complete)b.classList.add('revealed');
   b.innerHTML=complete?face(drawn.at(-1)):backs; b.disabled=complete;deck.append(b);
 }else{
   paintDeck();
 }
 $('#spread').classList.toggle('single',positions.length===1);
 $('#spread').innerHTML=positions.map(([label,desc,context],i)=>{
   const c=drawn[i];
   return '<article class="slot"><span>'+label+' · '+desc+'</span>'+(c?face(c)+'<p><strong>'+meaning(c)+'</strong>。'+context+'</p>':'<i>待揭晓</i>')+'</article>';
 }).join('');
 result.hidden=!complete;
 if(complete){
   const [first,middle,final]=drawn;
   const focus=['价值与转变','行动与动力','感受与关系','信息与判断','资源与节奏'];
   const relation=!middle?'':first.tone===middle.tone
     ?'前两张同属'+first.family+'，可以先从「'+focus[first.tone]+'」理解它们的联系。'
     :'前两张分别侧重「'+focus[first.tone]+'」和「'+focus[middle.tone]+'」；试着区分哪部分来自处境，哪部分来自你对处境的判断。';
   const summary=positions===spreads.advice?'先辨认「'+meaning(first)+'」在现状中的表现，再看「'+meaning(middle)+'」怎样影响你的判断。建议从「'+meaning(final)+'」找一个可以马上检验的切入点。':positions===spreads.time?'看看「'+meaning(first)+'」留下了什么影响，以及它是否延续为眼下的「'+meaning(middle)+'」。接下来，可以把「'+meaning(final)+'」当作一个值得探索的方向。':'这次的线索是「'+meaning(first)+'」。想一想，最近哪件具体的事最能体现这个主题？';
   $('#asked').textContent=question?'你的问题：'+question:'本次为无主题解读';
   $('#reading').textContent=summary+' '+relation+' '+(theme?theme[2]:question?'把你问题中最不确定的一点，与这些线索对照，看看哪一点最贴近实际。':'留意哪个线索最贴近你此刻的处境。');
   $('#step').textContent=drawn.at(-1).step;
 }
}
function flyCard(from,to,card){
 if(motion.matches||!from||!to||!to.width)return;
 const ghost=document.createElement('div');
 ghost.className='flight';ghost.setAttribute('aria-hidden','true');
 ghost.style.cssText='left:'+from.left+'px;top:'+from.top+'px;width:'+from.width+'px;height:'+from.height+'px';
 ghost.innerHTML=backs;
 document.body.append(ghost);
 const dx=to.left-from.left,dy=to.top-from.top;
 const sx=to.width/from.width,sy=to.height/from.height;
 const mid=card?{transform:'translate('+dx*.36+'px,'+(dy*.36-42)+'px) rotateY(90deg) scale(1.08)',offset:.44}:{transform:'translate('+dx*.35+'px,'+(dy*.35-36)+'px) scale(1.08)',offset:.45};
 const flight=ghost.animate([{transform:'none'},mid,{transform:'translate('+dx+'px,'+dy+'px) scale('+sx+','+sy+')',opacity:1}],{duration:card?650:370,easing:'cubic-bezier(.2,.67,.26,1)',fill:'forwards'});
 const timer=card?setTimeout(()=>{ghost.innerHTML=face(card)},280):0;
 flight.finished.catch(()=>{}).finally(()=>{clearTimeout(timer);ghost.remove()});
}
function advance(){
 if(!active||complete||performance.now()<lockedUntil)return;
 const from=deck.querySelector('.card.active')?.getBoundingClientRect();
 if(!pending){
   pending=pool.splice(selected,1)[0];render();
   if(!motion.matches)lockedUntil=performance.now()+370;
   flyCard(from,deck.querySelector('.card.active')?.getBoundingClientRect(),null);
   action.focus();return;
 }
 const card=pending;drawn.push(card);pending=null;selected=Math.min(selected,pool.length-1);complete=drawn.length===positions.length;gestureBase=null;edge=0;render();
 const target=$('#spread').children[drawn.length-1].querySelector('.art');
 if(!motion.matches){
   lockedUntil=performance.now()+650;
   if(target&&from){
     target.animate([{opacity:0},{opacity:0,offset:.92},{opacity:1}],650);
     flyCard(from,target.getBoundingClientRect(),card);
   }
 }
 if(complete)$('#result-title').focus({preventScroll:true});else action.focus({preventScroll:true});
}

$('#prev').onclick=()=>select(selected-1);$('#next').onclick=()=>select(selected+1);browse.oninput=()=>select(Number(browse.value)-1);action.onclick=advance;
document.addEventListener('keydown',e=>{
 if(!active||!['ArrowLeft','ArrowRight'].includes(e.key)||e.target.matches('input,textarea,select'))return;
 e.preventDefault(); select(selected+(e.key==='ArrowLeft'?-1:1));
});
function steer(x,t){
 if(!active||pending||complete||performance.now()<lockedUntil)return;
 const direction=x<.25?-1:x>.75?1:0;
 if(direction){
   gestureBase=null;
   if(direction!==edge){edge=direction;nextEdge=t+250;select(selected+edge)}
   else if(t>=nextEdge){select(selected+edge);nextEdge=t+105}
 }else{
   if(edge||!gestureBase)gestureBase={x,index:selected};
   edge=0;select(gestureBase.index+Math.round((x-gestureBase.x)*11));
 }
}

function stop(message='可用鼠标、键盘或触屏，也可开启摄像头用手势选牌。'){cancelAnimationFrame(loop);stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;monitor.hidden=true;camera.textContent='◎ 开启手势';hint.textContent=message;pinched=true;pinchAt=releaseAt=0;smooth=null;edge=0;gestureBase=null;last=-1}
function frame(t){
 if(!stream)return;
 try{
  if(video.readyState>=2&&video.currentTime!==last){
   last=video.currentTime;
   const hand=model.detectForVideo(video,t).landmarks[0];
   if(!hand){pinched=true;pinchAt=releaseAt=0;smooth=null;edge=0;gestureBase=null;signal.textContent='请把一只手放入画面'}
   else{
    const ratio=Math.hypot(hand[4].x-hand[8].x,hand[4].y-hand[8].y)/Math.max(.01,Math.hypot(hand[0].x-hand[9].x,hand[0].y-hand[9].y));
    const x=1-hand[9].x;smooth=smooth===null?x:smooth*.82+x*.18;
    if(ratio>.46){
      pinchAt=0;if(!releaseAt)releaseAt=t;
      if(t-releaseAt>100){pinched=false;steer(smooth,t)}
    }else{
      releaseAt=0;
      if(ratio<.29&&!pinched){
        if(!pinchAt)pinchAt=t;
        if(t-pinchAt>90&&t>=lockedUntil){pinched=true;advance()}
      }else pinchAt=0;
    }
    signal.textContent=!active?'已识别手掌 · 请先开始洗牌':complete?'牌阵已完成':pinched?'已识别手掌 · 请松开手指':pending?'已抽取 · 捏合翻牌':'已选中第 '+(selected+1)+' 张 · 捏合抽牌';
   }
  }
  loop=requestAnimationFrame(frame)
 }catch{stop('手势识别中断，本轮可继续用触屏或鼠标。')}
}

camera.onclick=async()=>{if(starting)return;if(stream){stop();return}starting=true;camera.disabled=true;camera.textContent='正在启动…';hint.textContent='请允许摄像头访问，首次加载识别模型可能需要一点时间。';try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('context');stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:640},height:{ideal:480},facingMode:'user'}});for(const track of stream.getTracks())track.addEventListener('ended',()=>stop('摄像头已断开。'));if(!model){const cdn='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';const {FilesetResolver,HandLandmarker}=await import(cdn+'/vision_bundle.mjs');model=await HandLandmarker.createFromOptions(await FilesetResolver.forVisionTasks(cdn+'/wasm'),{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'},runningMode:'VIDEO',numHands:1})}if(!stream)return;video.srcObject=stream;await video.play();monitor.hidden=false;camera.textContent='◎ 关闭手势';hint.textContent='左右移动手掌选牌，停在边缘连续浏览；捏合抽牌，松开再捏翻牌。';loop=requestAnimationFrame(frame)}catch(e){stop(e.name==='NotAllowedError'?'未获摄像头权限。可在浏览器设置里允许，或继续点击抽牌。':e.message==='context'?'手势模式需要通过 HTTPS 或 localhost 打开。':'摄像头或识别模型未能启动，请检查设备和网络后重试。')}finally{starting=false;camera.disabled=false}};
window.addEventListener('pagehide',()=>stop());

const arrival=$('#arrival'), ritual=$('main'), enter=$('#enter');
let entering=false;
function startRitual(){
 if(entering)return;
 entering=true;
 const show=()=>{
   arrival.hidden=true;document.body.classList.remove('arrival-mode');
   ritual.hidden=false;ritual.classList.add('arrived');
   $('#question').focus({preventScroll:true});
 };
 if(motion.matches){show();return}
 arrival.classList.add('departing');window.setTimeout(show,320);
}
enter.addEventListener('click',startRitual);
function trackCard(b){
 b.classList.add('fan-card');
 b.innerHTML='<span class="fan-face">'+backs+'</span>';
 const clear=()=>b.classList.remove('tracking');
 b.addEventListener('pointermove',e=>{
   if(e.pointerType!=='mouse')return;
   const r=b.getBoundingClientRect();
   if(!r.width||!r.height)return;
   const x=clamp((e.clientX-r.left)/r.width,0,1),y=clamp((e.clientY-r.top)/r.height,0,1);
   b.style.setProperty('--hover-rx',(5-y*10)+'deg');
   b.style.setProperty('--hover-ry',(x*14-7)+'deg');
   b.style.setProperty('--glint-x',x*100+'%');b.style.setProperty('--glint-y',y*100+'%');
   b.classList.add('tracking');
 });
 b.addEventListener('pointerleave',clear);b.addEventListener('pointercancel',clear);
}
