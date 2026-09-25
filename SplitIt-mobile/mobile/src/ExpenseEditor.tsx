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
  startCamera = false,
}: {
  group: Group;
  expense?: Expense;
  startCamera?: boolean;
  run: (f: () => Promise<void>) => Promise<boolean>;
  done: (draft?: boolean) => Promise<void>;
}) {
  const { t, c, busy: useBusy } = useUI();
  const [mode, setMode] = useState<"equal" | "items">(expense || startCamera ? "items" : "equal");
  const [equalAmount, setEqualAmount] = useState("");
  const [equalIds, setEqualIds] = useState(group.people.map(p => p.id));
  const [assignNow, setAssignNow] = useState(!!expense);
  const [note, setNote] = useState(expense?.note ?? "");
  const [items, setItems] = useState<Item[]>(() =>
    expense
      ? expense.items.map((i) => ({
          key: key(),
          name: i.name,
          price: String(i.price),
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
      expense?.payers.map((p) => ({
        personId: p.personId,
        amount: String(p.amount),
      })) ?? [],
  );
  const [multiplePayers, setMultiplePayers] = useState(
    (expense?.payers.length ?? 0) > 1,
  );
  const [singlePayer, setSinglePayer] = useState(
    expense?.payers.length === 1 ? expense.payers[0].personId : "",
  );

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
                values.ids !== undefined || values.price !== undefined
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
  async function save(confirm: boolean) {
    await run(async () => {
      if (group.locked)
        throw new Error(t("Grupa je zaključana.", "Group is locked."));
      if (expense && confirmed) {
        await done();
        return;
      }
      if (createdId) {
        if (confirm && !confirmed) {
          await api.confirm(group.slug, createdId);
          setConfirmed(true);
        }
        await done(!confirm);
        return;
      }
      if (multiplePayers)
        for (const payer of payers) cents(payer.amount || "0");
      const checked = validateBill(effectiveItems, actualPayers, confirm);
      if (checked.total <= 0 || checked.total !== checked.paid)
        throw new Error(t("Odaberi platitelja i uskladi uplate s ukupnim iznosom.", "Choose payers and match payments to the total."));
      const body = {
        note: note.trim() || undefined,
        payers: actualPayers.map((p) => ({
          personId: p.personId,
          amount: cents(p.amount) / 100,
        })),
        items: effectiveItems.map((x, i) => ({
          ordinalNumber: i + 1,
          name: x.name.trim(),
          price: cents(x.price) / 100,
          shares: x.originalShares ?? x.ids.map((personId) => ({ personId })),
        })),
      };
      if (expense) {
        await api.updateExpense(group.slug, expense.id, {
          ...body,
          expectedUpdatedAt: expense.updatedAt,
        });
        setConfirmed(true);
        await done();
        return;
      }
      const draft = await api.draft(group.slug, body);
      setCreatedId(draft.id); // Retain server id if confirmation fails: never create a duplicate on retry.
      if (confirm) {
        await api.confirm(group.slug, draft.id);
        setConfirmed(true);
      }
      await done(!confirm);
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
      {expense && confirmed ? (
        <Card>
          <Txt>
            {t(
              "Izmjene su spremljene. Osvježi grupu za prikaz.",
              "Changes saved. Refresh the group to view them.",
            )}
          </Txt>
          <Button
            label={t("Otvori grupu", "Open group")}
            onPress={() => void run(() => done(!!createdId && !confirmed))}
          />
        </Card>
      ) : createdId ? (
        <Card>
          <Txt>
            {t(
              "Nacrt je spremljen na server. Možeš ponoviti potvrdu ili ga otvoriti u grupi.",
              "Draft saved on the server. Retry confirmation or open it in the group.",
            )}
          </Txt>
          <Button
            label={
              confirmed
                ? t("Otvori spremljeni trošak", "Open saved expense")
                : t("Potvrdi spremljeni nacrt", "Confirm saved draft")
            }
            onPress={() => void save(true)}
          />
          <Button
            secondary
            label={t("Natrag u grupu", "Back to group")}
            onPress={() => void run(() => done(!!createdId && !confirmed))}
          />
        </Card>
      ) : (
        <>
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
          </Card>
          {mode === "equal" ? <Card>
            <Field label={t("Konačan iznos (€)", "Final total (€)")} decimal value={equalAmount} onChange={setEqualAmount} />
            <Txt bold>{t("Tko dijeli račun?", "Who shares the bill?")}</Txt>
            <Txt muted size={12}>{t("Svi su uključeni. Isključi osobe koje ne sudjeluju.", "Everyone is included. Uncheck anyone not participating.")}</Txt>
            <View style={s.wrap}>{group.people.map(p => <Chip key={p.id} label={p.name} selected={equalIds.includes(p.id)}
              onPress={() => setEqualIds(ids => ids.includes(p.id) ? ids.filter(id => id !== p.id) : [...ids, p.id])} />)}</View>
            <Txt bold style={{ color: c.accent }}>{equalIds.length ? (() => {
              const shares = splitCents(Math.round(total * 100), equalIds.length);
              const low = Math.min(...shares) / 100, high = Math.max(...shares) / 100;
              return `${low.toFixed(2)}${low !== high ? ` – ${high.toFixed(2)}` : ""} € ${t("po osobi", "per person")}`;
            })() : t("Odaberi barem jednu osobu.", "Select at least one person.")}</Txt>
          </Card> : <>
          {!expense && <Card style={{ backgroundColor: c.infoTint, borderColor: c.info }}>
            <Txt bold style={{ color: c.info }}>{t("Unesi → spremi draft → ekipa bira", "Enter → save draft → everyone selects")}</Txt>
            <Txt size={12}>{t("Članovi označe svoje stavke u draftu. Zajedničke se stavke dijele jednako.", "Members select their items in the draft. Shared items are split equally.")}</Txt>
            <Chip label={t("Podjelu odabirem odmah", "Assign people now")} selected={assignNow} onPress={() => setAssignNow(!assignNow)} />

          </Card>}
          <View style={s.between}><Txt bold size={20}>{t("Stavke računa", "Bill items")}</Txt><Txt muted size={13}>{items.length}</Txt></View>
          <Txt muted size={12}>{t("Upiši cijenu cijelog retka; zasebne porcije dodaj odvojeno.", "Enter the whole line price; add separate servings on separate lines.")}</Txt>
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
                    label={t("Iznos (€)", "Amount (€)")}
                    value={item.price}
                    decimal
                    onChange={(price) => patch(item.key, { price })}
                  />
                </View>
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
                      onChange={(amount) =>
                        setPayers((xs) => [
                          ...xs.filter((p) => p.personId !== person.id),
                          { personId: person.id, amount },
                        ])
                      }
                    />
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
            <Button
              label={
                expense
                  ? t("Spremi izmjene", "Save changes")
                  : mode === "items" && !assignNow
                    ? t("Spremi draft za ekipu", "Save draft for everyone")
                    : t("Potvrdi trošak", "Confirm expense")
              }
              disabled={
                group.locked ||
                Math.round(total * 100) !== Math.round(paid * 100) ||
                total <= 0 ||
                effectiveItems.some((item) => !item.name.trim()) ||
                (!(mode === "items" && !assignNow) && effectiveItems.some((item) => !item.ids.length))
              }
              onPress={() => void save(!(mode === "items" && !assignNow))}
            />
            {!expense && !(mode === "items" && !assignNow) && (
              <Button
                secondary
                label={t("Spremi kao nacrt", "Save as draft")}
                disabled={group.locked}
                onPress={() => void save(false)}
              />
            )}
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
