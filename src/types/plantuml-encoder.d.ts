declare module 'plantuml-encoder' {
  export function encode(text: string): string;
  export function decode(encoded: string): string;
}
