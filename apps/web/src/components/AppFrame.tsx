import {type ReactNode,useEffect,useState} from 'react';
import {syncAccountGroups,refreshAuthUser} from '../accountSync';
import {useAuthTick} from '../useAuthTick';
import {QuickAdd} from './QuickAdd';
import {NavLink,Link,useLocation} from 'react-router-dom';
import {House,Users,Plus,Activity,User,CloudOff} from 'lucide-react';
import {useLanguage} from '../i18n';
import {getAuthUser} from '../auth';
import {getSavedGroups} from '../storage';
import {applyTheme,getSavedTheme} from '../theme';
const onGroupSlug=(p:string)=>p.startsWith('/g/')?decodeURIComponent(p.split('/')[2]||''):'';
export function AppFrame({children}:{children:ReactNode}){
 const {t,language}=useLanguage(),{pathname}=useLocation();useEffect(()=>{applyTheme(getSavedTheme());void syncAccountGroups();void refreshAuthUser()},[]);
 useAuthTick();
 const [quick,setQuick]=useState(false);
 const [online,setOnline]=useState(()=>navigator.onLine);
 useEffect(()=>{const on=()=>setOnline(true),off=()=>setOnline(false);addEventListener('online',on);addEventListener('offline',off);return()=>{removeEventListener('online',on);removeEventListener('offline',off)}},[]);
 const saved=getSavedGroups().filter(g=>!(g as {archived?:boolean}).archived).slice(0,8),curSlug=onGroupSlug(pathname);
 const hr=language==='hr',user=getAuthUser(),onGroup=pathname.startsWith('/g/');
 const active=(p:string)=>p==='/activity'?pathname.startsWith('/activity'):p==='/'?pathname==='/':p==='/my-groups'?pathname.startsWith('/my-groups')||onGroup:pathname.startsWith(p);
 const desk=[['/',t('home')],['/my-groups',t('groupsNav')],['/settings',t('settingsNav')],['/subscriptions',t('subscriptions')]] as const;
 const m=[[House,'/',t('home')],[Users,'/my-groups',t('groupsNav')]] as const;
 const m2=[[Activity,'/activity',hr?'Aktivnost':'Activity'],[User,'/settings',hr?'Profil':'Profile']] as const;
 if(pathname==='/welcome')return <div className="fl dFrame zBare">{children}</div>;
 return <div className="fl dFrame">
  <aside className="dSide"><Link to="/" className="dLogo" aria-label="Home">÷</Link><button type="button" className="dSideAdd" onClick={()=>setQuick(true)}><Plus size={18}/>{t('quickAddTitle')}</button><small>{t('navMenu')}</small>
   {desk.map(([p,l])=><NavLink key={p} end to={p} className={active(p)?'on':''}>{l}</NavLink>)}
   {saved.length>0&&<><small className="dSideGroupsHead">{t('groupsNav')}</small><div className="dSideGroups">{saved.map(g=><Link key={g.slug} to={'/g/'+encodeURIComponent(g.slug)} className={curSlug===g.slug?'on':''}><i className={'dTile t'+(g.name.charCodeAt(0)%4)}>{g.name.charAt(0).toUpperCase()}</i><span>{g.name}</span></Link>)}<Link to="/new" className="dSideNew">+ {t('createGroup')}</Link></div></>}
   <Link to={user?'/settings':'/login'} className="dSideUser"><i>{user?.avatarImage?<img src={user.avatarImage} alt=""/>:(user?.username||'?').charAt(0).toUpperCase()}</i><div><b>{user?.username||t('login')}</b><small>{hr?'Besplatno':'Free'}</small></div></Link></aside>
  {!onGroup&&<nav className="dTabs">{m.map(([I,p,l])=><NavLink key={p} end to={p} className={active(p)?'on':''}><span className="dTi"><I size={21}/></span>{l}</NavLink>)}
   <button type="button" className="dFab" aria-label={t('quickAddTitle')} aria-haspopup="dialog" aria-expanded={quick} onClick={()=>setQuick(q=>!q)}><Plus size={28} style={{transform:quick?'rotate(45deg)':undefined,transition:'transform .2s'}}/></button>
   {m2.map(([I,p,l])=><NavLink key={p} to={p} className={active(p)?'on':''}><span className="dTi"><I size={21}/></span>{l}</NavLink>)}</nav>}
  {quick&&<QuickAdd onClose={()=>setQuick(false)}/>}
  <div className="dMain">{!online&&<div className="zOffline" role="status"><CloudOff size={16}/><span>{t('offlineBanner')}</span></div>}{children}</div></div>
}
