export type LibraryState = "on_disk" | "partially_on_disk" | "not_on_disk";

export interface GroupFilesOnDisk {
  groupId: number;
  filesOnDisk: number;
}

export function computeLibraryState(groups: GroupFilesOnDisk[]): LibraryState {
  if (groups.length === 0) return "not_on_disk";

  const allOnDisk = groups.every((g) => g.filesOnDisk > 0);
  if (allOnDisk) return "on_disk";

  const someOnDisk = groups.some((g) => g.filesOnDisk > 0);
  if (someOnDisk) return "partially_on_disk";

  return "not_on_disk";
}
