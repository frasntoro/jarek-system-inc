/**
 * Current conditions and tomorrow's outlook from Open-Meteo: free, keyless and
 * fast. Conditions come back as WMO codes, which src/i18n.js turns into words.
 */

import { fetchJson } from "../net.js";

export async function getWeather(location, { units = "metric", timeout = 4000 } = {}) {
  if (!location) return null;
  const imperial = units === "imperial";
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${location.latitude}&longitude=${location.longitude}` +
    "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m" +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code" +
    "&forecast_days=2&timezone=auto" +
    (imperial ? "&temperature_unit=fahrenheit&wind_speed_unit=mph" : "");

  const data = await fetchJson(url, { timeout });
  if (!data?.current) return null;

  const daily = data.daily ?? {};
  const tomorrowIndex = daily.time?.length > 1 ? 1 : 0;

  return {
    degree: imperial ? "°F" : "°C",
    now: {
      temperature: Math.round(data.current.temperature_2m),
      feelsLike: Math.round(data.current.apparent_temperature),
      code: data.current.weather_code,
      wind: Math.round(data.current.wind_speed_10m),
    },
    tomorrow: {
      min: Math.round(daily.temperature_2m_min?.[tomorrowIndex]),
      max: Math.round(daily.temperature_2m_max?.[tomorrowIndex]),
      rainChance: daily.precipitation_probability_max?.[tomorrowIndex] ?? null,
      code: daily.weather_code?.[tomorrowIndex],
    },
  };
}
