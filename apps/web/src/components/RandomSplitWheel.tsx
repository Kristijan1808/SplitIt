import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Dices, RotateCw, Sparkles, X } from "lucide-react";
import { useLanguage } from "../i18n";
import type { Person } from "../types";
import "./RandomSplitWheel.css";

type SplitOption = {
  id: string;
  personIds: string[];
  equal: boolean;
  label: string;
};

type RandomSplitWheelProps = {
  open: boolean;
  title?: string;
  amount: number;
  people: Person[];
  initialSelectedIds?: string[];
  onConfirm: (personIds: string[]) => void;
  onClose: () => void;
};

const MAX_COMBINATION_SIZE = 4;
const EQUALITY_SLICES = 3;
const SPIN_DURATION_MS = 4000;
const WHEEL_SIZE = 330;
const CENTER = WHEEL_SIZE / 2;
const RADIUS = 160;

const combinations = <T,>(items: T[], size: number): T[][] => {
  const result: T[][] = [];

  const walk = (start: number, current: T[]) => {
    if (current.length === size) {
      result.push([...current]);
      return;
    }

    for (let index = start; index <= items.length - (size - current.length); index += 1) {
      current.push(items[index]);
      walk(index + 1, current);
      current.pop();
    }
  };

  walk(0, []);
  return result;
};

const formatAmount = (amount: number) => `${Math.max(0, amount).toFixed(2)} €`;

const splitAmount = (amount: number, count: number) => {
  if (count <= 0) return [];
  const cents = Math.round(Math.max(0, amount) * 100);
  const base = Math.floor(cents / count);
  const remainder = cents % count;
  return Array.from({ length: count }, (_, index) => (base + (index < remainder ? 1 : 0)) / 100);
};

