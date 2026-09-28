import {storage} from "./storage";
import {requestKey,customAllocation} from "./domain.mjs";
import React, { useState, useEffect, useRef } from "react";
import { Alert, View, Pressable } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { api } from "./api";
import { Button, Card, Chip, Field, Heading, Page, Txt, useUI, s } from "./ui";
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
  template,
  participantId,
  startCamera = false,
}: {
  group: Group;
  expense?: Expense;
  template?: Expense;
  participantId?: string;
  startCamera?: boolean;
  run: (f: () => Promise<void>) => Promise<boolean>;
  done: (draft?: boolean) => Promise<void>;
}) {
  const source=expense??template;
  const { t, c, busy: useBusy } = useUI();
  const [mode, setMode] = useState<"equal" | "items">(source || startCamera ? "items" : "equal");
  const [splitMode,setSplitMode]=useState("equal");
  const [splitValues,setSplitValues]=useState<Record<string,string>>({});
  const [showDetails,setShowDetails]=useState(false);
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
  const submitted=useRef(false);
  const [recovery,setRecovery]=useState<any>(null);
  const [recoveryChecked,setRecoveryChecked]=useState(false);
  const storageKey=`entry.${group.id}`;
  useEffect(()=>{if(expense||template||startCamera){setRecoveryChecked(true);return;}storage.read<any>(storageKey,null).then(value=>{setRecovery(value);setRecoveryChecked(true)}).catch(()=>setRecoveryChecked(true));},[]);
  const snapshot={splitMode,splitValues,note,items,payers,multiplePayers,singlePayer,mode,equalAmount,equalIds,assignNow,billDate,category,requestId};
  const saveLocal=useRef(Promise.resolve());
  useEffect(()=>{if(expense||!recoveryChecked||recovery||submitted.current)return;const timer=setTimeout(()=>{if(!submitted.current)saveLocal.current=storage.write(storageKey,snapshot).catch(()=>{})},400);return()=>clearTimeout(timer)},[splitMode,splitValues,note,items,payers,multiplePayers,singlePayer,mode,equalAmount,equalIds,assignNow,billDate,category,requestId,recovery,recoveryChecked]);
  const restoreLocal=()=>{const x=recovery;setSplitMode(x.splitMode||"equal");setSplitValues(x.splitValues||{});setNote(x.note||"");setItems(x.items||items);setPayers(x.payers||[]);setMultiplePayers(!!x.multiplePayers);setSinglePayer(x.singlePayer||"");setMode(x.mode||"equal");setEqualAmount(x.equalAmount||"");setEqualIds((x.equalIds||[]).filter((id:string)=>group.people.some(p=>p.id===id)));setAssignNow(!!x.assignNow);setBillDate(x.billDate||billDate);setCategory(x.category||"other");setRequestId(x.requestId||requestKey());setRecovery(null)};
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
      const parsedDate=new Date(`${billDate}T12:00:00Z`);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(billDate)||!Number.isFinite(parsedDate.getTime())||parsedDate.toISOString().slice(0,10)!==billDate)throw new Error(t("Provjeri datum računa.","Check the bill date."));
      const custom=mode==="equal"&&splitMode!=="equal"?customAllocation(checked.total,equalIds,splitValues,splitMode):null;
      const body={requestId,note:note.trim()||undefined,billDate:parsedDate.toISOString(),category,
        payers:actualPayers.map(p=>({personId:p.personId,amount:cents(p.amount)/100})),
        items:effectiveItems.map((x,i)=>({ordinalNumber:i+1,name:x.name.trim(),quantity:Number(x.quantity||1),price:cents(x.price)/100,
          shares:custom?x.ids.map((personId,j)=>({personId,amount:custom[j]/100})):x.originalShares??x.ids.map(personId=>({personId}))}))};
      if(expense){await api.updateExpense(group.slug,expense.id,{...body,expectedUpdatedAt:expense.updatedAt});setConfirmed(true);await done();return;}
      const saved=await api.createExpense(group.slug,body);
      submitted.current=true;setCreatedId(saved.id);setConfirmed(true);
      await saveLocal.current;await storage.write(storageKey,null);await done();
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
          {recovery&&<Card style={{backgroundColor:c.infoTint}}><Txt bold>{t("Imaš spremljen unos na ovom uređaju", "An unfinished entry is saved on this device")}</Txt><Button label={t("Nastavi spremljeni unos", "Resume saved entry")} onPress={restoreLocal}/><Button secondary label={t("Započni novi unos", "Start a new entry")} onPress={()=>{setRecovery(null);setRequestId(requestKey())}}/></Card>}
          {!expense&&<Txt muted size={12}>{t("Unos se automatski čuva na ovom uređaju.", "Your entry is saved on this device automatically.")}</Txt>}
          {!expense && <View style={s.row}>
            {(["equal", "items"] as const).map(value => <Pressable key={value}
              accessibilityRole="radio" aria-checked={mode === value} accessibilityState={{ checked: mode === value }}
              disabled={useBusy} onPress={() => setMode(value)}
              style={{ flex: 1, padding: 12, minHeight: 72, borderRadius: 16, borderWidth: 1,
                borderColor: mode === value ? c.accent : c.line, backgroundColor: mode === value ? c.tint : c.card, gap: 4 }}>
              <Txt bold>{value === "equal" ? t("Jednako", "Equally") : t("Po stavkama", "By item")}</Txt>
              <Txt muted size={12}>{value === "equal" ? t("Jedan iznos za sve", "One total to share") : t("Svatko bira svoje", "Everyone picks their items")}</Txt>
            </Pressable>)}
          </View>}
          <Card style={{ backgroundColor: c.tint, borderColor: c.line }}>
            <View style={s.between}><Txt bold size={13}>{t("UKUPNO", "TOTAL")}</Txt><Txt size={26} bold>{total.toFixed(2)} €</Txt></View>
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
                  label={t("Galerija", "Gallery")}
                  onPress={() => chooseScan(false)}
                />
              </View>
            </View>}
            <Field
              label={t("Naslov računa", "Bill title")}
              value={note}
              onChange={setNote}
              maxLength={200}
            />
            <Button secondary label={t("Datum i kategorija", "Date and category")} onPress={()=>setShowDetails(!showDetails)}/>
            {showDetails&&<><Field label={t("Datum (GGGG-MM-DD)", "Date (YYYY-MM-DD)")} value={billDate} onChange={setBillDate} maxLength={10}/>
            <View style={s.wrap}>{[["other",t("Ostalo", "Other")],["food",t("Hrana", "Food")],["travel",t("Putovanje", "Travel")],["home",t("Dom", "Home")],["fun",t("Zabava", "Fun")]].map(([id,label])=><Chip key={id} label={label} selected={category===id} onPress={()=>setCategory(id)}/>)}</View></>}
          </Card>
          {mode === "equal" ? <Card>
            <Field label={t("Konačan iznos (€)", "Final total (€)")} decimal value={equalAmount} onChange={setEqualAmount} />
            <Txt bold>{t("Tko dijeli račun?", "Who shares the bill?")}</Txt>
            <Txt muted size={12}>{t("Svi su uključeni. Isključi osobe koje ne sudjeluju.", "Everyone is included. Uncheck anyone not participating.")}</Txt>
            <View style={s.wrap}>{group.people.map(p => <Chip key={p.id} label={p.name} selected={equalIds.includes(p.id)}
              onPress={() => setEqualIds(ids => ids.includes(p.id) ? ids.filter(id => id !== p.id) : [...ids, p.id])} />)}</View>
            <View style={s.wrap}>{[["equal",t("Jednako", "Equally")],["amount",t("Iznosi", "Amounts")],["percent",t("Postoci", "Percent")],["weight",t("Omjeri", "Weights")]].map(([id,label])=><Chip key={id} label={label} selected={splitMode===id} onPress={()=>setSplitMode(id)}/>)}</View>
            {splitMode!=="equal"&&<><Txt muted size={12}>{splitMode==="amount"?t("Upiši koliko svatko duguje. Zbroj mora biti jednak računu.","Enter each person's share. The sum must equal the bill."):splitMode==="percent"?t("Zbroj postotaka mora biti 100 %.","Percentages must total 100%."):t("Primjer: omjer 2 : 1 znači dvostruki udio za prvu osobu.","For example, 2 : 1 assigns twice as much to the first person.")}</Txt>{group.people.filter(p=>equalIds.includes(p.id)).map(p=><Field key={p.id} decimal label={`${p.name} (${splitMode==="amount"?"€":splitMode==="percent"?"%":"udio"})`} value={splitValues[p.id]||""} onChange={value=>setSplitValues(x=>({...x,[p.id]:value}))}/>)}</>}
            {splitMode==="equal"&&<Txt bold style={{ color: c.accent }}>{equalIds.length ? (() => {
              const shares = splitCents(Math.round(total * 100), equalIds.length);
              const low = Math.min(...shares) / 100, high = Math.max(...shares) / 100;
              return `${low.toFixed(2)}${low !== high ? ` – ${high.toFixed(2)}` : ""} € ${t("po osobi", "per person")}`;
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
              <View style={[s.row, { alignItems: "flex-start" }]}>
                <View style={{ flex: 1 }}>
                  <Field
                    label={t("Naziv", "Name")}
                    value={item.name}
                    onChange={(name) => patch(item.key, { name })}
                  />
                </View>
                <View style={{ width: 108 }}>
                  <Field
                    label={t("Jedinična cijena (€)", "Unit price (€)")}
                    value={item.price}
                    decimal
                    onChange={(price) => patch(item.key, { price })}
                  />
                </View>
              </View>
              <Field label={t("Količina (1–999)", "Quantity (1–999)")} decimal value={String(item.quantity??1)} onChange={quantity=>patch(item.key,{quantity})} maxLength={3}/>
              <Button secondary label={t("Dupliciraj stavku", "Duplicate item")} onPress={()=>setItems(xs=>[...xs,{...item,key:key(),originalShares:item.originalShares?.map(x=>({...x})),ids:[...item.ids]}])}/>
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
          <Heading
            title={t("Tko je platio?", "Who paid?")}
            subtitle={t(
              "Dodaj jednog ili više platitelja.",
              "Add one or more payers.",
            )}
          />
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
                    {t("Plaćeno", "Paid")}: {total.toFixed(2)} €
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
                  <View style={{ width: 130 }}>
                    <Field
                      decimal
                      hideLabel
                      label={`${person.name} (€)`}
                      value={
                        payers.find((p) => p.personId === person.id)?.amount ??
                        "0"
                      }
                      onChange={(amount) => setPayers(xs=>[...xs.filter(p=>p.personId!==person.id),{personId:person.id,amount}])}
                    />
                    <Button secondary disabled={total<=paid} label={t("Dodijeli ostatak", "Assign remainder")} onPress={()=>setPayers(xs=>{const old=Number(xs.find(p=>p.personId===person.id)?.amount.replace(",",".")||0);return [...xs.filter(p=>p.personId!==person.id),{personId:person.id,amount:(old+total-paid).toFixed(2)}]})}/>
                  </View>
                </View>
              ))}
            </Card>
          )}
          <Card>
            <Txt bold size={18}>
              {t("Pregled i spremanje", "Review and save")}
            </Txt>
            <View style={s.between}>
              <Txt>{t("Uplaćeno", "Paid")}</Txt>
              <Txt bold>{paid.toFixed(2)} €</Txt>
            </View>
            <View style={s.between}>
              <Txt>{t("Preostalo za uplatu", "Remaining to pay")}</Txt>
              <Txt bold>{(total - paid).toFixed(2)} €</Txt>
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
              disabled={group.locked||Math.round(total*100)!==Math.round(paid*100)||total<=0||effectiveItems.some(i=>!i.name.trim())||(mode==="equal"&&!equalIds.length)} onPress={()=>void save()}/>
          </Card>
        </>
      )}
      {wheel && (
        <Wheel
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
