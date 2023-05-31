declare module 'rbush-knn' {
  import RTree from 'rbush';

  export default function knn<T>(
    tree: RTree<T>,
    x: number,
    y: number,
    z: number,
    predicate?: (item: T) => boolean,
    maxDistance?: number,
  ): T[];
}
