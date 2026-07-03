import { useQuery } from "@tanstack/react-query";

export interface WeatherCurrent {
  temp: number;
  code: number;
  icon: string;
  label: string;
}

export interface WeatherDaily {
  date: string; // YYYY-MM-DD
  hi: number;
  lo: number;
  code: number;
  icon: string;
}

interface WeatherResponse {
  enabled: boolean;
  current?: WeatherCurrent;
  daily?: WeatherDaily[];
  location?: string;
  updatedAt?: string;
}

/**
 * Forecast for the kiosk. The server caches upstream calls for 30 minutes;
 * this hook polls on the same cadence so the always-on display stays fresh
 * without hammering anything. When weather is unconfigured the server returns
 * { enabled: false } and every consumer hides its weather UI.
 */
export function useWeather() {
  const { data } = useQuery<WeatherResponse>({
    queryKey: ["/api/weather"],
    staleTime: 30 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const isEnabled = data?.enabled === true && !!data.current;
  return {
    isEnabled,
    current: isEnabled ? data!.current : undefined,
    daily: isEnabled ? data!.daily ?? [] : [],
    location: isEnabled ? data!.location ?? "" : "",
  };
}

/** Key a daily forecast by local YYYY-MM-DD for date lookups. */
export function dailyKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
