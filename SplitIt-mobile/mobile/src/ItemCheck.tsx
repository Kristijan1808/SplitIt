import React from "react";
import { Pressable, View } from "react-native";
import { Txt, useUI } from "./ui";
export function ItemCheck({
  name,
  price,
  checked,
  disabled,
  onPress,
}: {
  name: string;
  price: number;
  checked: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { c, busy, t } = useUI();
  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={checked}
      accessibilityLabel={`${t("Moja stavka", "My item")}: ${name}`}
      accessibilityState={{ checked, disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 48,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 7,
          borderWidth: 1,
          borderColor: c.accent,
          backgroundColor: checked ? c.accent : c.card,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {checked && (
          <Txt bold size={15} style={{ color: c.bg }}>
            ✓
          </Txt>
        )}
      </View>
      <Txt bold style={{ flex: 1 }}>
        {name}
      </Txt>
      <Txt bold>{price.toFixed(2)} €</Txt>
    </Pressable>
  );
}
