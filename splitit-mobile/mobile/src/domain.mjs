export const cents = (value) => {
  const text = String(value).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(text))
    throw new Error(
      "Unesi valjan iznos s najviše dvije decimale. / Enter an amount with at most two decimals.",
    );
  const result = Math.round(Number(text) * 100);
  if (!Number.isSafeInteger(result))
    throw new Error("Iznos je prevelik. / Amount too large.");
  return result;
};
export const splitCents = (total, count) =>
  count < 1
    ? []
    : Array.from(
        { length: count },
        (_, i) => Math.floor(total / count) + (i < total % count ? 1 : 0),
      );
export function validateBill(items, payers, confirm) {
  if (!items.length || items.some((x) => !x.name.trim()))
    throw new Error("Svaka stavka treba naziv. / Each item needs a name.");
  const total = items.reduce((s, x) => s + cents(x.price), 0);
  const paid = payers.reduce((s, x) => {
    const n = cents(x.amount);
    if (!x.personId || n <= 0)
      throw new Error("Provjeri platitelje. / Check payers.");
    return s + n;
  }, 0);
  if (new Set(payers.map((x) => x.personId)).size !== payers.length)
    throw new Error("Platitelji se ne smiju ponavljati. / Duplicate payer.");
  if (paid > total)
    throw new Error("Uplaćeno je više od ukupnog iznosa. / Overpayment.");
  if (
    confirm &&
    (paid !== total || total <= 0 || items.some((x) => !x.ids.length))
  )
    throw new Error(
      "Dodijeli sve stavke i uskladi uplate s ukupnim iznosom. / Assign all items and match the paid total.",
    );
  return { total, paid };
}
// Same probabilities as web: every subset of size 1..4, plus three equal-split slots.
// Count and unrank instead of allocating all combinations for large groups.
const choose = (n, k) => {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - i + 1)) / i;
  return Math.round(r);
};
export function randomSelection(ids, random = Math.random) {
  if (!ids.length) return [];
  const sizes = Array.from({ length: Math.min(4, ids.length) }, (_, i) =>
    choose(ids.length, i + 1),
  );
  let rank = Math.floor(random() * (sizes.reduce((a, b) => a + b, 0) + 3));
  let size = 1;
  for (const count of sizes) {
    if (rank < count) break;
    rank -= count;
    size++;
  }
  if (size > sizes.length) return [...ids];
  const result = [];
  let start = 0;
  for (let remaining = size; remaining > 0; remaining--) {
    for (let i = start; i < ids.length; i++) {
      const count = choose(ids.length - i - 1, remaining - 1);
      if (rank < count) {
        result.push(ids[i]);
        start = i + 1;
        break;
      }
      rank -= count;
    }
  }
  return result;
}

// Per-expense net contribution. Never infer authorship from who paid.
export function expenseNet(expense, personId) {
  if (!personId) return null;
  const paid = expense.payers
    .filter((p) => p.personId === personId)
    .reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0);
  const owed = [...expense.shares,...(expense.provisionalShares||[])]
    .filter((p) => p.personId === personId)
    .reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0);
  return {
    paid,
    owed,
    net: paid - owed,
    involved:
      expense.payers.some((p) => p.personId === personId) ||
      expense.shares.some((p) => p.personId === personId),
  };
}
export function invitationCode(value, webUrl) {
  try {
    const url = new URL(value);
    const custom = url.protocol === "splitit:" && url.hostname === "join";
    const web =
      webUrl &&
      url.protocol === "https:" &&
      url.origin === new URL(webUrl).origin &&
      url.pathname.replace(/\/$/, "") === "/join";
    if (!custom && !web) return null;
    const code = (url.searchParams.get("code") || "").trim().toUpperCase();
    return /^[A-Z0-9]{6}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}
export function historyDetails(entry) {
  let value = null;
  try {
    value = JSON.parse(
      entry.action === "DELETE" ? entry.oldValue : entry.newValue,
    );
  } catch {}
  return value &&
    value.version === 2 &&
    typeof value.title === "string" &&
    Number.isFinite(value.total)
    ? value
    : null;
}

// A total-only bill uses one accounting line so existing API/web remain compatible.
export function prepareBillItems(mode, amount, ids, items, assignNow) {
  if (mode === "equal") return [{ key: "equal", name: "Jednaka podjela", price: amount, ids: [...ids] }];
  return items.flatMap(item => {
    const quantity=item.quantity===undefined?1:Number(item.quantity);
    if(!Number.isInteger(quantity)||quantity<1||quantity>999)return [{...item,name:"",ids:[]}];
    let price;try{price=item.originalLineTotal??(cents(item.price)*quantity/100).toFixed(2)}catch{return [{...item,name:"",ids:[]}]}
    const row={...item,quantity,price};return [assignNow?row:{...row,ids:[],originalShares:undefined}];
  });
}
export function draftReadiness(draft) {
  const total = draft.items.reduce((sum, item) => sum + Math.round(Number(item.price) * 100), 0);
  const paid = draft.payers.reduce((sum, payer) => sum + Math.round(Number(payer.amount) * 100), 0);
  const assigned = draft.items.filter(item => item.shares.length > 0).length;
  return { total, paid, assigned, missing: draft.items.length - assigned,
    ready: total > 0 && total === paid && assigned === draft.items.length && assigned > 0 };
}

export const requestKey = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
 const n = Math.floor(Math.random() * 16); return (c === 'x' ? n : (n & 3) | 8).toString(16);
});
export function allocateWeighted(total,weights) {
 if(!Number.isSafeInteger(total)||total<0||!weights.length||weights.some(w=>!Number.isFinite(w)||w<0)||weights.reduce((a,b)=>a+b,0)<=0)throw new Error('Provjeri omjere podjele.');
 const sum=weights.reduce((a,b)=>a+b,0),raw=weights.map(w=>total*w/sum),out=raw.map(Math.floor);
 const order=raw.map((v,i)=>({i,f:v-out[i]})).sort((a,b)=>b.f-a.f||a.i-b.i);
 const left=total-out.reduce((a,b)=>a+b,0);for(let i=0;i<left;i++)out[order[i%order.length].i]++;
 return out;
}
export function customAllocation(total,ids,values,mode){
 const numbers=ids.map(id=>cents(values[id]||'0'));
 if(mode==='amount'){if(numbers.reduce((a,b)=>a+b,0)!==total)throw new Error('Zbroj pojedinačnih iznosa mora biti jednak računu.');return numbers;}
 if(mode==='percent'&&numbers.reduce((a,b)=>a+b,0)!==10000)throw new Error('Zbroj postotaka mora biti 100 %.');
 return allocateWeighted(total,numbers);
}

export function inferCategory(title){
 const words=String(title).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
 const rules=[['taxi',['taksi','taxi','uber','bolt']],['food',['rucak','vecera','dorucak','pizza','pivo','kava','restoran','hrana','lunch','dinner','coffee']],['travel',['hotel','let','avion','vlak','bus','putovanje','flight','train']],['home',['stanarina','najam','struja','rezije','rent']],['fun',['kino','koncert','cinema','concert']],['shopping',['kupovina','shopping','namirnice']],['health',['ljekarna','lijek','doktor','pharmacy']]];
 return String(rules.find(([,matches])=>words.some(w=>matches.includes(w)))?.[0]||'other');
}
export function stepQuantity(value,delta){const n=Number(value);return String(Math.min(999,Math.max(1,(Number.isInteger(n)?n:1)+delta)));}
