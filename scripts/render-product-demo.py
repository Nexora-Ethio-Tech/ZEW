"""Render locally recorded product frames into a captioned, submission-size MP4."""
import json
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[1]
source = pathlib.Path('/tmp/zew-product-recording')
out = root / 'artifacts'
out.mkdir(exist_ok=True)
chapters = json.loads((source / 'chapters.json').read_text())
duration = chapters[-1]['end']

def stamp(t, srt=False):
    whole = int(t)
    fraction = int((t - whole) * (1000 if srt else 100))
    return f'{whole//3600:02}:{whole//60%60:02}:{whole%60:02}' + (f',{fraction:03}' if srt else f'.{fraction:02}')

ass = '''[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Chapter,Lato,26,&H00DAF4B6,&H00FFFFFF,&H001B3026,&H001B3026,-1,0,0,0,100,100,1,0,1,0,0,7,36,36,12,1
Style: Preview,Lato,22,&H00DAE4D9,&H00FFFFFF,&H001B3026,&H001B3026,0,0,0,0,100,100,1,0,1,0,0,9,36,36,14,1
Style: Caption,Lato,28,&H00FFFFFF,&H00FFFFFF,&H001B3026,&H001B3026,0,0,0,0,100,100,0,0,1,0,0,2,30,30,19,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
'''
srt = []
for i, ch in enumerate(chapters):
    a,b = stamp(ch['start']),stamp(ch['end'])
    ass += f"Dialogue: 0,{a},{b},Chapter,,0,0,0,,{{\\fad(180,120)}}{ch['title']}\n"
    ass += f"Dialogue: 0,{a},{b},Caption,,0,0,0,,{{\\fad(180,120)}}{ch['caption']}\n"
    srt.append(f"{i+1}\n{stamp(ch['start'],True)} --> {stamp(ch['end'],True)}\n{ch['caption']}\n")
ass += f'Dialogue: 0,0:00:00.00,{stamp(duration)},Preview,,0,0,0,,PRODUCT PREVIEW\n'
(source / 'captions.ass').write_text(ass)
(out / 'zew-product-demo.srt').write_text('\n'.join(srt))
filters = f"scale=1920:960:flags=lanczos,pad=1920:1080:0:56:color=0x1b3026,drawbox=x=0:y=53:w=iw:h=3:color=0xcfe99b:t=fill,ass={source}/captions.ass,fade=t=in:st=0:d=0.5,fade=t=out:st={duration-0.7:.3f}:d=0.7,format=yuv420p"
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-f','concat','-safe','0','-i',str(source / 'frames.txt'),'-vf',filters,'-r','24','-c:v','libx264','-threads','4','-preset','fast','-crf','23','-maxrate','2800k','-bufsize','5600k','-movflags','+faststart','-an','-metadata','title=Zew | Product walkthrough','-metadata','comment=Working product preview. Isolated test identities; staged matching and transport estimates; no real payments.',str(out / 'zew-product-demo.mp4')], check=True)
subprocess.run(['ffprobe','-v','error','-show_entries','format=duration,size:stream=codec_name,width,height,pix_fmt','-of','json',str(out/'zew-product-demo.mp4')], check=True)
