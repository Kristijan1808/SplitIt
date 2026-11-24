import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {getAuthUser,getAuthToken,saveAuth,clearAuth} from '../auth';
import {api} from '../api';
import {useLanguage} from '../i18n';
import {fileToAvatarDataUrl} from '../imageUpload';
import {ThemeToggle} from '../components/ThemeToggle';
import {LanguageToggle} from '../components/LanguageToggle';
import type {AuthUser} from '../types';

const photoCopy={
 hr:{title:'Profilna slika',upload:'Učitaj sliku',remove:'Ukloni sliku',hint:'Vide je ostali članovi tvojih grupa. Bez slike vidi se početno slovo.'},
 en:{title:'Profile picture',upload:'Upload picture',remove:'Remove picture',hint:'Shown instead of your initial. Square crop, small size.'},
 de:{title:'Profilbild',upload:'Bild hochladen',remove:'Bild entfernen',hint:'Wird anstelle deines Anfangsbuchstabens angezeigt.'},
 ja:{title:'プロフィール画像',upload:'画像をアップロード',remove:'画像を削除',hint:'頭文字の代わりに表示されます。'}
};

export function SettingsPage(){
 const {t,language}=useLanguage(),[u,setU]=useState<AuthUser|null>(getAuthUser),[error,setError]=useState(''),[busy,setBusy]=useState(false),fileRef=useRef<HTMLInputElement>(null),pc=photoCopy[language];
 useEffect(()=>{if(!getAuthToken())return;let active=true;api.me().then(r=>{if(active){setU(r.user);const token=getAuthToken();if(token)saveAuth(token,r.user)}}).catch(()=>{});return()=>{active=false}},[]);
 async function changeImage(image:string|null){
  if(!u||busy)return;setBusy(true);setError('');
  try{await api.setProfileImage(image);const next={...u,avatarImage:image};setU(next);const token=getAuthToken();if(token)saveAuth(token,next)}
  catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 return <main className="page zPage zSettings"><h1 className="zH1">{t('settingsNav')}</h1>
  <h2 className="zLbl">{t('myAccount')}</h2>
  {u?<section className="zCard zSetCard">
    <div className="zSetProfile">
     <span className="zAv" style={{width:72,height:72,fontSize:28}} aria-hidden="true">{u.avatarImage?<img src={u.avatarImage} alt=""/>:u.username.slice(0,1).toUpperCase()}</span>
     <div className="grow"><b style={{fontSize:20}}>{u.username}</b><span className="zMuted">{pc.hint}</span></div>
    </div>
    <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void fileToAvatarDataUrl(file).then(changeImage).catch(err=>setError(err instanceof Error?err.message:String(err)))}}/>
    <div className="zSetBtns">
     <button type="button" className="zBtn sm" disabled={busy} onClick={()=>fileRef.current?.click()}>{pc.upload}</button>
     {u.avatarImage&&<button type="button" className="zBtnD" style={{minHeight:44}} disabled={busy} onClick={()=>void changeImage(null)}>{pc.remove}</button>}
     <button type="button" className="zBtnG sm zSetOut" onClick={()=>{clearAuth();setU(null)}}>{t('signOut')}</button>
    </div>
    {error&&<p className="error" role="alert">{error}</p>}
   </section>:<section className="zCard zSetCard zSetGuest">
    <div className="zSetProfile"><span className="zAv" style={{width:56,height:56,fontSize:22}} aria-hidden="true">?</span>
     <div className="grow"><b style={{fontSize:18}}>{t('settingsGuestTitle')}</b><span className="zMuted">{t('settingsGuestHint')}</span></div></div>
    <div className="zSetBtns"><Link className="zBtn sm" to="/login">{t('login')}</Link><Link className="zBtnG sm" to="/login?mode=register">{t('welcomeCreateAccount')}</Link></div>
   </section>}
  <h2 className="zLbl">{t('settingsLook')}</h2>
  <section className="zCard zSetCard flSettings zSettingsList">
   <div className="settingsField"><label htmlFor="language-select">{t('language')}</label><LanguageToggle variant="select"/></div>
   <ThemeToggle/>
  </section>
  <h2 className="zLbl">{t('subscriptions')}</h2>
  <Link className="zCard zSetCard zSetLink" to="/subscriptions"><span className="grow"><b>{t('subscriptions')}</b><small className="zMuted">{t('settingsPlansHint')}</small></span><span aria-hidden="true">›</span></Link>
 </main>;
}
