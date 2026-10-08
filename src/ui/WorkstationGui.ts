
import modules from '../../MODULE_REGISTRY.json';

const repo = 'https://github.com/SouthPaw302/Libertas0';
const browserSuites = [
 'audio-kernel','deck-a','deck-b-mixer','musical-clock','sync','sync-soak',
 'performance-transport','mixer-dsp','track-intelligence','phase10','distributed',
 'distributed-torture','monitor-cue-bus','waveform-track-view','fx-engine',
 'sampler-performance-pads','advanced-midi-controller','advanced-library-preparation',
 'automix-transition','workstation-gui'
];
function make<K extends keyof HTMLElementTagNameMap>(tag: K,text = '',className = ''): HTMLElementTagNameMap[K] {
 const el = document.createElement(tag); el.textContent = text; el.className=className; return el;
}
function href(text:string,path:string):HTMLAnchorElement{
 const a=make('a',text);a.href=path;a.target='_blank';a.rel='noopener noreferrer';return a;
}
function appendRow(parent:HTMLElement,title:string,details:string,state:string):void{
 const row=make('div','','module-row');
 row.append(make('strong',title),make('small',details),make('span',state,'module-state'));
 parent.append(row);
}
async function optional(action:()=>Promise<unknown>|unknown):Promise<unknown>{
 try{return await action();}catch(error){return {unavailable:String(error)};}
}
export function startWorkstationGui():void {
 const main=document.querySelector('main');
 const header=document.querySelector('.topbar');
 if(!main || !header)return;
 document.title='Libertas0 — DJ Workstation';
 const heading=document.querySelector('.brand h1');if(heading)heading.textContent='Libertas0';
 const tagline=document.querySelector('.brand p');if(tagline)tagline.textContent='Music first · local and reliable';
 const performance=make('div','','performance-view');
 performance.id='performance-view';
 for(const child of Array.from(main.children))performance.append(child);
 main.append(performance);
 const quick=performance.querySelector('.quick-start');
 if(quick){
  const h=quick.querySelector('h2');if(h)h.textContent='Start mixing';
  const p=quick.querySelector('p');if(p)p.textContent='Load two songs, press Play, enable SYNC, then move the crossfader.';
  const jump=quick.querySelector('.jumpbar');
  if(jump){const a=make('a','AutoMix');a.href='#automix-panel';jump.prepend(a);}
 }
 const autoGroup=performance.querySelector('#automix-plan')?.closest('.row')?.parentElement;
 const automix=make('fieldset');automix.id='automix-panel';automix.append(make('legend','AutoMix / assisted transitions'));
 if(autoGroup){
  for(const child of Array.from(autoGroup.children))if(child.tagName!=='STRONG')automix.append(child);
  autoGroup.remove();
 }
 const clock=performance.querySelector('#clock-a-bpm')?.closest('fieldset');
 if(clock)clock.id='clock-panel';

 const readout=make('section','','session-readout');readout.id='session-readout';
 readout.setAttribute('aria-label','Current deck and sync state');
 const meters:HTMLElement[]=[];
 for(const name of ['A','B','SYNC']){
  const item=make('div','','session-meter');item.append(make('strong',name),make('span','No track','meter-value'));readout.append(item);meters.push(item);
 }
 const refresh=make('button','Refresh status');refresh.type='button';readout.append(refresh);
 const inOrder=[
  quick,readout,performance.querySelector('#decks'),performance.querySelector('#sync-panel'),
  performance.querySelector('#mixer-panel'),automix,performance.querySelector('#transport-panel'),
  performance.querySelector('#recording-panel'),performance.querySelector('#intelligence-panel'),
  clock,performance.querySelector('#monitor-panel'),performance.querySelector('#fx-panel'),
  performance.querySelector('#sampler-panel')
 ];
 for(const item of inOrder)if(item)performance.append(item);

 const advanced=make('section');advanced.id='advanced-view';advanced.hidden=true;
 advanced.append(make('h2','Advanced / testing & diagnostics'));
 advanced.append(make('p','The saved test modules stay in GitHub and are never removed from the app. This tab reads diagnostics; GitHub Actions runs the actual automated tests.','section-note'));
 const diagnostic=make('section','','advanced-block');
 diagnostic.append(make('h3','Live diagnostic snapshot'));
 const capture=make('button','Capture status');capture.type='button';capture.id='advanced-capture';
 const exportBtn=make('button','Export JSON');exportBtn.type='button';exportBtn.id='advanced-export';exportBtn.disabled=true;
 const controls=make('div','','row');controls.append(capture,exportBtn);
 const output=make('pre','Press Capture status to collect real module measurements.');output.id='advanced-output';
 diagnostic.append(controls,output);advanced.append(diagnostic);
 const catalog=make('section','','advanced-block');
 catalog.append(make('h3','Saved development modules ('+modules.modules.length+')'));
 const moduleList=make('div','','module-grid');moduleList.id='advanced-modules';
 modules.modules.forEach((module,index)=>appendRow(moduleList,String(index+1)+'. '+module.id.replaceAll('-',' '),
  'Gates: '+module.required_gates.join(', '),module.state));
 catalog.append(moduleList);advanced.append(catalog);
 const suites=make('section','','advanced-block');
 suites.append(make('h3','Browser regression source ('+browserSuites.length+')'));
 const list=make('ul','','suite-list');list.id='advanced-suites';
 for(const suite of browserSuites){const li=make('li');li.append(href(suite+'.spec.ts',repo+'/blob/main/tests/browser/'+suite+'.spec.ts'));list.append(li);}
 suites.append(list,href('CI runs',repo+'/actions'),make('span',' · '),href('Proof reports',repo+'/tree/main/evidence'),
  make('span',' · '),href('Local-agent evidence',repo+'/tree/validation/local-debug/reports/local-debug'));
 advanced.append(suites);
 const harness=Array.from(performance.querySelectorAll(':scope > details')).find(el=>el.textContent?.includes('Audio-kernel regression harness'));
 if(harness){const section=make('section','','advanced-block');section.append(harness);advanced.append(section);}
 main.append(advanced);

 const tabs=make('nav','','view-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Workstation view');
 const regular=make('button','Performance');regular.id='tab-performance';regular.type='button';regular.setAttribute('role','tab');regular.setAttribute('aria-controls','performance-view');
 const expert=make('button','Advanced');expert.id='tab-advanced';expert.type='button';expert.setAttribute('role','tab');expert.setAttribute('aria-controls','advanced-view');
 tabs.append(regular,expert);header.insertBefore(tabs,header.querySelector('.top-actions'));
 performance.setAttribute('role','tabpanel');performance.setAttribute('aria-labelledby',regular.id);
 advanced.setAttribute('role','tabpanel');advanced.setAttribute('aria-labelledby',expert.id);
 function select(view:'performance'|'advanced'):void{
  const playing=view==='performance';performance.hidden=!playing;advanced.hidden=playing;
  regular.setAttribute('aria-selected',String(playing));expert.setAttribute('aria-selected',String(!playing));
  regular.tabIndex=playing?0:-1;expert.tabIndex=playing?-1:0;
 }
 regular.addEventListener('click',()=>select('performance'));expert.addEventListener('click',()=>select('advanced'));
 tabs.addEventListener('keydown',event=>{
  if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
  event.preventDefault();
  if(performance.hidden){select('performance');regular.focus();}else{select('advanced');expert.focus();}
 });
 select(new URLSearchParams(location.search).get('view')==='advanced'?'advanced':'performance');
 async function refreshSession():Promise<void>{
  const [a,b,s]=await Promise.all([
   optional(()=>window.__libertasDeckATest.status()),
   optional(()=>window.__libertasDeckBTest.status()),
   optional(()=>window.__libertasSyncTest.status())
  ]);
  [a,b].forEach((value,index)=>{
   const output=meters[index]?.querySelector('.meter-value');
   if(!output)return;
   if(!value||typeof value!=='object'||!('loaded' in value)){output.textContent='Not loaded';return;}
   const status=value as {loaded:boolean;playing:boolean;sourceFrame:number;sourceSampleRate:number};
   output.textContent=status.loaded?(status.playing?'Playing':'Paused')+' · '+Math.round(status.sourceFrame/status.sourceSampleRate)+' s':'Not loaded';
  });
  const output=meters[2]?.querySelector('.meter-value');
  if(output){
   if(s&&typeof s==='object'&&'enabled' in s&&s.enabled){
    const status=s as unknown as {leader:string;follower:string;followerDeck?:{syncLocked:boolean}};
    output.textContent=status.leader+' → '+status.follower+' · '+(status.followerDeck?.syncLocked?'Locked':'Acquiring');
   }else output.textContent='Off';
  }
 }
 refresh.addEventListener('click',()=>void refreshSession());
 // Display-only polling, never musical or transport authority.
 window.setInterval(()=>{if(!performance.hidden&&document.visibilityState==='visible')void refreshSession();},2500);
 void refreshSession();
 let last:Record<string,unknown>|null=null;
 capture.addEventListener('click',()=>{
  capture.disabled=true;output.textContent='Reading live engine…';
  void (async()=>{
   const targets:Array<[string,()=>Promise<unknown>|unknown]>=[
    ['kernel',()=>window.__libertasKernelTest.status()],['deck_a',()=>window.__libertasDeckATest.status()],
    ['deck_b',()=>window.__libertasDeckBTest.status()],['mixer',()=>window.__libertasMixerTest.status()],
    ['sync',()=>window.__libertasSyncTest.status()],['automix',()=>window.__libertasAutoMixTest.status()],
    ['monitor',()=>window.__libertasMonitorCueTest.status()],['recording',()=>window.__libertasRecordingTest.status()],
    ['sampler',()=>window.__libertasSamplerTest.status()],['midi',()=>window.__libertasMidiTest.status()],
    ['library',async()=>({count:(await window.__libertasLibraryTest.list()).length})]
   ];
   const values=await Promise.all(targets.map(([,fn])=>optional(fn)));
   last={schema:'libertas.gui-snapshot.v1',captured_at:new Date().toISOString(),
    modules:modules.modules.map(m=>({id:m.id,state:m.state})),
    measurements:Object.fromEntries(targets.map(([name],i)=>[name,values[i]]))};
   output.textContent=JSON.stringify(last,null,2);exportBtn.disabled=false;capture.disabled=false;
  })().catch(error=>{output.textContent=String(error);capture.disabled=false;});
 });
 exportBtn.addEventListener('click',()=>{
  if(!last)return;
  const blob=new Blob([JSON.stringify(last,null,2)+'\n'],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=make('a');a.href=url;a.download='libertas0-diagnostics.json';document.body.append(a);a.click();a.remove();
  window.setTimeout(()=>URL.revokeObjectURL(url),0);
 });
}
