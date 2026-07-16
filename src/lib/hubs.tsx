import type { ReactNode } from "react";
import { Heart, TrendingUp, Shield, Landmark, Newspaper } from "lucide-react";

export interface ThematicHub {
  key: string;
  label: string;
  icon: ReactNode;
  categories: string[];
}

export const thematicHubs: ThematicHub[] = [
  {
    key: "health-environment",
    label: "Health & Environment",
    icon: <Heart size={18} />,
    categories: [
      "Health & Science",
      "Environment & Energy",
      "Safety & Consumer Protection",
      "Veterans Affairs, Healthcare, & Benefits",
    ],
  },
  {
    key: "economy-trade",
    label: "Economy & Trade",
    icon: <TrendingUp size={18} />,
    categories: [
      "Finance & Economy",
      "Commerce & Trade",
      "Agriculture & Food",
      "Labor & Employment",
    ],
  },
  {
    key: "defense-security",
    label: "Defense & Security",
    icon: <Shield size={18} />,
    categories: [
      "Defense & Security",
      "Technology, Cybersecurity, & Space",
      "Diplomacy & Foreign Affairs",
    ],
  },
  {
    key: "law-policy",
    label: "Law & Policy",
    icon: <Landmark size={18} />,
    categories: [
      "Congress & Legislation",
      "Courts & Judiciary",
      "Executive & Press",
      "Rulemaking & Regulations",
      "Oversight & Audits",
    ],
  },
  {
    key: "general-bulletins",
    label: "General Bulletins",
    icon: <Newspaper size={18} />,
    categories: [
      "Transportation",
      "General",
      "Grants & Arts",
      "Housing, Urban Development, & Infrastructure",
      "Development & Education",
    ],
  },
];
