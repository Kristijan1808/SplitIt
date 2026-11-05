import {type ReactNode,useEffect} from 'react';
import {NavLink,Link,useLocation} from 'react-router-dom';
import {Check,House,Users,SlidersHorizontal,Sparkles} from 'lucide-react';
import {useLanguage} from '../i18n';
import {applyTheme,getSavedTheme} from '../theme';
export function AppFrame({children}:{children:ReactNode}){
 const {t}=useLanguage(),{pathname}=useLocation();useEffect(()=>{applyTheme(getSavedTheme())},[]);
 const tabs=[[House,'/',t('home')],[Users,'/my-groups',t('groupsNav')],[SlidersHorizontal,'/settings',t('settingsNav')],[Sparkles,'/subscriptions',t('subscriptions')]] as const;
 return <div className="fl"><header className="flHeader"><Link className="brandmark" to="/"><i><Check size={21}/></i>SplitIt <em>.</em></Link><Link to="/settings" aria-label={t('settingsNav')}><SlidersHorizontal size={22}/></Link></header><nav className="flNav"><small>{t('navMenu')}</small>{tabs.map(([Icon,path,label])=><NavLink key={path} end to={path} className={({isActive})=>isActive||path==='/my-groups'&&pathname.startsWith('/g/')?'on':''}><Icon size={21}/>{label}</NavLink>)}</nav>{children}</div>
}
