export interface FranchiseCollection {
  anidbId: string;
  franchiseTitle: string;
  members: string[];
}

export interface FranchiseIndexMetadata {
  datasetVersion: string;
  datasetDate: string;
  collectionCount: number;
}

export interface FranchiseIndex {
  getCollectionForAnidb(anidbId: string): Promise<FranchiseCollection | null>;

  getAllCollections(): Promise<FranchiseCollection[]>;

  getMetadata(): Promise<FranchiseIndexMetadata>;
}
