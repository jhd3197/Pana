"""Package the generated recordings as a stored ZIP outside Git.

Run after qqsmp-narrate.py. Upload the printed ZIP to the voice-packs release.
"""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'Pana/games/qqsmp/public/audio'
OUT = ROOT / 'dist/voice-packs'
OUT.mkdir(parents=True, exist_ok=True)
manifest = json.loads((SOURCE / 'manifest.json').read_text(encoding='utf-8'))
archive_path = OUT / 'qqsmp-es.zip'
with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_STORED) as archive:
    for key in sorted(manifest['lines']):
        data = (SOURCE / f'{key}.mp3').read_bytes()
        if len(data) < 1000:
            raise ValueError(f'Invalid recording: {key}')
        # Fixed metadata gives identical archives for identical recordings.
        archive.writestr(zipfile.ZipInfo(f'{key}.mp3'), data)
digest = hashlib.sha256(archive_path.read_bytes()).hexdigest()
name = f'qqsmp-es-{digest[:16]}.zip'
target = OUT / name
archive_path.replace(target)
metadata = {'url': f'https://github.com/jhd3197/Pana/releases/download/voice-packs/{name}',
            'sha256': digest, 'bytes': target.stat().st_size, 'files': len(manifest['lines'])}
(SOURCE / 'pack.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
print(target)
