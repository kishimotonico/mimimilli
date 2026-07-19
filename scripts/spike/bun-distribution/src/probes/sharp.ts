import sharp from "sharp";

const image = await sharp({
  create: {
    background: { alpha: 1, b: 30, g: 20, r: 10 },
    channels: 4,
    height: 2,
    width: 2,
  },
})
  .png()
  .toBuffer();
const metadata = await sharp(image).metadata();

if (metadata.format !== "png" || metadata.width !== 2 || metadata.height !== 2) {
  throw new Error(`unexpected sharp metadata: ${JSON.stringify(metadata)}`);
}
console.log("sharp runtime probe: ok");
