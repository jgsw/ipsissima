# Installing Ipsissima

*Written for the download page. It tells people what they are about to see before they see it —
the warning is much less alarming when you were expecting it.*

---

## The short version

Ipsissima is not code-signed, so the first time you open it your computer will warn you that it
comes from an unidentified developer. **This is expected.** It does not mean anything is wrong
with the file. It means nobody has paid a certificate authority to vouch for it — an annual fee
that an academic tool given away for free has not yet had a reason to spend.

The step to get past it takes about five seconds, and you only do it once. Instructions for both
systems are below.

**If you would rather not deal with any of it**, use the single-file version instead:
download **`Ipsissima.html`**, double-click it, and it opens in your browser. No installation, no
warnings, nothing to get past. You lose only three things — double-clicking `.argdown` files to
open them, saving edits straight back to the file on some browsers, and the automatic reload when
you edit your text in another program.

---

## macOS

You will see:

> **"Ipsissima" cannot be opened because it is from an unidentified developer.**
> *or, on newer versions:* **Apple could not verify "Ipsissima" is free of malware.**

**What to do — once:**

1. Drag **Ipsissima** into your **Applications** folder.
2. **Right-click** (or Control-click) the app and choose **Open**.
3. The same warning appears, but this time with an **Open** button. Click it.

That is the whole difference: double-clicking gives you a warning with no way past it,
right-clicking and choosing Open gives you the same warning *with* a way past it. macOS then
remembers, and Ipsissima opens normally from then on.

If the second dialog still gives you no Open button, go to **System Settings → Privacy &
Security**, scroll down, and there will be a line saying Ipsissima was blocked with an
**Open Anyway** button beside it.

### Opening `.argdown` files by double-clicking

Once Ipsissima has been opened at least once, macOS knows it handles `.argdown` files. If
double-clicking one does not open it:

1. Right-click any `.argdown` file → **Get Info**.
2. Under **Open with**, choose **Ipsissima**.
3. Click **Change All…**.

---

## Windows

You will see a blue box:

> **Windows protected your PC**
> Microsoft Defender SmartScreen prevented an unrecognised app from starting.

**What to do — once:**

1. Click **More info** — this is the important step, and it is easy to miss because it looks
   like a link rather than a button.
2. Click **Run anyway**.

The installer then runs normally, registers `.argdown` files, and you will not see the warning
again.

SmartScreen shows this for any application it has not seen downloaded many times before,
signed or not. It is a statement about how well known the file is, not about what is in it.

---

## What Ipsissima does on your computer

Worth stating plainly, since you are being asked to click past a security warning:

- **It makes no network requests at all.** Not for updates, not for fonts, not for analytics.
  Everything it needs is inside the application. You can disconnect from the internet and it
  behaves identically.
- **It reads and writes only the files you open**, and only in your own home folder or on drives
  you have connected. It cannot reach system files, and it is refused by the operating system if
  it tries.
- **It never modifies your manuscript.** A reconstruction is a reading *of* a text; Ipsissima
  writes only the `.argdown` file, never the essay or chapter it points at.
- **It is open source.** If the warning bothers you, the source is readable and the application
  can be built from it.

---

## Updating

**Ipsissima does not check for updates, and does not phone home to find out whether one exists.**
Nothing in it makes a network request. That is a deliberate property rather than an oversight —
the manuscripts people put into it are often unpublished — and it has the cost you would expect:
you will not be told when a new version appears.

So: **watch the [releases page](https://github.com/jgsw/ipsissima/releases)**. GitHub will do
the watching for you if you press *Watch → Custom → Releases* on the repository, which sends you
an email when one is published and requires nothing of the app.

To update, install the new version over the old one exactly as you installed the first: on macOS
drag it to Applications and replace, on Windows run the new installer. Your reconstructions are
ordinary files kept wherever you put them, and are not touched by any of this.

**Which version have I got?** Help → About Ipsissima. Worth checking before reporting a bug: the
first question will be which version, and the answer is not guessable from the app's appearance.

## Uninstalling

**macOS.** Drag `Ipsissima.app` to the Trash. That is genuinely all that is required for the app
to stop working; if you want the few files it left behind as well:

```bash
rm -rf ~/Library/Caches/org.ipsissima.desktop \
       ~/Library/WebKit/org.ipsissima.desktop \
       ~/Library/Preferences/org.ipsissima.desktop.plist
```

If you built from source, the repository's own installer will do all of it, and say what it is
about to do first:

```bash
node app/desktop/install.mjs --uninstall --dry-run
```

Drop `--dry-run` to carry it out. It moves applications to the Trash rather than deleting them,
clears the files above, and unregisters the app so that double-clicking a `.argdown` stops
offering it.

**Windows.** Settings → Apps → Installed apps → Ipsissima → Uninstall.

**Linux.** `sudo apt remove ipsissima` for the `.deb`; delete the file for the AppImage.

**Your reconstructions are never removed by any of this.** They are `.argdown` and Markdown files
in folders you chose, and no uninstaller should be going looking for them.

### If you end up with more than one copy

It is easier to do than it sounds — building from source leaves a copy in `target/`, building a
`.dmg` mounts a disk image containing another, and macOS registers everything it sees. The
symptom is a double-clicked `.argdown` opening the wrong version, or nothing at all.

```bash
node app/desktop/install.mjs --status
```

lists every copy the system knows about, marking any that no longer exist. `node
app/desktop/install.mjs` rebuilds and collapses them to a single registered copy in
`~/Applications`.

## Why it is not signed

Signing an application means paying a certificate authority to attest to your identity, annually,
per platform.

- **macOS** requires membership of the Apple Developer Program to notarise an app. There is no
  free route.
- **Windows** requires a code-signing certificate. Microsoft's own service is the cheapest option
  at around $10 a month, and is open to organisations in the UK, EU, US and Canada; traditional
  certificates cost several hundred a year. Even then, Windows shows the warning until enough
  people have downloaded the file for it to become "recognised".

If Ipsissima finds institutional funding for these, the warnings go away and nothing else about
the application changes. Until then, this page exists so that the warning is something you were
told about rather than something that happened to you.
