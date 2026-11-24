import { useLanguage } from '../i18n';
import './home-bleed.css';
export function FullHomeBanner(){
 const {t}=useLanguage();
 return <header className="fullHomeBanner"><h1>{t('teamSlogan')}</h1><svg width="84" height="64" viewBox="0 0 84 64" aria-hidden="true" focusable="false"><g fill="white" opacity=".74"><circle cx="16" cy="22" r="7"/><circle cx="68" cy="22" r="7"/><path d="M2 50l6-17 8-4 9 4 7 17zm50 0 7-17 9-4 8 4 6 17z"/></g><g fill="white"><circle cx="42" cy="15" r="9"/><path d="M22 57l9-26 11-6 12 6 9 26z"/></g></svg></header>
}
