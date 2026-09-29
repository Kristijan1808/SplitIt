import {CurrencyPicker} from "./CurrencyPicker";
import {inferCategory,stepQuantity} from "./domain.mjs";
import {categories,categoryIcon,currencySymbol} from "./catalog";
import {requestKey,customAllocation} from "./domain.mjs";
import React, { useState, useEffect, useRef } from "react";
import { Alert, View, Pressable, TextInput, Modal, ScrollView } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { api, type FxQuote } from "./api";
import { Button, Card, Chip, Icon, Field, Heading, Page, Txt, useUI, s } from "./ui";
import { Wheel } from "./Wheel";
import { cents, validateBill, prepareBillItems, splitCents } from "./domain.mjs";
import type { Group, Expense } from "./types";
type Item = {
  key: string;
  quantity?: string | number;
  name: string;
  price: string;
  ids: string[];
  originalShares?: { personId: string; amount: number }[];
};
let serial = 0;
const key = () => String(++serial);
export function ExpenseEditor({
  group,
  run,
  done,
  expense,
  participantId,
  startCamera = false,
}: {
  group: Group;
  expense?: Expense;
  participantId?: string;
  startCamera?: boolean;
  run: (f: () => Promise<void>) => Promise<boolean>;
  done: (draft?: boolean) => Promise<void>;
}) {
  const source=expense;
  const { t, c, busy: useBusy } = useUI();
  const [mode, setMode] = useState<"equal" | "items">(source || startCamera ? "items" : "equal");
  const [splitMode,setSplitMode]=useState("equal");
  const [splitValues,setSplitValues]=useState<Record<string,string>>({});
  const [picker,setPicker]=useState<"category"|"currency"|null>(null);
  const baseCurrency=group.currency||"EUR";
  const [currency,setCurrency]=useState(baseCurrency);
  const [quote,setQuote]=useState<FxQuote|null>(null);
  const [rateError,setRateError]=useState("");
  const [rateLoading,setRateLoading]=useState(false);
  const [rateRefresh,setRateRefresh]=useState(0);
  const [manualCategory,setManualCategory]=useState(!!expense);
  useEffect(()=>{if(currency===baseCurrency){setQuote(null);setRateError("");setRateLoading(false);return;}let active=true;setQuote(null);setRateError("");setRateLoading(true);
    api.fxQuote(group.slug,currency).then(value=>{if(active)setQuote(value)}).catch(e=>{if(active)setRateError(e.message)}).finally(()=>{if(active)setRateLoading(false)});
    const timer=setInterval(()=>setRateRefresh(n=>n+1),5*60000);return()=>{active=false;clearInterval(timer)};
  },[currency,baseCurrency,group.slug,rateRefresh]);
  const [equalAmount, setEqualAmount] = useState("");
  const [equalIds, setEqualIds] = useState(group.people.map(p => p.id));
  const [assignNow, setAssignNow] = useState(!!source);
  const [note, setNote] = useState(source?.note ?? "");
  const [items, setItems] = useState<Item[]>(() =>
    source
      ? source.items.map((i) => ({
          key: key(),
          name: i.name,
          price: (Number(i.price)/(i.quantity||1)).toFixed(2),
          quantity:String(i.quantity||1),
          ids: i.shares.map((s) => s.personId),
          originalShares: i.shares.map((s) => ({
            personId: s.personId,
            amount: Number(s.amount),
          })),
        }))
      : [
          {
            key: key(),
            name: "",
            price: "",
            ids: group.people.map((p) => p.id),
          },
        ],
  );
  const [payers, setPayers] = useState<{ personId: string; amount: string }[]>(
    () =>
      source?.payers.map((p) => ({
        personId: p.personId,
        amount: String(p.amount),
      })) ?? [],
  );
  const [multiplePayers, setMultiplePayers] = useState(
    (source?.payers.length ?? 0) > 1,
  );
  const [singlePayer, setSinglePayer] = useState(
    source?.payers.length === 1 ? source!.payers[0].personId : participantId ?? "",
  );

  const [billDate,setBillDate]=useState((expense?.billDate||new Date().toISOString()).slice(0,10));
  const [category,setCategory]=useState(source?.category||"other");
  const [requestId,setRequestId]=useState(requestKey);
  const [showSplit,setShowSplit]=useState(false);
  const [showPayers,setShowPayers]=useState(false);
  const [advanced, setAdvanced] = useState(false);
  const autoScan = useRef(false);
  useEffect(() => {
    if (startCamera && !autoScan.current) {
      autoScan.current = true;
      void scan(true);
    }
  }, [startCamera]);
  const [wheel, setWheel] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const effectiveItems: Item[] = prepareBillItems(mode, equalAmount, equalIds, items, assignNow);
  const total = effectiveItems.reduce(
    (a, b) => a + (Number.isFinite(Number(b.price.replace(",", "."))) ? Math.round(Number(b.price.replace(",", ".")) * 100) / 100 : 0),
    0,
  );
  const actualPayers = multiplePayers
    ? payers.filter(
        (p) =>
          p.amount.trim() !== "" && Number(p.amount.replace(",", ".")) !== 0,
      )
    : singlePayer && total > 0
      ? [{ personId: singlePayer, amount: total.toFixed(2) }]
      : [];
  const paid = actualPayers.reduce(
    (a, b) => a + (Number(b.amount.replace(",", ".")) || 0),
    0,
  );
  const patch = (id: string, values: Partial<Item>) =>
    setItems((xs) =>
      xs.map((x) =>
        x.key === id
          ? {
              ...x,
              ...values,
              originalShares:
                values.ids !== undefined || values.price !== undefined || values.quantity !== undefined
                  ? undefined
                  : x.originalShares,
            }
          : x,
      ),
    );
  async function scan(camera: boolean) {
    await run(async () => {
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted)
          throw new Error(
            t(
              "Dopusti kameru u postavkama uređaja.",
              "Allow camera access in device settings.",
            ),
          );
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        quality: 0.85,
        allowsEditing: false,
      };
      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      const converted = await ImageManipulator.manipulateAsync(
        asset.uri,
        asset.width > 1800 ? [{ resize: { width: 1800 } }] : [],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      );
      const bill = await api.parse(converted.uri);
      if (!bill.items.length)
        throw new Error(
          t("Nisu pronađene stavke računa.", "No receipt items found."),
        );
      setMode("items");
      setItems(
        bill.items.map((x) => ({
          key: key(),
          name: x.name,
          price: Number(x.price).toFixed(2),
          ids: group.people.map((p) => p.id),
        })),
      );
    });
  }
  function chooseScan(camera: boolean) {
    if (items.some((i) => i.name || i.price))
      Alert.alert(
        t("Zamijeniti stavke?", "Replace items?"),
        t(
          "Skenirani račun zamijenit će unesene stavke.",
          "The scanned receipt will replace entered items.",
        ),
        [
          { text: t("Odustani", "Cancel"), style: "cancel" },
          { text: t("Nastavi", "Continue"), onPress: () => void scan(camera) },
        ],
      );
    else void scan(camera);
  }
  async function save() {
    await run(async()=>{
      if(group.locked)throw new Error(t("Grupa je zaključana.","Group is locked."));
      if(createdId||confirmed){await done();return;}
      if(effectiveItems.length>200)throw new Error(t("Najviše 200 stavki po računu.","Maximum 200 items per bill."));
      const checked=validateBill(effectiveItems,actualPayers,false);
      if(checked.total<=0||checked.total!==checked.paid)throw new Error(t("Zbroj uplata mora odgovarati računu.","Payments must match the total."));
      if(mode==="equal"&&!equalIds.length)throw new Error(t("Odaberi barem jednu osobu.","Select at least one person."));
      if(currency!==baseCurrency&&(!quote||quote.base!==currency||quote.quote!==baseCurrency||!quote.expiresAt||Date.parse(quote.expiresAt)<=Date.now()))throw new Error(t("Osvježi automatski tečaj prije spremanja.","Refresh the automatic rate before saving."));
      const parsedDate=new Date(`${billDate}T12:00:00Z`);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(billDate)||!Number.isFinite(parsedDate.getTime())||parsedDate.toISOString().slice(0,10)!==billDate)throw new Error(t("Provjeri datum računa.","Check the bill date."));
      const custom=mode==="equal"&&splitMode!=="equal"?customAllocation(checked.total,equalIds,splitValues,splitMode):null;
      const body={requestId,currency,quoteId:quote?.id,note:note.trim()||undefined,billDate:parsedDate.toISOString(),category,
        payers:actualPayers.map(p=>({personId:p.personId,amount:cents(p.amount)/100})),
        items:effectiveItems.map((x,i)=>({ordinalNumber:i+1,name:x.name.trim(),quantity:Number(x.quantity||1),price:cents(x.price)/100,
          shares:custom?x.ids.map((personId,j)=>({personId,amount:custom[j]/100})):x.originalShares??x.ids.map(personId=>({personId}))}))};
      if(expense){await api.updateExpense(group.slug,expense.id,{...body,expectedUpdatedAt:expense.updatedAt});setConfirmed(true);await done();return;}
      const saved=await api.createExpense(group.slug,body);
      setCreatedId(saved.id);setConfirmed(true);
      await done();
    });
  }
  return (
    <Page>
      <Heading
        title={
          expense
            ? t("Uredi račun", "Edit bill")
            : t("Novi trošak", "New expense")
        }
        subtitle={group.name}
      />
      {createdId || confirmed ? (<Card><Txt>{t("Račun je spremljen.","Bill saved.")}</Txt><Button label={t("Otvori grupu","Open group")} onPress={()=>void run(()=>done())}/></Card>) : (
        <>
          {!expense && <View style={s.row}>
            {(["equal", "items"] as const).map(value => <Pressable key={value}
              accessibilityRole="radio" aria-checked={mode === value} accessibilityState={{ checked: mode === value }}
              disabled={useBusy} onPress={() => setMode(value)}
              style={{ flex: 1, padding: 12, minHeight: 60, borderRadius: 16, borderWidth: 1,
                borderColor: mode === value ? c.accent : c.line, backgroundColor: mode === value ? c.tint : c.card, gap: 4 }}>
              <Txt bold>{value === "equal" ? t("Bez stavki", "Without items") : t("Po stavkama", "By item")}</Txt>
              <Txt muted size={12}>{value === "equal" ? t("Jedan iznos za sve", "One total to share") : t("Svatko bira svoje", "Everyone picks their items")}</Txt>
            </Pressable>)}
          </View>}
          <Card>
            {mode === "items" && <View style={s.row}>
              <View style={{ flex: 1 }}>
                <Button
                  secondary
                  icon="camera"
                  label={t("Skeniraj", "Scan")}
                  onPress={() => chooseScan(true)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  secondary
                  icon="gallery"
                  label={t("Galerija", "Gallery")}
                  onPress={() => chooseScan(false)}
                />
              </View>
            </View>}
            <View style={s.row}>
              <Pressable accessibilityRole="button" accessibilityLabel={t("Odaberi kategoriju","Choose category")} disabled={useBusy} onPress={()=>setPicker("category")} style={{width:48,height:48,borderRadius:24,backgroundColor:c.tint,alignItems:"center",justifyContent:"center"}}><Icon name={categoryIcon(category)} color={c.accent} size={26}/></Pressable>
              <TextInput accessibilityLabel={t("Naslov računa","Bill title")} placeholder={t("Za što je račun?","What is it for?")} placeholderTextColor={c.muted} value={note} onChangeText={value=>{setNote(value);if(!manualCategory)setCategory(inferCategory(value))}} maxLength={200} editable={!useBusy} style={{flex:1,minWidth:0,minHeight:52,borderWidth:0,backgroundColor:c.bg,borderRadius:14,color:c.ink,fontSize:20,padding:12}}/>
            </View>
            <View style={s.row}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${t("Odaberi valutu","Choose currency")}: ${currency}`} disabled={useBusy} onPress={()=>setPicker("currency")} style={{minWidth:48,minHeight:48,paddingHorizontal:5,borderRadius:10,borderWidth:1,borderColor:c.line,alignItems:"center",justifyContent:"center"}}><Txt bold size={20}>{currencySymbol(currency)}</Txt><Txt muted size={10}>{currency}</Txt></Pressable>
              {mode==="equal"?<TextInput accessibilityLabel={`${t("Iznos","Amount")} (${currency})`} placeholder="0,00" placeholderTextColor={c.muted} keyboardType="decimal-pad" value={equalAmount} onChangeText={setEqualAmount} editable={!useBusy} style={{flex:1,minWidth:0,minHeight:60,borderWidth:0,backgroundColor:c.tint,borderRadius:16,color:c.ink,fontSize:32,fontWeight:"600",padding:12}}/>:<Txt muted>{t("Valuta cijena stavki","Currency for item prices")}</Txt>}
            </View>
            {currency!==baseCurrency&&<View style={{gap:6,padding:10,borderRadius:12,backgroundColor:c.bg}}>
              {rateLoading?<Txt muted>{t("Dohvaćam tečaj…","Fetching exchange rate…")}</Txt>:rateError?<Txt style={{color:c.danger}}>{rateError}</Txt>:quote&&<><Txt bold>≈ {(total*quote.rate).toFixed(2)} {baseCurrency}</Txt><Txt muted size={12}>1 {currency} = {quote.rate} {baseCurrency} · {quote.rateDate}</Txt><Txt muted size={11}>{quote.source}</Txt></>}
              <Button compact secondary disabled={rateLoading} label={t("Osvježi tečaj","Refresh rate")} onPress={()=>setRateRefresh(n=>n+1)}/>
            </View>}

            {expense?.currency&&expense.currency!==baseCurrency&&<Txt muted size={12}>{t("Uređuješ preračunate iznose u glavnoj valuti grupe. Spremanje zamjenjuje prethodni zapis tečaja.","You are editing converted amounts in the group currency. Saving replaces the previous exchange-rate record.")}</Txt>}

          </Card>
          {mode === "equal" ? <Card>
            <Button secondary label={`${t("Podjela", "Split")}: ${splitMode==="equal"?t("jednako", "equally"):splitMode==="amount"?t("po iznosima","by amount"):splitMode==="percent"?t("po postocima","by percentage"):t("po omjerima","by weight")} · ${equalIds.length} ${t("osoba", "people")}`} onPress={()=>setShowSplit(!showSplit)}/>
            {showSplit&&<>
            <Txt bold>{t("Tko dijeli račun?", "Who shares the bill?")}</Txt>
            <Txt muted size={12}>{t("Svi su uključeni. Isključi osobe koje ne sudjeluju.", "Everyone is included. Uncheck anyone not participating.")}</Txt>
            <View style={s.wrap}>{group.people.map(p => <Chip key={p.id} label={p.name} selected={equalIds.includes(p.id)}
              onPress={() => setEqualIds(ids => ids.includes(p.id) ? ids.filter(id => id !== p.id) : [...ids, p.id])} />)}</View>
            <View style={s.wrap}>{[["equal",t("Jednako", "Equally")],["amount",t("Iznosi", "Amounts")],["percent",t("Postoci", "Percent")],["weight",t("Omjeri", "Weights")]].map(([id,label])=><Chip key={id} label={label} selected={splitMode===id} onPress={()=>setSplitMode(id)}/>)}</View>
            {splitMode!=="equal"&&<><Txt muted size={12}>{splitMode==="amount"?t("Upiši koliko svatko duguje. Zbroj mora biti jednak računu.","Enter each person's share. The sum must equal the bill."):splitMode==="percent"?t("Zbroj postotaka mora biti 100 %.","Percentages must total 100%."):t("Primjer: omjer 2 : 1 znači dvostruki udio za prvu osobu.","For example, 2 : 1 assigns twice as much to the first person.")}</Txt>{group.people.filter(p=>equalIds.includes(p.id)).map(p=><Field key={p.id} decimal label={`${p.name} (${splitMode==="amount"?currency:splitMode==="percent"?"%":"udio"})`} value={splitValues[p.id]||""} onChange={value=>setSplitValues(x=>({...x,[p.id]:value}))}/>)}</>}
            </>}
            {splitMode==="equal"&&<Txt bold style={{ color: c.accent }}>{equalIds.length ? (() => {
              const shares = splitCents(Math.round(total * 100), equalIds.length);
              const low = Math.min(...shares) / 100, high = Math.max(...shares) / 100;
              return `${low.toFixed(2)}${low !== high ? ` – ${high.toFixed(2)}` : ""} ${currency} ${t("po osobi", "per person")}`;
            })() : t("Odaberi barem jednu osobu.", "Select at least one person.")}</Txt>}
          </Card> : <>
          {!expense && <Card style={{ backgroundColor: c.infoTint, borderColor: c.info }}>
            <Txt bold style={{ color: c.info }}>{t("Unesi → kreiraj račun → ekipa bira", "Enter → create bill → everyone selects")}</Txt>
            <Txt size={12}>{t("Račun odmah ulazi u troškove grupe. Stavke ostaju nedodijeljene dok ih članovi ne označe. Jednu stavku može dijeliti više osoba.", "The bill immediately counts towards group expenses. Members claim unassigned items. Any item can be shared by several people.")}</Txt>
            <Chip label={t("Podijeli sada", "Assign now")} selected={assignNow} onPress={() => setAssignNow(!assignNow)} />

          </Card>}
          <View style={s.between}><Txt bold size={20}>{t("Stavke računa", "Bill items")}</Txt><Txt muted size={13}>{items.length}</Txt></View>
          <Txt muted size={12}>{t("Unesi jediničnu cijenu i količinu. Količina ne ograničava broj osoba koje dijele stavku.", "Enter unit price and quantity. Quantity does not limit the number of people sharing the item.")}</Txt>
          {assignNow && <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: advanced }}
            onPress={() => setAdvanced(!advanced)}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Txt bold style={{ color: c.accent }}>
              {t("Nasumična podjela", "Random split")} {advanced ? "⌃" : "⌄"}
            </Txt>
          </Pressable>}
          {assignNow && advanced && (
            <Button
              secondary
              label={t(
                "Nasumična podjela cijelog računa",
                "Random split of the entire bill",
              )}
              disabled={!group.people.length || total <= 0}
              onPress={() => setWheel("all")}
            />
          )}
          {items.map((item, i) => (
            <Card key={item.key}>
              <View style={s.between}>
                <Txt bold>
                  {t("STAVKA", "ITEM")} {i + 1}
                </Txt>
                {items.length > 1 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t("Ukloni stavku", "Remove item")} ${i + 1}`}
                    onPress={() =>
                      setItems(items.filter((x) => x.key !== item.key))
                    }
                    style={{
                      minHeight: 44,
                      paddingHorizontal: 8,
                      justifyContent: "center",
                    }}
                  >
                    <Txt size={13} style={{ color: c.danger }}>
                      {t("Ukloni", "Remove")}
                    </Txt>
                  </Pressable>
                )}
              </View>
              <Field label={t("Naziv stavke", "Item name")} value={item.name} onChange={name=>patch(item.key,{name})}/>
              <View style={[s.row,{alignItems:"flex-start",flexWrap:"wrap"}]}>
                <View style={{flex:1,minWidth:0}}><Field label={`${t("Cijena / kom","Unit price")} (${currency})`} value={item.price} decimal onChange={price=>patch(item.key,{price})}/></View>
                <View style={{flex:1,minWidth:150,gap:6}}><Txt bold size={13}>{t("Količina","Quantity")}</Txt><View style={{flexDirection:"row",alignItems:"center",borderWidth:1,borderColor:c.line,borderRadius:12,overflow:"hidden"}}>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("Smanji količinu","Decrease quantity")} disabled={useBusy||Number(item.quantity??1)<=1} onPress={()=>patch(item.key,{quantity:stepQuantity(item.quantity??1,-1)})} style={{width:44,minHeight:48,alignItems:"center",justifyContent:"center",backgroundColor:c.tint,opacity:Number(item.quantity??1)<=1?.4:1}}><Txt bold size={24}>−</Txt></Pressable>
                  <TextInput accessibilityLabel={t("Količina","Quantity")} keyboardType="number-pad" value={String(item.quantity??1)} editable={!useBusy} maxLength={3} onChangeText={quantity=>patch(item.key,{quantity:quantity.replace(/[^0-9]/g,"")})} onBlur={()=>patch(item.key,{quantity:stepQuantity(item.quantity??1,0)})} style={{flex:1,minWidth:38,textAlign:"center",fontSize:18,color:c.ink,minHeight:48}}/>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("Povećaj količinu","Increase quantity")} disabled={useBusy||Number(item.quantity??1)>=999} onPress={()=>patch(item.key,{quantity:stepQuantity(item.quantity??1,1)})} style={{width:44,minHeight:48,alignItems:"center",justifyContent:"center",backgroundColor:c.tint,opacity:Number(item.quantity??1)>=999?.4:1}}><Txt bold size={24}>+</Txt></Pressable>
                </View></View>
              </View>
              {assignNow && <><Pressable
                accessibilityRole="button"
                onPress={() => patch(item.key, { ids: [] })}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  borderRadius: 12,
                  backgroundColor: c.tint,
                  padding: 10,
                }}
              >
                <Txt size={13} bold style={{ color: c.accent }}>
                  {t("Dijele", "Shared by")}:{" "}
                  {item.ids.length === group.people.length
                    ? t("Svi", "Everyone")
                    : item.ids.length === 0
                      ? t("Odaberi osobe", "Choose people")
                      : item.ids
                          .map(
                            (id) => group.people.find((p) => p.id === id)?.name,
                          )
                          .join(", ")}{" "}
                  · {t("Promijeni / poništi", "Change / clear")}
                </Txt>
              </Pressable>
              {
                <>
                  <Txt muted size={13}>
                    {t("Tko dijeli ovu stavku?", "Who shares this item?")}
                  </Txt>
                  <View style={s.wrap}>
                    {group.people.map((p) => (
                      <Chip
                        key={p.id}
                        label={p.name}
                        selected={item.ids.includes(p.id)}
                        onPress={() =>
                          patch(item.key, {
                            ids: item.ids.includes(p.id)
                              ? item.ids.filter((id) => id !== p.id)
                              : [...item.ids, p.id],
                          })
                        }
                      />
                    ))}
                  </View>
                  {advanced && <Button
                    secondary
                    label={t("Zavrti za ovu stavku", "Spin for this item")}
                    disabled={
                      !group.people.length ||
                      Number(item.price.replace(",", ".")) <= 0
                    }
                    onPress={() => setWheel(item.key)}
                  />}
                </>
              }</>}
            </Card>
          ))}
          <Button
            secondary
            icon="plus"
            label={t("Dodaj stavku", "Add item")}
            onPress={() =>
              setItems([
                ...items,
                {
                  key: key(),
                  name: "",
                  price: "",
                  ids: group.people.map((p) => p.id),
                },
              ])
            }
          />
          </>}
          <Button secondary label={`${t("Platio/la", "Paid by")}: ${multiplePayers?t("više osoba", "multiple people"):group.people.find(p=>p.id===singlePayer)?.name||t("odaberi osobu", "choose person")}`} onPress={()=>setShowPayers(!showPayers)}/>
          {(showPayers||mode==="items")&&<>
          <Card>
            <View style={s.wrap}>
              <Chip
                label={t("Jedna osoba", "One person")}
                selected={!multiplePayers}
                onPress={() => setMultiplePayers(false)}
              />
              <Chip
                label={t("Više osoba", "Multiple people")}
                selected={multiplePayers}
                onPress={() => setMultiplePayers(true)}
              />
            </View>
            {!multiplePayers && (
              <>
                <Txt muted size={13}>
                  {t(
                    "Odaberi platitelja. Iznos prati ukupan račun.",
                    "Choose who paid. The amount follows the bill total.",
                  )}
                </Txt>
                <View style={s.wrap}>
                  {group.people.map((p) => (
                    <Chip
                      key={p.id}
                      label={p.name}
                      selected={singlePayer === p.id}
                      onPress={() => setSinglePayer(p.id)}
                    />
                  ))}
                </View>
                {singlePayer && (
                  <Txt bold>
                    {t("Plaćeno", "Paid")}: {total.toFixed(2)} {currency}
                  </Txt>
                )}
              </>
            )}
          </Card>
          {multiplePayers && (
            <Card>
              <Txt muted size={13}>
                {t(
                  "Upiši koliko je svaka osoba dala. Zbroj mora odgovarati računu.",
                  "Enter each payment. The total must match the bill.",
                )}
              </Txt>
              {group.people.map((person) => (
                <View key={person.id} style={[s.row, { alignItems: "center" }]}>
                  <Txt bold style={{ flex: 1 }}>
                    {person.name}
                  </Txt>
                  <View style={{ width: 82 }}>
                    <Field
                      decimal
                      hideLabel
                      label={`${person.name} (${currency})`}
                      value={
                        payers.find((p) => p.personId === person.id)?.amount ??
                        "0"
                      }
                      onChange={(amount) => setPayers(xs=>[...xs.filter(p=>p.personId!==person.id),{personId:person.id,amount}])}
                    />
                  </View>
                  <View style={{width:82}}><Button compact secondary disabled={total<=paid} label={t("Ostatak", "Rest")} onPress={()=>setPayers(xs=>{const old=Number(xs.find(p=>p.personId===person.id)?.amount.replace(",",".")||0);return [...xs.filter(p=>p.personId!==person.id),{personId:person.id,amount:(old+total-paid).toFixed(2)}]})}/>
                  </View>
                </View>
              ))}
            </Card>
          )}
          </>}
          <Card>
            <Txt bold size={18}>
              {t("Pregled i spremanje", "Review and save")}
            </Txt>
            <View style={s.between}>
              <Txt>{t("Uplaćeno", "Paid")}</Txt>
              <Txt bold>{paid.toFixed(2)} {currency}</Txt>
            </View>
            <View style={s.between}>
              <Txt>{t("Preostalo za uplatu", "Remaining to pay")}</Txt>
              <Txt bold>{(total - paid).toFixed(2)} {currency}</Txt>
            </View>
            {!singlePayer && !multiplePayers && (
              <Txt style={{ color: c.danger }} size={13}>
                {t(
                  "Odaberi tko je platio prije spremanja.",
                  "Choose who paid before saving.",
                )}
              </Txt>
            )}
            <Button label={expense?t("Spremi izmjene","Save changes"):t("Kreiraj račun","Create bill")}
              disabled={group.locked||(currency!==baseCurrency&&(rateLoading||!quote||!!rateError))||Math.round(total*100)!==Math.round(paid*100)||total<=0||effectiveItems.some(i=>!i.name.trim())||(mode==="equal"&&!equalIds.length)} onPress={()=>void save()}/>
          </Card>
        </>
      )}
      <Modal visible={picker==="category"} transparent animationType="slide" onRequestClose={()=>setPicker(null)}>
        <View style={{flex:1,backgroundColor:"#00000066",justifyContent:"center",padding:16}}>
          <View style={{backgroundColor:c.card,borderRadius:20,padding:16,maxHeight:"80%",width:"100%",maxWidth:500,alignSelf:"center",gap:12}} accessibilityViewIsModal>
            <Txt bold size={20}>{picker==="category"?t("Kategorija računa","Bill category"):t("Valuta računa","Bill currency")}</Txt>
            <ScrollView keyboardShouldPersistTaps="handled">
              {categories.map(x=><Pressable key={x.id} accessibilityRole="button" onPress={()=>{setCategory(x.id);setManualCategory(true);setPicker(null)}} style={[s.row,{minHeight:52,padding:8,backgroundColor:category===x.id?c.tint:undefined,borderRadius:10}]}><Icon name={x.icon} color={c.accent}/><Txt>{t(x.hr,x.en)}{category===x.id?" ✓":""}</Txt></Pressable>)}
              <Button secondary label={t("Prepoznaj iz naslova","Detect from title")} onPress={()=>{setManualCategory(false);setCategory(inferCategory(note));setPicker(null)}}/>

            </ScrollView>
            <Button secondary label={t("Zatvori","Close")} onPress={()=>setPicker(null)}/>
          </View>
        </View>
      </Modal>
      <CurrencyPicker visible={picker==="currency"} selected={currency} onSelect={code=>{if(code!==currency){setCurrency(code);setQuote(null);}setPicker(null)}} onClose={()=>setPicker(null)}/>
      {wheel && (
        <Wheel currency={currency}
          people={group.people}
          initial={
            wheel === "all"
              ? group.people.map((p) => p.id)
              : (items.find((x) => x.key === wheel)?.ids ?? [])
          }
          amount={
            wheel === "all"
              ? total
              : Number(
                  items.find((x) => x.key === wheel)?.price.replace(",", "."),
                ) || 0
          }
          onClose={() => setWheel(null)}
          onConfirm={(ids) => {
            setItems(
              items.map((x) =>
                wheel === "all" || x.key === wheel
                  ? { ...x, ids, originalShares: undefined }
                  : x,
              ),
            );
            setWheel(null);
          }}
        />
      )}
    </Page>
  );
}
