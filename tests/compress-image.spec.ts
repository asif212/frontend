import {test,expect} from '@playwright/test';
test('camera image above 20 megapixels is resized before upload',async({page})=>{
 await page.goto('/app');
 const result=await page.evaluate(async()=>{
  const path='/src/compressImage.ts';const {compressImage}=await import(path);
  const canvas=document.createElement('canvas');canvas.width=6000;canvas.height=4000;
  canvas.getContext('2d')!.fillRect(0,0,6000,4000);
  const original=await new Promise<Blob>(resolve=>canvas.toBlob(blob=>resolve(blob!),'image/jpeg'));
  const compressed=await compressImage(new File([original],'camera.jpg',{type:'image/jpeg'}));
  const image=await createImageBitmap(compressed);
  const result={width:image.width,height:image.height,size:compressed.size,type:compressed.type};image.close();return result;
 });
 expect(result.width).toBe(2400);expect(result.height).toBe(1600);expect(result.size).toBeLessThan(5*1024*1024);expect(result.type).toBe('image/webp');
});
