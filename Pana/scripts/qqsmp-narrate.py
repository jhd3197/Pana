"""Record QQSMP questions and answer choices using Spanish em_alex.

Run: python Pana/scripts/qqsmp-narrate.py
Requires ffmpeg, ffprobe and Kokoro at KOKORO_URL (default localhost:8880/v1).
No Python packages or live TTS service are needed by the game.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'Pana/games/qqsmp/public/audio'
VOICE = 'em_alex'
BASE = os.environ.get('KOKORO_URL', 'http://127.0.0.1:8880/v1').rstrip('/')


def ffmpeg(audio, filters, output):
    return subprocess.run(['ffmpeg', '-hide_banner', '-i', 'pipe:0', '-af', filters, *output],
                          input=audio, capture_output=True, check=True)


def record(text):
    request = urllib.request.Request(BASE + '/audio/speech',
        data=json.dumps({'model': 'kokoro', 'voice': VOICE, 'input': text, 'response_format': 'mp3'}).encode(),
        headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(request, timeout=120) as response:
        audio = response.read()
    trim = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.12,areverse'
    measured = ffmpeg(audio, trim + ',loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', ['-f', 'null', '-'])
    stats = json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}', measured.stderr.decode()).group())
    gain = -16 - float(stats['input_i'])
    return ffmpeg(audio, trim + f',volume={gain:.2f}dB,alimiter=limit=0.84:level=false',
                  ['-ac', '1', '-ar', '24000', '-b:a', '64k', '-f', 'mp3', 'pipe:1']).stdout


def main():
    source = "import {QUESTIONS} from './Pana/games/qqsmp/public/questions.js'; import {voiceKey, narrationLines} from './Pana/games/qqsmp/public/voice-key.js'; console.log(JSON.stringify([...new Set(Object.values(QUESTIONS).flat().flatMap(([text,...answers]) => narrationLines({text,answers})))].map(text => [voiceKey(text),text])));"
    lines = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', source], cwd=ROOT))
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {'voice': VOICE, 'language': 'es', 'lines': {}}
    def generate(line):
        key, text = line
        path = OUT / f'{key}.mp3'
        if not path.exists():
            for attempt in range(3):
                try:
                    audio = record(text)
                    path.write_bytes(audio)
                    break
                except Exception:
                    if attempt == 2:
                        raise
        seconds = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                         '-of', 'default=noprint_wrappers=1:nokey=1', str(path)]))
        return key, {'text': text, 'seconds': round(seconds, 3)}

    # Bound concurrent requests; each distinct text owns its recording file.
    workers = max(1, min(8, int(os.environ.get('KOKORO_WORKERS', '4'))))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(generate, line) for line in lines]
        entries = {}
        for i, future in enumerate(as_completed(futures)):
            key, entry = future.result()
            entries[key] = entry
            print(f'{i + 1}/{len(lines)} {key}', flush=True)
    manifest['lines'] = {key: entries[key] for key, _ in lines}
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
