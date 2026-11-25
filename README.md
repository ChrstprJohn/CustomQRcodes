# BrandQR

BrandQR is a free, browser-based QR studio built with React, Vite, and GSAP. Explore 44 visual QR samples in the animated Spiral gallery, download a phone wallpaper from a sample, or open its image in the studio. The studio creates static codes for websites, text, Wi-Fi, and contacts. Blend a photo into the pattern, add a center logo, or use a classic QR. Photo mode lets you adjust the crop and soften the dots around a subject.

The gallery includes six original BrandQR samples, 22 [Unsplash-licensed photographs](https://unsplash.com/license), and 16 [CC0 works from the Cleveland Museum of Art](https://www.clevelandart.org/open-access). Individual sources appear on the Credits page. Sample artwork is bundled for offline use.

```sh
pnpm install
pnpm dev
```

Open the address Vite prints. Run `pnpm build` to generate the static site in `dist/`. Images and encoded content are processed in the browser. The studio decodes both the preview and the rendered PNG before allowing a download.

## Browser checks

With the app running on port 5173, run `pnpm test:browser` with Chrome installed. Set `BRANDQR_URL` for a different local address or `BRANDQR_CHROME` for a custom Chrome executable. The checks cover gallery navigation, responsive editor controls, image upload, and decoding a downloaded PNG.

The interface uses [General Sans](https://www.fontshare.com/fonts/general-sans) from Fontshare and [Departure Mono](https://departuremono.com/) by Helena Zhang under the SIL Open Font License. The Departure Mono license is included in `src/departure-mono-LICENSE.txt`.
