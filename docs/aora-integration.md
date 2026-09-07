# Aora Emotion Ball integration

The floating campus pet uses the Emotion Ball expression engine from
[`sam70361/aora-bot`](https://github.com/sam70361/aora-bot).

- Upstream engine files and the original `LICENSE` / `NOTICE.md` are kept in
  `src/vendor/aora/`.
- After Expo prebuild, `npm run sync:aora-android` copies the complete folder
  into `android/app/src/main/assets/aora/` for APK packaging.
- This integration uses a custom orange theme while retaining the upstream
  expression IDs and SVG animation engine.
- The upstream ball-character visual design is restricted to personal,
  educational, research, and other non-commercial use. It must not be used in
  a commercial release.

The React Native bridge lives in `src/pet/AoraBall.tsx`; drag, edge snapping,
message detection, and the compact bubble are implemented by
`src/pet/CampusPetV2.tsx`.
