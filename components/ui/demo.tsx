"use client";
 
import React, { useState } from "react";
import CircularNavigation from "./cicular-navigation-bar";
import {
  Home,
  Film,
  Music,
  Trophy,
  FileText,
  Settings,
  Search,
} from "lucide-react";
import { Button } from "./button";
 
const navItems = [
  { name: "Home", icon: Home, href: "/" },
  { name: "Movies", icon: Film, href: "/movies" },
  { name: "Music", icon: Music, href: "/music" },
  { name: "Sports", icon: Trophy, href: "/sports" },
  { name: "News", icon: FileText, href: "/news" },
  { name: "Settings", icon: Settings, href: "/settings" },
  { name: "Search", icon: Search, href: "/search" },
];
 
export default function CircularNav() {
  const [isOpen, setIsOpen] = useState(false);
 
  const toggleMenu = () => setIsOpen(!isOpen);
 
  return (
    <>
      <div className="h-screen w-full flex items-center justify-center bg-slate-950">
        <Button onClick={toggleMenu} className="px-6 py-3 rounded-full text-base font-semibold shadow-lg shadow-blue-500/20">
          Open Navigation
        </Button>
      </div>
      <CircularNavigation
        navItems={navItems}
        isOpen={isOpen}
        toggleMenu={toggleMenu}
      />
    </>
  );
}
