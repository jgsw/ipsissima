---
name: A map is drawn wrongly
about: The picture says something about the argument that the file does not
labels: renderer
---

**The file.** Attach the `.argdown`, or a cut-down one that still shows it. If the reconstruction
is of something you cannot share, a map with the claim texts replaced by `[a]`, `[b]`, `[c]` is
usually enough — the layout depends on the shape, not the words.

**Which arrangement**, Reasons or Exposition, and what you had folded.

**What is drawn, and what the file says.** These are different questions and the second is the
one that makes it a bug: "this claim is drawn with nothing attached to it, but the file gives it
a `+` to `[x]`."

**Does the test suite already know?**

```bash
IPSISSIMA_CORPUS=<the folder holding your .argdown> node app/test_fold_invariants.mjs --steps 200
```

That walks the fold state space over your own reconstructions and names any invariant it breaks.
If it prints a failure, paste it — it is worth more than a screenshot, because it comes with the
sequence of clicks that produced it.
