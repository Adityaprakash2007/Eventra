// Built using Hyperiux Vault: https://vault.hyperiux.com
// Integrated into Eventra: images swapped to Unsplash, Tailwind v3 syntax,
// exported StackSpreadStage with an optional `progressOverride` MotionValue so
// the scatter can be time-driven (intro/loading screen) instead of scroll-driven.

"use client";

import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useMotionValueEvent,
  type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

const IMG_BASE =
  "https://images.unsplash.com";

const IMG = {
  plane: `${IMG_BASE}/photo-1559136555-9303baea8ebd?w=600&q=80&auto=format&fit=crop`,
  painting: `${IMG_BASE}/photo-1541961017774-22349e4a1262?w=600&q=80&auto=format&fit=crop`,
  breaker: `${IMG_BASE}/photo-1520367445093-50dc08a59d9d?w=600&q=80&auto=format&fit=crop`,
  dog: `${IMG_BASE}/photo-1552053831-71594a27632d?w=600&q=80&auto=format&fit=crop`,
  footballer: `${IMG_BASE}/photo-1517927033932-b3d18e61fb3a?w=600&q=80&auto=format&fit=crop`,
  jacket: `${IMG_BASE}/photo-1551024506-0bccd828d307?w=600&q=80&auto=format&fit=crop`,
  meadow: `${IMG_BASE}/photo-1500382017468-9049fed747ef?w=600&q=80&auto=format&fit=crop`,
  stripes: `${IMG_BASE}/photo-1558618666-fcd25c85cd64?w=600&q=80&auto=format&fit=crop`,
} as const;

// per-image rest scale, keyed by img index (1-8). default 1, drop below to shrink.
const SCALE: Partial<Record<number, number>> = {
  1: 0.9,
  2: 0.8,
  3: 0.9,
  4: 0.8,
  5: 0.8,
  6: 0.9,
  7: 0.9,
  8: 0.7,
};
const s = (i: number) => SCALE[i] ?? 1;

// array order = stack order, back (z 2) -> front (z 9)
const CARDS: StackSpreadCard[] = [
  // top-left stripes (img08) — sm row 1 left
  {
    item: { src: IMG.stripes, alt: "Colour stripes" },
    stackOffset: { x: -8, y: -10 },
    stackRotate: -18,
    target: { x: -20, y: -34, rotate: 0, scale: s(8), w: 17, h: 22 },
    targetSm: { x: -22, y: -40 },
    z: 2,
  },
  // top-right meadow (img07) — sm row 1 right
  {
    item: { src: IMG.meadow, alt: "Wildflower meadow" },
    stackOffset: { x: 14, y: -10 },
    stackRotate: 20,
    target: { x: 32, y: -30, rotate: 0, scale: s(7), w: 18, h: 32 },
    targetSm: { x: 22, y: -40 },
    z: 3,
  },
  // mid-left jacket (img06) — sm row 2 left
  {
    item: { src: IMG.jacket, alt: "Figure in a leather jacket" },
    stackOffset: { x: -16, y: 0 },
    stackRotate: -4,
    target: { x: -36, y: -2, rotate: 0, scale: s(6), w: 15, h: 32 },
    targetSm: { x: -22, y: -19 },
    z: 4,
  },
  // top-centre footballer (img05) — sm row 2 right
  {
    item: { src: IMG.footballer, alt: "Footballer mid-kick" },
    stackOffset: { x: 1, y: -10 },
    stackRotate: -2,
    target: { x: 6, y: -32, rotate: 0, scale: s(5), w: 25, h: 30 },
    targetSm: { x: 22, y: -19 },
    z: 5,
  },
  // mid-right dog (img04) — sm row 3 left
  {
    item: { src: IMG.dog, alt: "Terrier in profile" },
    stackOffset: { x: 18, y: 1 },
    stackRotate: 6,
    target: { x: 37, y: 6, rotate: 0, scale: s(4), w: 18, h: 32 },
    targetSm: { x: -22, y: 20 },
    z: 6,
  },
  // bottom-left breaker (img03) — sm row 3 right
  {
    item: { src: IMG.breaker, alt: "Breakdancer holding a pose" },
    stackOffset: { x: -6, y: 10 },
    stackRotate: 6,
    target: { x: -24, y: 34, rotate: 0, scale: s(3), w: 22, h: 25 },
    targetSm: { x: 22, y: 20 },
    z: 7,
  },
  // bottom-centre painting (img02) — sm row 4 left
  {
    item: { src: IMG.painting, alt: "Renaissance fresco detail" },
    stackOffset: { x: 8, y: 7 },
    stackRotate: 3,
    target: { x: 2, y: 36, rotate: 0, scale: s(2), w: 20, h: 26 },
    targetSm: { x: -22, y: 40 },
    z: 8,
  },
  // bottom-right plane (img01) — sm row 4 right
  {
    item: { src: IMG.plane, alt: "Vintage fighter plane" },
    stackOffset: { x: 20, y: 12 },
    stackRotate: -7,
    target: { x: 30, y: 34, rotate: 0, scale: s(1), w: 16, h: 20 },
    targetSm: { x: 22, y: 40 },
    z: 9,
  },
];

