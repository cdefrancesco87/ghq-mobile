/** Lower case and without accents, so «lunedi» finds «Lunedì». */
export const searchable = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();
