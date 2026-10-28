/* Local preferences, modal focus and synthesized sound. No gameplay rules live here. */
(() => {
  'use strict';
  const B=window.Bloxorz,$=id=>document.getElementById(id);
  let saved={};try{saved=JSON.parse(localStorage.getItem('bloxorz-observatory')||'{}')||{};}catch{}
  B.preferences={artVersion:2,skin:saved.artVersion===2&&['wood','obsidian','bronze'].includes(saved.skin)?saved.skin:'obsidian',theme:saved.artVersion===2&&B.themes[saved.theme]?saved.theme:'observatory',sound:saved.sound===true,reduced:typeof saved.reduced==='boolean'?saved.reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,deathCamera:saved.deathCamera!==false,completed:{}};
  if(saved.completed&&typeof saved.completed==='object')for(const [id,value] of Object.entries(saved.completed))if(/^\d+$/.test(id)&&Number.isInteger(value)&&value>=0)B.preferences.completed[id]=value;
  B.savePreferences=()=>{try{localStorage.setItem('bloxorz-observatory',JSON.stringify(B.preferences));}catch{}};
  let audio;
  B.sound=(kind='roll')=>{
    if(!B.preferences.sound)return;
    try{
      audio=audio||new (window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')void audio.resume();
      const now=audio.currentTime,osc=audio.createOscillator(),gain=audio.createGain();
      osc.type=kind==='roll'?'triangle':'sine';osc.frequency.setValueAtTime(kind==='win'?660:kind==='fall'?160:110,now);osc.frequency.exponentialRampToValueAtTime(kind==='win'?990:kind==='fall'?45:55,now+.16);
      gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.07,now+.01);gain.gain.exponentialRampToValueAtTime(.0001,now+.23);osc.connect(gain);gain.connect(audio.destination);osc.start(now);osc.stop(now+.24);
    }catch{}
  };
  B.menus={
    stack:[],
    open(id,opener){
      const dialog=$(id);if(!dialog)return;if(dialog.open){this.close();return;}
      document.dispatchEvent(new Event('bloxorz:menu'));
      const previous=this.stack.pop();
      const origin=previous?.opener||opener||document.activeElement;
      if(previous)previous.dialog.close();
      this.stack.push({dialog,opener:origin});
      if(dialog.show)dialog.show();else dialog.showModal();
      document.body.classList.add('menu-open');$('open-menu').setAttribute('aria-expanded','true');
      document.querySelector('main').inert=true;
      dialog.querySelector('[data-close]')?.focus();this.onChange?.();
    },
    close(){
      const item=this.stack.pop();if(!item)return;
      item.dialog.close();document.body.classList.remove('menu-open');$('open-menu').setAttribute('aria-expanded','false');document.querySelector('main').inert=false;
      const origin=item.opener?.isConnected?item.opener:$('open-menu');origin?.focus?.({preventScroll:true});
      this.onChange?.();
    },
    get active(){return this.stack.length>0;}
  };
  B.initExperience=(getScene,onAppearance)=>{
    const p=B.preferences;B.menus.onChange=()=>getScene()?.resize();
    const apply=()=>{
      document.body.dataset.theme=p.theme;
      document.querySelectorAll('[data-skin]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.skin===p.skin)));
      document.querySelectorAll('button[data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===p.theme)));
      $('sound-toggle').setAttribute('aria-pressed',String(p.sound));$('sound-toggle').setAttribute('aria-label',p.sound?'Tắt âm thanh':'Bật âm thanh');
      $('reduced-motion').checked=p.reduced;$('death-camera').checked=p.deathCamera;$('world-name').textContent=B.themes[p.theme].name;
      const scene=getScene();if(scene){scene.reducedMotion=p.reduced;scene.deathCamera=p.deathCamera;scene.skin=p.skin;scene.setTheme(p.theme);}
      B.savePreferences();
    };
    document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>B.menus.open(b.dataset.open,b)));
    document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>B.menus.close()));
    document.querySelectorAll('dialog').forEach(d=>{
      if(d.id!=='pause-dialog'){
        const back=document.createElement('button');back.className='panel-back';back.textContent='‹ Menu';
        back.addEventListener('click',()=>B.menus.open('pause-dialog'));d.prepend(back);
      }
      d.addEventListener('cancel',e=>{e.preventDefault();B.menus.close();});
      d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)B.menus.close();});
    });
    document.addEventListener('keydown',e=>{
      if(!B.menus.active)return;
      if(e.code==='Escape'){e.preventDefault();e.stopImmediatePropagation();B.menus.close();return;}
      if(e.code!=='Tab')return;
      const dialog=B.menus.stack.at(-1).dialog;
      const controls=[...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),summary,a[href]')].filter(el=>!el.closest('[hidden]')&&!el.classList.contains('sr-only'));
      const index=controls.indexOf(document.activeElement);
      if(e.shiftKey&&index<=0){e.preventDefault();controls.at(-1)?.focus();}
      else if(!e.shiftKey&&index===controls.length-1){e.preventDefault();controls[0]?.focus();}
    },true);
    $('level-search').addEventListener('input',()=>{
      const query=$('level-search').value.trim().toLocaleLowerCase('vi');
      document.querySelectorAll('#level-grid button').forEach(button=>button.hidden=!`${button.dataset.level} ${button.getAttribute('aria-label')}`.toLocaleLowerCase('vi').includes(query));
    });
    document.querySelectorAll('[data-skin],button[data-theme]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.skin)p.skin=b.dataset.skin;else p.theme=b.dataset.theme;apply();onAppearance();}));
    $('sound-toggle').addEventListener('click',()=>{p.sound=!p.sound;apply();B.sound('roll');});
    $('reduced-motion').addEventListener('change',e=>{p.reduced=e.target.checked;apply();});
    $('death-camera').addEventListener('change',e=>{p.deathCamera=e.target.checked;apply();});
    const media=matchMedia('(prefers-reduced-motion: reduce)');media.addEventListener?.('change',e=>{p.reduced=e.matches;apply();});
    $('focus-toggle').addEventListener('click',()=>{if(B.menus.active)B.menus.close();const active=document.body.classList.toggle('focus-mode');$('focus-toggle').setAttribute('aria-pressed',String(active));$('focus-toggle').setAttribute('aria-label',active?'Thoát tập trung':'Tập trung');$('focus-toggle').querySelector('span').textContent=active?'Thoát tập trung':'Tập trung';document.dispatchEvent(new Event('bloxorz:menu'));getScene()?.resize();});
    apply();return apply;
  };
})();
