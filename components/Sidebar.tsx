"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  BriefcaseIcon,
  UserGroupIcon,
  SparklesIcon,
  MicrophoneIcon,
  CpuChipIcon,
  ChevronRightIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";

const nav = [
  {
    label: "Vue d'ensemble",
    href: "/",
    icon: HomeIcon,
  },
  {
    label: "Recrutement RH",
    href: "/recrutement",
    icon: BriefcaseIcon,
    children: [
      { label: "Clients", href: "/recrutement/clients" },
      { label: "Missions", href: "/recrutement/missions" },
      { label: "Candidats", href: "/recrutement/candidats" },
    ],
  },
  {
    label: "Prospects",
    href: "/prospects",
    icon: BuildingOffice2Icon,
  },
  {
    label: "Coaching",
    href: "/coaching",
    icon: UserGroupIcon,
    children: [
      { label: "Coachés", href: "/coaching/coachees" },
      { label: "Séances", href: "/coaching/seances" },
    ],
  },
  {
    label: "LinkedIn",
    href: "/linkedin",
    icon: SparklesIcon,
  },
  {
    label: "Podcast 13ème Mois",
    href: "/podcast",
    icon: MicrophoneIcon,
  },
  {
    label: "Outils IA",
    href: "/outils-ia",
    icon: CpuChipIcon,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-64 min-h-screen bg-gray-950 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">La Manufacture</p>
            <p className="text-indigo-400 text-xs">RH</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
                  active && !item.children
                    ? "bg-indigo-600 text-white"
                    : active && item.children
                    ? "text-white"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.children && (
                  <ChevronRightIcon
                    className={`w-3.5 h-3.5 transition-transform ${active ? "rotate-90" : ""}`}
                  />
                )}
              </Link>

              {item.children && active && (
                <div className="mt-1 ml-8 space-y-0.5">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                        pathname === child.href
                          ? "bg-indigo-600/20 text-indigo-300 font-medium"
                          : "text-gray-500 hover:text-gray-300 hover:bg-gray-800/50"
                      }`}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-800">
        <p className="text-gray-600 text-xs text-center">© 2026 La Manufacture RH</p>
      </div>
    </aside>
  );
}
