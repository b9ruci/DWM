#!/usr/bin/env python3
"""Genera los paquetes de entrega U1, U2 y U3 en ./entregas/ a partir de los archivos versionados.
Uso: python3 tools/build-entregas.py
Solo incluye archivos versionados en git (nunca .secrets/, node_modules/, bases de datos ni .tmp/)."""
import fnmatch, os, subprocess, zipfile

ROOT = subprocess.check_output(['git', 'rev-parse', '--show-toplevel'], text=True).strip()
os.chdir(ROOT)
tracked = subprocess.check_output(['git', 'ls-files'], text=True).splitlines()
commit = subprocess.check_output(['git', 'rev-parse', '--short', 'HEAD'], text=True).strip()

def pick(patterns):
    return sorted(f for f in tracked if any(fnmatch.fnmatch(f, p) for p in patterns))

PAQUETES = {
    'Entrega-U1-Frontend-Chocomania': {
        'leeme': 'docs/entregas/ENTREGA-U1.md',
        'incluir': ['frontend/*', 'docs/diseno/*', 'docs/unidad1-frontend.md'],
        'renombrar': {'evidencias/RUN-06/P28/*': 'evidencias-responsivas/'},
    },
    'Entrega-U2-Backend-Chocomania': {
        'leeme': 'docs/entregas/ENTREGA-U2.md',
        'incluir': ['README.md', '.gitignore', 'docker-compose.yml', 'frontend/*', 'backend/*', 'tests/*',
                    'docs/unidad2-informe.md', 'docs/adr/*', 'docs/diagramas/M*', 'docs/diseno/*', 'docs/trazabilidad.csv',
                    'evidencias/RUN-06/*', 'evidencias/RUN-07/*', 'evidencias/CARGA-01/*'],
        'renombrar': {},
    },
    'Entrega-U3-Integracion-Chocomania': {
        'leeme': 'docs/entregas/ENTREGA-U3.md',
        'incluir': ['*'],
        'renombrar': {},
        'historial': True,
    },
}

os.makedirs('entregas', exist_ok=True)
for nombre, cfg in PAQUETES.items():
    destino = f'entregas/{nombre}.zip'
    archivos = pick(cfg['incluir'])
    with zipfile.ZipFile(destino, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        z.write(cfg['leeme'], f'{nombre}/LEEME-ENTREGA.md')
        for f in archivos:
            z.write(f, f'{nombre}/{f}')
        for patron, carpeta in cfg['renombrar'].items():
            for f in pick([patron]):
                z.write(f, f'{nombre}/{carpeta}{os.path.basename(f)}')
        if cfg.get('historial'):
            log = subprocess.check_output(['git', 'log', '--stat', '--date=iso'], text=True)
            z.writestr(f'{nombre}/historial-git.txt', log)
        z.writestr(f'{nombre}/VERSION.txt', f'Paquete generado desde el commit {commit}\n')
    print(f'{destino}: {len(archivos)} archivos, {os.path.getsize(destino) / 2**20:.1f} MB')
