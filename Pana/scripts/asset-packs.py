"""Build deterministic release packs for audio and images/textures >= 100 KiB.

python Pana/scripts/asset-packs.py [--game carreritas]
Upload new ZIPs from dist/asset-packs to the asset-packs GitHub release before
committing the catalog and untracking enrolled files. Local originals remain.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / 'Pana/server/src/asset-packs.json'
OUT = ROOT / 'dist/asset-packs'
AUDIO = {'.mp3', '.ogg', '.wav'}
EXTENSIONS = AUDIO | {'.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.ktx2', '.hdr', '.exr'}


def placement(name):
    match = re.fullmatch(r'Pana/games/([a-z0-9-]+)/public/(.+)', name)
    if match:
        game, relative = match.groups()
        return game, f'/g/{game}/{relative}'
    match = re.fullmatch(r'Pana/web/images/launcher/([a-z0-9-]+)\.[^.]+', name)
    if match:
        game = match[1].removesuffix('-card')
        if (ROOT / f'Pana/games/{game}/game.json').exists():
            return game, name.removeprefix('Pana/web')
    if name.startswith('Pana/web/character/'):
        return 'shared-character', name.removeprefix('Pana/web')
    if name.startswith('Pana/engine/'):
        return 'shared-world', name.removeprefix('Pana')
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game', help='Rebuild only this pack; retain other catalog entries')
    parser.add_argument('--no-new-audio', action='store_true', help='Do not enrol audio missing from the catalog (tracked audio keeps shipping from git)')
    args = parser.parse_args()
    catalog = json.loads(CATALOG.read_text()) if CATALOG.exists() else {}
    enrolled = {'Pana/' + name for pack in catalog.values() for name in pack['entries']}
    tracked = subprocess.check_output(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=ROOT).decode().split('\0')
    groups = {}
    for name in sorted(set(tracked) | enrolled):
        source = ROOT / name
        group = placement(name)
        if name in enrolled and not source.is_file() and (not args.game or group[0] == args.game):
            raise SystemExit('Missing packed originals. Run: node Pana/scripts/asset-packs.js --restore ' + group[0])
        if source.suffix.lower() not in EXTENSIONS or not source.is_file():
            continue
        if args.no_new_audio and name not in enrolled and source.suffix.lower() in AUDIO:
            continue
        if not group or (source.stat().st_size < 100 * 1024 and name not in enrolled and source.suffix.lower() not in AUDIO):
            continue
        game, url = group
        if args.game and game != args.game:
            continue
        groups.setdefault(game, []).append((name, url))
    if args.game and args.game not in groups:
        raise SystemExit(f'No packable runtime assets found for {args.game}')
    OUT.mkdir(parents=True, exist_ok=True)
    for game, files in sorted(groups.items()):
        target = OUT / f'{game}.zip'
        entries = {}
        with zipfile.ZipFile(target, 'w', zipfile.ZIP_STORED) as archive:
            for name, url in files:
                data = (ROOT / name).read_bytes()
                entry = name.removeprefix('Pana/')
                archive.writestr(zipfile.ZipInfo(entry), data)
                entries[entry] = {'url': url, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
        data = target.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        filename = f'{game}-{digest[:16]}.zip'
        target.replace(OUT / filename)
        catalog[game] = {'url': f'https://github.com/jhd3197/Pana/releases/download/asset-packs/{filename}',
                         'sha256': digest, 'bytes': len(data), 'files': len(entries), 'entries': entries}
        print(f'{game}: {len(entries)} files, {len(data):,} bytes; {filename}')
    CATALOG.write_text(json.dumps(dict(sorted(catalog.items())), indent=2) + '\n', encoding='utf-8')
    ignore = ROOT / '.gitignore'
    marker = '# Large runtime assets distributed in per-game release packs\n'
    end_marker = '# End large runtime asset packs\n'
    original = ignore.read_text(encoding='utf-8')
    names = sorted({'/Pana/' + name for pack in catalog.values() for name in pack['entries']})
    block = marker + '/dist/asset-packs/\n' + '\n'.join(names) + '\n' + end_marker
    if marker in original:
        if end_marker not in original:
            raise SystemExit('Missing end marker for asset-pack ignore block')
        original = re.sub(re.escape(marker) + r'.*?' + re.escape(end_marker), lambda _: block, original, flags=re.S)
    else:
        original = original.rstrip() + '\n\n' + block
    ignore.write_text(original, encoding='utf-8')


if __name__ == '__main__':
    main()
