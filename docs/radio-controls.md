# Radio controls follow-up — 2026-09-10

The player now minimizes to a 48px mobile / 52px desktop circular button. It
does not reserve a full-width footer or reduce the game iframe height. Opening
a page starts with the panel minimized; closing it, touching the game, Escape,
and internal navigation minimize the panel without stopping audio.

Volume uses the media element's native volume when its setter is supported.
Previously every CORS stream was routed through Web Audio, including native
HLS. WebKit can play native HLS outside that graph, so a GainNode can change
without changing audible volume. Reference:
https://bugs.webkit.org/show_bug.cgi?id=306493

Devices whose media volume is fixed fall back to Web Audio for CORS streams.
For HLS this explicitly selects hls.js/MSE when supported, even when native
HLS is also available. Native HLS is never marked as gain-controlled. Native
and Web Audio paths use the same squared volume curve. Streams that cannot
be controlled on a device show the existing hardware-volume hint.

The slider has a 44px touch region, 24px thumb, input/change handlers, keyboard
support, and separate minus/plus buttons. A value of zero silences the stream;
moving the slider or pressing minus/plus clears mute and persists the level.

Validation: 46 Node tests passed. Chrome and WebKit 26.5 browser runs used
actual pointer drags at 80% and 20% against live COOL MP3 and Flex HLS, verified
native media levels 0.64 and 0.04, zero, mute, minus/plus, minimize, navigation,
and back. A fixed-volume device test double in Chrome measured the real Web
Audio fallback waveform at both levels (RMS ratio about 0.0624). A private AI
game was played to check the mobile layout and continuous audio.

These checks do not constitute a physical iPhone or speaker-output test.
The user's specific browser and station were requested and have not yet been
provided. WebKit headless did not expose a decoded live-media waveform to its
analyser; native tests verify browser media volume, not recorded speaker audio.
