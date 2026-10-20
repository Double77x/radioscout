# Android fixture

`live.mp3` is the looped audio stream used by the Android smoke tests.

The TLS material is not stored here. `scripts/android-fixture-certs.mjs`
generates a throwaway CA and a `127.0.0.1` server certificate in `.generated/`
on demand. That directory and any `*.pem`/`*.key`/`*.p12` files are gitignored;
never commit a private key. The Gradle debug/releaseTest build runs the generator and
merges only the public CA into the APK. The shipped release does not trust it.
