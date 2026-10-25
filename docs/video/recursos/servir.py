from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent.parent
class VideoHandler(SimpleHTTPRequestHandler):
 def __init__(self,*args,**kw):super().__init__(*args,directory=str(ROOT),**kw)
 def send_head(self):
  self.remaining=None
  path=Path(self.translate_path(self.path))
  requested=self.headers.get('Range')
  if requested and path.is_file():
   size=path.stat().st_size;match=re.fullmatch(r'bytes=(\d*)-(\d*)',requested)
   if match:
    first,last=match.groups();start=int(first) if first else max(0,size-int(last));end=min(int(last),size-1) if first and last else size-1
    if start>=size or end<start:
     self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.end_headers();return None
    source=path.open('rb');source.seek(start);self.remaining=end-start+1
    self.send_response(206);self.send_header('Content-Type',self.guess_type(str(path)));self.send_header('Content-Length',str(self.remaining));self.send_header('Content-Range',f'bytes {start}-{end}/{size}');self.send_header('Accept-Ranges','bytes');self.end_headers();return source
  return super().send_head()
 def end_headers(self):
  self.send_header('Accept-Ranges','bytes');super().end_headers()
 def copyfile(self,source,out):
  if self.remaining is None:return super().copyfile(source,out)
  while self.remaining:
   block=source.read(min(65536,self.remaining))
   if not block:break
   try:out.write(block)
   except (BrokenPipeError,ConnectionResetError):break
   self.remaining-=len(block)
if __name__=='__main__':ThreadingHTTPServer(('127.0.0.1',13008),VideoHandler).serve_forever()
