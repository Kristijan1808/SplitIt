/** Inicijal ili profilna slika računa (ako je sudionik povezan s računom koji ima sliku). */
export function avInner(name: string, src?: string | null) {
  return src && src.startsWith("data:image/") ? <img src={src} alt="" /> : (name || "?").trim().charAt(0).toUpperCase();
}
