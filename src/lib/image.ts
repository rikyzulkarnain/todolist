// Lampiran multimodal (base64 tanpa prefix data URL) untuk dikirim ke server
// action / AI. Dipakai composer log kegiatan & pop-up dokumentasi selesai.
export type Attachment = { mimeType: string; base64: string };

/**
 * Perkecil foto di sisi klien sebelum diunggah: sisi terpanjang maks 1280px,
 * JPEG kualitas 0.7. Menekan payload base64 (batas server action) sekaligus
 * ukuran objek Storage. Mengembalikan JPEG base64 siap unggah.
 */
export function downscaleImage(file: File, max = 1280): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no-canvas"));
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      resolve({ mimeType: "image/jpeg", base64: dataUrl.split(",")[1] ?? "" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("img-load"));
    };
    img.src = url;
  });
}
