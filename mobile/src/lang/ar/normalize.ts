// Arabic diacritic (harakat) + tatweel stripper. Grading is lenient about short vowels, so a typed
// bare word matches its fully-vowelled reading. Shared by the pack's toReading and its type-word view.
//
// U+0640 tatweel; U+064B-U+0655 tanwin/short vowels/shadda/sukun/maddah/hamza marks; U+0670 superscript
// alef. Escapes (not a literal range) so Arabic-Indic digits U+0660-U+0669 are never swallowed.
const HARAKAT = /[ـً-ٰٕ]/g

export function stripHarakat(s: string): string {
  return s.replace(HARAKAT, '')
}
