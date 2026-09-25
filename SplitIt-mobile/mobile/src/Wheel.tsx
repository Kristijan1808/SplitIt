import React, { useEffect, useRef, useState } from "react";
import { Animated, View, Modal, Easing, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Path, Circle } from "react-native-svg";
import { Button, Chip, Txt, useUI, s } from "./ui";
import { randomSelection, splitCents } from "./domain.mjs";
import type { Person } from "./types";
export function Wheel({
  people,
  amount,
  initial,
  onConfirm,
  onClose,
}: {
  people: Person[];
  amount: number;
  initial: string[];
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}) {
  const { c, t } = useUI();
  const [ids, setIds] = useState(
    initial.length ? initial : people.map((p) => p.id),
  );
  const [result, setResult] = useState<string[] | null>(null);
  const [spinning, setSpinning] = useState(false);
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => () => rotation.stopAnimation(), [rotation]);
  function spin() {
    const next = randomSelection(ids);
    setResult(null);
    setSpinning(true);
    rotation.setValue(0);
    Animated.timing(rotation, {
      toValue: 1,
      duration: 2800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setResult(next);
        setSpinning(false);
      }
    });
  }
  const shares = result
    ? splitCents(Math.round(amount * 100), result.length)
    : [];
  return (
    <Modal
      animationType="slide"
      onRequestClose={() => {
        if (!spinning) onClose();
      }}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
        <ScrollView contentContainerStyle={s.page}>
          <Txt size={28} bold>
            {t("Neka sreća odluči", "Let luck decide")}
          </Txt>
          <Txt muted>
            {t(
              "Odaberi sudionike pa zavrti. Rezultat se primjenjuje tek nakon potvrde.",
              "Choose participants and spin. Apply the result only when you confirm.",
            )}
          </Txt>
          <View style={s.wrap}>
            {people.map((p) => (
              <Chip
                key={p.id}
                label={p.name}
                selected={ids.includes(p.id)}
                disabled={spinning}
                onPress={() => {
                  setResult(null);
                  setIds(
                    ids.includes(p.id)
                      ? ids.filter((i) => i !== p.id)
                      : [...ids, p.id],
                  );
                }}
              />
            ))}
          </View>
          <Txt bold size={30} style={{ textAlign: "center" }}>
            {amount.toFixed(2)} €
          </Txt>
          <Animated.View
            style={{
              alignSelf: "center",
              transform: [
                {
                  rotate: rotation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "1890deg"],
                  }),
                },
              ],
            }}
          >
            <Svg width={250} height={250} viewBox="0 0 250 250">
              {Array.from({ length: 12 }, (_, i) => {
                const a = (i * Math.PI) / 6,
                  b = ((i + 1) * Math.PI) / 6;
                return (
                  <Path
                    key={i}
                    d={`M125 125 L${125 + 120 * Math.cos(a)} ${125 + 120 * Math.sin(a)} A120 120 0 0 1 ${125 + 120 * Math.cos(b)} ${125 + 120 * Math.sin(b)} Z`}
                    fill={["#16715C", "#A8DFBF", "#F4D58D"][i % 3]}
                    stroke={c.bg}
                    strokeWidth={2}
                  />
                );
              })}
              <Circle cx={125} cy={125} r={43} fill={c.card} />
            </Svg>
          </Animated.View>
          <Txt muted size={12} style={{ textAlign: "center" }}>
            {t(
              "Animacija je dekorativna; odabir slijedi pravila web aplikacije.",
              "The animation is decorative; selection follows the web app rules.",
            )}
          </Txt>
          {result && (
            <View style={{ gap: 10 }}>
              {result.map((id, i) => (
                <View key={id} style={s.between}>
                  <Txt bold>{people.find((p) => p.id === id)?.name}</Txt>
                  <Txt>{(shares[i] / 100).toFixed(2)} €</Txt>
                </View>
              ))}
              <Button
                label={t("Primijeni podjelu", "Apply split")}
                onPress={() => onConfirm(result)}
              />
            </View>
          )}
          <Button
            label={spinning ? t("Vrti se…", "Spinning…") : t("Zavrti", "Spin")}
            disabled={spinning || !ids.length}
            onPress={spin}
          />
          <Button
            secondary
            label={t("Odustani", "Cancel")}
            disabled={spinning}
            onPress={onClose}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
