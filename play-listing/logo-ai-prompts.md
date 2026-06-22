# AlbaBiz.ie — AI prompts for logo / icon / graphics

Copy-paste prompts for AI image/logo generators, tuned per tool. They encode the
**existing brand** so anything you generate stays consistent with the live site:

- **Colours:** Albanian flag red `#C8102E` (primary), warm cream `#FAF7F2`
  (background), charcoal `#1C1B19` (ink), restrained antique gold `#B8893A`.
- **Identity:** an Albanian-owned business directory in Ireland, run by ACAI
  (Albanian Cultural Association Ireland). Editorial, warm, trustworthy — a local
  institution, NOT a flashy tech startup.
- **Existing mark:** a geometric "A" peak (like a mountain/roof) with a small red
  keystone notch at the apex nodding to the Albanian double-headed eagle.
- **Type feel:** the site uses Fraunces (serif display) + Inter (sans).

> Tip: **Ideogram** and **Recraft** render *text/logos* far better than
> Midjourney/DALL·E. For a clean vector logo + true SVG export, prefer **Recraft**
> or **Looka/Brandmark**. Use Midjourney/DALL·E for richer feature-graphic art.

---

## 1. App icon (the launcher / 512×512 Play icon)

Goal: a bold, simple mark that reads at 48px. Monogram "A" + red keystone, on a
solid or subtly warm background. Flat, geometric, no photo-realism.

### Ideogram / Recraft (recommended for logos)
```
A modern flat vector app icon for "AlbaBiz", a directory of Albanian-owned
businesses in Ireland. A bold geometric capital letter "A" shaped like a
mountain peak, with a small red keystone notch at the apex subtly suggesting the
Albanian double-headed eagle. White "A" on a solid Albanian-flag-red (#C8102E)
rounded-square background. Minimal, confident, high contrast, centered, generous
safe margin, no text, no gradients, no drop shadows. Editorial and trustworthy,
not techy. Flat design, crisp edges, scalable. --style vector
```

### Midjourney v6
```
flat vector app icon, bold geometric capital letter "A" as a mountain peak with
a small red keystone notch at the apex, white on Albanian flag red #C8102E,
rounded square, minimal, high contrast, centered, thick safe margin, editorial
brand mark for an Albanian business directory, no text, no gradient, no shadow,
crisp scalable design --no photo realism text words letters serifs --ar 1:1 --v 6
```

### DALL·E 3 / ChatGPT
```
Design a flat, minimal app icon (square, 1:1) for "AlbaBiz", an Albanian business
directory in Ireland. Centerpiece: a bold geometric capital "A" formed like a
mountain peak / roof, with a small red keystone wedge at the top hinting at the
Albanian double-headed eagle. White "A" on a solid red (#C8102E) rounded-square
background. No text anywhere. Flat vector style, high contrast, lots of padding
around the mark so it survives masking/cropping. Trustworthy and editorial, not a
tech-startup look. No gradients, no 3D, no drop shadows.
```

### Variations to try
- Swap to an **inverted** version: red "A" on a **cream `#FAF7F2`** background
  (for a lighter, more editorial feel).
- Add the **gold keystone** instead of red (`#B8893A`) for a premium variant.
- Ask for "a 3x3 grid of logo variations" (Ideogram) to pick from.

---

## 2. Wordmark / horizontal logo (header + Play feature graphic)

Goal: "AlbaBiz" (or "AlbaBiz.ie") set in a warm serif, mark to the left, on a
transparent or cream background. This matches the live header.

### Ideogram / Recraft (best for legible text)
```
A horizontal logo lockup for "AlbaBiz.ie". Left: a geometric "A" mountain-peak
mark with a small red keystone notch at the apex. Right: the wordmark "AlbaBiz"
in an elegant warm serif typeface (high-contrast, old-style, like Fraunces),
charcoal #1C1B19 with the "Biz" portion in Albanian-flag-red #C8102E. Clean,
editorial, balanced spacing, on a warm cream #FAF7F2 background. Vector, crisp,
professional, no tagline, no extra graphics. --style vector
```

