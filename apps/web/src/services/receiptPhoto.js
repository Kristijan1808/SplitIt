// Open the native browser picker during the initiating click, before any request.
export async function choosePhoto(camera) {
  const file=await new Promise(resolve=>{
    const input=document.createElement("input");input.type="file";input.accept="image/*";
    if(camera)input.setAttribute("capture","environment");input.hidden=true;document.body.append(input);
    const done=value=>{input.remove();resolve(value)};
    input.onchange=()=>done(input.files?.[0]);input.oncancel=()=>done(null);input.click();
  });
  if(!file)return null;
  const url=URL.createObjectURL(file);
  try{
    const img=new Image();img.src=url;await img.decode();
    const ratio=Math.min(1,1800/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
    const ctx=canvas.getContext("2d");ctx.fillStyle="white";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    return canvas.toDataURL("image/jpeg",0.85).split(",")[1];
  }finally{URL.revokeObjectURL(url)}
}
