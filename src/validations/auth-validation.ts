import { z } from "zod";

export const magicLinkSchema = z.object({
  email: z.email("Alamat email tidak valid"),
});
