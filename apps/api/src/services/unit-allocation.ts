// Allocate each cent once, including the still-unclaimed units.
export function unitShares(price:number, quantity:number, claims:{personId:string;units:number}[]) {
 const fail=(message:string):never=>{throw Object.assign(new Error(message),{status:409})};
 if(!Number.isInteger(quantity)||quantity<1||quantity>999) fail("Neispravna količina stavke.");
 const sorted=[...claims].sort((a,b)=>a.personId.localeCompare(b.personId));
 if(new Set(sorted.map(s=>s.personId)).size!==sorted.length)fail("Sudionik je naveden više puta.");
 if(sorted.some(s=>!Number.isInteger(s.units)||s.units<1))fail("Odaberi cijeli broj komada.");
 const used=sorted.reduce((n,s)=>n+s.units,0);
 if(used>quantity)fail("Nema toliko slobodnih komada. Osvježi račun i odaberi preostalu količinu.");
 const total=Math.round(price*100), weights=[...sorted.map(s=>s.units),quantity-used];
 const raw=weights.map(w=>total*w/quantity), amounts=raw.map(Math.floor);
 const order=raw.map((v,i)=>({i,f:v-amounts[i]})).sort((a,b)=>b.f-a.f||a.i-b.i);
 for(let left=total-amounts.reduce((a,b)=>a+b,0),i=0;i<left;i++)amounts[order[i].i]++;
 return sorted.map((s,i)=>({...s,amount:amounts[i]/100}));
}
