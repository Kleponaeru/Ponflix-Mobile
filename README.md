# PonflixMobile

PonflixMobile is the Expo and React Native companion to Ponflix. Home combines anime and comics recommendations. The tab bar provides Home, Search, Anime, and Comics; Search covers both anime and comic titles. Anime includes series details and episode playback, while manga, manhwa, and manhua include title details, chapter selection, and a continuous reader.

## Start the app

```sh
npx expo start
```

Open Expo Go on Android and scan the QR code shown in the terminal. Keep the computer and device on the same Wi-Fi network.

## Project structure

```text
src/
  app/                 Expo Router tabs and full-screen detail routes
  features/anime/      Mixed Home, anime discovery, series details, and playback
  features/comics/     Manga, manhwa, and manhua lists, details, and API
  features/reader/     Virtualized comic chapter reader
  navigation/          Native and web tab navigators
  constants/           Ponflix theme tokens
assets/
  branding/            Ponflix wordmark
  images/              Platform app icons
```

The anime player embeds stream URLs returned by the Ponflix API in a native WebView. Playback depends on the selected stream provider. Comic chapter images use a virtualized list so only nearby pages stay mounted while reading.

## Checks

```sh
npx expo lint
npx tsc --noEmit
```

This app uses Expo SDK 57. Check the matching version of the [Expo documentation](https://docs.expo.dev/versions/v57.0.0/) before changing Expo or React Native APIs.
