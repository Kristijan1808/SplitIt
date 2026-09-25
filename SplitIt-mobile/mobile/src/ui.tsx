import React, { createContext, useContext } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
// 60% quiet background, 30% layered surfaces, 10% semantic accents.
export const light = {
  bg: "#F4F6FA", card: "#FFFFFF", ink: "#182C3C", muted: "#54677A",
  line: "#DCE4EC", accent: "#086C58", tint: "#E1F2EB", danger: "#B33442",
  hero: "#174B48", info: "#285AB0", infoTint: "#EAF0FD",
  debt: "#A84A16", debtTint: "#FFF0E4",
};
export const dark = {
  bg: "#101923", card: "#1C2A36", ink: "#EDF3FA", muted: "#ABBCCD",
  line: "#354756", accent: "#79DABA", tint: "#233F3C", danger: "#FFA4AD",
  hero: "#234F50", info: "#9DBEFF", infoTint: "#24354F",
  debt: "#FFBE87", debtTint: "#443225",
};
export const UI = createContext({
  c: light,
  t: (hr: string, en: string) => hr,
  busy: false,
});
export const useUI = () => useContext(UI);
export function Txt({
  children,
  muted = false,
  size = 15,
  bold = false,
  style,
}: React.PropsWithChildren<{
  muted?: boolean;
  size?: number;
  bold?: boolean;
  style?: any;
}>) {
  const { c } = useUI();
  return (
    <Text
      style={[
        {
          color: muted ? c.muted : c.ink,
          fontSize: size,
          lineHeight: size * 1.4,
          fontWeight: bold ? "700" : "400",
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Card({
  children,
  style,
}: React.PropsWithChildren<{ style?: any }>) {
  const { c } = useUI();
  return (
    <View
      style={[s.card, { backgroundColor: c.card, borderColor: c.line }, style]}
    >
      {children}
    </View>
  );
}
export function Button({
  label,
  onPress,
  secondary = false,
  danger = false,
  disabled = false,
  icon,
  info = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  disabled?: boolean;
  icon?: string;
  info?: boolean;
}) {
  const { c, busy } = useUI();
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: info ? c.infoTint : secondary ? c.tint : danger ? c.danger : c.accent,
          opacity: off ? 0.4 : pressed ? 0.75 : 1,
        },
      ]}
    >
      {icon && <Icon name={icon} color={info ? c.info : secondary ? c.accent : c.bg} />}
      <Text
        style={{
          fontSize: 15,
          fontWeight: "700",
          color: info ? c.info : secondary ? c.accent : c.bg,
          textAlign: "center",
          flexShrink: 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  secure = false,
  decimal = false,
  multiline = false,
  maxLength = 120,
  hideLabel = false,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  secure?: boolean;
  decimal?: boolean;
  multiline?: boolean;
  maxLength?: number;
  hideLabel?: boolean;
}) {
  const { c, busy } = useUI();
  return (
    <View style={{ gap: 6 }}>
      {!hideLabel && <Txt size={13} bold>
        {label}
      </Txt>}
      <TextInput
        accessibilityLabel={label}
        editable={!busy}
        value={value}
        onChangeText={onChange}
        secureTextEntry={secure}
        keyboardType={decimal ? "decimal-pad" : "default"}
        autoCapitalize="none"
        autoCorrect={false}
        multiline={multiline}
        maxLength={maxLength}
        placeholderTextColor={c.muted}
        style={[
          s.input,
          {
            color: c.ink,
            backgroundColor: c.bg,
            borderColor: c.line,
            minHeight: multiline ? 76 : 48,
          },
        ]}
      />
    </View>
  );
}
export function Chip({
  label,
  selected,
  onPress,
  disabled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { c, busy } = useUI();
  return (
    <Pressable
      accessibilityRole="checkbox"
      aria-checked={selected}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={[
        s.chip,
        {
          borderColor: selected ? c.accent : c.line,
          backgroundColor: selected ? c.tint : c.card,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Txt size={13} bold={selected}>
        {selected ? "✓ " : ""}
        {label}
      </Txt>
    </Pressable>
  );
}
export function Page({
  children,
  refresh,
  refreshing = false,
}: React.PropsWithChildren<{ refresh?: () => void; refreshing?: boolean }>) {
  const { c } = useUI();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      refreshControl={
        refresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={c.accent}
          />
        ) : undefined
      }
      contentContainerStyle={s.page}
    >
      {children}
    </ScrollView>
  );
}
export function Heading({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={{ gap: 4, marginBottom: 4 }}>
      <Txt size={24} bold>
        {title}
      </Txt>
      {subtitle && <Txt muted>{subtitle}</Txt>}
    </View>
  );
}
export function Loading() {
  const { c } = useUI();
  return <ActivityIndicator color={c.accent} />;
}
export function Icon({
  name,
  color,
  size = 22,
}: {
  name: string;
  color: string;
  size?: number;
}) {
  const paths: Record<string, string> = {
    home: "M3 10 12 3 21 10 M5 9v12h5v-7h4v7h5V9",
    groups:
      "M3 21v-3a5 5 0 0 1 10 0v3 M16 13a5 5 0 0 1 5 5v3 M8 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M17 4a3 3 0 0 1 0 6",
    plus: "M12 5v14 M5 12h14",
    back: "M15 5 8 12l7 7",
    receipt: "M5 3v18l3-2 4 2 4-2 3 2V3l-3 2-4-2-4 2z M8 9h8 M8 13h8",
    user: "M4 21a8 8 0 0 1 16 0 M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
    camera: "M3 7h5l2-3h4l2 3h5v13H3z M12 10a4 4 0 1 0 0 8 4 4 0 0 0 0-8",
    share: "M12 16V3 M7 8l5-5 5 5 M5 12v9h14v-9",
    check: "M5 12l4 4L19 6",
  };
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] ? (
        <Path d={paths[name]} />
      ) : (
        <Circle cx="12" cy="12" r="8" />
      )}
    </Svg>
  );
}
export const s = StyleSheet.create({
  page: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 12,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
  },
  card: { padding: 12, borderWidth: 1, borderRadius: 18, gap: 10 },
  button: {
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: "center",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  between: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
});
