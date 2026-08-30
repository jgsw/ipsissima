"""Run debatelab/argdown-feedback's verifiers over a corpus of .argdown files.

argdown-feedback is AGPL-3.0 and is NOT vendored here -- install it separately:

    uv pip install "git+https://github.com/debatelab/argdown-feedback"

It was built as a reward function for RL training, so its checks assume the shape of the
*training task* the model was set: one argument, no inline data, no sections, and either a
map or a reconstruction but not both. An Ipsissima map is none of those things. So every
check is classified below, and only the SIGNAL and GAP rows mean anything about quality.

    python run_battery.py --corpus samples --corpus /path/to/private -o results.json
"""
import argparse, json, re, sys, warnings
from pathlib import Path

warnings.filterwarnings("ignore")

from argdown_feedback.verifiers.base import CompositeHandler
from argdown_feedback.verifiers.core.infreco_handler import InfRecoCompositeHandler
from argdown_feedback.verifiers.core.argmap_handler import ArgMapCompositeHandler
from argdown_feedback.verifiers.core.logreco_handler import LogRecoCompositeHandler
from argdown_feedback.verifiers.processing_handler import DefaultProcessingHandler
from argdown_feedback.tasks.base import Evaluation
from argdown_feedback.verifiers.verification_request import VerificationRequest

# How each check relates to what Ipsissima actually produces.
#   SIGNAL   -- a real quality claim; a failure here is worth reading
#   GAP      -- Ipsissima emits nothing for this; the check is right that it is missing
#   MISMATCH -- Ipsissima violates this BY DESIGN; failure carries no information
#   N/A      -- needs data (formalizations) Ipsissima does not produce at all
CLASS = {
    "ArgMap.CompleteClaimsHandler": ("MISMATCH", "counts Argdown section headings as unlabelled nodes"),
    "ArgMap.NoDuplicateLabelsHandler": ("SIGNAL", "duplicate labels are a real defect"),
    "ArgMap.NoPCSHandler": ("MISMATCH", "an Ipsissima map deliberately carries premise-conclusion structures"),
    "InfReco.HasArgumentsHandler": ("SIGNAL", "a reconstruction with no argument is empty"),
    "InfReco.HasUniqueArgumentHandler": ("MISMATCH", "expects exactly one argument; a map has many"),
    "InfReco.HasPCSHandler": ("MISMATCH", "Ipsissima allows a named argument used only as a map node"),
    "InfReco.StartsWithPremiseHandler": ("SIGNAL", "a PCS starting on a conclusion is malformed"),
    "InfReco.EndsWithConclusionHandler": ("SIGNAL", "a PCS ending on a premise is malformed"),
    "InfReco.NotMultipleGistsHandler": ("SIGNAL", "conflicting gists for one argument is a real defect"),
    "InfReco.NoDuplicatePCSLabelsHandler": ("SIGNAL", "duplicate labels inside a PCS is a real defect"),
    "InfReco.HasLabelHandler": ("SIGNAL", "unlabelled arguments cannot be referred to"),
    "InfReco.HasGistHandler": ("SIGNAL", "an argument with no gist is unexplained"),
    "InfReco.HasInferenceDataHandler": ("GAP", "Ipsissima emits '-----' without {from: [...]}, so inferences are implicit"),
    "InfReco.PropRefsExistHandler": ("SIGNAL", "a reference to a non-existent proposition is a real defect"),
    "InfReco.UsesAllPropsHandler": ("GAP", "follows from the missing from-data: props look unused"),
    "InfReco.NoExtraPropositionsHandler": ("MISMATCH", "map claims outside any PCS are the point of a map"),
    "InfReco.OnlyGroundedDialecticalRelationsHandler": ("MISMATCH", "dialectical relations are what a map is made of"),
    "InfReco.NoPropInlineDataHandler": ("MISMATCH", "fidelity/pinpoint/source inline data is Ipsissima's whole method"),
    "InfReco.NoArgInlineDataHandler": ("MISMATCH", "as above, on arguments"),
}

FM = re.compile(r"\A\s*===.*?===\s*\n", re.S)


def check(path: Path) -> dict:
    text = FM.sub("", path.read_text(encoding="utf8", errors="replace"))
    handler = CompositeHandler(handlers=[
        DefaultProcessingHandler(),
        ArgMapCompositeHandler(),
        InfRecoCompositeHandler(),
        LogRecoCompositeHandler(),
    ])
    req = VerificationRequest(inputs="```argdown\n" + text + "\n```")
    ev = Evaluation.from_verification_request(handler.process(req))
    checks = {}
    for key, msg in ev.metrics.items():
        name = re.sub(r"^\d+_", "", key)
        kind, why = CLASS.get(name, ("N/A", "logical reconstruction: needs formalizations"))
        checks[name] = {"passed": msg is None, "message": msg, "class": kind, "why": why}
    return {"file": str(path), "is_valid": ev.is_valid, "checks": checks}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", action="append", required=True,
                    help="directory to walk for .argdown files (repeatable)")
    ap.add_argument("-o", "--output", default="results.json")
    args = ap.parse_args()

    files = sorted({p for c in args.corpus for p in Path(c).rglob("*.argdown")})
    if not files:
        print("no .argdown files found", file=sys.stderr)
        return 1

    results = []
    for p in files:
        try:
            results.append(check(p))
        except Exception as e:                      # a parse failure is itself a result
            results.append({"file": str(p), "error": f"{type(e).__name__}: {e}"})
        print(".", end="", flush=True)
    print()

    Path(args.output).write_text(json.dumps(results, indent=2))
    print(f"{len(results)} file(s) -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
