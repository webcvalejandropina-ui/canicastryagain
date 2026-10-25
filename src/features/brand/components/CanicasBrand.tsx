import Image from 'next/image';
import glass from '@/features/appearance/glassAssets.json';

export function CanicasBrand({tagline=false}:{tagline?:boolean}):React.ReactElement{
 return <a href="#inicio" className="canicas-brand" aria-label="Canicas Try Again, inicio">
  <span className="canicas-brand-mark" aria-hidden="true">
   <Image unoptimized src={glass.crystal} alt="" width={48} height={48}/>
   <span className="canicas-brand-satellite"/>
  </span>
  <span className="canicas-brand-wordmark">canicas<span className="canicas-brand-signature">try again.</span></span>
  {tagline&&<span className="canicas-brand-tagline">Una partida.<br/>Otra historia.</span>}
 </a>;
}
