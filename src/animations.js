/**
 * What `break` can show.
 *
 * The rain ships with Jarek; anything else is added by the user's own plugins
 * (see src/plugins.js), so `break spore` works the moment a plugin registers
 * an animation called "spore".
 *
 * An animation is { name, about?, run(args, ctx) }. It gets the screen to
 * itself — `break` is a fullscreen command, so the prompt has already stepped
 * aside — and returns when the viewer leaves.
 */

const animations = new Map();

export function registerAnimation(animation) {
  const name = String(animation?.name ?? "").trim().toLowerCase();
  if (!/^[a-z][a-z0-9-]*$/.test(name) || typeof animation?.run !== "function") return false;
  if (animations.has(name)) return false; // first one wins: the rain cannot be replaced
  animations.set(name, { name, about: String(animation.about ?? ""), run: animation.run });
  return true;
}

export function findAnimation(name) {
  return animations.get(String(name ?? "").trim().toLowerCase()) ?? null;
}

export function animationNames() {
  return [...animations.keys()];
}

/** For tests: forget everything a plugin added. */
export function resetAnimations(keep = []) {
  const kept = keep.map((name) => [name, animations.get(name)]).filter(([, value]) => value);
  animations.clear();
  for (const [name, value] of kept) animations.set(name, value);
}
