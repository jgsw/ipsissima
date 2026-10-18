# Teaching maps

Maps written to be played with, rather than reconstructions of someone's text. They are in the
map-maker's own words, carry no source, and are kept by the test suite so that what each one
teaches stays true of what the App shows.

## `causal-junctions.argdown` — causal diagrams after Judea Pearl

Five small chains, one for each junction a causal diagram is built from:

| chain | the junction | try |
|---|---|---|
| smoking → tar → cancer | a **chain** through a mediator | suppose the tar does not build up |
| summer → ice cream, summer → drownings | a **fork**: a common cause, and the association it produces | suppose ice cream sales do not rise; then suppose the summer is not hot |
| wealth → tutoring → admission, wealth → admission | a **back door** | suppose the tutoring does not happen |
| talent → fame ← looks | a **collider** | suppose the actor is not talented; suppose fame does not happen |
| spark + oxygen → fire | a **joint cause** (both needed) | suppose there is no oxygen; compare the collider |

Open it in Ipsissima, switch to the **Mechanism** view, choose a chain from **Chain**, and
right-click a state or an arrow to suppose it does not happen. Tick **Guess first** in the banner to
mark what you expect to stop before you see. The **Reasons** view holds each chain's lesson, and the
**Questions to try** panel asks about the fork's association and the back door's direct step.

**What supposing shows, and what it does not.** "Suppose this does not happen" is an
*intervention* — Pearl's *do(X)*: it removes X and works forward along the arrows, and never
changes anything upstream. That is the right test for the chain, the fork, the back door and the
joint cause. A collider's trap is different: it comes from *selecting* on the collider (looking
only at the famous), which is conditioning, not intervening, and the App does not compute what
conditioning does. The map states the association that selection produces — talent and looks
trading off among the famous — as an association, so that the difference can be seen and
discussed, not as something the App has derived.

Licence: MIT, under the repository's `LICENSE`, as the App is.