// ---------------------------------------------------------------------------
// Mechanism
// ---------------------------------------------------------------------------

// Scroll progress where the cluster starts scattering and where it finishes.
const SCATTER_START = 0.12;
const SCATTER_END = 0.9;

const PARALLAX_X = 2.6;
const PARALLAX_Y = 2.2;
const PARALLAX_SPRING = { stiffness: 90, damping: 22, mass: 0.6 };
const parallaxDepth = (i: number, total: number) =>
  total <= 1 ? 1 : 0.55 + (i / (total - 1)) * 0.75;

const SUB = "Digital products, interfaces, and experiences built around people.";

const RESPONSIVE = {
  desktop: {
    scale: null as number | null,
    small: false,
    colX: null as number | null,
    card: null as { w: number; h: number } | null,
  },
  small: {
    scale: 0.72,
    small: true,
    colX: 22,
    card: { w: 40, h: 20 },
  },
};

function useResponsive() {
  const [r, setR] = useState(RESPONSIVE.desktop);
  useEffect(() => {
    // Touch vs. mouse, not raw width: a narrow but mouse-driven frame (21st
    // preview, split editor) keeps the desktop scatter + pointer parallax;
    // only real touch devices drop to the stacked column layout.
    const mq = window.matchMedia("(pointer: coarse)");
    const read = () => setR(mq.matches ? RESPONSIVE.small : RESPONSIVE.desktop);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);
  return r;
}

function usePointerParallax(active: boolean, enabled: boolean) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, PARALLAX_SPRING);
  const y = useSpring(rawY, PARALLAX_SPRING);

  useEffect(() => {
    if (!enabled) return;

    if (!active) {
      rawX.set(0);
      rawY.set(0);
      return;
    }

    const onMove = (event: PointerEvent) => {
      rawX.set((event.clientX / window.innerWidth) * 2 - 1);
      rawY.set((event.clientY / window.innerHeight) * 2 - 1);
    };
    const onLeave = () => {
      rawX.set(0);
      rawY.set(0);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [active, enabled, rawX, rawY]);

  return { x, y };
}

export interface StackSpreadItem {
  src: string;
  alt?: string;
}

export interface StackSpreadTarget {
  x: number;
  y: number;
  rotate: number;
  scale?: number;
  w: number;
  h: number;
}

export interface StackSpreadCard {
  item: StackSpreadItem;
  target: StackSpreadTarget;
  /** final x/y (vw/vh) for tablet + mobile; falls back to `target` */
  targetSm?: { x: number; y: number };
  /** angle while clustered */
  stackRotate?: number;
  /** offset while clustered (vw/vh) */
  stackOffset?: { x: number; y: number };
  /** paint order, higher on top */
  z?: number;
}

function Card({
  card,
  progress,
  reduce,
  clusterRotation,
  scaleMul,
  isSmall,
  colX,
  fixedCard,
  stackScale,
  cardRadius,
  pointer,
  depth,
}: {
  card: StackSpreadCard;
  progress: MotionValue<number>;
  reduce: boolean | null;
  clusterRotation: boolean;
  /** uniform rest-scale for every card; null = use each card's own scale */
  scaleMul: number | null;
  isSmall: boolean;
  colX: number | null;
  fixedCard: { w: number; h: number } | null;
  /** scale of the cards while clustered, before the scatter */
  stackScale: number;
  /** corner radius on each card, in px (desktop) */
  cardRadius: number;
  pointer: { x: MotionValue<number>; y: MotionValue<number> };
  depth: number;
}) {
  const { item, target } = card;

  const flat = reduce === true;
  const stackRotate = flat ? 0 : clusterRotation ? card.stackRotate ?? 0 : 0;
  const stackOffset = card.stackOffset ?? { x: 0, y: 0 };
  const restScale = scaleMul ?? target.scale ?? 1;

  // final resting spot: column grid on small screens, scatter on desktop
  const sm = isSmall && card.targetSm ? card.targetSm : null;
  const endX = sm
    ? colX != null
      ? Math.sign(sm.x) * colX
      : sm.x
    : target.x;
  const endY = sm ? sm.y : target.y;
  const endRotate = flat || isSmall ? 0 : target.rotate;

  // -50% keeps card centred on its anchor
  const translate = useTransform(
    [progress, pointer.x, pointer.y],
    ([p, px, py]: number[]) => {
      const tx = stackOffset.x + (endX - stackOffset.x) * p;
      const ty = stackOffset.y + (endY - stackOffset.y) * p;
      const drift = depth * p;
      const dx = tx - px * PARALLAX_X * drift;
      const dy = ty - py * PARALLAX_Y * drift;
      return `calc(-50% + ${dx}vw) calc(-50% + ${dy}vh)`;
    },
  );
  const rotate = useTransform(progress, [0, 1], [stackRotate, endRotate]);
  const scale = useTransform(progress, [0, 1], [stackScale, restScale]);

  return (
    <motion.div
      className="absolute left-1/2 top-1/2 will-change-transform"
      style={{
        width: `${fixedCard ? fixedCard.w : target.w}vw`,
        height: `${fixedCard ? fixedCard.h : target.h}vh`,
        zIndex: card.z ?? 1,
        translate,
        rotate,
        scale,
      }}
    >
      <CardFace item={item} cardRadius={cardRadius} />
    </motion.div>
  );
}

function CardFace({
  item,
  cardRadius,
}: {
  item: StackSpreadItem;
  cardRadius: number;
}) {
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-[4vw] md:rounded-none"
      style={{ borderRadius: `${cardRadius}px` }}
    >
      <img
        src={item.src}
        alt={item.alt ?? ""}
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}

interface StackSpreadStageProps {
  cards?: StackSpreadCard[];
  /** scatter scroll distance, in vh */
  scrollLength?: number;
  bgColor?: string;
  /** fan the clustered stack (default) or start flat */
  clusterRotation?: boolean;
  /** scale of the cards while clustered, before the scatter */
  stackScale?: number;
  /** corner radius on each card, in px (desktop only — mobile keeps its responsive radius) */
  cardRadius?: number;
  /** color of the centre headline and subtitle */
  textColor?: string;
  /** scroll progress (0-1) where the centre text starts fading in */
  textFadeStart?: number;
  /** show the "scroll to spread" hint at the bottom until the scatter begins */
  showScrollHint?: boolean;
  /** override the scroll-driven progress with an external MotionValue (intro mode) */
  progressOverride?: MotionValue<number>;
  /** centre headline; use \n for a line break */
  title?: string;
  /** centre subtitle */
  subtitle?: string;
  /** optional node rendered inside the sticky stage (e.g. a brand overlay) */
  overlay?: ReactNode;
  /** text for the bottom scroll hint */
  scrollHintText?: string;
  /** scroll progress (0-1) where the overlay starts fading out (default: same as textFadeStart) */
  overlayFadeStart?: number;
}

export function StackSpreadStage({
  cards = CARDS,
  scrollLength = 350,
  bgColor = "#ececeb",
  clusterRotation = true,
  stackScale = 0.82,
  cardRadius = 8,
  textColor = "#141414",
  textFadeStart = 0.3,
  showScrollHint = true,
  progressOverride,
  title = "Design\n That\n Responds.",
  subtitle = SUB,
  overlay,
  scrollHintText = "Scroll",
  overlayFadeStart,
}: StackSpreadStageProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scale: scaleMul, small: isSmall, colX, card: fixedCard } =
    useResponsive();

  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ["start start", "end end"],
  });

  const source = progressOverride ?? scrollYProgress;

  // hold, scatter, then settle
  const progress = useTransform(
    source,
    [0, SCATTER_START, SCATTER_END, 1],
    [0, 0, 1, 1],
  );

  // centre text always fades in on scroll; the scale-in is dropped only when
  // reduced motion is confirmed (`true`), not on the null SSR value.
  const [spread, setSpread] = useState(false);
  useMotionValueEvent(progress, "change", (p) => {
    setSpread((was) => (was ? p > 0.985 : p >= 0.999));
  });
  const parallaxEnabled = reduce !== true && !isSmall;
  const pointer = usePointerParallax(spread, parallaxEnabled);

  const noScale = reduce === true;
  const copyOpacity = useTransform(progress, [textFadeStart, textFadeStart + 0.35], [0, 1]);
  const copyScale = useTransform(progress, [textFadeStart, 0.9], [0.85, 1]);

  // scroll hint: visible while clustered, gone by the time the scatter starts
  const hintOpacity = useTransform(progress, [0, SCATTER_START], [1, 0]);

  // brand overlay: holds while clustered, yields as the headline fades in
  const overlayOpacity = useTransform(
    progress,
    [0, overlayFadeStart ?? textFadeStart, (overlayFadeStart ?? textFadeStart) + 0.2],
    [1, 1, 0],
  );

  return (
    <section
      ref={wrapRef}
      className="relative w-full"
      style={{ height: progressOverride ? "100%" : `${scrollLength}vh`, backgroundColor: bgColor }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* centre text */}
        <motion.div
          className="pointer-events-none absolute inset-0 z-[5] flex flex-col items-center justify-center px-6 text-center max-md:px-8"
          style={{
            opacity: copyOpacity,
            scale: noScale ? 1 : copyScale,
          }}
        >
          <h2
            className="w-full whitespace-pre-line text-[4.5vw] font-normal leading-none tracking-tight max-md:text-[10vw]"
            style={{ color: textColor }}
          >
            {title}
          </h2>
          <p
            className="mt-[1.2vw] w-full max-w-[42ch] text-[1.15vw] leading-relaxed tracking-tight max-md:mt-3 max-md:text-[3.6vw]"
            style={{ color: textColor, opacity: 0.6 }}
          >
            {subtitle}
          </p>
        </motion.div>

        {/* optional overlay (e.g. brand logo) — fades out as the scatter begins */}
        {overlay && (
          <motion.div
            className="absolute inset-0 z-30"
            style={{ opacity: overlayOpacity }}
          >
            {overlay}
          </motion.div>
        )}

        {/* scattering cards */}
        <div className="absolute inset-0 z-10">
          {cards.map((card, i) => (
            <Card
              key={i}
              card={card}
              progress={progress}
              reduce={reduce}
              clusterRotation={clusterRotation}
              scaleMul={scaleMul}
              isSmall={isSmall}
              colX={colX}
              fixedCard={fixedCard}
              stackScale={stackScale}
              cardRadius={cardRadius}
              pointer={pointer}
              depth={parallaxEnabled ? parallaxDepth(i, cards.length) : 0}
            />
          ))}
        </div>

        {/* scroll hint */}
        {showScrollHint && !progressOverride && (
          <motion.div
            className="pointer-events-none absolute inset-x-0 bottom-[3vh] z-20 flex flex-col items-center gap-[0.6vh] text-[0.8vw] font-medium uppercase tracking-[0.2em] max-md:bottom-6 max-md:gap-1 max-md:text-[2.8vw]"
            style={{ color: textColor, opacity: hintOpacity }}
          >
            <span>{scrollHintText}</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-bounce max-md:h-[4vw] max-md:w-[4vw]"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </motion.div>
        )}
      </div>
    </section>
  );
}

