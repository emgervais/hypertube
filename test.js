// removeFirstByte.mjs
import { readFile, writeFile } from 'fs/promises';

const inputPath = 'src/server/movies/bunny.avi';
const inputPath2 = 'src/server/movies/real_bunny.avi';

try {
  const buffer = await readFile(inputPath);
  const buffer2 = await readFile(inputPath2);

  if (buffer.length < 2) {
    throw new Error('File is too short to remove first byte.');
  }
  let matchingBytes = 0;
  const minLength = Math.min(buffer.length, buffer2.length);
  
  for (let i = 0; i < minLength; i++) {
    if (buffer[i] === buffer2[i]) {
      matchingBytes++;
    } else {
      break;
    }
  }
  if (matchingBytes === minLength) {
    console.log('One buffer is a prefix of the other');
  }
  console.log(`Number of consecutive matching bytes from start: ${matchingBytes}`);
  console.log(`Buffer 1 length: ${buffer.length}`);
  console.log(`Buffer 2 length: ${buffer2.length}`);

} catch (err) {
  console.error('Error:', err.message);
}
