import {useSyncExternalStore} from 'react';
import {applyTheme,applyPalette,getSavedTheme,getSavedPalette,getThemeSnapshot,subscribeTheme} from '../theme';
import {palettes,appearanceLabels,type ThemeMode} from '../palettes';
import {useLanguage} from '../i18n';
import {RichSelect,Swatches} from './RichSelect';
export function ThemeToggle() {
 useSyncExternalStore(subscribeTheme,getThemeSnapshot,getThemeSnapshot);
 const {language} = useLanguage();
 const labels = appearanceLabels[language] || appearanceLabels.en;
 return <section className="appearanceSettings">
  <label className="themeSelectLabel" htmlFor="colour-theme">{labels.palette}</label>
  <RichSelect id="colour-theme" ariaLabel={labels.palette} value={getSavedPalette()} onChange={applyPalette}
   options={palettes.map(p=>({value:p.id,label:p.name,visual:<Swatches colors={p.swatches}/>}))}/>
  <h2>{labels.mode}</h2><div className="themeModes" role="group" aria-label={labels.mode}>
   {(['system','light','dark'] as ThemeMode[]).map(mode=><button type="button" key={mode} aria-pressed={getSavedTheme()===mode} onClick={()=>applyTheme(mode)}>{labels[mode]}</button>)}
  </div>
 </section>;
}
