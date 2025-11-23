"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Text, Button, Heading } from "@radix-ui/themes";
import VRMViewerCompact from "./VRMViewerCompact";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

interface LandingPageProps {
  onEnter: () => void;
}

export default function LandingPage({ onEnter }: LandingPageProps) {
  const titleRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Enable scrolling on body when landing page is mounted
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'auto';

    gsap.registerPlugin(ScrollTrigger);

    // Animate title flying off
    gsap.to(titleRef.current, {
      y: -200,
      opacity: 0,
      ease: "power2.out",
      scrollTrigger: {
        trigger: heroRef.current,
        start: "top top",
        end: "bottom top",
        scrub: 1,
      }
    });

    // Button stays in place - no animation

    // Camera animation - move backwards
    const cameraAnimation = gsap.to({}, {
      duration: 1,
      ease: "none",
      scrollTrigger: {
        trigger: heroRef.current,
        start: "top top",
        end: "bottom top",
        scrub: 1,
        onUpdate: (self) => {
          // This will be controlled by the VRMViewerCompact component
          const progress = self.progress;
          // Update global camera state
          if (typeof window !== 'undefined') {
            (window as any).landingCameraProgress = progress;
          }
        }
      }
    });

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
      // Restore original overflow when component unmounts
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-screen z-[9999]"
      style={{
        background: 'linear-gradient(180deg, #fce7f3 0%, #fbcfe8 100%)',
      }}
    >
      {/* Dark overlay */}
      <div
        className="absolute inset-0 z-10"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
        }}
      />

      {/* Hero Section - Full Screen */}
      <div ref={heroRef} className="relative w-full h-screen flex flex-col items-center justify-center z-20">
        {/* Text Content - Center */}
        <div ref={titleRef} className="z-30 flex flex-col items-center justify-center text-center px-8 mb-16">
          <Heading
            size="9"
            weight="bold"
            style={{
              color: 'white',
              letterSpacing: '-0.03em',
              marginBottom: '0.5rem',
            }}
          >
            VibeTrade
          </Heading>

          <Text
            size="5"
            className="max-w-2xl"
            style={{
              color: 'rgba(255, 255, 255, 0.9)',
              marginBottom: '1rem',
            }}
          >
            Your AI Trading Companion
          </Text>

          <Button
            ref={buttonRef}
            onClick={onEnter}
            size="4"
            style={{
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 600,
              backgroundColor: '#be185d',
              color: 'white',
            }}
          >
            Enter Dashboard
          </Button>
        </div>

        {/* 3D Model - Landing Page Horse Girl */}
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ zIndex: 1 }}
        >
          <VRMViewerCompact
            viewMode="landing"
          />
        </motion.div>

        {/* Mesh gradient overlay */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-60">
          <div
            className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255,87,181,0.3) 0%, transparent 50%)',
              filter: 'blur(80px)',
            }}
          />
          <div
            className="absolute -bottom-1/4 -right-1/4 w-[150%] h-[150%] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(255,12,130,0.25) 0%, transparent 50%)',
              filter: 'blur(100px)',
            }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(250,122,180,0.2) 0%, transparent 60%)',
              filter: 'blur(120px)',
            }}
          />
        </div>
      </div>

    </div>
  );
}

