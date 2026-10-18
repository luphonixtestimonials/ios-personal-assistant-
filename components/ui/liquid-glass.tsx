"use client";

import React from "react";

// Types
export interface GlassEffectProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  href?: string;
  target?: string;
}

export interface DockIcon {
  src: string;
  alt: string;
  onClick?: () => void;
}

// Glass Effect Wrapper Component
export const GlassEffect: React.FC<GlassEffectProps> = ({
  children,
  className = "",
  style = {},
  href,
  target = "_blank",
}) => {
  const glassStyle = {
    boxShadow: "0 6px 6px rgba(0, 0, 0, 0.2), 0 0 20px rgba(0, 0, 0, 0.1)",
    transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
    ...style,
  };

  const content = (
    <div
      className={`relative flex font-semibold overflow-hidden text-black cursor-pointer transition-all duration-700 ${className}`}
      style={glassStyle}
    >
      {/* Glass Layers */}
      <div
        className="absolute inset-0 z-0 overflow-hidden rounded-inherit rounded-3xl"
        style={{
          backdropFilter: "blur(3px)",
          filter: "url(#glass-distortion)",
          isolation: "isolate",
        }}
      />
      <div
        className="absolute inset-0 z-10 rounded-inherit"
        style={{ background: "rgba(255, 255, 255, 0.25)" }}
      />
      <div
        className="absolute inset-0 z-20 rounded-inherit rounded-3xl overflow-hidden"
        style={{
          boxShadow:
            "inset 2px 2px 1px 0 rgba(255, 255, 255, 0.5), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.5)",
        }}
      />

      {/* Content */}
      <div className="relative z-30">{children}</div>
    </div>
  );

  return href ? (
    <a href={href} target={target} rel="noopener noreferrer" className="block">
      {content}
    </a>
  ) : (
    content
  );
};

// Dock Component
export const GlassDock: React.FC<{ icons: DockIcon[]; href?: string }> = ({
  icons,
  href,
}) => (
  <GlassEffect
    href={href}
    className="rounded-3xl p-3 hover:p-4 hover:rounded-4xl"
  >
    <div className="flex items-center justify-center gap-2 rounded-3xl p-3 py-0 px-0.5 overflow-hidden">
      {icons.map((icon, index) => (
        <img
          key={index}
          src={icon.src}
          alt={icon.alt}
          className="w-16 h-16 transition-all duration-700 hover:scale-110 cursor-pointer"
          style={{
            transformOrigin: "center center",
            transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
          }}
          onClick={icon.onClick}
        />
      ))}
    </div>
  </GlassEffect>
);

// Button Component
export const GlassButton: React.FC<{ children: React.ReactNode; href?: string }> = ({
  children,
  href,
}) => (
  <GlassEffect
    href={href}
    className="rounded-3xl px-10 py-6 hover:px-11 hover:py-7 hover:rounded-4xl overflow-hidden"
  >
    <div
      className="transition-all duration-700 hover:scale-95"
      style={{
        transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
      }}
    >
      {children}
    </div>
  </GlassEffect>
);

// SVG Filter Component
export const GlassFilter: React.FC = () => (
  <svg style={{ display: "none" }} aria-hidden="true">
    <filter
      id="glass-distortion"
      x="0%"
      y="0%"
      width="100%"
      height="100%"
      filterUnits="objectBoundingBox"
    >
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.001 0.005"
        numOctaves="1"
        seed="17"
        result="turbulence"
      />
      <feComponentTransfer in="turbulence" result="mapped">
        <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
        <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
        <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
      </feComponentTransfer>
      <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
      <feSpecularLighting
        in="softMap"
        surfaceScale="5"
        specularConstant="1"
        specularExponent="100"
        lightingColor="white"
        result="specLight"
      >
        <fePointLight x="-200" y="-200" z="300" />
      </feSpecularLighting>
      <feComposite
        in="specLight"
        operator="arithmetic"
        k1="0"
        k2="1"
        k3="1"
        k4="0"
        result="litImage"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="softMap"
        scale="200"
        xChannelSelector="R"
        yChannelSelector="G"
      />
    </filter>
  </svg>
);

