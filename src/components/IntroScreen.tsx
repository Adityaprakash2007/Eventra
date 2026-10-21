import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { Ticket, ChevronDown } from "lucide-react";
import ImageStreamHero, { type StreamImage } from "@/components/ui/image-stream-hero";

/**
 * Eventra intro / loading screen — ImageStreamHero corridor edition.
 *
 * A full-viewport hero: two mirrored rails of event imagery stream toward the
 * viewer behind the Eventra brand and a scroll cue. Scrolling down (or tapping
 * "Get started") moves past the hero to the dashboard, which flows in directly
 * underneath — real page scroll, no scroll-jacking.
 *
 * Plays once per browser session (sessionStorage): afterwards the dashboard is
 * the first thing users see. The corridor itself pauses under
 * prefers-reduced-motion (built into the component).
 */

const KEY = "eventra-intro-shown";

const IMAGES: StreamImage[] = [
  { src: "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=600&q=80&auto=format&fit=crop", alt: "Concert crowd with raised hands" },
  { src: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=600&q=80&auto=format&fit=crop", alt: "Live band on stage under warm lights" },
  { src: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80&auto=format&fit=crop", alt: "Conference audience in a large hall" },
  { src: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&q=80&auto=format&fit=crop", alt: "Party celebration with confetti" },
  { src: "https://images.unsplash.com/photo-1507924538820-ede94a04019d?w=600&q=80&auto=format&fit=crop", alt: "Theatre stage bathed in red light" },
  { src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&q=80&auto=format&fit=crop", alt: "Team collaborating at a workshop table" },
  { src: "https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=600&q=80&auto=format&fit=crop", alt: "DJ mixing in front of a crowd" },
  { src: "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&q=80&auto=format&fit=crop", alt: "Friends celebrating at an evening event" },
];

export default function IntroScreen({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const [show, setShow] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(KEY) !== "1";
    } catch {
      return true;
    }
  });

  // Mark as shown as soon as the user leaves the hero.
  useEffect(() => {
    if (!show) return;
    const onScroll = () => {
      if (window.scrollY > window.innerHeight * 0.5) {
        try {
          sessionStorage.setItem(KEY, "1");
        } catch {
          /* storage unavailable */
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [show]);

  if (!show) return <>{children}</>;

  return (
    <>
      {/* ── Intro hero ─────────────────────────────────────────────── */}
      <ImageStreamHero
        images={IMAGES}
        speed={16}
        className="h-screen w-full bg-[#0b1020]"
        path={{ cardRadius: 0.8 }}
      >
        {/* readability scrim over the corridor */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0b1020]/80 via-[#0b1020]/40 to-[#0b1020]/85" />

        {/* brand + copy */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-4"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
              <Ticket className="h-8 w-8" />
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl">
              Eventra
            </h1>
            <p className="max-w-md text-balance text-base text-white/70">
              Registration &amp; ticketing for modern events — discover, register
              and pay in seconds.
            </p>
          </motion.div>

          <motion.button
            onClick={() =>
              window.scrollTo({ top: window.innerHeight, behavior: "smooth" })
            }
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="mt-8 rounded-full bg-gradient-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition-transform hover:scale-[1.03] active:scale-95"
          >
            Get started
          </motion.button>
        </div>

        {/* scroll cue */}
        <motion.button
          onClick={() =>
            window.scrollTo({ top: window.innerHeight, behavior: "smooth" })
          }
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
          className="absolute inset-x-0 bottom-6 z-10 mx-auto flex w-fit flex-col items-center gap-1 text-white/60 transition-colors hover:text-white"
          aria-label="Scroll to dashboard"
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.25em]">
            Scroll to explore
          </span>
          <ChevronDown className="h-4 w-4 animate-bounce" />
        </motion.button>
      </ImageStreamHero>

      {/* ── Dashboard flows in underneath ──────────────────────────── */}
      <motion.div
        initial={reduce ? false : { opacity: 0.4 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </>
  );
}
