// Part masks in the 512-unit coordinate space. The paths define which region
// of the master drawing belongs to which bone. Coordinates are unchanged from
// the original so that the skeleton, IK and planted-paw tests keep working.
//
// The old version cut a raster bitmap with these paths and hacked in procedural
// arms. The new version receives pre-painted canvases from cat-artwork.js and
// only does the clipping; arms and elbows come as dedicated limb canvases.

export const CAT_PART_PATHS={
  head:'M70 40H410V255L348 258Q335 270 306 279Q230 286 187 273L153 260L70 261Z',
  scarf:'M151 264Q179 271 204 270Q246 277 279 278Q307 280 310 273Q323 279 309 299L298 307Q273 302 231 285L211 315L180 320L191 300Q165 306 141 278Z',
  tail:'M70 270H158L166 357Q164 389 196 401L206 435Q157 431 137 405L124 335L75 326Z',
  grip:'M282 311Q308 310 333 324L331 332Q348 325 355 342Q363 364 333 374L320 398Q300 405 270 390L276 375Q256 379 241 365L240 346Q257 337 279 347Z',
  hips:'M172 368Q210 357 248 370L272 374L309 370Q342 363 359 390L366 413L388 420V460H164Z',
  torso:'M218 273Q260 265 307 282Q332 300 339 341Q354 372 354 402Q274 417 169 405Q164 377 193 338Q210 315 218 273Z',
};

function masked(source,pathD){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d');ctx.clip(new Path2D(pathD));ctx.drawImage(source,0,0);return canvas;
}

// createCatParts now takes a pre-drawn 512×512 master canvas from
// cat-artwork.js rather than the old PNG sprite sheet.
export function createCatParts(source){
  const parts=Object.fromEntries(Object.entries(CAT_PART_PATHS).map(([name,pathD])=>[name,masked(source,pathD)]));
  return parts;
}
