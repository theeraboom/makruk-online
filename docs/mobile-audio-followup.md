# Mobile audio and persistent-shell follow-up

The user reproduced the remaining issue in mobile Safari and requested Chrome
coverage too. Earlier desktop volume checks did not establish physical iPhone
behavior.

## Fixes

- Removed nested `noscript` content before embedding the lobby's no-JavaScript
  fallback. Its closing tag prematurely ended the shell's fallback, leaving the
  remaining old lobby rendered below the live game iframe. The problem was
  visible in WebKit mobile screenshots. The live shell now has no lobby `main`
  or `header` nodes outside the iframe.
- Hash local script/stylesheet URLs and expose the build in page metadata.
  When navigation loads a new page inside an older persistent shell, replace
  that shell once with the current URL, preserving private-room parameters.
- Move camera controls below the board. Four compact presets stay visible;
  detailed tilt/rotation sliders are collapsed by default.
- Explicitly select the gain path for iPhone/iPad, including desktop-mode iPad
  and Chrome iOS. Do not trust a native volume setter as proof of iOS support.
  HLS uses MSE when Web Audio is needed and supported.
- Request an audio playback session when supported. Resume suspended or
  interrupted contexts and await the result before scheduling a short sound.
  A blocked preview reports a retry message instead of silently swallowing it.
- Add game-sound minus/plus buttons, unmute on explicit volume adjustments,
  preserve zero with a clear preview message, and handle corrupt saved volume.

Relevant primary references:
- https://bugs.webkit.org/show_bug.cgi?id=306493 (native HLS bypassing Web Audio)
- https://bugs.webkit.org/show_bug.cgi?id=237322 (iOS silent switch / playback session)
- https://github.com/WebAudio/web-audio-api/issues/2585 (interrupted contexts)

## Verification

51 Node tests pass. Chrome and WebKit with an iPhone viewport/UA were exercised
through real controls. Preview waveform measurements are nonzero; changing SFX
80% to 20% reduces RMS to about 6.3%, matching the squared gain curve. Explicitly
suspending the context and pressing Preview produces sound again. Camera layout,
range expansion, mute, volume buttons, radio continuity, MSE selection, zero
overflow, and upgrading an old shell were checked. The shell fallback regression
is checked in both HTTP output and the actual DOM.

Limit: WebKit mobile emulation is not a physical iPhone. Native radio volume
and mobile graph gains are verified; this does not record the user's phone
speaker output or prove every station/iOS combination works. Unsupported
non-CORS streams still show the device-volume hint.
