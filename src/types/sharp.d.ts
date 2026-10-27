// sharp no expone sus tipos a través del mapa "exports" de package.json;
// se declara el subconjunto usado (verificación de imágenes en uploads).
declare module "sharp" {
  interface Metadata {
    format?: string;
    width?: number;
    height?: number;
    [key: string]: unknown;
  }

  interface Sharp {
    metadata(): Promise<Metadata>;
  }

  interface SharpConstructor {
    (input: Buffer): Sharp;
  }

  const sharp: SharpConstructor;
  export default sharp;
}
