import { Sun, Cloud, CloudSun, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning } from "lucide-react";

/** Map the server's icon names (from WMO weather codes) to lucide icons. */
const ICONS: Record<string, typeof Sun> = {
  sun: Sun,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
};

export function WeatherIcon({ icon, size = 18, className }: { icon: string; size?: number; className?: string }) {
  const Icon = ICONS[icon] ?? Cloud;
  return <Icon size={size} className={className} />;
}
