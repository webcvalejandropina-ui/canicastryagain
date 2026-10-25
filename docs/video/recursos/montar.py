from pathlib import Path
import subprocess,json,concurrent.futures,wave,struct,math,textwrap,os,tempfile
root=Path(__file__).resolve().parent.parent;tmp=Path(os.environ.get('CANICAS_VIDEO_TMP',str(Path(tempfile.gettempdir())/'canicas-video-render')));plan=json.loads((root/'guion/PLAN.json').read_text());layers={s['id']:s['sprites'] for s in json.loads((tmp/'layers.json').read_text())}
def run(a):
 p=subprocess.run(a,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 if p.returncode:raise RuntimeError(p.stderr.decode()[-6000:])
def dur(p):return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(p)]))
if not (tmp/'dado-real.mp4').exists():run(['ffmpeg','-y','-v','error','-i',str(root/'recursos/originales/dado-real.mkv'),'-c','copy',str(tmp/'dado-real.mp4')])
captions=[]
for s in plan:
 source=root/'audio'/(s['id']+'.aiff');d=dur(source);speed=max(1,d/(s['duration']-.15));speech=d/speed
 run(['ffmpeg','-v','error','-y','-i',str(source),'-af',f'atempo={speed},adelay=100,apad','-t',str(s['duration']),'-ar','48000','-ac','1',str(tmp/(s['id']+'.wav'))])
 words=s['voice'].split();chunks=[];chunk=[]
 for w in words:
  if len(' '.join(chunk+[w]))>60:chunks.append(' '.join(chunk));chunk=[]
  chunk.append(w)
 if chunk:chunks.append(' '.join(chunk))
 if len(chunks)>1 and len(chunks[-1].split())<3:
  prev=chunks[-2].split();last=chunks[-1].split();n=min(3,len(prev)//2);chunks[-2]=' '.join(prev[:-n]);chunks[-1]=' '.join(prev[-n:]+last)
 at=.1
 for c in chunks:
  span=speech*len(c.split())/len(words);captions.append({'id':s['id'],'a':at,'b':min(s['duration'],at+span),'text':c});at+=span
(tmp/'audio.txt').write_text(''.join(f"file '{tmp/(s['id']+'.wav')}'\n"for s in plan))
run(['ffmpeg','-v','error','-y','-f','concat','-safe','0','-i',str(tmp/'audio.txt'),'-af','loudnorm=I=-16:TP=-2:LRA=9','-ar','48000','-ac','1',str(root/'audio/LOCUCION.wav')])
with wave.open(str(root/'audio/LOCUCION.wav'),'rb')as f:sr=f.getframerate();samples=list(struct.unpack('<'+'h'*f.getnframes(),f.readframes(f.getnframes())))
# Composición sonora original, tenue, sin música de terceros.
chords=[(130.81,164.81,196),(110,130.81,164.81),(146.83,174.61,220),(98,123.47,146.83)]
for i in range(len(samples)):
 t=i/sr;en=max(0,min(1,t/1.8,(59-t)/2));ch=chords[int(t/8)%4];bed=0.003*en*sum(math.sin(2*math.pi*n*t)*(.7+.3*math.sin(.4*t+j))for j,n in enumerate(ch));samples[i]=max(-32000,min(32000,samples[i]+round(bed*32767)))
for at in [0.2,4.7,9.1,15.7,21.7,26.0,29.1,32.6,35.7,39.2,43.5,44,44.4,54.3]:
 for j in range(int(sr*.5)):
  t=j/sr;v=.026*math.exp(-11*t)*(math.sin(2*math.pi*1540*t)+.3*math.sin(2*math.pi*2820*t));k=round(at*sr)+j
  if k<len(samples):samples[k]=max(-32000,min(32000,samples[k]+round(v*32767)))
with wave.open(str(root/'audio/MEZCLA.wav'),'wb')as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(sr);f.writeframes(struct.pack('<'+'h'*len(samples),*samples))
def stamp(t):
 ms=round(t*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02},{ms%1000:03}'
(root/'guion/SUBTITULOS.srt').write_text(''.join(f'{i+1}\n{stamp(next(s["start"] for s in plan if s["id"]==c["id"])+c["a"])} --> {stamp(next(s["start"] for s in plan if s["id"]==c["id"])+c["b"])}\n{c["text"]}\n\n' for i,c in enumerate(captions)))
(root/'guion/SUBTITULOS.json').write_text(json.dumps(captions,ensure_ascii=False,indent=2))
run(['node',str(root/'recursos/subtitulos.mjs')])
def render(s):
 key=s['id'];out=tmp/(key+'.mp4')
 if os.environ.get('CANICAS_VIDEO_SCENES') and key not in os.environ['CANICAS_VIDEO_SCENES'].split(',') and out.exists():return out
 args=['ffmpeg','-y','-v','error','-filter_complex_threads','1','-loop','1','-framerate','30','-i',str(tmp/(key+'-base.png'))];nodes=['[0:v]fade=t=in:st=0:d=0.18:color=0xfffdf6[b0]'];last='b0';idx=0
 def inp(file):
  nonlocal idx
  idx+=1;args.extend(['-loop','1','-framerate','30','-i',str(file)]);return idx
 def overlay(i,pre='',x='0',y='0',enable=None):
  nonlocal last
  label=f's{i}'
  if pre:nodes.append(f'[{i}:v]{pre}[{label}]');source=label
  else:source=f'{i}:v'
  dest=f'b{i}';e=f":enable='{enable}'"if enable else'';nodes.append(f"[{last}][{source}]overlay=x='{x}':y='{y}'{e}[{dest}]");last=dest
 for sp in layers[key]:
  i=inp(tmp/(key+'-m'+str(sp['index'])+'.png'));pre="format=rgba,rotate=angle='0.025*sin(t*1.2+"+str(sp['index'])+")':fillcolor=none"
  x=str(sp['x']);y=f"{sp['y']}+{8 if sp.get('hero') else 2}*sin(t*1.3+{sp['index']})"
  if sp.get('delay'):pre+=f",fade=t=in:st={sp['delay']}:d=0.45:alpha=1"
  if sp.get('affected'):pre+=",fade=t="+('in'if sp.get('revive')else'out')+":st=1.0:d=0.45:alpha=1"
  if sp.get('ending'):pre+=',fade=t=out:st=1.6:d=0.5:alpha=1'
  if s['kind']=='manual':
   if sp['index']==0:x=f"{sp['x']}+730*(1-pow(1-min(max((t-4)/2.4,0),1),1.55))";pre+=',fade=t=out:st=6.35:d=0.25:alpha=1'
   else:pre+=f",fade=t=out:st={4+[0,.55,1.2,2][sp['index']]}:d=0.2:alpha=1"
  overlay(i,pre,x,y)
 if s['kind']=='select':
  i=inp(tmp/'pointer.png');overlay(i,x="if(lt(t,3.4),230+min(t/2.4,1)*220,490)",y="if(lt(t,3.4),1135,1390)",enable='between(t,.4,5.5)')
 if s['kind']=='dice':
  idx+=1;args.extend(['-i',str(tmp/'dado-real.mp4')]);overlay(idx,x='160',y='615')
 if s['kind']=='zoom':
  i=inp(tmp/'zoom.png');overlay(i,x='65',y='600',enable='gte(t,2.3)')
  i=inp(tmp/'pointer.png');overlay(i,x='490',y='840',enable='between(t,1.3,2.2)')
 if s['kind']=='worlds':
  for n,at in [(1,1.3),(2,2.7)]:
   i=inp(tmp/('world-'+str(n)+'.png'));overlay(i,pre=f'fade=t=in:st={at}:d=0.25:alpha=1',x='65',y='585',enable=f'gte(t,{at})')
 if s['kind']=='manual':
  i=inp(tmp/'pointer.png');overlay(i,x='135+730*min(max((t-.5)/2,0),1)',y='845',enable='between(t,.4,3.95)')
  nodes.append(f"[{last}]drawbox=x=85:y=1200:w=910:h=34:color=0x8aa336:t=fill:enable='between(t,3.8,4)'[forceflash]");last='forceflash'
  for n in range(28):
   at=.3+3.5*(n/28)**.78;w=round(910*(n+1)/28);label=f'force{n}';nodes.append(f"[{last}]drawbox=x=85:y=1200:w={w}:h=34:color=0x8aa336:t=fill:enable='between(t,{at:.3f},4)'[{label}]");last=label
 if s['kind']in ['hero','outro','warning']:
  i=inp(tmp/'spark.png');overlay(i,pre='fade=t=in:st=0.6:d=0.6:alpha=1,fade=t=out:st=2.1:d=0.7:alpha=1',x='750+10*sin(t)',y='650+10*cos(t)')
 for n,c in enumerate(captions):
  if c['id']==key:
   i=inp(tmp/(f'cap-{n}.png'));overlay(i,x='60',y='1710',enable=f"between(t,{c['a']:.4f},{c['b']:.4f})")
 i=inp(tmp/'progress.png');overlay(i,x=f'-1080+1080*({s["start"]}+t)/59',y='1900')
 args+=['-filter_complex',';'.join(nodes),'-map',f'[{last}]','-t',str(s['duration']),'-an','-c:v','libx264','-threads','2','-preset','veryfast','-crf','18','-pix_fmt','yuv420p',str(out)];run(args);print('Escena',key,'lista',flush=True);return out
with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:files=list(pool.map(render,plan))
(tmp/'video.txt').write_text(''.join(f"file '{f}'\n"for f in files));out=root/'CANICAS_COMO_JUGAR_59s.mp4'
run(['ffmpeg','-y','-v','error','-f','concat','-safe','0','-i',str(tmp/'video.txt'),'-i',str(root/'audio/MEZCLA.wav'),'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','192k','-t','59','-movflags','+faststart',str(out)])
run(['ffmpeg','-v','error','-y','-i',str(out),'-ss','1.8','-frames:v','1',str(root/'PORTADA.jpg')])
info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration,size:stream=codec_name,width,height,r_frame_rate','-of','json',str(out)]));assert abs(float(info['format']['duration'])-59)<.04;(root/'VERIFICACION.json').write_text(json.dumps(info,indent=2));print('MP4 COMPLETO',out,flush=True)
