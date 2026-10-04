# Suno Deck

Suno Deck is JukeBot's first hosted-source adapter.

Its job is to let an operator keep a Suno playlist manifest inside JukeBot and play each referenced song through Suno's hosted player without scraping Suno pages or converting Suno-hosted songs into undocumented direct audio URLs.

## Add a Suno playlist

1. Open the playlist on Suno.
2. Copy its playlist share URL.
3. Copy the canonical song URLs for the songs you want JukeBot to keep in the manifest.
4. In JukeBot, enter a playlist name.
5. Paste the playlist URL.
6. Paste one song per line.
7. Press **SAVE SUNO PLAYLIST**.

Accepted song lines:

```text
https://suno.com/song/SONG-UUID
https://suno.com/embed/SONG-UUID
Track title | https://suno.com/song/SONG-UUID
```

Accepted playlist source:

```text
https://suno.com/playlist/PLAYLIST-UUID
```

## Why canonical links only?

Short `/s/...` links require a redirect lookup before JukeBot can know the stable song UUID.

JukeBot is a static GitHub Pages application and deliberately does not ship a hidden proxy or Suno credential just to resolve those links. Open the short link and copy the resulting canonical song URL instead.

This keeps the source adapter deterministic and inspectable.

## Playback boundary

The iframe URL is derived from the canonical Suno song UUID:

```text
https://suno.com/embed/SONG-UUID
```

The Suno player owns the hosted playback.

JukeBot owns:

- which Suno playlist manifest is selected
- which Suno song player is mounted
- previous/next selection
- source provenance
- persistence of the manifest
- export/import of the manifest

JukeBot does not currently own:

- hosted playback position
- hosted play/pause state
- hosted volume
- hosted song-ended events
- automatic next-track handoff

Those facts stay outside the Reality Ledger until Suno exposes a supported integration contract that JukeBot can validate.

## Native/offline option

If you download a Suno song that you are permitted to download and add the resulting MP3/WAV as local audio, it becomes a normal JukeBot native track.

That track is then:

- stored as a Blob in IndexedDB
- available offline in that browser
- controlled by the governed native Action Bus
- eligible for native room receipts and deterministic replay

The Suno source playlist and the local native track remain separate records on purpose. One is provider provenance; the other is media JukeBot actually possesses.

## Session bundles

`jukebot.session.v1` bundles may contain Suno source-playlist manifests.

They never contain Suno-hosted audio bytes.

This keeps a session bundle small, portable and explicit about what media is local versus provider-hosted.
