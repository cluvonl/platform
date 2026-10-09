
import Image from 'next/image';
export async function prepareClubLogo(file:File):Promise<string>{
 if(file.size>2*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('INVALID_LOGO');
 const bitmap=await createImageBitmap(file);try{
  if(!bitmap.width||!bitmap.height)throw new Error('INVALID_LOGO');
  const ratio=Math.min(1,192/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
  const context=canvas.getContext('2d');if(!context)throw new Error('INVALID_LOGO');context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  for(const quality of [0.85,0.7,0.5,0.3]){const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',quality));if(blob?.type==='image/webp'&&blob.size<=24576)return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('INVALID_LOGO'));reader.readAsDataURL(blob);});}
  throw new Error('INVALID_LOGO');
 }finally{bitmap.close();}
}
export function LogoInput({id,name,value}:{id:string;name:string;value:unknown}){
 const current=typeof value==='string'&&(/^(?:\/brand\/|data:image\/webp;base64,)/.test(value))?value:'/brand/cluvo-logo.png';
 return <><Image src={current} alt="Huidig verenigingslogo" width={96} height={72} unoptimized style={{objectFit:'contain'}}/><input id={id} name={name} type="file" accept="image/png,image/jpeg,image/webp"/></>;
}
