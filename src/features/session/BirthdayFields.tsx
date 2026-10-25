'use client';
import {useId} from 'react';
import {BIRTHDAY_MONTH_DAYS,type Birthday} from '@/shared/birthday';
const MONTHS=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
export function BirthdayFields({value,onChange,disabled=false}:{value:Birthday|null;onChange:(value:Birthday|null)=>void;disabled?:boolean}):React.ReactElement {
  const id=useId();
  return <div className="account-birthday-fields">
    <label className="birthday-enable"><input type="checkbox" checked={!!value} disabled={disabled} onChange={e=>{
      const parts=new Intl.DateTimeFormat('en',{timeZone:'Europe/Madrid',month:'numeric',day:'numeric'}).formatToParts(new Date());
      onChange(e.target.checked?{month:Number(parts.find(p=>p.type==='month')!.value),day:Number(parts.find(p=>p.type==='day')!.value)}:null);
    }}/> Personalizar mi cumpleaños</label>
    {value&&<div className="birthday-date">
      <label htmlFor={id+'-day'}>Día<select id={id+'-day'} aria-label="Día de cumpleaños" disabled={disabled} value={value.day} onChange={e=>onChange({...value,day:Number(e.target.value)})}>{Array.from({length:BIRTHDAY_MONTH_DAYS[value.month-1]},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
      <label htmlFor={id+'-month'}>Mes<select id={id+'-month'} aria-label="Mes de cumpleaños" disabled={disabled} value={value.month} onChange={e=>{const month=Number(e.target.value);onChange({month,day:Math.min(value.day,BIRTHDAY_MONTH_DAYS[month-1])});}}>{MONTHS.map((month,i)=><option key={month} value={i+1}>{month}</option>)}</select></label>
    </div>}
    <p>Solo día y mes, sin año de nacimiento. Tu cuenta tendrá fondo, canicas y dado de cumpleaños el día anterior, el propio día y el siguiente, en modo Automático.</p>
  </div>;
}
