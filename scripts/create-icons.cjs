const sharp = require('sharp');
const path = require('node:path');
const fs = require('node:fs/promises');

async function main() {
  const assets = path.resolve(__dirname, '../public/assets');
  const source = path.resolve(process.argv[2] || path.join(assets, 'miaobagua-logo.png'));
  const metadata = await sharp(source).metadata();
  if (!metadata.width || metadata.width !== metadata.height) {
    throw new Error('Logo must be a square image. The source artwork is never cropped.');
  }

  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const frames = [];
  for (const size of sizes) {
    frames.push(await sharp(source).resize(size, size).png().toBuffer());
  }
  const directory = Buffer.alloc(6 + sizes.length * 16);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(sizes.length, 4);
  let offset = directory.length;
  sizes.forEach((size, index) => {
    const entry = 6 + index * 16;
    directory[entry] = directory[entry + 1] = size === 256 ? 0 : size;
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(frames[index].length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += frames[index].length;
  });

  await fs.writeFile(path.join(assets, 'app-icon.png'), frames.at(-1));
  await fs.writeFile(path.join(assets, 'app-icon.ico'), Buffer.concat([directory, ...frames]));
  console.log(`Exported MiaoBaGua PNG and Windows ICO from ${path.basename(source)}.`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
