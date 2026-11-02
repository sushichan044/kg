# Bundled font assets

- `RinMincho-Regular.ttf` and `RinMincho-Bold.ttf`: original Rin Mincho v1.0.0,
  published by Ameame at https://rinmincho.pages.dev/. Copyright and SIL OFL 1.1
  notices are preserved in `RinMincho-OFL.txt`.
- `GenEiKoburiMin6-R.ttf`: original GenEi Koburi Mincho v6.1a Regular from
  https://okoneya.jp/font/. Its SIL OFL notice is preserved in `OFLicense.txt`.

The fonts are distributed without modification. Their licenses are independent
of the viewer's MIT license. Production loading verifies the file checksums in
`src/typography-fonts.ts` before registering any face.

`HarfBuzz-COPYING.txt` preserves the HarfBuzz notice at
`c7a7457b7385f33178e8cf87615ca077a810bbe7`, the submodule revision bundled by
harfbuzzjs v1.6.3. It supplements the JavaScript wrapper’s MIT notice.
