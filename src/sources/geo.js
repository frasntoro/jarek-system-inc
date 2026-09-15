/**
 * Approximate location. Two providers are tried in order; both are keyless and
 * derive the position from the public IP address, so the result is a city, not
 * a street. `--city` bypasses this entirely and goes straight to geocoding.
 */

import { fetchJson } from "../net.js";

function fromIpapi(d) {
  if (!d || d.error || typeof d.latitude !== "number") return null;
  return {
    city: d.city,
    region: d.region,
    country: d.country_name,
    latitude: d.latitude,
    longitude: d.longitude,
    timezone: d.timezone,
  };
}

function fromIpwho(d) {
  if (!d || d.success === false || typeof d.latitude !== "number") return null;
  return {
    city: d.city,
    region: d.region,
    country: d.country,
    latitude: d.latitude,
    longitude: d.longitude,
    timezone: d.timezone?.id,
  };
}

export async function locateByIp({ timeout = 4000 } = {}) {
  const providers = [
    ["https://ipapi.co/json/", fromIpapi],
    ["https://ipwho.is/", fromIpwho],
  ];
  for (const [url, parse] of providers) {
    try {
      const located = parse(await fetchJson(url, { timeout }));
      if (located?.city) return located;
    } catch {
      // Try the next provider.
    }
  }
  return null;
}

/**
 * Picks the location for this run.
 *
 * An explicit --city wins. Otherwise the position comes from the IP address,
 * and when Jarek is not speaking English the place name is looked up again in
 * the local language: an Italian briefing should say "Milano, Italia", not
 * "Milan, Italy". The coordinates from the IP lookup are kept either way.
 */
export async function resolveLocation({ city, language = "en", timeout = 4000 } = {}) {
  if (city) return locateByName(city, { language, timeout });

  const located = await locateByIp({ timeout });
  if (!located || language.startsWith("en") || !located.city) return located;

  try {
    const translated = await locateByName(located.city, { language, timeout });
    if (translated?.city) {
      return { ...located, city: translated.city, region: translated.region, country: translated.country };
    }
  } catch {
    // The English name is perfectly usable.
  }
  return located;
}

/** Turns a city name typed by the user into coordinates. */
export async function locateByName(name, { language = "en", timeout = 4000 } = {}) {
  const url =
    "https://geocoding-api.open-meteo.com/v1/search" +
    `?name=${encodeURIComponent(name)}&count=1&language=${encodeURIComponent(language)}&format=json`;
  const data = await fetchJson(url, { timeout });
  const hit = data?.results?.[0];
  if (!hit) return null;
  return {
    city: hit.name,
    region: hit.admin1,
    country: hit.country,
    latitude: hit.latitude,
    longitude: hit.longitude,
    timezone: hit.timezone,
  };
}
