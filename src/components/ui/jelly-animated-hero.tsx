// Adapted from FarmUI's FUIHeroWithJelly for Eventra (Vite + React Router):
// - next/image → plain <img>, next/link → react-router <Link>
// - Tailwind v3-safe classes (no theme() slash-opacity, no min-w-screen/h-50)
// - data-aos attributes replaced with Framer Motion entrance fades
// - content via props with Eventra defaults; video + Unsplash imagery verified live

import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

export interface JellyHeroProps {
  headline?: ReactNode;
  subtitle?: string;
  ctaLabel?: string;
  /** react-router path for the CTA */
  ctaTo?: string;
  /** large screenshot-style image floating above the video */
  imageSrc?: string;
  imageAlt?: string;
  /** background video (the animated "jelly") */
  videoSrc?: string;
  className?: string;
}

const DEFAULTS = {
  headline: (
    <>
      Manage your events, sales
      <br className="max-lg:hidden" /> and analytics in one place.
    </>
  ),
  subtitle:
    "Eventra is a modern registration & ticketing platform that changes how teams create, run and measure events.",
  ctaLabel: "Explore events",
  ctaTo: "/events",
  imageSrc:
    "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=1600&q=80&auto=format&fit=crop",
  imageAlt: "Audience under stage lights at a live event",
  videoSrc: "https://ease-one.vercel.app/bg/something.mp4",
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] as const, delay },
  }),
};

export default function JellyHero({
  headline = DEFAULTS.headline,
  subtitle = DEFAULTS.subtitle,
  ctaLabel = DEFAULTS.ctaLabel,
  ctaTo = DEFAULTS.ctaTo,
  imageSrc = DEFAULTS.imageSrc,
  imageAlt = DEFAULTS.imageAlt,
  videoSrc = DEFAULTS.videoSrc,
  className = "",
}: JellyHeroProps) {
  const reduce = useReducedMotion();
  const anim = (delay: number) =>
    reduce ? {} : { variants: fadeUp, initial: "hidden" as const, animate: "show" as const, custom: delay };

  return (
    <section
      className={`relative overflow-hidden rounded-3xl text-white shadow-2xl bg-[linear-gradient(to_bottom,#0b0b10,#000_30%,#000_98%)] ${className}`}
    >
      <div className="px-2 mx-auto sm:px-6 md:px-0">
        <div className="pt-12 md:pt-16">
          {/* Headline + subtitle + CTA */}
          <div className="pb-10 text-center md:pb-14">
            <motion.h1
              {...anim(0.05)}
              className="mx-auto mb-5 max-w-3xl bg-gradient-to-b from-indigo-200 via-violet-200 to-white bg-clip-text p-4 text-4xl font-normal tracking-tighter text-transparent md:text-6xl"
            >
              {headline}
            </motion.h1>

            <div className="relative mx-auto max-w-3xl">
              <motion.p {...anim(0.2)} className="mb-8 text-lg text-gray-400">
                {subtitle}
              </motion.p>

              {/* ambient blue glow */}
              <div
                className="absolute left-0 top-0 h-80 w-[90%] overflow-x-hidden bg-blue-500/40 opacity-60 blur-[200px]"
                style={{ transform: "rotate(-30deg)" }}
                aria-hidden
              />

              <div className="relative before:absolute before:inset-0 before:[border-image:linear-gradient(to_right,transparent,rgba(203,213,225,0.8),transparent)_1] before:border-y">
                <motion.div
                  {...anim(0.35)}
                  className="items-center z-20 mx-auto mt-[-16px] mb-[18px] flex max-w-none justify-center gap-5"
                >
                  <Link
                    to={ctaTo}
                    className="group inline-flex w-fit items-center justify-center gap-x-2 rounded-xl border border-white/30 bg-white/5 px-5 py-3 text-base font-medium text-white backdrop-blur-md duration-200 hover:border-zinc-600 hover:bg-white/10 hover:text-zinc-100"
                  >
                    {ctaLabel}
                    <div className="relative ml-1 flex h-5 w-5 items-center justify-center overflow-hidden">
                      <ArrowUpRight className="absolute transition-all duration-500 group-hover:-translate-y-5 group-hover:translate-x-5" />
                      <ArrowUpRight className="absolute -translate-x-5 -translate-y-5 transition-all duration-500 group-hover:translate-x-0 group-hover:translate-y-0" />
                    </div>
                  </Link>
                </motion.div>
              </div>
            </div>
          </div>

          {/* Hero media: floating image over the animated jelly video */}
          <motion.div {...anim(0.5)} className="relative mx-auto max-w-6xl px-2 sm:px-6 md:px-8">
            <img
              src={imageSrc}
              alt={imageAlt}
              loading="lazy"
              decoding="async"
              draggable={false}
              className="relative z-10 w-full rounded-3xl shadow-2xl"
            />
            {videoSrc && (
              <video
                autoPlay
                loop
                muted
                playsInline
                src={videoSrc}
                aria-hidden
                className="pointer-events-none mx-auto -mt-24 w-full rounded-b-3xl opacity-90"
              />
            )}
          </motion.div>

          {/* fade-out into the black section floor */}
          <div className="h-10 bg-gradient-to-b from-transparent to-transparent md:h-14" aria-hidden />
        </div>
      </div>
    </section>
  );
}
