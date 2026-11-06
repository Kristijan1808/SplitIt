import React from "react";
import { View } from "react-native-web";
import { useUI, Txt } from "./ui.jsx";
export function ReceiptMark() {
    const { c } = useUI();
    return <svg width={83} height={76} viewBox="0 0 83 76" aria-hidden={true}>
 <ellipse cx="43" cy="57" rx="31" ry="9" fill={c.tint}/>
 <path d="M25 12 Q25 10 28 11 L66 17 L54 65 L49 61 L45 64 L40 59 L35 62 L30 57 L25 60 L21 55 L15 58 Z" fill={c.card} stroke={c.accent} strokeWidth={2.2} strokeLinejoin="round"/>
 <circle cx="36" cy="27" r="1.7" fill={c.ink}/><circle cx="52" cy="29" r="1.7" fill={c.ink}/>
 <path d="M38 33 Q43 39 48 34 M28 45l22 4 M27 50l14 3 M66 9l3-6 M71 13l7-4" fill="none" stroke={c.accent} strokeWidth="2" strokeLinecap="round"/>
 </svg>;
}
export function ClaimPawns({ shares, remaining, mine }) {
    const { c } = useUI();
    const compact = shares.reduce((n, s) => n + s.count, 0) > 5;
    const shape = "M2 24C2 18 6 13 13 13S24 18 24 24Q24 26 21 26H5Q2 26 2 24Z";
    return <View aria-hidden={true} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
 {shares.flatMap(p => {
            const initials = p.name.trim().split(/\s+/u);
            const tag = Array.from(initials[0] || "?")[0] + (initials.length > 1 ? Array.from(initials[initials.length - 1])[0] : "");
            const color = p.id === mine ? "#075845" : ["#775184", "#416478", "#756030", "#416D52"][Array.from(p.id).reduce((n, ch) => (n + ch.charCodeAt(0)) % 4, 0)];
            return Array.from({ length: compact ? 1 : Math.min(5, p.count) }, (_, i) => <View key={p.id + ":" + i} style={{ flexDirection: "row", alignItems: "center" }}><svg width={26} height={27} viewBox="0 0 26 28"><circle cx={13} cy={6.4} r={5.8} fill={color}/><path d={shape} fill={color}/><text x={13} y={23} textAnchor="middle" fontWeight="bold" fontSize={10} fill="white">{tag.toLocaleUpperCase()}</text></svg>{compact && p.count > 1 && <Txt size={11}>×{p.count}</Txt>}</View>);
        })}
 {remaining > 0 && <svg width={25} height={27} viewBox="0 0 26 28"><circle cx={13} cy={6.4} r={5.5} fill="none" stroke={c.muted} strokeDasharray="3 2"/><path d={shape} fill="none" stroke={c.muted} strokeDasharray="3 2"/></svg>}
 </View>;
}
