/** PBKDF2-HMAC-SHA-256, 32-byte output, with a server-side password pepper.
 * Pure V8 compression avoids 1.2 million remote Utilities calls per login.
 * The test suite checks this implementation against Node's native crypto.
 */
const QC_SHA_K = [
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
];
const QC_SHA_INITIAL = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];

function qcFwRotateRight_(x, n) { return (x >>> n) | (x << (32 - n)); }
function qcFwCompressSha256_(state, block, w) {
  const k = QC_SHA_K;
  for (let i = 0; i < 16; i++) w[i] = block[i];
  for (let i = 16; i < 64; i++) {
    const a = w[i-15], b = w[i-2];
    const s0 = ((a>>>7)|(a<<25)) ^ ((a>>>18)|(a<<14)) ^ (a >>> 3);
    const s1 = ((b>>>17)|(b<<15)) ^ ((b>>>19)|(b<<13)) ^ (b >>> 10);
    w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
  }
  let a=state[0],b=state[1],c=state[2],d=state[3],e=state[4],f=state[5],g=state[6],h=state[7];
  for (let i = 0; i < 64; i++) {
    const s1 = ((e>>>6)|(e<<26)) ^ ((e>>>11)|(e<<21)) ^ ((e>>>25)|(e<<7));
    const t1 = (h + s1 + ((e & f) ^ (~e & g)) + k[i] + w[i]) | 0;
    const s0 = ((a>>>2)|(a<<30)) ^ ((a>>>13)|(a<<19)) ^ ((a>>>22)|(a<<10));
    const t2 = (s0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
    h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
  }
  state[0]=(state[0]+a)|0; state[1]=(state[1]+b)|0; state[2]=(state[2]+c)|0; state[3]=(state[3]+d)|0;
  state[4]=(state[4]+e)|0; state[5]=(state[5]+f)|0; state[6]=(state[6]+g)|0; state[7]=(state[7]+h)|0;
}

function qcFwPbkdf2Sha256_(keyBytes, saltBytes, iterations) {
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 2000000 || saltBytes.length > 51) throw new Error('Invalid KDF parameters.');
  let key = Array.from(keyBytes, b => b & 255);
  if (key.length > 64) key = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, key).map(b => b & 255);
  const w = new Int32Array(64), ipad = new Int32Array(16), opad = new Int32Array(16);
  for (let i=0;i<64;i++) {
    const k = key[i] || 0, shift = 24 - (i % 4) * 8;
    ipad[i >>> 2] |= (k ^ 0x36) << shift;
    opad[i >>> 2] |= (k ^ 0x5c) << shift;
  }
  const innerSeed = Int32Array.from(QC_SHA_INITIAL), outerSeed = Int32Array.from(QC_SHA_INITIAL);
  qcFwCompressSha256_(innerSeed, ipad, w); qcFwCompressSha256_(outerSeed, opad, w);
  const first = new Int32Array(16), block = new Int32Array(16);
  const input = Array.from(saltBytes, b => b & 255).concat([0,0,0,1]);
  input.forEach((b,i) => { first[i>>>2] |= b << (24-(i%4)*8); });
  first[input.length>>>2] |= 0x80 << (24-(input.length%4)*8);
  first[15] = (64 + input.length) * 8;
  block[8] = 0x80000000; block[15] = 768;
  const inner = new Int32Array(8), outer = new Int32Array(8), result = new Int32Array(8), u = new Int32Array(8);
  for (let iteration=0;iteration<iterations;iteration++) {
    for(let i=0;i<8;i++) { inner[i]=innerSeed[i]; outer[i]=outerSeed[i]; if(iteration) block[i]=u[i]; }
    qcFwCompressSha256_(inner, iteration ? block : first, w);
    for(let i=0;i<8;i++) block[i]=inner[i];
    qcFwCompressSha256_(outer, block, w);
    for(let i=0;i<8;i++) { u[i]=outer[i]; result[i]^=u[i]; }
  }
  const bytes=[];
  for(let i=0;i<8;i++) for(let shift=24;shift>=0;shift-=8) bytes.push((result[i]>>>shift)&255);
  return bytes;
}