export function RandomSplitWheel({
  open,
  title,
  amount,
  people,
  initialSelectedIds = [],
  onConfirm,
  onClose
}: RandomSplitWheelProps) {
  const { t } = useLanguage();
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<SplitOption | null>(null);
  const [rotation, setRotation] = useState(0);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);

  const equalityLabel = t("randomSplitEquality");

  const options = useMemo<SplitOption[]>(() => {
    if (people.length === 0) return [];

    const generated: SplitOption[] = [];
    const maxSize = Math.min(MAX_COMBINATION_SIZE, people.length);

    for (let size = 1; size <= maxSize; size += 1) {
      combinations(people, size).forEach((selection) => {
        generated.push({
          id: selection.map((person) => person.id).join("-"),
          personIds: selection.map((person) => person.id),
          equal: false,
          label: selection.map((person) => person.name).join(" + ")
        });
      });
    }

    // Equality gets several slices on purpose: it is useful often, but still feels random.
    for (let index = 0; index < EQUALITY_SLICES; index += 1) {
      generated.push({
        id: `equal-${index}`,
        personIds: people.map((person) => person.id),
        equal: true,
        label: equalityLabel
      });
    }

    return generated;
  }, [people, equalityLabel]);

  useEffect(() => {
    if (!open) {
      setSpinning(false);
      setResult(null);
      setPendingIndex(null);
      setRotation(0);
    }
  }, [open]);

  useEffect(() => {
    if (!spinning || pendingIndex === null) return;

    const timer = window.setTimeout(() => {
      setSpinning(false);
      setResult(options[pendingIndex] ?? null);
      setPendingIndex(null);
    }, SPIN_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [spinning, pendingIndex, options]);

  if (!open || options.length === 0) return null;

  const selectedResultIds = result?.personIds ?? [];
  const selectedPeople = people.filter((person) => selectedResultIds.includes(person.id));
  const selectedAmounts = splitAmount(amount, selectedPeople.length);

  const spin = () => {
    if (spinning || options.length === 0) return;

    const nextIndex = Math.floor(Math.random() * options.length);
    const segmentAngle = 360 / options.length;
    const targetRotation = rotation + 360 * 5 + (360 - nextIndex * segmentAngle - segmentAngle / 2);

    setResult(null);
    setPendingIndex(nextIndex);
    setRotation(targetRotation);
    setSpinning(true);
  };

  const confirm = () => {
    if (!result) return;

    // Only notify the owner of the selected participants. The owner decides
    // whether the wheel itself should close; it must never close an enclosing
    // draft/expense overlay as a side effect of this button.
    onConfirm(result.personIds);
    setResult(null);
    setPendingIndex(null);
    setSpinning(false);
    setRotation(0);
  };

  const deny = () => {
    setResult(null);
    setPendingIndex(null);
    setSpinning(false);
    setRotation(0);
  };

  const segmentAngle = 360 / options.length;
  const wheelCenterLabel = spinning ? t("randomSplitSpinning") : result ? "🎉" : "SPIN";

  const point = (angle: number, radius: number) => {
    const radians = (angle - 90) * (Math.PI / 180);
    return {
      x: CENTER + radius * Math.cos(radians),
      y: CENTER + radius * Math.sin(radians)
    };
  };

  const describeArc = (startAngle: number, endAngle: number) => {
    const start = point(endAngle, RADIUS);
    const end = point(startAngle, RADIUS);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
  };

  return createPortal(
    <div
      className="randomSplitBackdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !spinning) onClose();
      }}
    >
      <section
        className="randomSplitModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="random-split-title"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="randomSplitClose"
          onClick={onClose}
          disabled={spinning}
          aria-label={t("close")}
        >
          <X size={20} />
        </button>

        <div className="randomSplitHeader">
          <div className="randomSplitIcon"><Dices size={24} /></div>
          <div>
            <p className="randomSplitEyebrow">{t("randomSplitTitle")}</p>
            <h2 id="random-split-title">{title ?? t("randomSplitTitle")}</h2>
          </div>
        </div>

        <p className="randomSplitIntro">
          {t("randomSplitIntro")}
        </p>

        <div className="randomSplitAmount">{formatAmount(amount)}</div>

        <div className="randomSplitWheelArea">
          <div className="randomSplitPointer" aria-hidden="true" />
          <div
            className={`randomSplitWheel${spinning ? " isSpinning" : ""}`}
            style={{ transform: `rotate(${rotation}deg)` }}
          >
            <svg viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`} className="randomSplitSvg" aria-label={t("randomSplitWheelAria")}>
              <circle cx={CENTER} cy={CENTER} r={RADIUS + 3} className="randomSplitWheelOutline" />
              {options.map((option, index) => {
                const start = index * segmentAngle;
                const end = start + segmentAngle;
                const mid = start + segmentAngle / 2;
                const labelPoint = point(mid, RADIUS * 0.66);
                const compact = options.length > 36;
                const label = compact
                  ? option.equal
                    ? "="
                    : option.personIds.length === 1
                      ? people.find((person) => person.id === option.personIds[0])?.name.slice(0, 2).toUpperCase() ?? ""
                      : `${option.personIds.length}×`
                  : option.equal
                    ? "="
                    : option.personIds.length === 1
                      ? people.find((person) => person.id === option.personIds[0])?.name ?? ""
                      : `${option.personIds.length}×`;

                return (
                  <g key={option.id}>
                    <path
                      d={describeArc(start, end)}
                      className={`randomSplitSegment${option.equal ? " equality" : ""}`}
                    />
                    <text
                      x={labelPoint.x}
                      y={labelPoint.y}
                      className="randomSplitSegmentLabel"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${mid} ${labelPoint.x} ${labelPoint.y})`}
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
              <circle cx={CENTER} cy={CENTER} r="43" className="randomSplitHub" />
              <text x={CENTER} y={CENTER - 3} textAnchor="middle" className="randomSplitHubText">
                {wheelCenterLabel}
              </text>
              <text x={CENTER} y={CENTER + 14} textAnchor="middle" className="randomSplitHubSubtext">
                {spinning ? "" : result ? t("randomSplitResult") : t("randomSplitClick")}
              </text>
            </svg>
          </div>
        </div>

        {!result ? (
          <button
            type="button"
            className="randomSplitSpinButton"
            onClick={spin}
            disabled={spinning}
          >
            <RotateCw size={19} className={spinning ? "randomSplitButtonSpin" : ""} />
            {spinning ? t("randomSplitSpinning") : t("randomSplitSpin")}
          </button>
        ) : (
          <div className="randomSplitResultCard">
            <div className="randomSplitResultTitle">
              <Sparkles size={18} />
              <strong>{result.equal ? t("randomSplitEqualResult") : t("randomSplitMixedResult")}</strong>
            </div>
            <div className="randomSplitPeopleResult">
              {selectedPeople.map((person, index) => (
                <div className="randomSplitPersonResult" key={person.id}>
                  <span>{person.name}</span>
                  <strong>{formatAmount(selectedAmounts[index] ?? 0)}</strong>
                </div>
              ))}
            </div>
            <p className="randomSplitResultHint">
              {result.equal
                ? t("randomSplitEqualHint")
                : `${result.label} · ${selectedPeople.length} ${t("randomSplitPeople")}`}
            </p>
            <div className="randomSplitActions">
              <button type="button" className="randomSplitDenyButton" onClick={deny}>
                {t("randomSplitDeny")}
              </button>
              <button type="button" className="randomSplitConfirmButton" onClick={confirm}>
                {t("randomSplitConfirm")}
              </button>
            </div>
          </div>
        )}

        {initialSelectedIds.length > 0 && !result && (
          <p className="randomSplitCurrentSelection">
            {t("randomSplitCurrentSelection")}: {people.filter((person) => initialSelectedIds.includes(person.id)).map((person) => person.name).join(", ")}
          </p>
        )}
      </section>
    </div>,
    document.body
  );
}
