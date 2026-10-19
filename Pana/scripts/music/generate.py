"""Generate raw music takes for Pana with ACE-Step 1.5 (local GPU, MIT licensed).

Run inside the ACE-Step checkout's environment:
  uv run --project <ACE-Step-1.5> python scripts/music/generate.py [--only id,id] [--takes 2]

Takes land in <ACE-Step-1.5>/output/pana/<id>/take-N.wav; loop.py turns the
chosen take into the game's mp3 plus its loop points.
"""

import argparse
import json
import os
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_ACE = HERE.parents[3] / "ACE-Step-1.5"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ace", default=os.environ.get("ACE_STEP_DIR", str(DEFAULT_ACE)))
    ap.add_argument("--only", default="")
    ap.add_argument("--takes", type=int, default=2)
    ap.add_argument("--model", default="acestep-v15-xl-sft")
    ap.add_argument("--lm", default="acestep-5Hz-lm-1.7B")
    ap.add_argument("--steps", type=int, default=50)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--offload", action="store_true", help="park idle models in RAM (when VRAM is short)")
    args = ap.parse_args()

    ace = Path(args.ace).resolve()
    sys.path.insert(0, str(ace))
    from acestep.handler import AceStepHandler
    from acestep.llm_inference import LLMHandler
    from acestep.inference import GenerationParams, GenerationConfig, generate_music

    spec = json.loads((HERE / "songs.json").read_text(encoding="utf-8"))
    only = {s for s in args.only.split(",") if s}
    songs = [s for s in spec["songs"] if not only or s["id"] in only]

    dit = AceStepHandler()
    msg, ok = dit.initialize_service(project_root=str(ace), config_path=args.model, device="auto", offload_to_cpu=args.offload)
    if not ok:
        sys.exit(f"DiT init failed: {msg}")
    llm = LLMHandler()
    msg, ok = llm.initialize(checkpoint_dir=str(ace / "checkpoints"), lm_model_path=args.lm, backend="pt", device="auto", offload_to_cpu=args.offload, dtype=None)
    if not ok:
        sys.exit(f"LM init failed: {msg}")

    turbo = "turbo" in args.model
    for song in songs:
        out = ace / "output" / "pana" / song["id"]
        if out.exists() and not args.force and len(list(out.glob("take-*.wav"))) >= args.takes:
            print(f"skip {song['id']} (takes exist)")
            continue
        out.mkdir(parents=True, exist_ok=True)
        tmp = out / "_raw"
        params = GenerationParams(
            task_type="text2music",
            caption=f"{song['caption']}, {spec['style']}",
            lyrics="[Instrumental]",
            instrumental=True,
            bpm=song["bpm"],
            keyscale=song["key"],
            timesignature=song["time"],
            duration=max(10, song["duration"]),
            inference_steps=8 if turbo else args.steps,
            guidance_scale=1.0 if turbo else 7.0,
            shift=3.0 if turbo else 1.0,
            thinking=True,
            use_cot_caption=False,  # keep our caption as written
        )
        config = GenerationConfig(batch_size=args.takes, audio_format="wav")
        result = generate_music(dit, llm, params=params, config=config, save_dir=str(tmp))
        if not result.success:
            print(f"FAIL {song['id']}: {result.error or result.status_message}")
            continue
        for i, audio in enumerate(result.audios, 1):
            shutil.move(audio["path"], out / f"take-{i}.wav")
            (out / f"take-{i}.json").write_text(json.dumps({"seed": audio["params"].get("seed"), "caption": params.caption}), encoding="utf-8")
        shutil.rmtree(tmp, ignore_errors=True)
        print(f"ok {song['id']} -> {out}")


if __name__ == "__main__":
    main()
