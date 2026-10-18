import React from "react";
import { Component, LiquidGlassNavBar } from "./liquid-glass";

export default function DemoOne() {
  return (
    <div className="relative w-full min-h-screen">
      <Component />
    </div>
  );
}

export function DemoNavigation() {
  const [activeTab, setActiveTab] = React.useState("dashboard");

  return (
    <div className="relative w-full min-h-[300px] flex items-center justify-center p-8 bg-slate-950">
      <LiquidGlassNavBar
        activeId={activeTab}
        onSelect={setActiveTab}
        centerEmblem={
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-blue-600 to-cyan-400 p-0.5 shadow-[0_0_20px_rgba(0,217,255,0.7)] cursor-pointer">
            <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-cyan-300 font-bold text-xs">
              LPX
            </div>
          </div>
        }
        items={[
          { id: "dashboard", label: "Home" },
          { id: "tasks", label: "Tasks" },
          { id: "hydration", label: "Water" },
          { id: "reminders", label: "Reminders" },
          { id: "siri", label: "Siri" },
          { id: "devices", label: "Devices" },
          { id: "settings", label: "Settings" },
        ]}
      />
    </div>
  );
}
