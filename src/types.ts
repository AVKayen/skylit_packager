export type PhotoMetadata = Record<string, string | number | boolean>;

export type IndexEntry = {
    id: string;
    title: string;
    metadata: PhotoMetadata;
};

export type IndexSection = {
    title: string;
    entries: IndexEntry[];
};

export type Photo = {
    id: string;
    title: string;
    width: number;
    height: number;
    lqip: string;
    extension: string;
    column: 1 | 2 | 3;
    metadata: PhotoMetadata;
};

export type Section = {
    title: string;
    photos: Photo[];
};