/** Scroll-driven full-section variant — drop into any page flow. */
export function StackSpreadScroll(props: StackSpreadStageProps) {
  return <StackSpreadStage cards={CARDS} {...props} />;
}

export interface StackSpreadProps {
  /** scatter scroll distance, in vh */
  scrollLength?: number;
  bgColor?: string;
  /** fan the clustered stack (default) or start flat */
  clusterRotation?: boolean;
  /** scale of the cards while clustered, before the scatter */
  stackScale?: number;
  /** corner radius on each card, in px (desktop only — mobile keeps its responsive radius) */
  cardRadius?: number;
  /** color of the centre headline and subtitle */
  textColor?: string;
  /** scroll progress (0-1) where the centre text starts fading in */
  textFadeStart?: number;
  /** show the "scroll to spread" hint at the bottom until the scatter begins */
  showScrollHint?: boolean;
}

export default function StackSpread({
  scrollLength = 350,
  bgColor = "#ececeb",
  clusterRotation = true,
  stackScale = 0.82,
  cardRadius = 8,
  textColor = "#141414",
  textFadeStart = 0.3,
  showScrollHint = true,
}: StackSpreadProps) {
  return (
    <StackSpreadStage
      cards={CARDS}
      scrollLength={scrollLength}
      bgColor={bgColor}
      clusterRotation={clusterRotation}
      stackScale={stackScale}
      cardRadius={cardRadius}
      textColor={textColor}
      textFadeStart={textFadeStart}
      showScrollHint={showScrollHint}
    />
  );
}
