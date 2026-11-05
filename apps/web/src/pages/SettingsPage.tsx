import {useState} from 'react';
import {Link} from 'react-router-dom';
import {getAuthUser,clearAuth} from '../auth';
import {useLanguage} from '../i18n';
import {ThemeToggle} from '../components/ThemeToggle';
import {LanguageToggle} from '../components/LanguageToggle';
export function SettingsPage(){const {t}=useLanguage(),[u,setU]=useState(getAuthUser);return <main className="page"><h1>{t('settingsNav')}</h1><section className="card flSettings"><div>{t('language')} <LanguageToggle/></div><ThemeToggle/><Link className="secondaryButton" to="/subscriptions">{t('subscriptions')}</Link>{u?<button className="secondaryButton" onClick={()=>{clearAuth();setU(null)}}>{u.username} · {t('signOut')}</button>:<Link className="secondaryButton" to="/login">{t('login')}</Link>}</section></main>}
