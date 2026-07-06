export type SpaceRole = "owner" | "member" | "child";

export type SharedSpace = {
  id: string;
  type: "couple" | "family";
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
};

export type SpaceMember = {
  space_id: string;
  user_id: string;
  role: SpaceRole;
  display_name: string | null;
  created_at: string;
};

export type ShoppingItem = {
  id: string;
  space_id: string;
  name: string;
  checked: boolean;
  added_by: string | null;
  created_at: string;
};

/** Ruang berbagi lengkap dengan anggota & peran user saat ini. */
export type SpaceWithMembers = {
  space: SharedSpace;
  members: SpaceMember[];
  myRole: SpaceRole;
};
