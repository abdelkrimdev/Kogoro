export async function hashFile(filePath: string): Promise<string> {
  const file = Bun.file(filePath);
  const buffer = await file.arrayBuffer();
  const hash = new Bun.CryptoHasher("sha256");
  hash.update(new Uint8Array(buffer));
  return hash.digest("hex");
}
