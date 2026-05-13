const fs = require("fs");
let c = fs.readFileSync("src/components/ui/admin-dashboard.tsx", "utf8");

const hasSig = c.includes("uploadImage = async (file: File, oldUrl?: string): Promise<string>");
const hasNew = c.includes("Promise<{ url: string; previewUrl: string }>");
console.log("Has OLD uploadImage signature:", hasSig);
console.log("Has NEW uploadImage signature:", hasNew);

if (hasSig && !hasNew) {
  // Replace line by line using a regex approach
  const OLD_BLOCK_START = "  const uploadImage = async (file: File, oldUrl?: string): Promise<string> => {";
  const startIdx = c.indexOf(OLD_BLOCK_START);
  
  if (startIdx === -1) {
    console.log("ERROR: could not find start of uploadImage");
    process.exit(1);
  }

  // Find the closing }; of the function
  let depth = 0;
  let i = startIdx;
  let inFn = false;
  let endIdx = -1;
  
  while (i < c.length) {
    if (c[i] === '{') { depth++; inFn = true; }
    if (c[i] === '}') {
      depth--;
      if (inFn && depth === 0) {
        // Check if followed by ;
        let j = i + 1;
        while (j < c.length && (c[j] === ' ' || c[j] === '\r')) j++;
        if (c[j] === ';') {
          endIdx = j + 1;
          break;
        }
      }
    }
    i++;
  }

  if (endIdx === -1) {
    console.log("ERROR: could not find end of uploadImage");
    process.exit(1);
  }

  console.log("Function found from index", startIdx, "to", endIdx);
  console.log("Old function length:", endIdx - startIdx, "chars");

  const NEW_FN = `  /**
   * Upload pipeline — zero base64, zero localStorage blobs:
   *   1. compressToBlob (canvas WebP, no FileReader)
   *   2. Hard limit 500KB — friendly error if still too large
   *   3. Supabase Storage upload → CDN URL + cache-bust timestamp
   *   4. Offline: ObjectURL preview (session only, never persisted)
   */
  const uploadImage = async (file: File, oldUrl?: string): Promise<{ url: string; previewUrl: string }> => {
    // Step 1 — compress to WebP Blob (no base64)
    const { blob, previewUrl } = await compressToBlob(file);

    // Step 2 — hard size cap post-compression
    if (blob.size > SIZE_HARD_CAP) {
      URL.revokeObjectURL(previewUrl);
      throw new Error(
        \`A imagem ainda está muito pesada (\${Math.round(blob.size / 1024)}KB). \` +
        'Tente uma foto com resolução menor ou formato diferente.'
      );
    }

    // Step 3 — upload to Supabase Storage
    if (supabase) {
      const filePath = generateUniqueFileName();
      const { error } = await supabase.storage
        .from('product-images')
        .upload(filePath, blob, { contentType: 'image/webp', upsert: false });

      if (!error) {
        if (oldUrl) await deleteOldImage(oldUrl);
        const { data } = supabase.storage.from('product-images').getPublicUrl(filePath);
        URL.revokeObjectURL(previewUrl);
        const cdnUrl = \`\${data.publicUrl}?v=\${Date.now()}\`;
        return { url: cdnUrl, previewUrl: cdnUrl };
      }

      console.error('Supabase upload error:', error.message);
    }

    // Step 4 — offline graceful degradation
    // ObjectURL is valid this session only — NEVER stored in localStorage.
    console.warn('Supabase indisponível — usando prévia local (sessão apenas).');
    return { url: previewUrl, previewUrl };
  };`;

  const before = c.slice(0, startIdx);
  // Find the comment block just before the function (/** Upload principal ... */)
  const commentStart = c.lastIndexOf("  /** \r\n   * Upload", startIdx);
  const actualStart = commentStart !== -1 ? commentStart : startIdx;
  const after = c.slice(endIdx);

  c = before.slice(0, actualStart - before.length + before.length) + NEW_FN + after;
  // Simpler: just do startIdx replacement
  c = c.slice(0, actualStart) + NEW_FN + c.slice(endIdx);

  fs.writeFileSync("src/components/ui/admin-dashboard.tsx", c, "utf8");
  console.log("SUCCESS: uploadImage replaced!");
  console.log("New function has correct signature:", c.includes("Promise<{ url: string; previewUrl: string }>"));
} else if (hasNew) {
  console.log("ALREADY UP TO DATE: new signature found");
} else {
  console.log("ERROR: neither old nor new signature found");
}
