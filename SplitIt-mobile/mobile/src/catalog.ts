export const currencies=["EUR","USD","GBP","CHF","CAD","AUD","BAM","RSD","PLN","CZK","SEK","NOK","DKK","HUF"];
export const categories=[
 {id:'other',icon:'receipt',hr:'Ostalo',en:'Other'},
 {id:'taxi',icon:'taxi',hr:'Taksi',en:'Taxi'},
 {id:'food',icon:'food',hr:'Hrana i piće',en:'Food and drink'},
 {id:'travel',icon:'travel',hr:'Putovanje',en:'Travel'},
 {id:'home',icon:'home',hr:'Dom',en:'Home'},
 {id:'fun',icon:'fun',hr:'Zabava',en:'Entertainment'},
 {id:'shopping',icon:'shopping',hr:'Kupovina',en:'Shopping'},
 {id:'health',icon:'health',hr:'Zdravlje',en:'Health'},
];
export const categoryIcon=(id?:string)=>categories.find(c=>c.id===id)?.icon||'receipt';
export const currencySymbol=(id:string)=>({EUR:'€',USD:'$',GBP:'£',CHF:'Fr.'}[id]||id);
