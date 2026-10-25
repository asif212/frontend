/** Resize before sending so camera originals fit the server's processing limits. */
export async function compressImage(file:File):Promise<File>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPEG, PNG or WebP image.');
 let bitmap:ImageBitmap;
 try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw new Error('This image could not be opened. Try exporting it as JPEG, PNG or WebP.');}
 try{
  const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));
  if(scale===1&&file.size<=5*1024*1024)return file;
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const context=canvas.getContext('2d');if(!context)throw new Error('Your browser could not prepare this image.');
  context.drawImage(bitmap,0,0,canvas.width,canvas.height);
  for(const quality of [.88,.75,.6,.45]){
   const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',quality));
   if(blob&&blob.size<=5*1024*1024)return new File([blob],file.name.replace(/\.[^.]+$/,'')+(blob.type==='image/webp'?'.webp':'.png'),{type:blob.type,lastModified:file.lastModified});
  }
  throw new Error('This image is still too large after compression. Please choose a smaller version.');
 }finally{bitmap.close();}
}