### With the bilingual tagline (optional)
```
...below the wordmark, a small understated tagline in a clean sans-serif (like
Inter), muted grey: "Rrjeti i Bizneseve Shqiptare në Irlandë". Keep it secondary
and small. Ensure the Albanian characters ë and ç render correctly.
```

> ⚠ AI text rendering is imperfect — even Ideogram can misspell. Generate the
> **mark** with AI, but for the final wordmark consider setting "AlbaBiz" in real
> Fraunces (already self-hosted in `cloud/pages/fonts/`) and combining in Figma/
> Illustrator. That guarantees correct spelling + the exact brand font.

---

## 3. Play Store feature graphic (1024×500, landscape banner)

Goal: a warm hero banner with the logo + a short value line + subtle Irish/
Albanian visual cues. This one benefits from richer art (Midjourney/DALL·E).

### Midjourney v6
```
warm editorial banner, 1024x500, soft cream #FAF7F2 background with subtle
abstract line-art of Irish rolling hills and a faint Albanian double-headed eagle
motif in the corner, a bold geometric red "A" mountain-peak logo mark on the
left, generous negative space, premium community-directory brand, muted warm
palette with a single Albanian-flag-red #C8102E accent and antique gold details,
no busy textures, lots of clean space for a headline --ar 1024:500 --v 6
```

### DALL·E 3
```
A clean, warm horizontal banner (1024×500) for the AlbaBiz app — a directory of
Albanian-owned businesses in Ireland. Cream background, a bold geometric red "A"
mountain-peak logo on the left third, the rest mostly empty negative space for a
headline. Subtle, tasteful line-art hints of Irish landscape and a small Albanian
double-headed eagle accent. Editorial and trustworthy. Single red accent (#C8102E)
plus warm gold details. No photo-realism, no clutter, no text.
```
(Add the headline text yourself afterwards — AI banners with baked-in text usually
misspell. Overlay "AlbaBiz.ie — Bizneset shqiptare në Irlandë" in Fraunces.)

---

## 4. Category / spot illustrations (optional, if you want bespoke art)

The site currently uses Lucide line-icons for the 15 categories. If you want
custom illustrations instead:
```
A set of minimal flat line illustrations on warm cream #FAF7F2, single red
#C8102E stroke with occasional antique-gold fill, consistent 2px stroke weight,
rounded friendly style. Subjects: construction trowel, car, restaurant plate &
cutlery, market basket, barber scissors, cleaning spray, briefcase, house,
medical cross, graduation cap, delivery truck, shopping bag, computer monitor.
Uniform style, centered, lots of padding, no text. --style vector
```

---

## 5. After you generate — how to wire it in

| Asset | Where it goes |
|---|---|
| 512×512 icon PNG | `play-listing/icon-512.png` + Android `ic_launcher` |
| Logo SVG | replace `cloud/pages/brand-mark.svg` (keep the same viewBox shape) |
| Feature graphic 1024×500 | `play-listing/feature-1024x500.png` |
| Favicon | export 32×32 + 180×180 from the icon |
| Android adaptive icon | re-export the "A" as `ic_launcher_foreground` (vector or 432×432 PNG) |

Hand me the generated PNG/SVG files (or their paths) and I'll wire them into the
site + Android project and redeploy.

---

## Recommended workflow
1. **Recraft** (or Ideogram) → generate the **app icon** (prompt #1), pick the
   best, export SVG + 512 PNG.
2. Build the **wordmark** by combining that mark with "AlbaBiz" set in real
   Fraunces (correct font + spelling guaranteed).
3. **Midjourney/DALL·E** → the **feature graphic** background (prompt #3), then
   overlay the wordmark + headline yourself.
4. Send me the files → I integrate + redeploy.