// Navigation Menu Specific Liquid Glass Component
export interface LiquidNavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export const LiquidGlassNavBar: React.FC<{
  items: LiquidNavItem[];
  activeId?: string;
  onSelect?: (id: string) => void;
  centerEmblem?: React.ReactNode;
}> = ({ items, activeId, onSelect, centerEmblem }) => {
  return (
    <>
      <GlassFilter />
      <nav
        className="fixed bottom-4 left-1/2 -translate-x-1/2 w-[95%] max-w-[460px] h-16 rounded-[36px] flex items-center justify-around px-2 z-50 overflow-hidden"
        style={{
          boxShadow:
            "0 16px 40px rgba(0, 0, 0, 0.75), 0 0 25px rgba(0, 140, 255, 0.25)",
          transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
        }}
      >
        {/* Layer 1: Liquid Refraction & Backdrop Blur */}
        <div
          className="absolute inset-0 z-0 rounded-[36px] pointer-events-none"
          style={{
            backdropFilter: "blur(20px) saturate(190%)",
            WebkitBackdropFilter: "blur(20px) saturate(190%)",
            filter: "url(#glass-distortion)",
            isolation: "isolate",
          }}
        />

        {/* Layer 2: Obsidian Translucent Tint */}
        <div
          className="absolute inset-0 z-10 rounded-[36px] pointer-events-none"
          style={{
            background:
              "linear-gradient(145deg, rgba(16, 26, 44, 0.85), rgba(7, 13, 23, 0.92))",
          }}
        />

        {/* Layer 3: Liquid Specular Light Rim */}
        <div
          className="absolute inset-0 z-20 rounded-[36px] pointer-events-none"
          style={{
            boxShadow:
              "inset 1.5px 1.5px 1px 0 rgba(255, 255, 255, 0.5), inset -1px -1px 1.5px 1px rgba(0, 217, 255, 0.4)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
          }}
        />

        {/* Interactive Content */}
        <div className="relative z-30 flex items-center justify-around w-full">
          {items.map((item, idx) => {
            const isActive = activeId ? activeId === item.id : item.active;
            return (
              <React.Fragment key={item.id}>
                {/* Insert center emblem halfway if provided */}
                {centerEmblem && idx === Math.floor(items.length / 2) && (
                  <div className="flex-shrink-0 mx-1">{centerEmblem}</div>
                )}
                <button
                  onClick={() => {
                    item.onClick?.();
                    onSelect?.(item.id);
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-500 cursor-pointer ${
                    isActive
                      ? "text-cyan-400 scale-105"
                      : "text-slate-400 hover:text-white hover:scale-105"
                  }`}
                  style={{
                    transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
                    background: isActive
                      ? "linear-gradient(135deg, rgba(0, 140, 255, 0.28), rgba(0, 217, 255, 0.14))"
                      : "transparent",
                    boxShadow: isActive
                      ? "inset 1px 1px 1px rgba(255,255,255,0.45), 0 0 16px rgba(0, 217, 255, 0.35)"
                      : "none",
                  }}
                >
                  {item.icon}
                  <span className="text-[10px] font-semibold mt-0.5 tracking-tight">
                    {item.label}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </nav>
    </>
  );
};

// Main Component
export const Component = () => {
  const dockIcons: DockIcon[] = [
    {
      src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&auto=format&fit=crop&q=80",
      alt: "Assistant",
    },
    {
      src: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=128&auto=format&fit=crop&q=80",
      alt: "Technology",
    },
    {
      src: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=128&auto=format&fit=crop&q=80",
      alt: "Hardware",
    },
    {
      src: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=128&auto=format&fit=crop&q=80",
      alt: "Code",
    },
    {
      src: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=128&auto=format&fit=crop&q=80",
      alt: "Design",
    },
  ];

  return (
    <div
      className="min-h-screen h-full flex items-center justify-center font-light relative overflow-hidden w-full"
      style={{
        background: `radial-gradient(ellipse at 50% 20%, #0d1b33 0%, #05080f 80%)`,
      }}
    >
      <GlassFilter />

      <div className="flex flex-col gap-6 items-center justify-center w-full px-4">
        <GlassDock icons={dockIcons} href="#" />

        <GlassButton href="#">
          <div className="text-xl text-white font-medium">
            <p>How can I help you today?</p>
          </div>
        </GlassButton>
      </div>
    </div>
  );
};

export default Component;
