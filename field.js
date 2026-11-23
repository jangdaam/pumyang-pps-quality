'use strict';
// Model coordinates are metres in the training layout. Z is vertical.
const Field = (() => {
  const members = PPS.positions.map((position,i) => ({
    position, code:'PPS-A1-'+String(i+1).padStart(3,'0'), y: (i-2)*4,
    loads:[[115,116,114],[118,117,119],[113,115,114],[115,114,116],[116,118,117]][i]
  }));
  const initial = {az:-0.62, el:0.67, zoom:1};
  const camera = {...initial};
  let focusPosition=null;
  const memberFor = pos => members.find(m=>m.position===pos);
  const selectedMember = record => memberFor(focusPosition??record?.position);
  const latest = (records,pos) => records.filter(r=>r.position===pos).sort((a,b)=>b.date.localeCompare(a.date)||b.round-a.round)[0];
  const codes = () => members.map(m=>`<button type="button" data-pipe="${m.position}" aria-pressed="false">${m.code}</button>`).join('');
  function viewport(){
    return `<section class="drawing"><header><h2>강관 설치 배치</h2><div class="camera"><button data-camera="orbit">사시도</button><button data-camera="plan">평면도</button><button data-camera="out" aria-label="축소">−</button><button data-camera="in" aria-label="확대">＋</button></div></header><svg id="excavation" viewBox="0 0 760 420" role="group" aria-label="굴착 구간 A의 3차원 강관 배치도"></svg><div class="pipe-list" aria-label="강관 선택">${codes()}</div><footer>드래그로 회전 · 강관 또는 코드 선택</footer></section>`;
  }
  function info(m, records){
    if(!m)return '<section class="inspection"><h2>배치도 미연결</h2><p>등록된 설치 위치를 선택하면 부재 정보를 볼 수 있습니다.</p></section>';
    const heights = m.loads.map(v=>v/130*80);
    return `<section class="inspection"><div class="sheet-label">선택 강관</div><h2>${m.code}</h2><dl class="spec"><div><dt>설치 위치</dt><dd>A구간 · ${m.position}</dd></div><div><dt>설치 단수</dt><dd>지보공 1단</dd></div><div><dt>부재 길이</dt><dd>16 m</dd></div><div><dt>재하 기록</dt><dd>${records.filter(r=>r.position===m.position).length}건</dd></div></dl><h3>길이 방향 축력 분포</h3><p class="caption">별도 예시 계측 · 11월 12일 · 단위 kN</p><div class="load-bars">${m.loads.map((v,i)=>`<div><b>${v}</b><i style="height:${heights[i]}px"></i><span>${['좌단','중앙','우단'][i]}</span></div>`).join('')}</div><p class="caption">세 지점의 축력은 각각의 단면값입니다.</p></section>`;
  }
  function draw(svg,m){
    const {az,el,zoom}=camera, c=Math.cos(az),s=Math.sin(az),e=Math.cos(el),v=Math.sin(el);
    const all=[], labels=[];
    function project([x,y,z]){
      const d=x*s+y*c, scale=14.5*zoom;
      return [(375+(x*c-y*s)*scale),(216+(d*v-z*e)*scale),d*e+z*v];
    }
    function face(points,color,stroke='#6a6c64',pipe=''){
      const xy=points.map(project),depth=xy.reduce((n,p)=>n+p[2],0)/xy.length;
      all.push({depth,svg:`<polygon points="${xy.map(p=>p.slice(0,2).map(n=>n.toFixed(2)).join(',')).join(' ')}" fill="${color}" stroke="${stroke}" stroke-width="0.8" ${pipe?'data-hit="'+pipe+'"':''}/>`});
    }
    function box(x,y,z,dx,dy,dz,colors){
      const a=[x,y,z],b=[x+dx,y,z],d=[x,y+dy,z],f=[x+dx,y+dy,z],top=p=>[p[0],p[1],p[2]+dz];
      for(const [l,r,k] of [[a,b,0],[b,f,1],[f,d,0],[d,a,1]])face([l,r,top(r),top(l)],colors[k]);
      face([a,b,f,d].map(top),colors[2]);
    }
    // A cutaway floor and stepped front retaining walls leave the struts visible.
    face([[-8.8,-11,-3.4],[8.8,-11,-3.4],[8.8,11,-3.4],[-8.8,11,-3.4]],'#b1a895','#948c7a');
    all[0].depth=-Infinity;
    for(const side of [-1,1]){
      const highX=side*s<0,highY=side*c<0;
      for(let i=0;i<11;i++)box(side<0?-8.7:8,-11+i*2,-3.5,.7,1.98,highX?5.4:2.7,['#95978c','#85887f','#d5d1bd']);
      for(let i=0;i<8;i++)box(-8+i*2,side<0?-11.5:11,-3.5,1.98,.5,highY?5.4:2.1,['#a09f92','#8d9188','#d5d1bd']);
      box(side<0?-8.25:7.86,-10.8,-.28,.42,21.6,.55,['#656962','#797d73','#b8b8a8']);
    }
    function tube(x1,x2,y,r,palette,id){
      const at=(x,i)=>[x,y+r*Math.cos(i*Math.PI/6),r*Math.sin(i*Math.PI/6)];
      // Subdivide long surfaces so crossing walls and fittings are depth sorted.
      const slices=Math.ceil((x2-x1)/1.4);
      for(let j=0;j<slices;j++)for(let i=0;i<12;i++){
        const x=x1+(x2-x1)*j/slices,next=x1+(x2-x1)*(j+1)/slices;
        const tint=palette[Math.floor((Math.sin((i+.5)*Math.PI/6)+1)*1.49)];
        face([at(x,i),at(next,i),at(next,i+1),at(x,i+1)],tint,tint,id);
      }
    }
    for(const p of members){
      const active=m?.position===p.position;
      const steel=active?['#984219','#df691a','#ff993c']:['#656e6b','#9ea8a2','#d8dcd1'];
      const metal=active?['#89431e','#b95622','#dd7636']:['#505856','#77827c','#a4aca2'];
      tube(-7.98,7.98,p.y,.37,steel,p.position);
      for(const [x,r,w] of [[-7.45,.57,.48],[-6.45,.53,.27],[0,.47,.24],[7.5,.49,.24]])tube(x,x+w,p.y,r,metal,p.position);
      const end=project([8,p.y,.35]);labels.push({p,end,active});
    }
    all.sort((a,b)=>a.depth-b.depth);
    svg.innerHTML=all.map(f=>f.svg).join('')+labels.map(({p,end:[x,y],active})=>`<g data-hit="${p.position}" class="callout"><rect x="${x-19}" y="${y-10}" width="39" height="19" rx="2" fill="${active?'#b94712':'#323b38'}"/><text x="${x}" y="${y+3}" text-anchor="middle" fill="white" font-size="11" font-weight="650">${p.position}</text></g>`).join('');
  }
  function mount(m,choose){
    const svg=document.getElementById('excavation');if(!svg)return;
    const repaint=()=>draw(svg,m);
    repaint();
    svg.parentElement.querySelectorAll('[data-pipe]').forEach(b=>{
      b.setAttribute('aria-pressed',String(b.dataset.pipe===m?.position));b.onclick=()=>choose(b.dataset.pipe);
    });
    svg.parentElement.querySelectorAll('[data-camera]').forEach(b=>b.onclick=()=>{
      const action=b.dataset.camera;
      if(action==='plan')Object.assign(camera,{az:0,el:Math.PI/2,zoom:1});
      else if(action==='orbit')Object.assign(camera,initial);
      else camera.zoom=Math.min(1.4,Math.max(.7,camera.zoom+(action==='in'?.1:-.1)));
      repaint();
    });
    let start,frame=0;
    svg.onpointerdown=ev=>{
      if(ev.button!==0)return;
      start={x:ev.clientX,y:ev.clientY,az:camera.az,el:camera.el,id:ev.target.closest('[data-hit]')?.dataset.hit,moved:false};
      svg.setPointerCapture(ev.pointerId);
    };
    svg.onpointermove=ev=>{
      if(!start)return;
      const dx=ev.clientX-start.x,dy=ev.clientY-start.y;
      if(!start.moved&&Math.hypot(dx,dy)<4)return;
      start.moved=true;camera.az=start.az+dx*.007;camera.el=Math.max(.28,Math.min(Math.PI/2,start.el+dy*.006));
      if(!frame)frame=requestAnimationFrame(()=>{frame=0;repaint()});
    };
    svg.onpointerup=()=>{if(!start)return;const clicked=!start.moved&&start.id;start=null;if(clicked)choose(clicked);};
    svg.onpointercancel=()=>{start=null;};
  }
  return {viewport,info,mount,latest,selectedMember,setFocus:p=>{focusPosition=p;}};
})();

