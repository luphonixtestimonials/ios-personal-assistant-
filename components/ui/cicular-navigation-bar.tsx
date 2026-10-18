"use client";
 
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { X } from "lucide-react";
 
export interface NavItem {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  onClick?: () => void;
}
 
export interface CircularNavigationProps {
  navItems: NavItem[];
  isOpen: boolean;
  toggleMenu: () => void;
  radius?: number;
}
 
export default function CircularNavigation({
  navItems,
  isOpen,
  toggleMenu,
  radius = 150,
}: CircularNavigationProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
 
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 h-screen w-full flex items-center justify-center bg-black/60 backdrop-blur-md z-[9000]">
          <div
            className="fixed inset-0 flex items-center justify-center z-[10000]"
            onClick={toggleMenu}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.2 }}
              transition={{ duration: 0.45, ease: [0.175, 0.885, 0.32, 1.275] }}
              className="relative aspect-square w-[420px] max-w-[92vw] rounded-full flex items-center justify-center"
              style={{
                background: "radial-gradient(circle at center, rgba(16, 26, 44, 0.85) 0%, rgba(6, 11, 20, 0.95) 100%)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                boxShadow:
                  "inset 2px 2px 2px rgba(255,255,255,0.4), inset -1px -1px 2px rgba(0,217,255,0.3), 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 35px rgba(0, 140, 255, 0.3)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Center Close / Emblem Button */}
              <button
                onClick={toggleMenu}
                aria-label="Close navigation"
                className="absolute aspect-square flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 text-white shadow-[0_0_20px_rgba(0,217,255,0.6)] hover:scale-110 active:scale-95 transition-all duration-300 z-20 cursor-pointer"
              >
                <X className="w-6 h-6 stroke-[2.5]" />
              </button>
 
              {/* Radial Items */}
              {navItems.map((item, index) => {
                const Icon = item.icon;
                const angle = (360 / navItems.length) * index;
 
                return (
                  <div
                    key={item.name}
                    className="absolute"
                    style={{
                      transform: `rotate(${angle}deg) translate(${radius}px) rotate(-${angle}deg)`,
                    }}
                  >
                    <Link
                      href={item.href || "#"}
                      className={`flex flex-col items-center justify-center w-20 h-20 aspect-square rounded-full transition-all duration-300 no-underline cursor-pointer border ${
                        hoveredItem === item.name
                          ? "bg-white text-black scale-110 shadow-[0_0_25px_rgba(255,255,255,0.8)] border-white"
                          : "text-slate-200 bg-white/5 hover:bg-white/15 border-white/10 shadow-[inset_1px_1px_1px_rgba(255,255,255,0.25)]"
                      }`}
                      onMouseEnter={() => setHoveredItem(item.name)}
                      onMouseLeave={() => setHoveredItem(null)}
                      onClick={(e) => {
                        if (item.onClick) {
                          item.onClick();
                        }
                        toggleMenu();
                      }}
                    >
                      <Icon className="w-6 h-6 mb-1 transition-transform duration-200" />
                      <span
                        className="text-[11px] font-semibold tracking-tight"
                        style={{ textDecoration: "none" }}
                      >
                        {item.name}
                      </span>
                    </Link>
                  </div>
                );
              })}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
