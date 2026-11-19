# The itch.io page

Everything needed to dress the itch.io page in the game's poster look. Open [`preview.html`](preview.html)
through the dev server (`npm run dev`, then http://localhost:5210/itch/preview.html) to see roughly how it
will look before pasting anything.

| File | What it is | Where it goes |
|---|---|---|
| `cover.png` | 630 × 500 cover | Edit game → Cover image |
| `screenshots/*.jpg` | 1920 × 1080, numbered in order | Edit game → Screenshots |
| `banner.jpg` | 1920 × 600, the title's sunburst and wordmark | Edit theme → Banner |
| `background.jpg` | 1920 × 1080, the home stretch (optional) | Edit theme → Background |
| `description.html` | The page text | Edit game → Description, in HTML mode |
| `theme.css` | The custom stylesheet | Edit theme → CSS |

## 1. Upload the game

```bash
npm run build
```

Zip the *contents* of `dist/` (so `index.html` is at the top of the zip), upload it, and tick
**This file will be played in the browser**. Under *Embed options*:

- Kind of project: **HTML**
- Viewport: **960 × 540**, *Click to launch in fullscreen* off, **Fullscreen button** on
- **Mobile friendly** on, orientation **Landscape**
- Frame options: **Automatically start on page load** off, so the cover shows with a *Run game* button

## 2. Theme (Edit theme, on the game page)

| Setting | Value |
|---|---|
| Layout | Embed in page, screenshots in the right column |
| Background | `#0A0712` (ink) |
| Page background | `#0A0712` |
| Text | `#F3E3CC` (bone) |
| Links | `#FF6A30` (ember) |
| Buttons | `#E3263A` (red) |
| Header font | Anton, if offered; the stylesheet sets it either way |
| Body font | Space Mono, if offered |
| Banner | `banner.jpg`, aligned centre |

Hide the page title if the banner is up: the wordmark is already in it.

## 3. Custom CSS

Paste [`theme.css`](theme.css) into **Edit theme → CSS**. Custom CSS is switched off on new itch accounts;
if the CSS box is missing, ask itch support to enable it for the game (it's free, and usually quick).
Without it the page still works: the colours from step 2 carry the look, just without the printed details.

What the stylesheet adds:

- A halftone-printed oxblood wall behind the page, and the page as an ink sheet with a hard red offset,
  like a misregistered screen print
- Anton headlines with a red drop, numbered section heads (`01`, `02` … in gold) with an ember rule
- Bold words stamped in red, `code` as bone key-caps, `<hr>` as the road's ember and ink kerb
- Screenshots pinned at slight angles with red and ember offsets
- Tables as a printed timetable, the credit as a perforated ticket stub
- Chunky poster buttons that press in when clicked

itch removes `class` and `style` attributes from the description, so the stylesheet styles only plain
elements (`h1`, `h2`, `strong`, `code`, `table`, `blockquote`, `hr`, `img`) and itch's own page classes.

## 4. Description

Switch the description editor to HTML, paste [`description.html`](description.html), and save. Its
pictures load from this repository on GitHub, so push first. To host them on itch instead, upload them
in the editor and swap the `src` links.

## Details

- Classification: Games · Genre: Simulation · Tags: physics, driving, cats, 2D, hand-drawn, short
- Short description: *Everything you own, one small truck. Pack it, tie it down, and drive it home.*
- Inputs: keyboard, mouse, gamepad, touchscreen
