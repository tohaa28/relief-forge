#!/usr/bin/env python3
"""Install approved Doctor Uzelkov PNG assets with byte-for-byte integrity.

python tools/install_approved_art.py \
 --approved Doctor_Uzelkov_approved_originals.zip \
 --crops doctor_uzelkov_exact_assets.zip
The script changes only HTML asset references, CSS layout and copies images.
"""
from __future__ import annotations
import argparse
import hashlib
import re
from pathlib import Path
from zipfile import ZipFile

ORIGINALS={
 'mascot-approved.png':'d45984cb6c29f15bb89da90f',
 'icons-ui-kit-approved.png':'bddadd00d7f15ed10feac2cc',
 'interface-approved.png':'65d26f95dd0da75b8ea69085',
}
ICONS={
 'open':'open','export-eps':'save_eps','new':'new_project',
 'save':'save_project','select':'select','line':'polyline','rect':'rect',
 'circle':'ellipse','undo':'undo','redo':'redo','fit':'fit',
 'curve-edit':'curve_edit','node-move':'move_node','node-add':'add_node',
 'node-remove':'remove_node','node-handles':'handles','node-cusp':'cusp',
 'node-smooth':'smooth','node-symmetric':'symmetric',
 'node-line':'line','node-curve':'curve','node-break':'break',
 'node-close':'close','node-reverse':'reverse',
}
MENU={
 'add':'add_node','remove':'remove_node','break':'break','line':'line',
 'curve':'curve','cusp':'cusp','smooth':'smooth','symmetric':'symmetric',
 'reverse':'reverse','close':'close',
}
VERSION='0.2.0-alpha.22'

def install(repo:Path,approved:Path,crops:Path):
    web=repo/'web'
    hp=web/'index.html';cp=web/'style.css'
    if not hp.is_file() or not cp.is_file():raise FileNotFoundError('Expected web/index.html and web/style.css')
    target=web/'approved'
    (target/'icons').mkdir(parents=True,exist_ok=True)
    with ZipFile(approved) as source:
        for filename,expected in ORIGINALS.items():
            data=source.read(filename)
            digest=hashlib.sha256(data).hexdigest()
            if not digest.startswith(expected):raise ValueError('Wrong approved original: '+filename)
            (target/filename).write_bytes(data)
    with ZipFile(crops) as source:
        for icon in sorted(set([*ICONS.values(),*MENU.values(),'appmark'])):
            name=f'doctor_uzelkov_exact_assets/icons/{icon}.png'
            data=source.read(name)
            (target/'icons'/f'{icon}.png').write_bytes(data)
    html=hp.read_text(encoding='utf-8')
    if 'brand-appmark' not in html or 'mascot-welcome' not in html:raise ValueError('Unexpected UI header/welcome')
    html,n=re.subn(r'<svg class="brand-appmark-icon">.*?</svg>',
      '<img class="brand-appmark-icon" src="approved/icons/appmark.png" alt="">',html,count=1)
    if n!=1 and 'approved/icons/appmark.png' not in html:raise ValueError('Missing appmark')
    html,n=re.subn(r'(<img class="workspace-mascot" src=")[^"]+(" alt="Доктор Узелков")',
      r'\1approved/mascot-approved.png\2',html,count=1)
    if n!=1 and 'src="approved/mascot-approved.png"' not in html:raise ValueError('Missing mascot')
    for ident,icon in ICONS.items():
        pat=(r'(<button\b[^>]*\bid="'+re.escape(ident)+r'"[^>]*>)'
          r'<svg class="tool-icon" aria-hidden="true">.*?</svg>')
        html,n=re.subn(pat,lambda m:m.group(1)+
          f'<img class="tool-icon approved-icon" src="approved/icons/{icon}.png" alt="" aria-hidden="true">',html,count=1)
        if n!=1 and f'src="approved/icons/{icon}.png"' not in html:
            raise ValueError('Missing action: '+ident)
    for ident,icon in MENU.items():
        pat=(r'(<button\b[^>]*\bdata-node-menu="'+re.escape(ident)+r'"[^>]*>)'
          r'<svg class="tool-icon" aria-hidden="true">.*?</svg>')
        html,n=re.subn(pat,lambda m:m.group(1)+
          f'<img class="tool-icon approved-icon" src="approved/icons/{icon}.png" alt="" aria-hidden="true">',html,count=1)
        if n!=1 and f'data-node-menu="{ident}"><img class="tool-icon' not in html:
            raise ValueError('Missing context menu action: '+ident)
    html=re.sub(r'0\.2\.0-alpha\.\d+',VERSION,html)
    hp.write_text(html,encoding='utf-8')
    css=cp.read_text(encoding='utf-8')
    css+="""
/* Approved raster illustrations are never redrawn or recolored. */
.tool-icon.approved-icon{width:20px;height:20px;flex:0 0 20px;object-fit:contain;display:block;margin:0}
.brand-appmark-icon{object-fit:contain;display:block;width:42px;height:42px;border-radius:10px}
.brand-appmark{background:transparent;border:0;box-shadow:none;overflow:visible}
.mascot-welcome .workspace-mascot{object-fit:contain;width:auto;height:min(34dvh,285px);max-width:min(100%,320px)}
@media(max-width:780px){.mascot-welcome .workspace-mascot{height:min(28dvh,190px)}}
"""
    cp.write_text(css,encoding='utf-8')
    print(f'Installed {len(ORIGINALS)} exact originals and {len(set([*ICONS.values(),*MENU.values(),"appmark"]))} icon assets')

if __name__=='__main__':
    a=argparse.ArgumentParser()
    a.add_argument('--repo',type=Path,default=Path('.'))
    a.add_argument('--approved',type=Path,required=True)
    a.add_argument('--crops',type=Path,required=True)
    v=a.parse_args()
    install(v.repo,v.approved,v.crops)
