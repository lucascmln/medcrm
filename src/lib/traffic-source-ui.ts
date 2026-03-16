export type TrafficSourceKey = "META_ADS" | "GOOGLE_ADS" | "BIO_LINK" | "GOOGLE_ORGANIC" | "DIRECT";

export interface TrafficSourceConfig {
  label: string;
  color: string;
  bg: string;
  text: string;
}

export const TRAFFIC_SOURCE_CONFIG: Record<TrafficSourceKey, TrafficSourceConfig> = {
  META_ADS:       { label: "Meta Ads",        color: "#1877F2", bg: "bg-blue-100",    text: "text-blue-700"    },
  GOOGLE_ADS:     { label: "Google Ads",       color: "#EA4335", bg: "bg-red-100",     text: "text-red-700"     },
  BIO_LINK:       { label: "Link na Bio",      color: "#8B5CF6", bg: "bg-violet-100",  text: "text-violet-700"  },
  GOOGLE_ORGANIC: { label: "Google Orgânico",  color: "#10B981", bg: "bg-emerald-100", text: "text-emerald-700" },
  DIRECT:         { label: "Direto",           color: "#94A3B8", bg: "bg-slate-100",   text: "text-slate-500"   },
};

export function getTrafficSourceConfig(key: string | null | undefined): TrafficSourceConfig {
  if (key && key in TRAFFIC_SOURCE_CONFIG) return TRAFFIC_SOURCE_CONFIG[key as TrafficSourceKey];
  return TRAFFIC_SOURCE_CONFIG.DIRECT;
}
