/* 自主合成，无第三方素材。脚本与输出采用 CC0-1.0，见 README.md。 */
const fs = require('fs');
const path = require('path');
const rate = 16000;
const samples = Math.round(rate * 0.3);
const wav = Buffer.alloc(44 + samples * 2);
wav.write('RIFF', 0);
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); // PCM
wav.writeUInt16LE(1, 22); // mono
wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(samples * 2, 40);
for (let i = 0; i < samples; i += 1) {
  const t = i / rate;
  const envelope = Math.min(1, t / 0.015) * Math.max(0, 1 - t / 0.3);
  const tone = Math.sin(2 * Math.PI * 880 * t) * 0.7 + Math.sin(2 * Math.PI * 1320 * t) * 0.3;
  wav.writeInt16LE(Math.round(tone * envelope * 10000), 44 + i * 2);
}
fs.writeFileSync(path.join(__dirname, 'rest.wav'), wav);